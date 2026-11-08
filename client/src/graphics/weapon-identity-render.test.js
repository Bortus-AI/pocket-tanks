import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WeaponFX } from './weapon-fx';
import { weaponIdentity } from './weapon-identity';
import { expansionCatalog } from '../weapons/expansion/catalog';
import { classicAdaptations,earlyClassicAdaptations } from '../weapons/expansion/classics';
import { laterClassicAdaptations,modernClassicAdaptations } from '../weapons/expansion/later-classics';
import { withMechanicalRules,legacyMechanicalRules } from '../weapons/expansion/unique-mechanics';

const source=fs.readFileSync(path.join(__dirname,'../weapons/packs/Standard/Standard.js'),'utf8');
const legacyPayload=id=>[7,8,12,13,17,18,19,25,27].includes(id)?'seismic':id===14?'ion':[15,23].includes(id)?'fire':id===16?'frost':'kinetic';
const registry=[...source.matchAll(/this\.name\s*=\s*'([^']+)'/g)].map((match,id)=>({id,name:match[1],payload:{key:legacyPayload(id)},mechanicalRules:legacyMechanicalRules(id)}));
expansionCatalog.forEach(weapon=>registry[weapon.id]=withMechanicalRules(weapon));
const normalize=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
const names=new Set(registry.map(weapon=>normalize(weapon.name)));
for(const pack of [classicAdaptations,earlyClassicAdaptations,laterClassicAdaptations,modernClassicAdaptations])for(const weapon of pack){if(names.has(normalize(weapon.name)))continue;names.add(normalize(weapon.name));registry.push(withMechanicalRules({...weapon,id:registry.length}));}

// Capture the paths the real compositor submits after all nested transforms.
// Names, glyph labels, palettes, weapon IDs and seeds never enter this hash.
const captureContext=()=>{
    let matrix=[1,0,0,1,0,0],current=[],paths=0;const stack=[],hash=crypto.createHash('sha256');
    const multiply=b=>{const a=matrix;matrix=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];};
    const point=(x,y)=>[Math.round((matrix[0]*x+matrix[2]*y+matrix[4])*100)/100,Math.round((matrix[1]*x+matrix[3]*y+matrix[5])*100)/100];
    const draw=kind=>{if(context.globalAlpha>.015&&current.length){hash.update(JSON.stringify([kind,Math.round(context.globalAlpha*100)/100,current]));paths++;}};
    const context={globalAlpha:1,lineWidth:1,save(){stack.push({matrix:[...matrix],alpha:this.globalAlpha,width:this.lineWidth});},restore(){const old=stack.pop();matrix=old.matrix;this.globalAlpha=old.alpha;this.lineWidth=old.width;},
        translate(x,y){multiply([1,0,0,1,x,y]);},rotate(angle){multiply([Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0]);},scale(x,y){multiply([x,0,0,y,0,0]);},
        beginPath(){current=[];},moveTo(x,y){current.push(['M',...point(x,y)]);},lineTo(x,y){current.push(['L',...point(x,y)]);},closePath(){current.push(['Z']);},stroke(){draw('stroke');},fill(){draw('fill');}};
    return {context,finish:()=>({hash:hash.digest('hex'),paths})};
};

const renderedFingerprint=(weapon,reducedMotion)=>{
    const profile=weaponIdentity(weapon),fx=Object.create(WeaponFX.prototype);fx.mobile=true;fx.reducedMotion=reducedMotion;
    const {context,finish}=captureContext();
    for(const progress of [.08,.24,.43,.64,.83,.96])fx.drawStory(context,{x:0,y:0,r:40,life:1,age:progress,profile,color:'#ffffff',angle:.4});
    fx.drawIdentityProjectile(context,{x:0,y:0,px:-1,py:0,age:.5,color:'#ffffff',profile,options:{},history:Array.from({length:16},(_,i)=>({x:-i*3,y:Math.sin(i/3)*3}))});
    return finish();
};

for(const reducedMotion of [false,true])test(`actual composited grayscale paths differ for all 770 weapons (reduced motion ${reducedMotion})`,()=>{
    const hashes=new Map(),empty=[];
    for(const weapon of registry){const rendered=renderedFingerprint(weapon,reducedMotion);if(!rendered.paths)empty.push(weapon.name);if(!hashes.has(rendered.hash))hashes.set(rendered.hash,[]);hashes.get(rendered.hash).push(weapon.name);}
    expect(empty).toEqual([]);
    const duplicates=[...hashes.values()].filter(group=>group.length>1);
    expect(duplicates).toEqual([]);
    expect(hashes.size).toBe(770);
});

test('original projectile bridge visibility suppresses both chassis and trail',()=>{
    const fx=Object.create(WeaponFX.prototype),capture=captureContext();
    fx.drawProjectile(capture.context,{visible:false,profile:weaponIdentity({name:'Tracer'})});
    expect(capture.finish().paths).toBe(0);
});

test('nonexplosive tracer markers never receive generic shrapnel or flame particles',()=>{
    const fx=Object.create(WeaponFX.prototype);fx.particles=[];fx.particleLimit=200;fx.story=()=>({profile:weaponIdentity({weaponId:6})});fx.particle=jest.fn();
    expect(fx.impact(100,100,40,{weaponId:6,payload:'kinetic'})).toBe(true);
    expect(fx.particle).not.toHaveBeenCalled();
    expect(fx.bursts).toBeUndefined();
});
