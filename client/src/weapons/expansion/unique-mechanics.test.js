import fs from 'fs';
import path from 'path';
import { expansionCatalog, payloads } from './catalog';
import { classicAdaptations, earlyClassicAdaptations } from './classics';
import { laterClassicAdaptations, modernClassicAdaptations } from './later-classics';
import { ExpansionRuntime } from './runtime';
import { ClassicRuntime } from './classic-runtime';
import { authoredMechanicalRules, ruleDescriptions, withMechanicalRules, mechanicalSignature, legacyMechanicalRules, legacyMechanicalSignature, applyLegacyAftermath } from './unique-mechanics';
import { tankState, worldState } from './tactics';

const source=fs.readFileSync(path.join(__dirname,'../packs/Standard/Standard.js'),'utf8');
const originals=[...source.matchAll(/this.name\s*=\s*'([^']+)'/g)].map((m,id)=>({name:m[1],id}));
const normalize=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
const seen=new Set(originals.map(w=>normalize(w.name)));
const weapons=[];
[...expansionCatalog,...classicAdaptations,...earlyClassicAdaptations,...laterClassicAdaptations,...modernClassicAdaptations].forEach(raw=>{
    if(seen.has(normalize(raw.name)))return;seen.add(normalize(raw.name));weapons.push(withMechanicalRules(raw));
});
const fluent=()=>{const shape={destroy:jest.fn()};['setDepth','setStrokeStyle','setOrigin','setPosition','lineStyle','lineBetween','clear'].forEach(key=>shape[key]=jest.fn(()=>shape));return shape;};
const setup=(name,changes={})=>{
    const definition={...(weapons.find(w=>w.name===name)||{id:999,name,behavior:'shell',radius:30,strength:1,count:1,payload:payloads[0]}),...changes};
    const tank=x=>({x,y:200,centre:{x,y:194},power:40,movesRemaining:4,body:{setVelocity:jest.fn(),setGravityY:jest.fn(),stop:jest.fn(),updateFromGameObject:jest.fn()},isPointInside:(px,py)=>Math.abs(px-x)<12&&Math.abs(py-194)<10,updateScore:jest.fn(),turret:{rotation:Math.PI/4,setRelativeRotation:jest.fn()},setPosition:jest.fn(),setPower:jest.fn()});
    const a=tank(100),b=tank(400),ctx=Object.fromEntries(['save','restore','beginPath','rect','clip','arc','ellipse','fill','stroke','moveTo','lineTo','closePath'].map(key=>[key,jest.fn()]));ctx.createLinearGradient=()=>({addColorStop:jest.fn()});
    const scene={tank1:a,tank2:b,events:{once:jest.fn(),off:jest.fn()},add:{graphics:fluent,circle:fluent,ellipse:fluent,line:fluent,text:fluent},tweens:{add:jest.fn()},cache:{audio:{exists:()=>false}}};
    const terrain={width:1200,height:533,context:ctx,update:jest.fn(),getPixel:(x,y)=>({alpha:y>=200?255:0,red:60,green:70,blue:40}),getSlope:()=>0,fixTerrain:jest.fn()};
    const runtime=definition.classicMechanic?new ClassicRuntime(definition):new ExpansionRuntime(definition);
    const weapon={id:610,scene,tank:a,turret:{x:100,y:188,rotation:Math.PI/4},terrain};runtime.create(weapon);
    return {runtime,scene,terrain,weapon};
};
const contact=(runtime,x=400,y=200)=>{runtime.shoot();const p=runtime.projectiles.find(p=>!p.removed);Object.assign(p,{x,y,vx:120,vy:160});runtime.impact(p);return p;};

test('all 770 registered names retain distinct semantic recipes without count/size/ID aliases',()=>{
    expect(originals).toHaveLength(30);expect(weapons).toHaveLength(740);
    const grouped=new Map();
    [...originals,...weapons].forEach(w=>{const signature=mechanicalSignature(w);grouped.set(signature,[...(grouped.get(signature)||[]),w.name]);});
    expect([...grouped.values()].filter(names=>names.length>1)).toEqual([]);
    const base=weapons.find(w=>w.name==='Impact Starburst');
    expect(mechanicalSignature({...base,id:9999,name:'Changed name',radius:300,strength:90,count:99,payload:{...base.payload,color:0}})).toBe(mechanicalSignature(base));
    Object.values(authoredMechanicalRules).flat().forEach(rule=>expect(ruleDescriptions[rule]).toBeTruthy());
});
test('contact fuse keeps the shot alive and delays excavation until resolution',()=>{
    const {runtime}=setup('Impact Howitzer');runtime.carve=jest.fn();contact(runtime);
    expect(runtime.carve).not.toHaveBeenCalled();expect(runtime.events).toHaveLength(1);expect(runtime.ruleVisuals).toHaveLength(1);
    runtime.events.shift().fn();expect(runtime.carve).toHaveBeenCalled();expect(runtime.ruleVisuals).toHaveLength(0);
});
test('nuclear moat retains the central mass instead of reusing a circular crater',()=>{
    const {runtime}=setup('Nuke');runtime.carve=jest.fn();contact(runtime);
    expect(runtime.carve).toHaveBeenCalledTimes(18);
    expect(runtime.carve.mock.calls.every(([x,y])=>Math.hypot(x-400,y-200)>40)).toBe(true);
});
test('different authored terrain aftermaths produce genuinely different geometry',()=>{
    const cross=setup('Shredder').runtime,stairs=setup('Crater Maker').runtime;
    cross.carve=jest.fn();stairs.carve=jest.fn();contact(cross);contact(stairs);
    const crossPoints=cross.carve.mock.calls.map(([x,y])=>[x,y]);
    expect(crossPoints.some(([x,y])=>x===400&&y<180)).toBe(true);
    expect(stairs.carve.mock.calls.some(([x,y])=>x>450&&y>240)).toBe(true);
});
test('a returning split shell holds its secondary attack until it comes back',()=>{
    const {runtime}=setup('Fission Bomb');runtime.shoot();const p=runtime.projectiles[0];
    Object.assign(p,{x:300,y:70,age:20,vx:150,vy:1});runtime.update();
    expect(p.vx).toBeLessThan(0);expect(p.removed).not.toBe(true);
    Object.assign(p,{x:120,vy:20});runtime.update();expect(p.removed).toBe(true);expect(runtime.projectiles.some(p=>p.child)).toBe(true);
});
test('chuted split ordnance descends before releasing its children',()=>{
    const {runtime}=setup('Pillow Fight');runtime.shoot();const p=runtime.projectiles[0];
    Object.assign(p,{x:300,y:50,age:20,vx:150,vy:1});runtime.update();expect(p.removed).not.toBe(true);expect(p.vx).toBe(0);expect(p.gravity).toBe(30);
    p.y=180;runtime.update();expect(p.removed).toBe(true);expect(runtime.projectiles.some(p=>p.child)).toBe(true);
});
test('dirt-building fragments now apply their real frost payload',()=>{
    const {runtime,scene}=setup('Snowblower');runtime.shoot();runtime.impact({...runtime.projectiles[0],x:400,y:200,fragmentMode:'dirt'});
    expect(tankState(scene.tank2).frost).toBe(2);
});
test('non-scoring leech construction has a shield-draining reinforcement interaction',()=>{
    const {runtime,scene}=setup('Leech Rampart');tankState(scene.tank2).shield=50;contact(runtime);
    expect(tankState(scene.tank2).shield).toBe(30);expect(tankState(scene.tank1).shield).toBe(20);
});
test('beam range and displacement force use the authored options',()=>{
    const {runtime}=setup('Ion Rail Spike',{options:{range:90}});runtime.beam({x:100,y:100},0,true);
    expect(runtime.lastDeliveryPoint.x).toBeLessThanOrEqual(190);
    const other=setup('Ferric Gravity Well',{options:{force:280}});contact(other.runtime);
    expect(other.scene.tank2.body.setVelocity.mock.calls.some(([vx])=>Math.abs(vx)===280)).toBe(true);
});
test('salvo launch is a staggered event sequence rather than a count-only fan',()=>{
    const {runtime}=setup('Impact Salvo');runtime.shoot();expect(runtime.projectiles).toHaveLength(0);expect(runtime.events).toHaveLength(5);
    runtime.events.shift().fn();expect(runtime.projectiles).toHaveLength(1);
});
test('hazard aftermath persists in exported tactical state and has owner/counterplay',()=>{
    const {runtime,scene}=setup('Magic Forest');contact(runtime);
    expect(worldState(scene).zones.some(z=>z.kind==='mine'&&z.owner===scene.tank1&&z.armedAt===1)).toBe(true);
});
test('the three turret names route to three persistent device kinds',()=>{
    const kinds=[];
    for(const name of ['Auto Turrets','Missile Turret',"Run 'n' Gun"]){const {runtime,scene}=setup(name);contact(runtime);kinds.push(worldState(scene).devices[0].kind);}
    expect(new Set(kinds).size).toBe(3);
});
test('legacy additions execute once and preserve all original IDs',()=>{
    const {weapon,terrain}=setup('Single Shot');weapon.id=2;
    expect(legacyMechanicalRules(2)).toEqual(['crosscut']);expect(applyLegacyAftermath(weapon,{x:400,y:200,radius:20})).toBe(true);
    const calls=terrain.context.arc.mock.calls.length;expect(calls).toBeGreaterThan(10);
    expect(applyLegacyAftermath(weapon,{x:600,y:200,radius:20})).toBe(false);expect(terrain.context.arc).toHaveBeenCalledTimes(calls);
    expect(new Set(originals.map(w=>legacyMechanicalSignature(w.id))).size).toBe(30);
});
test('runtime effects carry the registered weapon ID and semantic rules',()=>{
    const {runtime}=setup('Nuke');expect(runtime.fxOptions()).toMatchObject({weaponId:610,weaponName:'Nuke',semanticRules:['annular-moat']});
});
test('rule descriptions are idempotent and short descriptions lead with the actual rule',()=>{
    const nuke=weapons.find(w=>w.name==='Nuke');
    expect(withMechanicalRules(withMechanicalRules(nuke)).description).toBe(nuke.description);
    expect(nuke.shortDescription).toMatch(/^Excavates a ring/);expect(nuke.shortDescription.length).toBeLessThanOrEqual(180);
    for(const name of ['Auto Turrets','Missile Turret',"Run 'n' Gun"]){const w=weapons.find(w=>w.name===name);expect(w.shortDescription).toBeTruthy();expect(w.description).not.toMatch(/^Delivers its payload/);}
});
test('accepted shot inputs replay deterministic trajectories and terrain aftermaths',()=>{
    const first=setup('Topsy-Turvy').runtime,second=setup('Topsy-Turvy').runtime;
    first.carve=jest.fn();second.carve=jest.fn();first.shoot();second.shoot();
    for(let i=0;i<90;i++){first.update();second.update();}
    expect(first.projectiles.map(({x,y,vx,vy,removed})=>({x,y,vx,vy,removed}))).toEqual(second.projectiles.map(({x,y,vx,vy,removed})=>({x,y,vx,vy,removed})));
    expect(first.carve.mock.calls).toEqual(second.carve.mock.calls);
});
