import fs from 'fs';
import path from 'path';
import { expansionCatalog } from '../weapons/expansion/catalog';
import { classicAdaptations,earlyClassicAdaptations } from '../weapons/expansion/classics';
import { laterClassicAdaptations,modernClassicAdaptations } from '../weapons/expansion/later-classics';
import { withMechanicalRules,legacyMechanicalRules } from '../weapons/expansion/unique-mechanics';
import { IDENTITY_GEOMETRY,expandedGeometry } from './weapon-identity-geometry';
import { ORIGINAL_WEAPON_NAMES,MECHANIC_STORIES,NAMED_STORIES,RULE_STORIES,weaponIdentity,identitySignature,identityTokens,auditWeaponIdentities,assertUniqueWeaponIdentities } from './weapon-identity';
import { IDENTITY_MOTIONS,MATERIAL_CHOREOGRAPHY,storyboardPose,materialActors } from './weapon-identity-animation';

const standard=fs.readFileSync(path.join(__dirname,'../weapons/packs/Standard/Standard.js'),'utf8');
const baseNames=[...standard.matchAll(/this\.name\s*=\s*'([^']+)'/g)].map(match=>match[1]);
const legacyPayload=id=>[7,8,12,13,17,18,19,25,27].includes(id)?'seismic':id===14?'ion':[15,23].includes(id)?'fire':id===16?'frost':'kinetic';
const registry=baseNames.map((name,id)=>({id,name,payload:{key:legacyPayload(id)},mechanicalRules:legacyMechanicalRules(id)}));
expansionCatalog.forEach(definition=>registry[definition.id]=withMechanicalRules(definition));
const normalized=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
const names=new Set(registry.map(definition=>normalized(definition.name)));
for(const pack of [classicAdaptations,earlyClassicAdaptations,laterClassicAdaptations,modernClassicAdaptations])for(const definition of pack){if(names.has(normalized(definition.name)))continue;names.add(normalized(definition.name));registry.push(withMechanicalRules({...definition,id:registry.length}));}

test('every storyboard token and composed vector part has actual implemented geometry',()=>{
    const profiles=[...Object.keys(MECHANIC_STORIES).map(behavior=>weaponIdentity({behavior})),...Object.keys(NAMED_STORIES).map(name=>weaponIdentity({name})),...Object.keys(RULE_STORIES).map(rule=>weaponIdentity({semanticRules:[rule]}))];
    const missing=[...new Set(profiles.flatMap(identityTokens).filter(token=>!IDENTITY_GEOMETRY[token]))];
    expect(missing).toEqual([]);
    const nestedMissing=[];
    for(const [name,nodes]of Object.entries(IDENTITY_GEOMETRY))for(const node of nodes)if(node.glyph&&!IDENTITY_GEOMETRY[node.glyph])nestedMissing.push(`${name}->${node.glyph}`);
    expect(nestedMissing).toEqual([]);
    Object.keys(IDENTITY_GEOMETRY).forEach(name=>expect(()=>expandedGeometry(name)).not.toThrow());
});

test('animation signatures exclude recoloring, radius, damage, seed and stable ID',()=>{
    const base={name:'Impact Howitzer',behavior:'shell',payload:{key:'kinetic'},mechanicalRules:['contact-fuse']};
    expect(identitySignature(weaponIdentity({...base,id:30,color:0xff0000,radius:20,strength:1,seed:1}))).toBe(identitySignature(weaponIdentity({...base,id:999,color:0x00ff00,radius:100,strength:9,seed:42})));
    expect(()=>assertUniqueWeaponIdentities([{...base,id:1},{...base,id:2,name:'Renamed shell'}])).toThrow(/repeated visual storyboards/);
});

test('late original blasts retain named identity after a handler is disposed',()=>{
    expect(ORIGINAL_WEAPON_NAMES).toEqual(baseNames);
    expect(weaponIdentity({weaponId:6,payload:'kinetic',behavior:'shell'}).presentation).toBe('probe');
    expect(weaponIdentity({weaponId:6,payload:'kinetic',behavior:'shell'}).body).toBe('probe');
});

test('named mechanisms have different rendered geometry and preserve real rule aftermath',()=>{
    const examples=['Auto Turrets','Missile Turret',"Run 'n' Gun",'Fix-it Foam','Warp Missiles','Blender','Earthquake','Rumbler','Laser Net'];
    expect(new Set(examples.map(name=>identitySignature(weaponIdentity({name})))).size).toBe(examples.length);
    const profile=weaponIdentity({name:'Impact Howitzer',behavior:'shell',semanticRules:['contact-fuse','annular-moat']});
    expect(profile.rules.map(rule=>rule.geometry)).toEqual(['fuseclock','moat']);
    expect(profile.unsupportedRules).toEqual([]);
});

test('all authored rhythms, materials and mechanical motions have implemented animation paths',()=>{
    const profiles=[...registry.map(weaponIdentity),...Object.keys(MECHANIC_STORIES).map(behavior=>weaponIdentity({behavior})),...Object.keys(RULE_STORIES).map(rule=>weaponIdentity({semanticRules:[rule]}))];
    const motions=[...new Set(profiles.flatMap(profile=>[profile.rhythm,profile.material.motion,...profile.rules.map(rule=>rule.motion)]))];
    expect(motions.filter(motion=>!IDENTITY_MOTIONS[motion])).toEqual([]);
    expect(profiles.map(profile=>profile.material.primary).filter(primary=>!MATERIAL_CHOREOGRAPHY[primary])).toEqual([]);
    motions.forEach(motion=>[0,.25,.5,.75,1].forEach(progress=>Object.values(storyboardPose(motion,progress)).forEach(value=>expect(Number.isFinite(value)).toBe(true))));
    const profile=weaponIdentity({name:'Blender'});
    expect(storyboardPose(profile.rhythm,.5,true)).toEqual({x:0,y:0,rotation:0,sx:1,sy:1,alpha:1});
    expect(identityTokens(profile)).toContain('blades');
    Object.keys(MATERIAL_CHOREOGRAPHY).forEach(primary=>[false,true].forEach(quiet=>[0,.25,.5,.75,1].forEach(progress=>materialActors(primary,progress,quiet).forEach(actor=>Object.values(actor).forEach(value=>expect(Number.isFinite(value)).toBe(true))))));
});

test('all 770 registered names receive supported storyboards, with exact duplicate diagnostics',()=>{
    const report=auditWeaponIdentities(registry);
    fs.writeFileSync('/tmp/pocket-identity-structural-audit.json',JSON.stringify(report,null,2));
    expect(report.total).toBe(770);
    expect(report.unsupported).toEqual([]);
    if(report.duplicates.length)console.info('REMAINING VISUAL DUPLICATES',JSON.stringify(report.duplicates));
    expect(report.duplicates).toEqual([]);
    const reduced=auditWeaponIdentities(registry,{reducedMotion:true});
    expect(reduced.duplicates).toEqual([]);
});
