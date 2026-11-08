import { expansionCatalog } from './catalog';
import { classicAdaptations } from './classics';
import { teleportTank, tankState, scoreHit, applyPayload, addShield, addZone, beginTacticalShot, exportTactics, importTactics, worldState } from './tactics';
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
test('foam coats the enemy without shielding it and sprays a terrain mound',()=>{
 const s=scene();const ctx={save:jest.fn(),restore:jest.fn(),beginPath:jest.fn(),ellipse:jest.fn(),fill:jest.fn()};
 s.terrain={context:ctx,update:jest.fn()};tankState(s.tank2).acid=2;applyPayload(weapon(s,'foam'),300,100,30);
 expect(tankState(s.tank2)).toMatchObject({shield:0,acid:2,foam:1});
 expect(ctx.ellipse).toHaveBeenCalledTimes(1);expect(s.terrain.update).toHaveBeenCalled();
});
test('foam around the firing tank cleanses and shields only the owner, without a mound',()=>{
 const s=scene();const ctx={save:jest.fn(),restore:jest.fn(),beginPath:jest.fn(),ellipse:jest.fn(),fill:jest.fn()};
 s.terrain={context:ctx,update:jest.fn()};s.tank2.centre={x:120,y:100};tankState(s.tank1).acid=2;
 applyPayload(weapon(s,'foam'),100,100,30);
 expect(tankState(s.tank1)).toMatchObject({shield:30,acid:0});expect(tankState(s.tank2)).toMatchObject({shield:0,foam:1});
 expect(ctx.ellipse).not.toHaveBeenCalled();
});
test('foamed treads allow one move and wear off after the next shot',()=>{
 const s=scene();applyPayload(weapon(s,'foam'),300,100,30);
 beginTacticalShot(s,s.tank2);expect(tankState(s.tank2)).toMatchObject({foam:0,frostMoves:0});
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

test('importTactics merges defaults: missing/garbage fields never become NaN, missing arrays are tolerated',()=>{
 const s=scene();expect(()=>importTactics(s,{states:[{shield:'x'},{frost:2}]})).not.toThrow();
 expect(tankState(s.tank1)).toEqual({shield:0,frost:2,frostMoves:0,acid:0,marked:0,foam:0});
 expect(tankState(s.tank2).shield).toBe(0);expect(worldState(s).shot).toBe(0);expect(worldState(s).zones).toEqual([]);
 // A shield restored from a partial snapshot still absorbs and depletes normally.
 expect(scoreHit(s.tank1,s.tank2,30)).toBe(30);expect(s.tank1.score).toBe(30);
 importTactics(s,{shot:NaN,states:[{shield:999}],zones:[{kind:'mine',x:200,y:100,radius:30,owner:1},{kind:'bogus',x:1,y:1,radius:5},{kind:'fire',x:NaN,y:1,radius:5}]});
 expect(tankState(s.tank2).shield).toBe(150);expect(worldState(s).zones).toHaveLength(1);
 const mine=worldState(s).zones[0];expect(Number.isFinite(mine.armedAt)).toBe(true);expect(Number.isFinite(mine.ttl)).toBe(true);
 expect(()=>importTactics(s,{})).not.toThrow();expect(()=>importTactics(s,null)).not.toThrow();
});
test('ion arcs each marked tank once per shot even across many bomblets',()=>{
 const s=scene();tankState(s.tank2).marked=2;const w=weapon(s,'ion');
 for(let i=0;i<7;i++)applyPayload(w,300,100,20);
 expect(s.tank1.score).toBe(24);
});
test('fire patches from one shot are capped and burn a tank once per shot',()=>{
 const s=scene();const w=weapon(s,'fire');for(let i=0;i<5;i++)applyPayload(w,300+i*5,100,40);
 expect(worldState(s).zones.filter(z=>z.kind==='fire')).toHaveLength(3);
 beginTacticalShot(s,s.tank2);expect(s.tank1.score).toBe(12);
});
test('protectOwner keeps fire, foam mounds and volatile blasts off the owner',()=>{
 const s=scene();const schedule=jest.fn();
 applyPayload(weapon(s,'fire'),100,100,30,0,{protectOwner:true});expect(worldState(s).zones).toHaveLength(0);
 const w={scene:s,tank:s.tank1,weaponHandler:{definition:{payload:{key:'volatile',radius:1.15},strength:1},schedule,burst:jest.fn()}};
 applyPayload(w,110,100,30,0,{protectOwner:true});expect(schedule).not.toHaveBeenCalled();
 applyPayload(w,300,100,30,0,{protectOwner:true});applyPayload(w,300,100,30,0,{protectOwner:true});expect(schedule).toHaveBeenCalledTimes(1);
});
test('a mine ignores its owner until the owner has been clear of it, then triggers on return',()=>{
 const s=scene();s.terrain={context:{save:jest.fn(),restore:jest.fn(),beginPath:jest.fn(),arc:jest.fn(),fill:jest.fn()},update:jest.fn(),fixTerrain:jest.fn()};
 addZone(s,s.tank1,'mine',100,100,35,'kinetic');
 beginTacticalShot(s,s.tank2);beginTacticalShot(s,s.tank1);expect(worldState(s).zones).toHaveLength(1);expect(s.tank1.score).toBe(0);
 const {checkTacticalMines}=require('./tactics');
 s.tank1.centre={x:200,y:100};checkTacticalMines(s);expect(worldState(s).zones).toHaveLength(1);
 s.tank1.centre={x:100,y:100};checkTacticalMines(s);expect(worldState(s).zones).toHaveLength(0);expect(s.tank1.score).toBe(-50);
 expect(expansionCatalog.find(w=>w.name==='Impact Buried Gift').warning).toMatch(/ignores you until you have moved clear/);
});
test('shields decay by a quarter (min 5) when their owner fires, never below zero',()=>{
 const s=scene();addShield(s.tank1,100);addShield(s.tank2,100);
 beginTacticalShot(s,s.tank1);expect(tankState(s.tank1).shield).toBe(75);expect(tankState(s.tank2).shield).toBe(100);
 tankState(s.tank1).shield=12;beginTacticalShot(s,s.tank1);expect(tankState(s.tank1).shield).toBe(7);
 tankState(s.tank1).shield=3;beginTacticalShot(s,s.tank1);expect(tankState(s.tank1).shield).toBe(0);
});
test('device damage scales with weapon strength and payload damage',()=>{
 const {deploySentries}=require('./deployables');
 const make=()=>{const s=scene();s.terrain={width:1200,height:500,getPixel:(x,y)=>({alpha:y>=200?255:0}),context:{},update:jest.fn()};s.tank1.y=200;deploySentries(s,s.tank1,{x:500,y:200},1);return s;};
 const weak=make(),strong=make();
 const hit=(s,strength)=>applyPayload({scene:s,tank:s.tank1,weaponHandler:{definition:{payload:{key:'kinetic',damage:1},strength}}},500,190,40);
 hit(weak,.1);hit(strong,1);
 expect(worldState(weak).devices[0].health).toBeGreaterThan(worldState(strong).devices[0]?.health??-Infinity);
});
test('deployables build tactical state through worldState, so the mine listener is attached',()=>{
 const {deploySentries}=require('./deployables');const s=scene();s.physics={world:{on:jest.fn(),off:jest.fn()}};s.events={once:jest.fn()};
 s.terrain={width:1200,height:500,getPixel:(x,y)=>({alpha:y>=200?255:0})};deploySentries(s,s.tank1,{x:500,y:200});
 expect(s.physics.world.on).toHaveBeenCalledWith('worldstep',expect.any(Function));
});
test('catalog balance and truthful support text',()=>{
 expect(expansionCatalog.find(w=>w.name==='Impact Bore Lance').strength).toBe(1);
 expect(expansionCatalog.find(w=>w.name==='Unstable Howitzer').payload.damage).toBe(.9);
 const ember=expansionCatalog.find(w=>w.name==='Ember Aegis'),tremor=expansionCatalog.find(w=>w.name==='Tremor Field Medic'),unstable=expansionCatalog.find(w=>w.name==='Unstable Aegis');
 expect(ember.description).not.toMatch(/burning patch/);expect(tremor.description).not.toMatch(/excavation/);expect(unstable.description).not.toMatch(/delayed second explosion/);
 expect(expansionCatalog.find(w=>w.name==='Impact Aegis').warning).toMatch(/quarter of their charge/);
});
test('fire burns away foam as well as thawing frost',()=>{
 const s=scene();tankState(s.tank2).foam=1;tankState(s.tank2).frost=2;applyPayload(weapon(s,'fire'),300,100,30);
 expect(tankState(s.tank2)).toMatchObject({foam:0,frost:0});
});
test('teleportTank resets the arcade frame delta so a swap is not applied twice',()=>{
 // Mirrors Phaser Arcade Body.postUpdate: sprite.x += position.x - prevFrame.x.
 const vec=(x,y)=>({x,y,copy(v){this.x=v.x;this.y=v.y;return this;}});
 const tank={x:100,y:300,setPosition(x,y){this.x=x;this.y=y;return this;}};
 tank.body={position:vec(100,300),prev:vec(100,300),prevFrame:vec(100,300),stop:jest.fn(),
  updateFromGameObject(){this.position.x=tank.x;this.position.y=tank.y;},
  postUpdate(){tank.x+=this.position.x-this.prevFrame.x;tank.y+=this.position.y-this.prevFrame.y;}};
 teleportTank(tank,750,280);tank.body.postUpdate();
 expect({x:tank.x,y:tank.y}).toEqual({x:750,y:280});expect(tank.body.stop).toHaveBeenCalled();
});
