import { ClassicRuntime } from './classic-runtime';
import { earlyClassicAdaptations } from './classics';
import { laterClassicAdaptations } from './later-classics';
import { payloads } from './catalog';
const fluent=()=>{const shape={destroy:jest.fn()};['setDepth','setStrokeStyle','setOrigin','setPosition','lineStyle','lineBetween','clear'].forEach(name=>{shape[name]=jest.fn(()=>shape);});return shape;};
const context=()=>Object.fromEntries(['save','restore','beginPath','rect','clip','arc','ellipse','fill','stroke','moveTo','lineTo','closePath'].map(name=>[name,jest.fn()]));
const setup=(name)=>{
 const tank=x=>({x,y:200,power:40,centre:{x,y:194},body:{setVelocity:jest.fn(),setGravityY:jest.fn(),stop:jest.fn(),updateFromGameObject:jest.fn()},isPointInside:(bx,by)=>Math.abs(bx-x)<12&&Math.abs(by-194)<10,setPosition:jest.fn(),updateScore:jest.fn(),turret:{rotation:Math.PI/4,setRelativeRotation:jest.fn()},setPower:jest.fn()});
 const a=tank(100),b=tank(400),ctx=context();ctx.createLinearGradient=()=>({addColorStop:jest.fn()});
 const scene={tank1:a,tank2:b,events:{once:jest.fn(),off:jest.fn()},add:{graphics:fluent,circle:fluent,ellipse:fluent,line:fluent,text:fluent},tweens:{add:jest.fn()},cache:{audio:{exists:()=>false}}};
 const terrain={width:1200,height:533,context:ctx,update:jest.fn(),getPixel:(x,y)=>({alpha:y>=200?255:0,red:60,green:70,blue:40}),getSlope:()=>0,fixTerrain:jest.fn()};
 const definition=[...earlyClassicAdaptations,...laterClassicAdaptations].find(w=>w.name===name)||{id:999,name,classicMechanic:name,payload:payloads[0],radius:30,strength:1,count:5,options:{}};
 const runtime=new ClassicRuntime(definition),weapon={scene,tank:a,turret:{x:100,y:188,rotation:Math.PI/4},terrain};runtime.create(weapon);
 return {runtime,scene,terrain,weapon};
};
test('every added early classic has an explicit supported signature',()=>{
 expect(earlyClassicAdaptations).toHaveLength(71);
 const allowed=new Set(['spread','stream','tracer','split','proximity','roller','bouncer','drillburst','scatterbuild','radiallaser','orbitlaser','pitfall','pitfirebury','terraincoat','groundwave','selflaunch','selfescape','guided','nonexcavate','random','ring','pillars','selfshelter','wavecoat','groundfan','scramble','sweep','projectilelaser']);
 earlyClassicAdaptations.forEach(w=>expect(allowed.has(w.classicMechanic)).toBe(true));
});
test('Mud Pie creates actual earth-building fragments',()=>{
 const {runtime}=setup('Mud Pie');runtime.shoot();const p=runtime.projectiles[0];p.age=10;p.vy=2;runtime.classicFlight();
 const children=runtime.projectiles.filter(p=>!p.removed);expect(children).toHaveLength(18);expect(children.every(p=>p.fragmentMode==='dirt')).toBe(true);
});
test('Lock Box flies past its apex and resolves on contact',()=>{
 const {runtime}=setup('Lock Box');runtime.shoot();const p=runtime.projectiles[0];
 Object.assign(p,{x:300,y:100,age:60,vy:2});runtime.classicFlight();
 expect(p.removed).not.toBe(true);expect(runtime.laterState).toBeUndefined();
 Object.assign(p,{x:400,y:194});runtime.impact(p);
 expect(p.removed).toBe(true);expect(runtime.laterState.kind).toBe('lock-box');
});
test('Super Tracer marks offsets without explosions or scoring',()=>{
 const {runtime,scene}=setup('Super Tracer');runtime.shoot();expect(runtime.projectiles).toHaveLength(10);
 const p=runtime.projectiles[0];runtime.impact(p);expect(p.removed).toBe(true);expect(scene.tank1.updateScore).not.toHaveBeenCalled();expect(runtime.dirty).toHaveLength(0);
});
test('Flash Blast scores without excavating',()=>{
 const {runtime,scene}=setup('Flash Blast');runtime.burst=jest.fn();runtime.pointBurst(400,194,62,1.1,false);
 expect(runtime.burst).not.toHaveBeenCalled();expect(scene.tank1.updateScore).toHaveBeenCalled();expect(runtime.dirty).toHaveLength(0);
});
test('Super Skipper keeps a live replacement shell after impact',()=>{
 const {runtime}=setup('Super Skipper');runtime.shoot();const shell=runtime.projectiles[0];shell.x=300;shell.y=200;shell.vx=100;shell.vy=200;runtime.impact(shell);
 expect(shell.removed).toBe(true);expect(runtime.projectiles.filter(p=>!p.removed)).toHaveLength(1);expect(runtime.projectiles.at(-1).classicBounces).toBe(1);
});
test('roller remains active until its scheduled detonation and cleans up on shutdown',()=>{
 const {runtime}=setup('Mega Cruiser');runtime.shoot();runtime.impact(runtime.projectiles[0]);expect(runtime.walkers).toHaveLength(1);expect(runtime.events.length).toBeGreaterThan(0);
 const visual=runtime.walkers[0].visual;runtime.dispose();expect(visual.destroy).toHaveBeenCalled();expect(runtime.walkers).toHaveLength(0);
});
test('Fire in the Hole queues excavation and delayed burning burial',()=>{
 const {runtime}=setup('Fire in the Hole');runtime.shoot();runtime.impact(runtime.projectiles[0]);expect(runtime.events).toHaveLength(6);
});

test('wide groundwaves honor the authored range',()=>{
 const {runtime}=setup('groundwave');runtime.options={shots:5,range:400};runtime.definition.classicMechanic='groundwave';runtime.pointBurst=jest.fn();
 runtime.shoot();runtime.impact({...runtime.projectiles[0],x:600,y:200});runtime.events.forEach(event=>event.fn());
 expect(runtime.pointBurst.mock.calls.map(call=>call[0])).toEqual([400,500,600,700,800]);
});
test('screen-wrapping projectiles re-enter before the base bounds check',()=>{
 const {runtime}=setup('guided');runtime.options={wrap:true};runtime.shoot();const projectile=runtime.projectiles[0];projectile.x=1;projectile.vx=-100;
 runtime.classicFlight();expect(projectile.x).toBe(1196);expect(projectile.wraps).toBe(1);
});
test('Showdown launches both tanks rather than only the shooter',()=>{
 const {runtime,scene}=setup('selflaunch');runtime.options={self:false,force:260};runtime.shoot();
 expect(scene.tank1.body.setVelocity).toHaveBeenCalledWith(0,-260);expect(scene.tank2.body.setVelocity).toHaveBeenCalledWith(0,-260);
});
test('island excavates around a retained central mass',()=>{
 const {runtime}=setup('island');runtime.carve=jest.fn();runtime.shoot();runtime.impact(runtime.projectiles[0]);expect(runtime.carve).toHaveBeenCalledTimes(3);
});
test('a piercing guided shell excavates a bounded corridor ahead of flight',()=>{
 const {runtime}=setup('guided');runtime.options={pierce:true,range:100};runtime.shoot();const p=runtime.projectiles[0];p.y=220;p.vx=120;p.vy=0;
 runtime.carve=jest.fn();runtime.classicFlight();expect(runtime.carve).toHaveBeenCalled();expect(p.pierceDistance).toBe(2);
});


test('Tar Ball encloses a directly hit tank in opaque black terrain rather than ordinary soil',()=>{
 const {runtime,terrain}=setup('Tar Ball');runtime.shoot();const p=runtime.projectiles[0];Object.assign(p,{x:400,y:194});runtime.impact(p);
 expect(terrain.context.fillStyle).toBe('#050508');expect(terrain.context.arc).toHaveBeenCalledWith(400,194,48,0,Math.PI*2);
 expect(terrain.update).toHaveBeenCalled();
});

test('Fire Bolt loses actual scoring damage while it flies',()=>{
 const fresh=setup('Fire Bolt');fresh.runtime.shoot();const a=fresh.runtime.projectiles[0];Object.assign(a,{x:400,y:194,age:0});fresh.runtime.impact(a);
 const old=setup('Fire Bolt');old.runtime.shoot();const b=old.runtime.projectiles[0];Object.assign(b,{x:400,y:194,age:220});old.runtime.impact(b);
 const points=fixture=>fixture.scene.tank1.updateScore.mock.calls.reduce((sum,[value])=>sum+value,0);
 expect(points(fresh)).toBeGreaterThan(points(old));expect(points(old)).toBeGreaterThan(0);
});

test('a closed foam shelter actually grants its promised shield charge',()=>{
 const {runtime,scene}=setup('Shelter');runtime.options={closed:true,rubber:true};runtime.shoot();
 expect(scene.tank1.tactics.shield).toBe(30);
});


test('reflected rays return from the ceiling and world walls',()=>{
 const {runtime}=setup('sweep');
 expect(runtime.ray(600,20,-Math.PI/2,80,false,24,1).y).toBeGreaterThan(20);
 expect(runtime.ray(1180,100,0,80,false,24,1).x).toBeLessThan(1180);
});

test('a gravity-free ricochet returns from the world edge instead of disappearing',()=>{
 const {runtime}=setup('bouncer');runtime.options={bounces:3,gravity:0};runtime.shoot();const p=runtime.projectiles[0];Object.assign(p,{x:1197,y:100,vx:300,vy:0,gravity:0});
 runtime.update();const replacement=runtime.projectiles.find(p=>!p.removed);
 expect(replacement).toBeDefined();expect(replacement.vx).toBeLessThan(0);expect(replacement.classicBounces).toBe(1);
});
