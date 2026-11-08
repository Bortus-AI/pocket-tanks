import { normalizeSavedRoom, canApplyCheckpoint, onlinePresenceText, hasUnsettledShot } from './session-state';
const checkpoint=(turnNumber,savedAt)=>({savedAt,state:{players:{host:{},player:{}},terrainPath:[],turnNumber}});
test('permanent membership migrates even an already expired legacy browser cache',()=>{
    const saved=normalizeSavedRoom({roomId:'room',sessionId:'session',role:'host',expiresAt:1});
    expect(saved).toMatchObject({roomId:'room',sessionId:'session',persistent:true,asynchronous:true});
    expect(saved.expiresAt).toBeUndefined();
    expect(normalizeSavedRoom({roomId:'room'})).toBeNull();
});
test('duplicate and stale checkpoints cannot roll back a new local shot',()=>{
    expect(canApplyCheckpoint(checkpoint(4,300),{turnNumber:3,savedAt:200},3)).toBe(true);
    expect(canApplyCheckpoint(checkpoint(4,200),{turnNumber:4,savedAt:200},4)).toBe(false);
    expect(canApplyCheckpoint(checkpoint(3,400),{turnNumber:4,savedAt:300},4)).toBe(false);
    expect(canApplyCheckpoint(checkpoint(4,400),{turnNumber:3,savedAt:300},5)).toBe(false);
});
test('an absent opponent does not hide the current player\'s available turn',()=>{
    const session={roomId:'room',role:'host',phase:'match',opponentAvailable:false,player:{name:'Pat'}};
    expect(onlinePresenceText(session,{activeTank:1})).toMatch(/YOUR TURN.*play now/);
    expect(onlinePresenceText(session,{activeTank:2})).toMatch(/TURN SAVED.*menu/);
    expect(onlinePresenceText({...session,phase:'draft'})).toMatch(/picks are saved/);
});

test('waiting for initial terrain can park without waiting for nonexistent physics',()=>{
    const scene={sys:{settings:{key:'main-scene'}},terrain:{path:[],animate:false,blastArray:[]},tank1:{settled:false,turret:{}},tank2:{settled:false,turret:{}}};
    expect(hasUnsettledShot(scene)).toBe(false);
    scene.terrain.path=[{x:0,y:300}];expect(hasUnsettledShot(scene)).toBe(true);
    scene.tank1.settled=scene.tank2.settled=true;expect(hasUnsettledShot(scene)).toBe(false);
    scene.tank1.turret.activeWeapon={id:0};expect(hasUnsettledShot(scene)).toBe(true);
});
