import fs from 'fs';
import path from 'path';
import * as geometry from './weapon-identity-geometry';
import { WeaponFX } from './weapon-fx';
import { weaponIdentity } from './weapon-identity';
import { materialRecipe, materialSample } from './weapon-materials';
import { animatedParticleFrame } from './particle-sprites';
import { WEAPON_ART, weaponArt } from './weapon-art';
import { ART_FRAMES, artPose } from './weapon-art/frames';
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

const captureContext=()=>{
    const calls={fill:0,stroke:0,image:0};
    const context={globalAlpha:1,save(){},restore(){},translate(){},rotate(){},beginPath(){},closePath(){},
        moveTo(){},lineTo(){},ellipse(){},fill(){calls.fill++;},fillRect(){calls.fill++;},stroke(){calls.stroke++;},drawImage(){calls.image++;},
        createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};
    return {context,calls};
};

test('all 770 weapons render solid projectiles without invoking schematic geometry',()=>{
    const glyph=jest.spyOn(geometry,'drawIdentityGeometry').mockImplementation(()=>{throw Error('Schematic geometry reached live renderer');});
    const bitmap=jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(captureContext().context);
    try{
        const materials=new Set(),fx=Object.create(WeaponFX.prototype);fx.owned={get:design=>({id:design.id,canvas:{},frames:{'body-0':{x:0,y:0},'body-1':{x:128,y:0}}})};
        expect(registry).toHaveLength(770);
        for(const weapon of registry){
            const profile={...weaponIdentity(weapon),art:weaponArt(weapon)},recipe=materialRecipe(profile),{context,calls}=captureContext();
            materials.add(recipe.material);
            fx.drawProjectile(context,{visible:true,x:10,y:10,px:9,py:10,color:'#ffffff',age:0,profile,options:{},history:[{x:10,y:10},{x:9,y:10}]});
            expect(calls.image).toBe(1);expect(calls.stroke).toBe(0);expect(profile.art.id).toBe(weapon.id);
            for(const pulse of recipe.pulses)for(let i=0;i<7;i++)expect(Object.values(materialSample(recipe,pulse,i,7)).every(Number.isFinite)).toBe(true);
        }
        expect(materials.size).toBe(10);expect(glyph).not.toHaveBeenCalled();
    }finally{glyph.mockRestore();bitmap.mockRestore();}
});

test('soil construction emits dirt rather than a generic fiery explosion',()=>{
    const fx=Object.create(WeaponFX.prototype);
    Object.assign(fx,{scene:{},particles:[],stories:[],bursts:[],particleLimit:650,storyLimit:24,time:0,lastShake:0,owned:{get:design=>({id:design.id,design})}});
    fx.impact(100,100,40,{weaponId:12,payload:'kinetic'});
    const kinds=fx.particles.map(p=>p.kind);
    expect(kinds.every(kind=>kind==='owned')).toBe(true);expect(fx.particles[0].art.design.construction).toBe(true);expect(fx.particles[0].art.design.nodes.every(n=>n.kind===0||n.kind===2)).toBe(true);
    expect(kinds).not.toContain('flame');expect(kinds).not.toContain('explosion');
});

test('material pulses are bounded and never repeat after a long frame',()=>{
    const fx=Object.create(WeaponFX.prototype);Object.assign(fx,{particles:[],particleLimit:20});
    const story={recipe:materialRecipe(weaponIdentity({behavior:'drill',payload:'seismic'})),age:1,nextPulse:0,x:10,y:10,r:40,color:'#ffffff'};
    fx.emitStoryParticles(story);const first=fx.particles.map(p=>({...p}));fx.emitStoryParticles(story);
    expect(first).toHaveLength(20);expect(fx.particles).toEqual(first);
    expect(first.every(p=>p.kind==='dust'&&p.vy<0)).toBe(true);
});

test('original projectile bridge visibility suppresses both chassis and trail',()=>{
    const fx=Object.create(WeaponFX.prototype),{context,calls}=captureContext();
    fx.drawProjectile(context,{visible:false,profile:weaponIdentity({name:'Tracer'})});
    expect(calls).toEqual({fill:0,stroke:0,image:0});
});

test('nonexplosive tracer markers never receive generic shrapnel or flame particles',()=>{
    const fx=Object.create(WeaponFX.prototype);fx.particles=[];fx.particleLimit=200;fx.story=()=>({profile:weaponIdentity({weaponId:6})});fx.particle=jest.fn();
    expect(fx.impact(100,100,40,{weaponId:6,payload:'kinetic'})).toBe(true);
    expect(fx.particle).not.toHaveBeenCalled();expect(fx.bursts).toBeUndefined();
});

test('one-shot sprite animations reach their final material frame without looping',()=>{
    for(const [kind,last] of [['flame',5],['explosion',11],['smoke',7],['frostburst',7],['acidburst',7],['foamburst',7]]){
        expect(animatedParticleFrame({kind,age:0,life:1})).toBe(`${kind}-0`);
        expect(animatedParticleFrame({kind,age:1,life:1})).toBe(`${kind}-${last}`);
    }
});

// Hash the actual animated geometry, excluding names/IDs/palettes/signature
// metadata. The raster audit separately compares all baked channels and alpha.
test('770 weapons own different assets and different rendered motion graphs',()=>{
    expect(WEAPON_ART).toHaveLength(770);expect(new Set(WEAPON_ART.map(d=>d.asset)).size).toBe(770);
    const graphs=new Set();
    for(const weapon of registry){
        const design=weaponArt(weapon);expect(design.name).toBe(weapon.name);
        const frames=ART_FRAMES.map(frame=>artPose(design,frame));
        expect(frames.every(nodes=>nodes.length>0&&nodes.length<=40&&nodes.every(n=>n.every(Number.isFinite)))).toBe(true);
        graphs.add(JSON.stringify(frames));
    }
    expect(graphs.size).toBe(770);expect(weaponArt({weaponId:8000})).toBeNull();
});
