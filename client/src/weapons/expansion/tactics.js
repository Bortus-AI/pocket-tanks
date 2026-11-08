import { createWeaponZone, emitWeaponBeam, emitWeaponImpact } from '../../graphics/weapon-fx';
import { advanceDeployables, damageDeployables, disruptDeployables, exportDeployables, importDeployables } from './deployables';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const TACTICAL_STATE_DEFAULTS = Object.freeze({ shield:0, frost:0, frostMoves:0, acid:0, marked:0, foam:0 });
export const tankState = tank => tank.tactics || (tank.tactics = { ...TACTICAL_STATE_DEFAULTS });
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
export const SHIELD_CAP = 150;
export const addShield = (tank, amount) => { const state=tankState(tank); state.shield=clamp((Number.isFinite(state.shield)?state.shield:0)+amount,0,SHIELD_CAP); };
// Shields are temporary charge: each time their owner fires, a quarter of the
// remaining charge (at least 5 points) bleeds away before the new shot resolves.
export const decayShield = tank => {
    const state=tankState(tank);
    if(!(state.shield>0)) { state.shield=0; return 0; }
    const loss=Math.min(state.shield,Math.max(5,Math.ceil(state.shield*.25)));
    state.shield-=loss; return loss;
};
// Launch a tank without letting the push carry it past either map edge. The
// flight-time bound assumes a worst-case fall to the bottom of the battlefield.
export const safeLaunch = (scene,tank,vx,vy,gravity=300) => {
    const width=scene?.terrain?.width, height=scene?.terrain?.height;
    if(Number.isFinite(width)&&Number.isFinite(tank.x)) {
        const drop=Math.max(0,(Number.isFinite(height)?height:600)-(tank.y||0));
        const time=Math.max(.25,(-vy+Math.sqrt(Math.max(0,vy*vy+2*gravity*drop)))/gravity);
        const margin=24, maxRight=Math.max(0,(width-margin-tank.x)/time), maxLeft=Math.min(0,(margin-tank.x)/time);
        vx=clamp(vx,maxLeft,maxRight);
    }
    tank.body.setVelocity(vx,vy); tank.body.setGravityY(gravity); tank.settled=false;
    return vx;
};
// One-shot bookkeeping for a runtime: Ion arcs, delayed volatile blasts, fire
// patches and foam mounds are counted per shot, not per bomblet or burst.
export const payloadLedger = weapon => {
    const handler=weapon.weaponHandler||(weapon.weaponHandler={});
    return handler.payloadLedger||(handler.payloadLedger={ionArced:new Set(),volatile:false,fireZones:0});
};
const centreOf = tank => tank?.centre || tank;

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
export const addZone = (scene,owner,kind,x,y,radius,payload,sourceWeaponId,extra={}) => {
    const world=worldState(scene);
    // Bounded per-match state and visual objects.
    if(world.zones.length>=24) world.zones.shift().visual?.destroy();
    const color={mine:0xffce79,fire:0xf99758,oil:0x8b85b0,acid:0xb9e875}[kind];
    const weaponId=sourceWeaponId??owner?.turret?.activeWeapon?.id??scene.weaponFX?.lastWeaponOptions?.weaponId;
    const visual=createWeaponZone(scene,{kind,x,y,radius,payload,weaponId})
        || scene.add.ellipse(x,y-2,radius*2,kind==='mine'?12:18,color,.23).setStrokeStyle(1,color,.8).setDepth(1);
    const zone={id:world.nextZone++,kind,x,y,radius,payload,weaponId,owner,ttl:kind==='mine'?8:3,armedAt:world.shot+1,group:world.shot,visual,...extra};
    // A mine ignores its owner until the owner has been seen outside its radius.
    if(kind==='mine'&&zone.ownerClear===undefined) zone.ownerClear=!owner||distance(centreOf(owner),{x,y})>=radius;
    world.zones.push(zone);
    return zone;
};
// Damage for owner-protected payloads: same falloff as splashScore, owner excluded.
const hostileSplash = (weapon,x,y,r,factor,protectOwner) => {
    if(!protectOwner) return splashScore(weapon,x,y,r,factor);
    const target=enemyOf(weapon.scene,weapon.tank);
    const d=target.isPointInside?.(x,y)?0:distance(centreOf(target),{x,y});
    return scoreHit(weapon.tank,target,Math.max(0,(r-d)*factor));
};
export const applyPayload = (weapon,x,y,r,enemyDamage=0,options={}) => {
    const {scene,tank}=weapon, definition=weapon.weaponHandler.definition, key=definition.payload.key;
    const protect=!!options.protectOwner, ledger=payloadLedger(weapon);
    const ownerDistance=distance(centreOf(tank),{x,y});
    // Device damage follows the delivering weapon's strength and payload damage.
    // Owner-protected deliveries never wreck devices (a wreck blasts its surroundings).
    if(!protect&&['kinetic','fire','volatile','ion','seismic','acid'].includes(key)) {
        const strength=Number.isFinite(options.strength)?options.strength:Number.isFinite(definition.strength)?definition.strength:1;
        const factor=clamp(strength*(definition.payload.damage??1),.1,2);
        damageDeployables(scene,x,y,r,Math.max(2,r*.8*factor),scoreHit);
    }
    disruptDeployables(scene,x,y,r,key);
    const near=tanksInRange(scene,x,y,r+24);
    const hostile=near.filter(target=>!protect||target!==tank);
    if(key==='fire') {
        const oils=worldState(scene).zones.filter(z=>z.kind==='oil'&&distance(z,{x,y})<r+z.radius);
        oils.forEach(z=>{hostileSplash(weapon,z.x,z.y,z.radius*1.3,.8,protect);});
        clearZones(scene,x,y,r,['oil']);
        // Fire patches from one shot share a group (a tank burns once per shot
        // for the whole group) and are capped so bursts cannot carpet the map.
        const fireRadius=r*.8, ownerInside=protect&&ownerDistance<fireRadius+24;
        if(!ownerInside&&ledger.fireZones<3) {
            ledger.fireZones++;
            addZone(scene,tank,'fire',x,y,fireRadius,key,weapon.id??definition.id);
        }
        // Heat thaws frost and burns away foam alike.
        near.forEach(t=>{tankState(t).frost=0;tankState(t).foam=0;});
    }
    if(key==='frost') {clearZones(scene,x,y,r,['fire']);hostile.forEach(t=>{tankState(t).frost=2;tankState(t).frostMoves=0;});}
    if(key==='acid') hostile.forEach(t=>{tankState(t).acid=2;});
    if(key==='magnet') hostile.forEach(t=>{tankState(t).marked=2;});
    if(key==='ion') {
        hostile.forEach(t=>{tankState(t).shield=0;});
        // Each marked tank is arced at most once per shot, however many bomblets land.
        [scene.tank1,scene.tank2].filter(t=>(!protect||t!==tank)&&!ledger.ionArced.has(t)&&tankState(t).marked&&distance(t.centre,{x,y})<r+130).forEach(t=>{
            ledger.ionArced.add(t);
            scoreHit(tank,t,24);
            if (!emitWeaponBeam(scene,x,y,t.centre.x,t.centre.y,{weaponId:weapon.id??definition.id,payload:'ion',color:0xc9b3ff,heavy:false})) {
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
        else if(!protect||ownerDistance>=r+40) {
            // Cap mounds per shot so many-shot foam weapons cannot flood the map.
            const ledger=payloadLedger(weapon);
            ledger.foamDeposits=(ledger.foamDeposits||0)+1;
            if(ledger.foamDeposits<=3) depositFoam(scene,x,y,r);
        }
    }
    if(key==='seismic') {
        const mines=worldState(scene).zones.filter(z=>z.kind==='mine'&&distance(z,{x,y})<r+z.radius);
        // Owner-protected tremors defuse mines quietly instead of detonating them.
        if(!protect) mines.forEach(z=>{splashScore(weapon,z.x,z.y,45,.6);});
        clearZones(scene,x,y,r,['mine']);
    }
    // Delayed ordnance belongs to the payload, including walls, fields and
    // planted hazards that never call burst() during their initial delivery.
    // One delayed blast per shot; r is already payload-scaled, burst() rescales.
    const runtime=weapon.weaponHandler;
    if(key==='volatile'&&options.delayed!==false&&runtime.schedule&&runtime.burst&&!ledger.volatile&&!(protect&&ownerDistance<r+40)) {
        ledger.volatile=true;
        const scale=definition.payload.radius||1;
        runtime.schedule(.45,()=>runtime.burst(x,y,r*.65/scale,(options.strength??definition.strength)*.5,false));
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
    const triggered = world.zones.filter(zone => {
        if (zone.kind !== 'mine') return false;
        const near = tanksInRange(scene, zone.x, zone.y, zone.radius);
        // The owner can always drive off its own fresh mine: it only counts as a
        // trigger after the owner has been seen clear of the radius.
        if (zone.owner && !near.includes(zone.owner)) zone.ownerClear = true;
        if (world.shot < zone.armedAt) return false;
        return near.some(tank => tank !== zone.owner || zone.ownerClear);
    });
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
    decayShield(shooter);
    if (state.frost > 0 || state.foam > 0) state.frostMoves = 0;
    if (state.frost > 0) state.frost--;
    if (state.foam > 0) state.foam--;
    if (state.acid > 0) state.acid--;
    if (state.marked > 0) state.marked--;
    checkTacticalMines(scene);
    const expired = new Set(), burned = new Set();
    [...world.zones].forEach(zone => {
        const near = tanksInRange(scene, zone.x, zone.y, zone.radius);
        if (zone.kind === 'fire' || zone.kind === 'acid') near.forEach(tank => {
            // Overlapping patches laid by one shot hurt a tank once, not per patch.
            const key = `${zone.kind}:${zone.group ?? `z${zone.id}`}:${tank === scene.tank1 ? 1 : 2}`;
            if (burned.has(key)) return;
            burned.add(key);
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

// Snapshots arrive from the network or storage: every field is validated and
// merged over defaults, so a missing value can never become NaN/undefined.
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const ZONE_KINDS = ['mine','fire','oil','acid'];
const sanitizeState = (state = {}) => {
    const source = state && typeof state === 'object' ? state : {};
    const clean = {};
    Object.entries(TACTICAL_STATE_DEFAULTS).forEach(([key, fallback]) => {
        clean[key] = clamp(finite(source[key], fallback), 0, key === 'shield' ? SHIELD_CAP : 99);
    });
    return clean;
};
export const importTactics = (scene,snapshot) => {
    if(!snapshot || typeof snapshot !== 'object') return;
    const states = Array.isArray(snapshot.states) ? snapshot.states : [];
    scene.tank1.tactics=sanitizeState(states[1]);scene.tank2.tactics=sanitizeState(states[0]);
    if(Array.isArray(snapshot.scores)){
        if(Number.isFinite(snapshot.scores[1])) scene.tank1.score=snapshot.scores[1];
        if(Number.isFinite(snapshot.scores[0])) scene.tank2.score=snapshot.scores[0];
    }
    const world = worldState(scene);
    world.zones.forEach(z=>z.visual?.destroy());
    Object.assign(world, {shot:Math.max(0,Math.floor(finite(snapshot.shot,world.shot||0))),zones:[],nextZone:1});
    const zones = Array.isArray(snapshot.zones) ? snapshot.zones : [];
    zones.filter(z=>z&&ZONE_KINDS.includes(z.kind)&&Number.isFinite(z.x)&&Number.isFinite(z.y)&&Number.isFinite(z.radius)&&z.radius>0).slice(-24).forEach(z=>{
        const added=addZone(scene,z.owner===1?scene.tank2:scene.tank1,z.kind,z.x,z.y,z.radius,z.payload,z.weaponId);
        const id=Number.isInteger(z.id)&&z.id>0?z.id:added.id;
        Object.assign(added,{ttl:finite(z.ttl,added.ttl),armedAt:finite(z.armedAt,added.armedAt),id,group:finite(z.group,`z${id}`)});
        if(typeof z.ownerClear==='boolean') added.ownerClear=z.ownerClear;
        world.nextZone=Math.max(world.nextZone,id+1);
    });
    importDeployables(scene,Array.isArray(snapshot.devices)?snapshot.devices:[],snapshot.nextDevice);
};
