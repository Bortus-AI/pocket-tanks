import { applyOnlineSnapshot, onlineSession } from './session';
import { exportTactics } from '../weapons/expansion/tactics';

const makeScene=role=>{
    const tank=()=>({body:{updateFromGameObject:jest.fn(),stop:jest.fn(),setGravity:jest.fn()},turret:{activeWeapon:null,setRelativeRotation:jest.fn()},setPosition(x,y){this.x=x;this.y=y;return this;},setRotation(rotation){this.rotation=rotation;return this;},setPower(power){this.power=power;},score:0});
    return {sceneData:{gameType:3,onlineRole:role},tank1:tank(),tank2:tank(),terrain:{setPath:jest.fn(),multiplayerCorrection:jest.fn(),save:jest.fn()}};
};
test.each(['host','player'])('saved deployables retain allegiance and ammunition from the %s perspective',role=>{
    Object.assign(onlineSession,{role,matchId:'devices-match'});
    const scene=makeScene(role),player={weapons:[{id:0}],selectedWeapon:0,movesRemaining:4,x:100,y:200,rotation:0,power:60,turretRotation:0,score:0};
    const device={id:6,kind:'sentry',owner:1,x:300,y:220,heading:1,ammo:4,heat:2,health:18,ttl:5,armedAt:2,lastReaction:3,lastBoundary:3,buried:false,lock:null};
    const snapshot={role:'host',state:{matchId:'devices-match',turnNumber:3,activeRole:'player',terrainPath:[{x:0,y:220}],terrainMask:{},players:{host:player,player:{...player,x:800}},tacticsRole:'host',tactics:{shot:3,states:[{},{}],scores:[0,0],zones:[],devices:[device],nextDevice:7}}};
    expect(applyOnlineSnapshot(scene,snapshot)).toBe(true);
    expect(scene.tacticalWorld.devices[0].owner).toBe(role==='host'?scene.tank1:scene.tank2);
    expect(scene.tacticalWorld.devices[0]).toMatchObject({ammo:4,heat:2,lastReaction:3,lastBoundary:3});
    const saved=exportTactics(scene);expect(saved.devices[0].owner).toBe(role==='host'?1:2);expect(saved.nextDevice).toBe(7);
});
