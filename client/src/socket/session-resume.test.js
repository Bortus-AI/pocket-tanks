const SESSION_ID='direct-current-session-1234';
let session,socket,listeners,sent;
const makeScene=()=>{
    const makeTank=x=>({name:'Tank',color:0x6eaa99,weapons:[{id:0,name:'Single Shot',type:0}],selectedWeapon:0,power:60,rotation:0,turret:{relativeRotation:0,activeWeapon:null},score:0,x,y:300,movesRemaining:4,settled:true,active:true});
    return {sceneData:{gameType:3},tank1:makeTank(200),tank2:makeTank(900),activeTank:2,gameOver:false,terrain:{path:[{x:0,y:300}],exportMask:()=>({runs:[1],values:[1]}),layoutKind:'hills',animate:false,blastArray:[]}};
};
beforeEach(()=>{
    jest.resetModules();jest.useFakeTimers();document.body.innerHTML='';
    Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=>SESSION_ID}});
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
    window.game={scene:{getScenes:()=>[],start:jest.fn(),stop:jest.fn()}};
    session=require('./session');listeners=new Map();sent=[];
    socket={connected:true,auth:{sessionId:SESSION_ID},on(event,handler){listeners.set(event,handler);return this;},listeners:()=>[],
        emit(event,data,ack){sent.push({event,data,ack});return this;},
        disconnect:jest.fn(function(){this.connected=false;return this;}),connect:jest.fn(function(){return this;})};
    session.installOnlineSession(socket);
    Object.assign(session.onlineSession,{sessionId:SESSION_ID,roomId:'current-room',role:'host',playerId:'current-player',phase:'match',paused:false,restoring:false});
});
afterEach(()=>{jest.clearAllTimers();jest.useRealTimers();document.body.innerHTML='';});

test('connected suspended player can resume directly with a full-size overlay button',()=>{
    listeners.get('sessionPaused')({roomId:'current-room',role:'host',reason:'background'});
    const resume=document.querySelector('#online-connection-status .resume-match');
    expect(resume.textContent).toBe('RESUME MATCH');expect(parseInt(resume.style.minHeight,10)).toBeGreaterThanOrEqual(44);
    resume.click();
    expect(sent.map(message=>message.event)).toContain('resumeSession');
    expect(sent.map(message=>message.event)).not.toContain('requestRoomSession');
    expect(sent.map(message=>message.event)).not.toContain('leaveRoom');
    expect(socket.connect).not.toHaveBeenCalled();expect(socket.disconnect).not.toHaveBeenCalled();
    expect(session.onlineSession).toMatchObject({roomId:'current-room',playerId:'current-player',parked:false,restoring:true});
    expect(window.game.scene.start).not.toHaveBeenCalled();
});

test('disconnected retry reconnects and resumes the same room without visiting the menu',()=>{
    socket.connected=false;listeners.get('disconnect')();
    document.querySelector('#online-connection-status .resume-match').click();
    expect(socket.auth.sessionId).toBe(SESSION_ID);expect(socket.connect).toHaveBeenCalledTimes(1);
    socket.connected=true;listeners.get('connect')();
    expect(sent.map(message=>message.event)).toContain('resumeSession');
    expect(session.onlineSession.roomId).toBe('current-room');expect(session.onlineSession.playerId).toBe('current-player');
    expect(window.game.scene.start).not.toHaveBeenCalled();
});

test('direct resume retains and retries an unconfirmed completed turn before restoring',async()=>{
    const scene=makeScene();scene.tank1.score=70;
    const failed=session.saveOnlineMatch(scene,{force:true});
    sent.find(message=>message.event==='saveMatch').ack({ok:false,message:'Temporary save failure'});await failed;
    listeners.get('sessionPaused')({roomId:'current-room',role:'host',reason:'background'});
    document.querySelector('#online-connection-status .resume-match').click();
    listeners.get('roomSession')({sessionId:SESSION_ID,roomId:'current-room',role:'host',playerId:'current-player',phase:'match',resumed:true,paused:false});
    const retries=sent.filter(message=>message.event==='saveMatch');
    expect(retries).toHaveLength(2);expect(retries[1].data.state.players.host.score).toBe(70);
    expect(retries[1].data.state.activeRole).toBe('player');
    expect(window.game.scene.start).not.toHaveBeenCalled();
});

test('resume waits for an in-flight completed-turn acknowledgement before requesting fresh state',async()=>{
    const scene=makeScene();scene.tank1.score=95;
    const pending=session.saveOnlineMatch(scene,{force:true});
    listeners.get('sessionPaused')({roomId:'current-room',role:'host',reason:'background'});
    document.querySelector('#online-connection-status .resume-match').click();
    listeners.get('roomSession')({sessionId:SESSION_ID,roomId:'current-room',role:'host',playerId:'current-player',phase:'match',resumed:true,paused:false});
    expect(sent.filter(message=>message.event==='saveMatch')).toHaveLength(1);
    expect(window.game.scene.start).not.toHaveBeenCalled();
    expect(sent.filter(message=>message.event==='requestRoomSession')).toHaveLength(0);
    sent.find(message=>message.event==='saveMatch').ack({ok:true,savedAt:700});await pending;
    expect(sent.filter(message=>message.event==='requestRoomSession')).toHaveLength(1);
    expect(session.onlineSession).toMatchObject({roomId:'current-room',playerId:'current-player',persistenceStatus:'saved'});
});


test('End Match leaves the server room, clears local membership and returns to the main menu',()=>{
    listeners.get('sessionPaused')({roomId:'current-room',role:'host',reason:'background'});
    const end=document.querySelector('#online-connection-status .end-match');
    expect(parseInt(end.style.minHeight,10)).toBeGreaterThanOrEqual(44);
    end.click();
    expect(sent.map(message=>message.event)).toContain('leaveRoom');
    expect(session.onlineSession.roomId).toBeUndefined();
    expect(document.querySelector('#online-connection-status')).toBeNull();
    expect(window.game.scene.start).toHaveBeenCalledWith('scene-1');
    expect(window.game.scene.start).not.toHaveBeenCalledWith('scene-4',expect.anything());
});

test('transient unavailable and another-tab takeover retain a direct Resume and saved membership',()=>{
    session.resumeOnlineMatch();
    listeners.get('sessionUnavailable')({roomId:'current-room',sessionId:SESSION_ID,message:'Storage temporarily unavailable'});
    expect(session.onlineSession.roomId).toBe('current-room');
    expect(document.querySelector('.resume-match')).not.toBeNull();
    listeners.get('sessionReplaced')({roomId:'current-room',sessionId:SESSION_ID});
    expect(session.resumableOnlineRoom()).toMatchObject({roomId:'current-room',sessionId:SESSION_ID});
    document.querySelector('.resume-match').click();
    expect(sent.filter(message=>message.event==='resumeSession')).toHaveLength(2);
    expect(window.game.scene.start).not.toHaveBeenCalled();
});

test('only a scoped definitive missing-room reply can remove the current Resume',()=>{
    listeners.get('sessionUnavailable')({roomId:'old-room',sessionId:SESSION_ID,definitive:true,code:'SESSION_NOT_FOUND'});
    listeners.get('opponentLeft')({roomId:'old-room',sessionId:SESSION_ID});
    expect(session.onlineSession.roomId).toBe('current-room');
    listeners.get('sessionUnavailable')({roomId:'current-room',sessionId:SESSION_ID,definitive:true,code:'SESSION_NOT_FOUND'});
    expect(session.onlineSession.roomId).toBeUndefined();
});

test('late room presence cannot overwrite canonical state or cancel local recovery',()=>{
    Object.assign(session.onlineSession,{matchId:'match-2',turn:{number:4,activeRole:'host'},snapshot:{savedAt:900},restoring:true});
    listeners.get('roomState')({roomId:'current-room',phase:'match',matchId:'match-1',turn:{number:1,activeRole:'player'},snapshot:{savedAt:100},restoring:false,player:{name:'Pat'},opponentAvailable:true});
    expect(session.onlineSession).toMatchObject({matchId:'match-2',turn:{number:4},snapshot:{savedAt:900},restoring:true,opponentAvailable:true});
});

test('a duplicate room status during an executing shot cannot queue an old-baseline restore',()=>{
    const scene=makeScene();scene.sys={settings:{key:'main-scene'}};
    scene.scene={isActive:()=>true,isPaused:()=>false};scene.tank1.turret.activeWeapon={id:0};
    window.game.scene.getScenes=()=>[scene];
    Object.assign(session.onlineSession,{matchId:'current-match',turn:{number:2,activeRole:'host',pendingShotId:'accepted-shot'},pendingShot:{shotId:'accepted-shot'}});
    listeners.get('roomSession')({sessionId:SESSION_ID,roomId:'current-room',matchId:'current-match',role:'host',resumed:true,paused:false,phase:'match',turn:{number:2,activeRole:'host',pendingShotId:null},pendingShot:null,snapshot:{savedAt:200}});
    expect(session.onlineSession.pendingShot.shotId).toBe('accepted-shot');
    expect(session.onlineSession.turn.pendingShotId).toBe('accepted-shot');
    expect(window.game.scene.start).not.toHaveBeenCalled();expect(session.onlineSession.restoring).toBe(false);
    jest.advanceTimersByTime(500);expect(window.game.scene.start).not.toHaveBeenCalled();
});
