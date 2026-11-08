import { installOnlineSession, onlineSession, saveOnlineMatch } from './session';

test('only acknowledged changed checkpoints become committed, and failed saves remain retryable',async()=>{
    jest.useFakeTimers();
    Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=> 'test-online-session-1234'}});
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
    const requests=[];
    const socket={connected:true,auth:{},on:jest.fn(),listeners:()=>[],emit(event,data,ack){if(event==='saveMatch')requests.push({data,ack});return this;}};
    installOnlineSession(socket);
    Object.assign(onlineSession,{roomId:'durable-room',role:'host',playerId:'host',phase:'match',paused:false,restoring:false});
    const makeTank=x=>({name:'Tank',color:'#abc',weapons:[{id:0,name:'Single Shot',type:0}],selectedWeapon:0,power:60,rotation:0,turret:{relativeRotation:0,activeWeapon:null},score:0,x,y:300,movesRemaining:4,settled:true,active:true});
    const scene={sceneData:{gameType:3},tank1:makeTank(200),tank2:makeTank(900),activeTank:1,gameOver:false,terrain:{path:[{x:0,y:300}],exportMask:()=>({runs:[1],values:[1]}),layoutKind:'hills',animate:false,blastArray:[]}};
    const first=saveOnlineMatch(scene,{force:true});const repeated=saveOnlineMatch(scene,{force:true});
    expect(requests).toHaveLength(1);expect(repeated).toBe(first);expect(onlineSession.persistenceStatus).toBe('saving');
    requests[0].ack({ok:true,savedAt:100});await first;
    expect(onlineSession.persistenceStatus).toBe('saved');
    expect(await saveOnlineMatch(scene,{force:true})).toMatchObject({ok:true,unchanged:true});expect(requests).toHaveLength(1);
    scene.tank1.score=30;scene.activeTank=2;scene.tank1.active=false;
    const failed=saveOnlineMatch(scene,{force:true});requests[1].ack({ok:false,message:'Disk unavailable'});await failed;
    expect(onlineSession.persistenceStatus).toBe('error');
    jest.advanceTimersByTime(3100);
    expect(requests).toHaveLength(3);
    expect(requests[2].data.state.activeRole).toBe('player');
    expect(requests[2].data.state.players.host.score).toBe(30);
    requests[2].ack({ok:true,savedAt:200});await Promise.resolve();
    expect(onlineSession.persistenceStatus).toBe('saved');
    jest.clearAllTimers();jest.useRealTimers();
});
