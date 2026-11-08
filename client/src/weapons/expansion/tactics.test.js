import { expansionCatalog } from './catalog';
import { classicAdaptations } from './classics';
import { tankState, scoreHit, applyPayload, addShield, addZone, beginTacticalShot, exportTactics, importTactics, worldState } from './tactics';
const tank=(x)=>({x,y:100,centre:{x,y:100},score:0,movesRemaining:4,updateScore(points){this.score+=points;},isPointInside(){return false;}});
const scene=()=>({tank1:tank(100),tank2:tank(300),add:{ellipse:()=>({setStrokeStyle(){return this;},setDepth(){return this;},destroy:jest.fn()}),line:()=>({setOrigin(){return this;},setDepth(){return this;}})},tweens:{add:jest.fn()}});
const weapon=(s,key)=>({scene:s,tank:s.tank1,weaponHandler:{definition:{payload:{key}}}});
test('370 distinct combinations with stable contiguous IDs and usable metadata',()=>{
 expect(expansionCatalog).toHaveLength(370);expect(new Set(expansionCatalog.map(w=>w.name)).size).toBe(370);
 expect(expansionCatalog.map(w=>w.id)).toEqual(Array.from({length:370},(_,i)=>i+30));
 expect(new Set(expansionCatalog.map(w=>w.behavior)).size).toBe(37);
 expansionCatalog.forEach(w=>{expect(w.description.length).toBeGreaterThan(30);expect(w.warning.length).toBeGreaterThan(15);expect(Number.isFinite(w.type)).toBe(true);});
 expect(new Set(classicAdaptations.map(w=>w.id)).size).toBe(classicAdaptations.length);
});
test('shield absorbs enemy damage and self damage without inventing score',()=>{
 const a=tank(100),b=tank(300);addShield(b,40);expect(scoreHit(a,b,60)).toBe(20);expect(a.score).toBe(20);expect(tankState(b).shield).toBe(0);
 addShield(a,10);scoreHit(a,a,25);expect(a.score).toBe(5);
});
test('acid amplifies the next damage and leech converts actual damage into shielding',()=>{
 const s=scene();applyPayload(weapon(s,'acid'),300,100,25);expect(scoreHit(s.tank1,s.tank2,20)).toBe(27);
 applyPayload(weapon(s,'leech'),300,100,25,27);expect(tankState(s.tank1).shield).toBe(17);
});
test('foam can accidentally protect the enemy and clears corrosion',()=>{
 const s=scene();tankState(s.tank2).acid=2;applyPayload(weapon(s,'foam'),300,100,30);
 expect(tankState(s.tank2)).toMatchObject({shield:30,acid:0});
});
test('fire ignites oil; frost extinguishes burning ground',()=>{
 const s=scene();addZone(s,s.tank1,'oil',300,100,40,'fire');applyPayload(weapon(s,'fire'),300,100,40);
 expect(s.tank1.score).toBeGreaterThan(0);expect(worldState(s).zones.map(z=>z.kind)).toEqual(['fire']);
 applyPayload(weapon(s,'frost'),300,100,40);expect(worldState(s).zones).toHaveLength(0);expect(tankState(s.tank2).frost).toBe(2);
});
test('hazard duration follows shots and damages its own owner too',()=>{
 const s=scene();addZone(s,s.tank1,'fire',100,100,40,'fire');expect(s.tank1.score).toBe(0);
 beginTacticalShot(s,s.tank2);expect(s.tank1.score).toBe(-12);
 beginTacticalShot(s,s.tank2);beginTacticalShot(s,s.tank2);expect(worldState(s).zones).toHaveLength(0);
});
test('ion removes shields and discharges marked armor',()=>{
 const s=scene();addShield(s.tank2,60);tankState(s.tank2).marked=2;applyPayload(weapon(s,'ion'),300,100,30);
 expect(tankState(s.tank2).shield).toBe(0);expect(s.tank1.score).toBe(24);
});
test('online snapshot reverses local player slots and preserves hazard age',()=>{
 const s=scene();addShield(s.tank1,50);s.tank1.score=80;addZone(s,s.tank1,'oil',200,100,30,'fire');worldState(s).zones[0].ttl=2;
 const target=scene();importTactics(target,exportTactics(s));expect(tankState(target.tank2).shield).toBe(50);expect(target.tank2.score).toBe(80);
 expect(worldState(target).zones[0].owner).toBe(target.tank2);expect(worldState(target).zones[0].ttl).toBe(2);
});

test('an armed proximity mine detonates while a tank drives into range',()=>{
 const s=scene();s.terrain={context:{save:jest.fn(),restore:jest.fn(),beginPath:jest.fn(),arc:jest.fn(),fill:jest.fn()},update:jest.fn(),fixTerrain:jest.fn()};
 addZone(s,s.tank1,'mine',220,100,35,'kinetic');
 beginTacticalShot(s,s.tank1);expect(worldState(s).zones).toHaveLength(1);
 s.tank2.centre.x=220;
 // An ordinary world step checks proximity without requiring another shot.
 const {checkTacticalMines}=require('./tactics');checkTacticalMines(s);
 expect(worldState(s).zones).toHaveLength(0);expect(s.tank1.score).toBe(50);
 expect(s.terrain.fixTerrain).toHaveBeenCalledWith(220,100,32);
});

test('import preserves the tactical listener and allocates unique future zone IDs',()=>{
 const s=scene();s.physics={world:{on:jest.fn(),off:jest.fn()}};s.events={once:jest.fn()};
 worldState(s);worldState(s);expect(s.physics.world.on).toHaveBeenCalledTimes(1);
 importTactics(s,{shot:10,states:[{},{}],scores:[0,0],zones:[{id:40,kind:'oil',owner:1,x:200,y:100,radius:30,payload:'fire',ttl:2,armedAt:0}]});
 addZone(s,s.tank1,'oil',400,100,30,'fire');
 expect(worldState(s).zones.map(z=>z.id)).toEqual([40,41]);expect(s.physics.world.on).toHaveBeenCalledTimes(1);
 const stop=s.events.once.mock.calls[0][1];stop();expect(s.physics.world.off).toHaveBeenCalledWith('worldstep',s.physics.world.on.mock.calls[0][1]);
});
