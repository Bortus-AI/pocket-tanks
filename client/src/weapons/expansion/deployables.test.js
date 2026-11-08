import { deploySentries, deployMissileSilo, deployRunGun, advanceDeployables, exportDeployables, importDeployables, damageDeployables, disruptDeployables } from './deployables';
import { beginTacticalShot, exportTactics, importTactics, scoreHit, worldState } from './tactics';
const tank=x=>({x,y:200,centre:{x,y:187},score:0,tactics:{shield:0},isPointInside:(px,py)=>Math.abs(px-x)<10&&Math.abs(py-187)<10,updateScore(points){this.score+=points;}});
const fixture=()=>{
 const a=tank(40),b=tank(280),ctx=Object.fromEntries(['save','restore','beginPath','arc','fill'].map(name=>[name,jest.fn()]));
 const scene={tank1:a,tank2:b,terrain:{width:1200,height:500,getPixel:(x,y)=>({alpha:y>=200?255:0}),context:ctx,update:jest.fn(),fixTerrain:jest.fn()}};
 worldState(scene);return scene;
};
const step=scene=>beginTacticalShot(scene,scene.tank1);

test('twin sentries deploy real persistent devices and arm for later shot boundaries',()=>{
 const scene=fixture(),devices=deploySentries(scene,scene.tank1,{x:120,y:200},1);
 expect(devices).toHaveLength(2);expect(devices.map(d=>d.x)).toEqual([100,140]);expect(scene.tank1.score).toBe(0);
 step(scene);expect(scene.tank1.score).toBe(24);expect(devices.map(d=>d.ammo)).toEqual([4,4]);
 step(scene);expect(scene.tank1.score).toBe(48);
 step(scene);expect(scene.tank1.score).toBe(48);expect(devices.map(d=>d.heat)).toEqual([1,1]);
 step(scene);expect(scene.tank1.score).toBe(72);expect(worldState(scene).devices).toHaveLength(0);
});

test('sentry cone, range and real terrain block fire; friendly interception costs owner points',()=>{
 const scene=fixture(),[device]=deploySentries(scene,scene.tank1,{x:120,y:200},-1);scene.tacticalWorld.devices=[device];
 step(scene);expect(scene.tank1.score).toBe(0);device.heading=1;
 scene.terrain.getPixel=(x,y)=>({alpha:y>=200||(x>200&&x<210)?255:0});step(scene);expect(scene.tank1.score).toBe(0);
 scene.terrain.getPixel=(x,y)=>({alpha:y>=200?255:0});
 scene.tank1.isPointInside=(x,y)=>x>170&&x<190&&y>177&&y<196;
 step(scene);expect(scene.tank1.score).toBe(-12);
});

test('burial suppresses devices and excavating their foundation can wreck them',()=>{
 const scene=fixture(),[device]=deploySentries(scene,scene.tank1,{x:120,y:200},1);scene.tacticalWorld.devices=[device];
 scene.terrain.getPixel=(x,y)=>({alpha:y>=180?255:0});step(scene);expect(device.buried).toBe(true);expect(device.ammo).toBe(6);
 scene.terrain.getPixel=(x,y)=>({alpha:y>=350?255:0});step(scene);expect(worldState(scene).devices).toHaveLength(0);
});

test('a silo marks a fixed coordinate for a later missile, allowing the target to dodge',()=>{
 const scene=fixture(),device=deployMissileSilo(scene,scene.tank1,{x:120,y:200},1);
 step(scene);expect(device.lock).toMatchObject({x:280,y:187,fireAt:2});expect(device.ammo).toBe(2);expect(scene.tank1.score).toBe(0);
 scene.tank2.centre={x:450,y:187};scene.tank2.isPointInside=(x,y)=>Math.abs(x-450)<10&&Math.abs(y-187)<10;
 step(scene);expect(device.ammo).toBe(1);expect(device.lock).toBeNull();expect(scene.tank1.score).toBe(0);
 expect(scene.terrain.fixTerrain).toHaveBeenCalled();
 step(scene);expect(device.lock).toBeNull();step(scene);expect(device.lock.x).toBe(450);
});

test('mobile gun makes a moving firing run and cools instead of becoming a static sentry',()=>{
 const scene=fixture(),device=deployRunGun(scene,scene.tank1,{x:120,y:200},1);
 step(scene);expect(device.x).toBe(204);expect(device.ammo).toBe(6);expect(scene.tank1.score).toBe(24);
 step(scene);expect(device.x).toBe(204);expect(device.ammo).toBe(6);expect(scene.tank1.score).toBe(24);
});

test('replaying the same accepted boundary does not spend ammo or score twice',()=>{
 const scene=fixture(),device=deployMissileSilo(scene,scene.tank1,{x:120,y:200},1);
 step(scene);step(scene);const ammo=device.ammo,score=scene.tank1.score;
 advanceDeployables(scene,2,scoreHit);expect(device.ammo).toBe(ammo);expect(scene.tank1.score).toBe(score);
});

test('full checkpoint restores ownership, heading, ammo, heat, lock and reaction epoch without firing',()=>{
 const scene=fixture();deploySentries(scene,scene.tank1,{x:120,y:200},1);const silo=deployMissileSilo(scene,scene.tank2,{x:500,y:200},-1);
 silo.lock={x:40,y:187,fireAt:9};silo.heat=1;silo.health=17;silo.lastReaction=5;silo.lastBoundary=6;silo.buried=true;silo.ttl=3;
 const snapshot=exportTactics(scene),target=fixture();importTactics(target,snapshot);
 expect(target.tacticalWorld.devices.map(d=>d.owner)).toEqual([target.tank2,target.tank2,target.tank1]);
 const restored=target.tacticalWorld.devices[2];expect({...restored,owner:2}).toEqual({...exportDeployables(scene)[2],owner:2});
 expect(target.tank1.score).toBe(0);expect(target.tank2.score).toBe(0);
 expect(JSON.stringify(snapshot)).not.toMatch(/visual|canvas|scene/);
 const before=JSON.stringify(exportDeployables(target));advanceDeployables(target,0,scoreHit);expect(JSON.stringify(exportDeployables(target))).toBe(before);
});

test('replacement is bounded and loaded battery explosions can damage the owner',()=>{
 const scene=fixture();for(let i=0;i<20;i++)deploySentries(scene,scene.tank1,{x:120,y:200},1);
 expect(scene.tacticalWorld.devices).toHaveLength(2);const maxId=scene.tacticalWorld.nextDevice;
 const serialized=exportDeployables(scene);importDeployables(scene,serialized,maxId);deployRunGun(scene,scene.tank1,{x:120,y:200},1);
 expect(new Set(scene.tacticalWorld.devices.map(d=>d.id)).size).toBe(3);
 scene.tacticalWorld.devices[0].owner=scene.tank1;
 scene.tank1.centre={x:100,y:190};damageDeployables(scene,100,190,20,100,scoreHit);
 expect(scene.tank1.score).toBeLessThan(0);expect(scene.tacticalWorld.devices).toHaveLength(2);
});

test('ion disables reactions for two boundaries and shields absorb turret rounds',()=>{
 const scene=fixture(),[device]=deploySentries(scene,scene.tank1,{x:120,y:200},1);scene.tacticalWorld.devices=[device];scene.tank2.tactics.shield=20;
 disruptDeployables(scene,device.x,device.y-12,20,'ion');step(scene);step(scene);
 expect(device.ammo).toBe(6);expect(scene.tank1.score).toBe(0);
 step(scene);expect(device.ammo).toBe(4);expect(scene.tank2.tactics.shield).toBe(8);expect(scene.tank1.score).toBe(0);
});

test('a covered silo cannot lock through a roof and locked coordinates remain serializable',()=>{
 const scene=fixture(),device=deployMissileSilo(scene,scene.tank1,{x:120,y:200},1);
 scene.terrain.getPixel=(x,y)=>({alpha:y>=200||(y>150&&y<158)?255:0});step(scene);
 expect(device.lock).toBeNull();expect(device.ammo).toBe(2);
});

test('finite lifetime continues even when a turret is blocked or nobody is in range',()=>{
 const scene=fixture();scene.tank2.centre.x=1000;deploySentries(scene,scene.tank1,{x:120,y:200},1);
 for(let i=0;i<7;i++)step(scene);
 expect(scene.tacticalWorld.devices).toHaveLength(0);expect(scene.tank1.score).toBe(0);
});
