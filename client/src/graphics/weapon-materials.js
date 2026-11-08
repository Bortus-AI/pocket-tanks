// Physical material and delivery recipes. These do not invent new impacts or
// affect scoring: a weapon's actual runtime owns those events and positions.
const group = (names, mechanic) => names.split(' ').includes(mechanic);
const PAYLOADS = {ballistic:'kinetic',thermal:'fire',crystalline:'frost',solvent:'acid',staccato:'ion',stratified:'earth',returnflow:'leech',pneumatic:'foam',ferrous:'magnet',unstable:'volatile'};

export const materialRecipe = profile => {
    const mechanic=profile.mechanic,material=PAYLOADS[profile.material.primary]||'kinetic';
    const construction=group('wall dome berm platform bridge selfbridge seed selfdome selfrubberdome pedestal scatterbuild pillars selfshelter island',mechanic);
    const boring=group('drill tunnel excavator crater well longtunnel drillburst groundfan saw',mechanic);
    const lateral=group('barrage carpet trench groundwave fault landslide sweep sideways',mechanic);
    const scatter=group('cluster split spread stream skyfall proximity ring',mechanic);
    const field=profile.presentation==='field';
    return {
        material,construction,field,probe:profile.presentation==='probe',
        layout:construction?'surface':boring?'jet':lateral?'lateral':scatter?'spray':field?'inward':'radial',
        projectile:profile.presentation==='probe'?'tracer':group('guided selflaunch jump',mechanic)?'rocket':boring?'drill':
            group('mine roller bouncer ricochet',mechanic)?'grenade':construction||material==='foam'?'capsule':material==='frost'?'ice':
            material==='acid'?'liquid':['ion','magnet','leech'].includes(material)||field?'plasma':'shell',
        pulses:construction?[.05,.18,.4]:boring?[.04,.15,.3,.5]:lateral?[.02,.12,.25]:scatter?[.04,.2]:field?[.05,.24,.45]:[.08,.25],
    };
};

export const materialSample = (recipe, progress, index, count) => {
    const t=count>1?index/(count-1):.5,a=index*2.399963;
    if(recipe.layout==='surface')return {x:(t-.5)*1.7,y:.05,vx:(t-.5)*22,vy:-20-progress*10};
    if(recipe.layout==='jet')return {x:Math.cos(a)*.18,y:0,vx:Math.cos(a)*32,vy:-90-t*90};
    if(recipe.layout==='lateral')return {x:(t-.5)*1.6,y:-.04,vx:(t-.5)*100,vy:-20-t*35};
    if(recipe.layout==='spray')return {x:Math.cos(a)*.28,y:Math.sin(a)*.12,vx:Math.cos(a)*80,vy:-40-Math.abs(Math.sin(a))*80};
    if(recipe.layout==='inward')return {x:Math.cos(a)*.7,y:Math.sin(a)*.45-.3,vx:-Math.cos(a)*24,vy:-Math.sin(a)*24-10};
    return {x:Math.cos(a)*.28,y:Math.sin(a)*.16,vx:Math.cos(a)*35,vy:-20-Math.abs(Math.sin(a))*35};
};
