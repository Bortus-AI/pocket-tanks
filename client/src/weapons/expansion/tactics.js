import { createWeaponZone, emitWeaponBeam, emitWeaponImpact } from '../../graphics/weapon-fx';
import { advanceDeployables, damageDeployables, disruptDeployables, exportDeployables, importDeployables } from './deployables';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const tankState = tank => tank.tactics || (tank.tactics = { shield:0, frost:0, frostMoves:0, acid:0, marked:0, foam:0 });
export const worldState = scene => {
    if (scene.tacticalWorld) return scene.tacticalWorld;
    const world = { shot:0, zones:[], nextZone:1 };
    scene.tacticalWorld = world;
    // Proximity mines respond to driving as well as firing. The listener belongs
    // to this scene lifetime and is removed before a match restarts.
    const physics = scene.physics?.world;
    if (physics && scene.events) {
        const step = () => { if (scene.tacticalWorld === world) checkTacticalMines(scene); };
        physics.on('worldstep', step);
        scene.events.once('shutdown', () => physics.off('worldstep', step));
    }
    return world;
};
export const tanksInRange = (scene,x,y,r) => [scene.tank1,scene.tank2].filter(t => distance(t.centre || t,{x,y}) < r);
export const enemyOf = (scene,tank) => tank === scene.tank1 ? scene.tank2 : scene.tank1;
export const addShield = (tank, amount) => { const state=tankState(tank); state.shield=clamp(state.shield+amount,0,150); };

// Points are the game's damage model. Shield absorption applies to both the
// legacy arsenal and the expansion, including negative points for self hits.
export const scoreHit = (attacker, target, amount) => {
    const state=tankState(target);
    let damage=Math.max(0,Math.round(amount*(state.acid>0?1.35:1)));
    const absorbed=Math.min(state.shield,damage); state.shield-=absorbed; damage-=absorbed;
    if(damage) attacker.updateScore(target===attacker?-damage:damage);
    return damage;
};
export const splashScore = (weapon,x,y,r,factor) => {
    let enemyDamage=0;
    for(const target of [weapon.scene.tank1,weapon.scene.tank2]) {
        const d=target.isPointInside(x,y)?0:distance(target.centre,{x,y});
        const dealt=scoreHit(weapon.tank,target,Math.max(0,(r-d)*factor));
        if(target!==weapon.tank) enemyDamage+=dealt;
    }
    return enemyDamage;
};
export const clearStatuses = tank => { const s=tankState(tank); s.frost=0;s.frostMoves=0;s.acid=0;s.marked=0;s.foam=0; };
// Foam is sprayed as real terrain: a soft mound that can bog down or bury
// whatever it lands on. It never builds over the firing tank.
export const FOAM_COLOR = 'rgb(214,240,224)';
export const depositFoam = (scene,x,y,r) => {
    const terrain=scene.terrain, ctx=terrain?.context;
    if(!ctx) return false;
    const rx=clamp(r*1.15,14,80), ry=clamp(r*.7,10,50);
    ctx.save(); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1; ctx.fillStyle=FOAM_COLOR;
    ctx.beginPath(); ctx.ellipse(x,y+ry*.25,rx,ry,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    terrain.update?.();
    [scene.tank1,scene.tank2].forEach(t=>{ if(t) t.settled=false; });
    return true;
};
export const clearZones = (scene,x,y,r,kinds) => {
    const world=worldState(scene);
    world.zones=world.zones.filter(z=>{
        if(distance(z,{x,y})<r+z.radius && (!kinds || kinds.includes(z.kind))) { z.visual?.destroy();return false; }
        return true;
    });
};
export const addZone = (scene,owner,kind,x,y,radius,payload,sourceWeaponId) => {
    const world=worldState(scene);
    // Bounded per-match state and visual objects.
    if(world.zones.length>=24) world.zones.shift().visual?.destroy();
    const color={mine:0xffce79,fire:0xf99758,oil:0x8b85b0,acid:0xb9e875}[kind];
    const weaponId=sourceWeaponId??owner?.turret?.activeWeapon?.id??scene.weaponFX?.lastWeaponOptions?.weaponId;
    const visual=createWeaponZone(scene,{kind,x,y,radius,payload,weaponId})
        || scene.add.ellipse(x,y-2,radius*2,kind==='mine'?12:18,color,.23).setStrokeStyle(1,color,.8).setDepth(1);
    world.zones.push({id:world.nextZone++,kind,x,y,radius,payload,weaponId,owner,ttl:kind==='mine'?8:3,armedAt:world.shot+1,visual});
};
export const applyPayload = (weapon,x,y,r,enemyDamage=0,options={}) => {
    const {scene,tank}=weapon, key=weapon.weaponHandler.definition.payload.key;
    if(['kinetic','fire','volatile','ion','seismic','acid'].includes(key))damageDeployables(scene,x,y,r,Math.max(5,r*.8),scoreHit);
    disruptDeployables(scene,x,y,r,key);
    const near=tanksInRange(scene,x,y,r+24);
    const hostile=near.filter(target=>!options.protectOwner||target!==tank);
    if(key==='fire') {
        const oils=worldState(scene).zones.filter(z=>z.kind==='oil'&&distance(z,{x,y})<r+z.radius);
        oils.forEach(z=>{splashScore(weapon,z.x,z.y,z.radius*1.3,.8);});
        clearZones(scene,x,y,r,['oil']);
        addZone(scene,tank,'fire',x,y,r*.8,key,weapon.id??weapon.weaponHandler.definition.id);
        near.forEach(t=>{tankState(t).frost=0;});
    }
    if(key==='frost') {clearZones(scene,x,y,r,['fire']);hostile.forEach(t=>{tankState(t).frost=2;tankState(t).frostMoves=0;});}
    if(key==='acid') hostile.forEach(t=>{tankState(t).acid=2;});
    if(key==='magnet') hostile.forEach(t=>{tankState(t).marked=2;});
    if(key==='ion') {
        hostile.forEach(t=>{tankState(t).shield=0;});
        [scene.tank1,scene.tank2].filter(t=>(!options.protectOwner||t!==tank)&&tankState(t).marked&&distance(t.centre,{x,y})<r+130).forEach(t=>{
            scoreHit(tank,t,24);
            if (!emitWeaponBeam(scene,x,y,t.centre.x,t.centre.y,{weaponId:weapon.id??weapon.weaponHandler.definition.id,payload:'ion',color:0xc9b3ff,heavy:false})) {
                const line=scene.add.line(0,0,x,y,t.centre.x,t.centre.y,0xc9b3ff,.9).setOrigin(0).setDepth(5);
                scene.tweens.add({targets:line,alpha:0,duration:300,onComplete:()=>line.destroy()});
            }
        });
    }
    if(key==='leech'&&enemyDamage>0) addShield(tank,Math.ceil(enemyDamage*.6));
    if(key==='foam') {
        clearZones(scene,x,y,r,['fire','acid']);
        // Enemies are coated (treads gummed for their next turn), never shielded.
        near.filter(t=>t!==tank).forEach(t=>{tankState(t).foam=1;tankState(t).frostMoves=0;});
        // Foam fired around yourself is protective: cleanse and a small shield.
        if(near.includes(tank)) {clearStatuses(tank);addShield(tank,30);}
        else {
            // Cap mounds per shot so many-shot foam weapons cannot flood the map.
            const handler=weapon.weaponHandler||{};
            handler.foamDeposits=(handler.foamDeposits||0)+1;
            if(handler.foamDeposits<=3) depositFoam(scene,x,y,r);
        }
    }
    if(key==='seismic') {
        const mines=worldState(scene).zones.filter(z=>z.kind==='mine'&&distance(z,{x,y})<r+z.radius);
        mines.forEach(z=>{splashScore(weapon,z.x,z.y,45,.6);});
        clearZones(scene,x,y,r,['mine']);
    }
    // Delayed ordnance belongs to the payload, including walls, fields and
    // planted hazards that never call burst() during their initial delivery.
    if(key==='volatile'&&options.delayed!==false&&weapon.weaponHandler.schedule&&weapon.weaponHandler.burst) {
        const runtime=weapon.weaponHandler;
        runtime.schedule(.45,()=>runtime.burst(x,y,r*.65,(options.strength??runtime.definition.strength)*.5,false));
    }
};

const detonateMine = (scene, zone) => {
    let enemyDamage = 0;
    [scene.tank1, scene.tank2].forEach(tank => {
        const damage = scoreHit(zone.owner, tank, Math.max(0, 50 - distance(tank.centre, zone)));
        if (tank !== zone.owner) enemyDamage += damage;
    });
    const terrain = scene.terrain, ctx = terrain.context;
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(zone.x, zone.y, 32, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    terrain.update(); terrain.fixTerrain(Math.round(zone.x), Math.round(zone.y), 32);
    const weapon = { scene, tank:zone.owner, id:zone.weaponId,weaponHandler:{ definition:{id:zone.weaponId, payload:{key:zone.payload} } } };
    applyPayload(weapon, zone.x, zone.y, 32, enemyDamage);
    emitWeaponImpact(scene,zone.x,zone.y,45,{weaponId:zone.weaponId,payload:zone.payload || 'kinetic',behavior:'mine',color:0xffce79});
};

export const checkTacticalMines = scene => {
    const world = worldState(scene);
    const triggered = world.zones.filter(zone => zone.kind === 'mine' && world.shot >= zone.armedAt && tanksInRange(scene, zone.x, zone.y, zone.radius).length);
    if (!triggered.length) return;
    const ids = new Set(triggered.map(zone => zone.id));
    // Remove first: an ion/seismic payload may mutate the zone collection.
    world.zones = world.zones.filter(zone => !ids.has(zone.id));
    triggered.forEach(zone => { zone.visual?.destroy(); detonateMine(scene, zone); });
};

// Effects age at shot boundaries, not wall-clock time. Mine proximity is checked
// on physics steps too, so a player cannot safely drive across an armed mine.
export const beginTacticalShot = (scene, shooter) => {
    const world = worldState(scene); world.shot++;
    advanceDeployables(scene,world.shot,scoreHit);
    const state = tankState(shooter);
    if (state.frost > 0 || state.foam > 0) state.frostMoves = 0;
    if (state.frost > 0) state.frost--;
    if (state.foam > 0) state.foam--;
    if (state.acid > 0) state.acid--;
    if (state.marked > 0) state.marked--;
    checkTacticalMines(scene);
    const expired = new Set();
    [...world.zones].forEach(zone => {
        const near = tanksInRange(scene, zone.x, zone.y, zone.radius);
        if (zone.kind === 'fire' || zone.kind === 'acid') near.forEach(tank => {
            scoreHit(zone.owner, tank, zone.kind === 'fire' ? 12 : 7);
            if (zone.kind === 'acid') tankState(tank).acid = 2;
        });
        zone.ttl--;
        if (zone.ttl <= 0) expired.add(zone.id);
    });
    world.zones = world.zones.filter(zone => {
        if (expired.has(zone.id)) { zone.visual?.destroy(); return false; }
        return true;
    });
};

// Ground truth at turn handoff, with tank IDs mapped by the receiver.
export const exportTactics = scene => ({shot:worldState(scene).shot,states:[{...tankState(scene.tank1)},{...tankState(scene.tank2)}],
    scores:[scene.tank1.score,scene.tank2.score],zones:worldState(scene).zones.map(({visual,owner,...zone})=>({...zone,owner:owner===scene.tank1?1:2})),devices:exportDeployables(scene),nextDevice:worldState(scene).nextDevice});
export const importTactics = (scene,snapshot) => {
    if(!snapshot || !Array.isArray(snapshot.states)) return;
    scene.tank1.tactics={...snapshot.states[1]};scene.tank2.tactics={...snapshot.states[0]};
    if(snapshot.scores){scene.tank1.score=snapshot.scores[1];scene.tank2.score=snapshot.scores[0];}
    worldState(scene).zones.forEach(z=>z.visual?.destroy());
    const world = worldState(scene);
    Object.assign(world, {shot:snapshot.shot,zones:[],nextZone:1});
    snapshot.zones.forEach(z=>{
        addZone(scene,z.owner===1?scene.tank2:scene.tank1,z.kind,z.x,z.y,z.radius,z.payload,z.weaponId);
        const added=worldState(scene).zones.at(-1);Object.assign(added,{ttl:z.ttl,armedAt:z.armedAt,id:z.id});
        world.nextZone=Math.max(world.nextZone,z.id+1);
    });
    importDeployables(scene,snapshot.devices||[],snapshot.nextDevice);
};
