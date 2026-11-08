let session,listeners,sent,socket,scene;
beforeEach(()=>{
 jest.resetModules();jest.useFakeTimers();sessionStorage.clear();localStorage.clear();document.body.innerHTML='';
 Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=> 'shot-token'}});
 Object.defineProperty(document,'hidden',{configurable:true,value:false});
 window.game={scene:{getScenes:()=>[],start:jest.fn(),stop:jest.fn()}};
 session=require('./session');listeners=new Map();sent=[];
 socket={connected:true,auth:{sessionId:'shot-token'},on(event,handler){listeners.set(event,handler);return this;},listeners:()=>[],emit(event,data,ack){sent.push({event,data,ack});return this;}};
 session.installOnlineSession(socket);
 Object.assign(session.onlineSession,{sessionId:'shot-token',roomId:'room',role:'host',phase:'match',matchId:'match',turn:{number:3,activeRole:'host'},paused:false,restoring:false});
 const tank=x=>({name:'Tank',color:1,weapons:[{id:0}],selectedWeapon:0,power:60,rotation:0,turret:{relativeRotation:0,activeWeapon:null,setRelativeRotation:jest.fn()},score:0,x,y:300,movesRemaining:4,settled:true,active:true,setPosition:jest.fn(),setRotation:jest.fn(),setPower:jest.fn(),shoot:jest.fn(()=>true)});
 scene={sceneData:{gameType:3},onlineMatchId:'match',onlineTurnNumber:3,tank1:tank(200),tank2:tank(900),activeTank:1,gameOver:false,HUD:{weaponScrollDisplay:{reset:jest.fn()}},terrain:{path:[{x:0,y:300}],exportMask:()=>({runs:[1],values:[1]}),layoutKind:'hills',animate:false,blastArray:[]}};
});
afterEach(()=>{jest.clearAllTimers();jest.useRealTimers();});
const packet={selectedWeapon:0,power:70,rotation:1,rotation1:0,rotation2:0,position1:{x:200,y:300},position2:{x:900,y:300}};

test('one shot request waits for durable baseline and unique server grant before local simulation',async()=>{
 const request=session.requestOnlineShot(scene,packet);
 expect(session.requestOnlineShot(scene,packet)).toBe(request);
 expect(sent.map(r=>r.event)).toEqual(['saveMatch']);expect(scene.tank1.shoot).not.toHaveBeenCalled();
 sent[0].ack({ok:true,savedAt:100});await Promise.resolve();await Promise.resolve();
 const shoot=sent.find(r=>r.event==='shoot');expect(shoot.data).toMatchObject({matchId:'match',turnNumber:3,shotId:'shot-token'});
 shoot.ack({ok:true,shotId:'shot-token'});expect(await request).toMatchObject({ok:true,shotId:'shot-token'});
 expect(scene.onlineShotId).toBe('shot-token');expect(scene.tank1.shoot).not.toHaveBeenCalled();
 scene.activeTank=2;
 const completion=session.saveOnlineMatch(scene,{force:true});const save=sent.filter(r=>r.event==='saveMatch')[1];
 expect(save.data).toMatchObject({matchId:'match',completedShotId:'shot-token',state:{turnNumber:4,activeRole:'player'}});
 save.ack({ok:true,savedAt:200,turn:{number:4,activeRole:'player'}});await completion;
 expect(scene.onlineShotId).toBeNull();expect(scene.onlineTurnNumber).toBe(4);expect(session.onlineSession.turn.number).toBe(4);
});

test('failed durable baseline never emits a shot',async()=>{
 const pending=session.requestOnlineShot(scene,packet);sent[0].ack({ok:false,message:'Disk unavailable'});
 expect(await pending).toMatchObject({ok:false});expect(sent.some(r=>r.event==='shoot')).toBe(false);
});

test('shot IDs remain valid server tokens when randomUUID is unavailable',async()=>{
 Object.defineProperty(window,'crypto',{configurable:true,value:{getRandomValues:values=>values.fill(0)}});
 const request=session.requestOnlineShot(scene,packet);
 sent[0].ack({ok:true,savedAt:100});await Promise.resolve();await Promise.resolve();
 const shoot=sent.find(r=>r.event==='shoot');
 expect(shoot.data.shotId).toMatch(/^[a-zA-Z0-9_-]{16,128}$/);
 shoot.ack({ok:true});expect(await request).toMatchObject({ok:true});
});

const startRematch=()=>{
 listeners.get('playAgain')({});
 listeners.get('startGame')({matchId:'rematch',turn:{number:0,activeRole:'host'}});
 scene.onlineMatchId='rematch';scene.onlineTurnNumber=0;scene.onlineShotId=null;scene.gameOver=false;scene.tank1.score=0;
};

test('a rematch discards timed-out completed-turn retries and can fire from a fresh baseline',async()=>{
 scene.onlineShotId='completed-shot';scene.onlineShotTurnNumber=3;scene.gameOver=true;scene.tank1.score=100;
 const oldSave=session.saveOnlineMatch(scene,{force:true});
 jest.advanceTimersByTime(12000);expect(await oldSave).toMatchObject({ok:false});
 startRematch();
 const request=session.requestOnlineShot(scene,packet);
 const saves=sent.filter(r=>r.event==='saveMatch');expect(saves).toHaveLength(2);
 expect(saves[1].data).toMatchObject({matchId:'rematch',state:{turnNumber:0,gameOver:false,players:{host:{score:0}}}});
 expect(saves[1].data.completedShotId).toBeUndefined();
 saves[1].ack({ok:true,savedAt:200});await Promise.resolve();await Promise.resolve();
 const shoot=sent.find(r=>r.event==='shoot');expect(shoot.data.matchId).toBe('rematch');
 shoot.ack({ok:true});expect(await request).toMatchObject({ok:true});
 jest.advanceTimersByTime(15000);expect(sent.filter(r=>r.event==='saveMatch')).toHaveLength(2);
});

test.each(['success','failure','timeout'])('an old-match %s cannot alter a rematch save or restore its retry state',async outcome=>{
 scene.onlineShotId='completed-shot';scene.onlineShotTurnNumber=3;scene.gameOver=true;
 const oldSave=session.saveOnlineMatch(scene,{force:true}),oldRequest=sent[0];
 startRematch();
 const freshSave=session.saveOnlineMatch(scene,{force:true});
 const freshRequest=sent.filter(r=>r.event==='saveMatch')[1];expect(freshRequest.data.matchId).toBe('rematch');
 if(outcome==='timeout')jest.advanceTimersByTime(11000);
 else oldRequest.ack(outcome==='success'?{ok:true,savedAt:100,turn:{number:4,activeRole:'player'}}:{ok:false,message:'Old save failed'});
 expect(session.onlineSession.persistenceStatus).toBe('saving');
 expect(session.onlineSession.turn).toEqual({number:0,activeRole:'host'});
 freshRequest.ack({ok:true,savedAt:200});await freshSave;
 if(outcome==='timeout')jest.advanceTimersByTime(1000);
 await oldSave;
 expect(session.onlineSession.persistenceStatus).toBe('saved');
 expect(await session.saveOnlineMatch(scene,{force:true})).toMatchObject({ok:true,unchanged:true,savedAt:200});
 jest.advanceTimersByTime(15000);expect(sent.filter(r=>r.event==='saveMatch')).toHaveLength(2);
});

test('a late failure during the rematch draft cannot restore an old checkpoint retry',async()=>{
 const oldSave=session.saveOnlineMatch(scene,{force:true});
 listeners.get('playAgain')({});
 sent[0].ack({ok:false,message:'Old save failed'});await oldSave;
 jest.advanceTimersByTime(15000);
 expect(sent.filter(r=>r.event==='saveMatch')).toHaveLength(1);
 expect(session.onlineSession.persistenceStatus).toBeUndefined();
});

test.each(['roomSession','startGame'])('%s discards failed checkpoints when the match changes',async event=>{
 const oldSave=session.saveOnlineMatch(scene,{force:true});
 sent[0].ack({ok:false,message:'Old save failed'});await oldSave;
 listeners.get(event)({sessionId:'shot-token',roomId:'room',role:'host',phase:'match',matchId:'rematch',turn:{number:0,activeRole:'host'}});
 scene.onlineMatchId='rematch';scene.onlineTurnNumber=0;
 const freshSave=session.saveOnlineMatch(scene,{force:true});
 const freshRequest=sent.filter(r=>r.event==='saveMatch')[1];
 expect(freshRequest.data.matchId).toBe('rematch');
 freshRequest.ack({ok:true,savedAt:200});expect(await freshSave).toMatchObject({ok:true});
});

test('a forced save queued behind an old checkpoint cannot submit after a rematch',async()=>{
 const oldSave=session.saveOnlineMatch(scene,{force:true});
 scene.tank1.score=50;
 const queuedSave=session.saveOnlineMatch(scene,{force:true});
 startRematch();
 sent[0].ack({ok:true,savedAt:100});await oldSave;
 expect(await queuedSave).toMatchObject({ok:false,skipped:true});
 expect(sent.filter(r=>r.event==='saveMatch')).toHaveLength(1);
});

test('remote and restored accepted shots simulate once and reject old match/epoch packets',()=>{
 session.onlineSession.turn.activeRole='player';
 const incoming={...packet,matchId:'match',turnNumber:3,shotId:'remote-shot',role:'player'};
 expect(session.acceptOnlineShot(scene,{...incoming,matchId:'old-match'})).toBe(false);
 expect(session.acceptOnlineShot(scene,{...incoming,turnNumber:2})).toBe(false);
 expect(session.acceptOnlineShot(scene,incoming)).toBe(true);expect(session.acceptOnlineShot(scene,incoming)).toBe(false);
 expect(scene.tank2.shoot).toHaveBeenCalledTimes(1);expect(scene.tank1.shoot).not.toHaveBeenCalled();
 expect(scene.onlineShotId).toBeUndefined();
 // A recovered own reservation replays using its original id and is eligible
 // to commit the resulting turn, without requesting a second server grant.
 const replay={...incoming,shotId:'own-recovery',role:'host',data:packet};
 session.onlineSession.turn.activeRole='host';
 expect(session.acceptOnlineShot(scene,replay)).toBe(true);expect(scene.tank1.shoot).toHaveBeenCalledTimes(1);
 expect(scene.onlineShotId).toBe('own-recovery');expect(scene.onlineShotTurnNumber).toBe(3);
 expect(sent.some(r=>r.event==='shoot')).toBe(false);
});

test('a wrong actor or failed simulation does not consume an accepted shot id',()=>{
 const incoming={...packet,matchId:'match',turnNumber:3,shotId:'retryable',role:'player'};
 expect(session.acceptOnlineShot(scene,incoming)).toBe(false);
 session.onlineSession.turn.activeRole='player';scene.tank2.shoot.mockReturnValueOnce(false);
 expect(session.acceptOnlineShot(scene,incoming)).toBe(false);
 expect(session.acceptOnlineShot(scene,incoming)).toBe(true);
 expect(scene.tank2.shoot).toHaveBeenCalledTimes(2);
});

test('a delayed checkpoint from a previous match cannot replace current match authority',()=>{
 listeners.get('matchCheckpoint')({roomId:'room',matchId:'previous-match',turn:{number:9,activeRole:'player'},snapshot:{savedAt:900,state:{turnNumber:9,terrainPath:[],players:{host:{},player:{}}}}});
 expect(session.onlineSession.matchId).toBe('match');expect(session.onlineSession.turn).toMatchObject({number:3,activeRole:'host'});
 expect(session.onlineSession.snapshot).toBeUndefined();
});

test('duplicate grant acknowledgement requests canonical recovery without simulating a second shot',async()=>{
 const request=session.requestOnlineShot(scene,packet);sent[0].ack({ok:true,savedAt:100});await Promise.resolve();await Promise.resolve();
 sent.find(r=>r.event==='shoot').ack({ok:true,duplicate:true,shotId:'shot-token'});
 expect(await request).toMatchObject({ok:true,duplicate:true});
 expect(scene.tank1.shoot).not.toHaveBeenCalled();expect(scene.onlineShotId).toBeUndefined();
 expect(sent.some(r=>r.event==='requestRoomSession')).toBe(true);
});
