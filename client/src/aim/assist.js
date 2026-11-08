import { createPreviewWorld } from './preview-world';
const TAU=Math.PI*2,wrap=a=>((a+Math.PI)%TAU+TAU)%TAU-Math.PI;
const selfModes=new Set(['shield','repair','cleanse','kamikaze','selfdome','selfrubberdome','well','pedestal','jump','randomblink','longtunnel','selflaunch','selfescape','selfbridge','selfshelter','wavecoat']);

export function aimKind(entry) {
    if(entry.tetherEffect)return 'projectile';
    if(entry.laterEffect==='neutron-beam'||entry.name==='Saucer Attack')return 'automatic';
    if(['leap-frog','fix-it-foam','crash-dive','upheaval','stomper','breakout','bunker','cavern','retreat','super-retreat','dash','foundation','auto-turrets'].includes(entry.laterEffect))return 'self';
    if(['time-bomb','puddle-jumper','backtrack','matter-blaster','lock-box','bumpers','rebound-lasers','jump-rope','mirror-ball','six-shooter','gravity-grenade','coin-toss','bumper-bowling','firefight','bungee-punch','bombardment'].includes(entry.laterEffect))return 'projectile';
    if(entry.id===8)return 'directional';
    if(entry.id===27||selfModes.has(entry.classicMechanic||entry.behavior))return 'self';
    if(entry.behavior==='cheapshot'||entry.classicMechanic==='selflaser'||entry.options?.enemyTurret||(entry.options?.both&&entry.classicMechanic==='pitfall')||entry.classicMechanic==='sideways'||(entry.classicMechanic==='spread'&&entry.options?.side))return 'automatic';
    if(['laser','rail'].includes(entry.behavior)||entry.classicMechanic==='sweep')return 'beam';
    return 'projectile';
}

// Analytic arcs seed the search. Every candidate is then checked using the
// weapon's real update logic, including semi-implicit 60 Hz gravity and muzzle.
export function ballisticSeeds(origin,target,speedFactor,gravity) {
    const seeds=[];
    for(let power=2;power<=100;power+=2){
        const v=power*speedFactor;
        for(const high of [false,true]){
            let a=Math.atan2(target.y-origin.y,target.x-origin.x),valid=true;
            for(let iteration=0;iteration<4;iteration++){
                const ox=origin.x+16*Math.cos(a),oy=origin.y+16*Math.sin(a),dx=target.x-ox,dy=oy-target.y;
                // Euler gravity adds g*t/120 to the continuous trajectory.
                const effectiveDy=dy+Math.abs(dx)/Math.max(1,Math.abs(v*Math.cos(a)))*gravity/120;
                const disc=v**4-gravity*(gravity*dx*dx+2*effectiveDy*v*v);
                if(disc<0||!gravity){valid=false;break;}
                const up=Math.atan((v*v+(high?1:-1)*Math.sqrt(disc))/(gravity*Math.abs(dx)));
                a=dx<0?Math.PI+up:-up;
            }
            if(valid)seeds.push({rotation:wrap(a+Math.PI/2),power});
        }
    }
    return seeds;
}

export async function findAim(tank,{yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0)),isCurrent=()=>true}={}) {
    const scene=tank.scene,entry=scene.arsenal?.catalog.find(w=>w.id===tank.weapons[tank.selectedWeapon]?.id);
    if(!entry)return {status:'unavailable'};
    const kind=aimKind(entry),foe=tank===scene.tank1?scene.tank2:scene.tank1;
    if(kind==='self'||kind==='automatic')return {status:kind,weaponId:entry.id};
    if(kind==='directional')return {status:'directional',rotation:Math.atan2(foe.y-tank.y,foe.x-tank.x)+Math.PI/2,power:tank.power,weaponId:entry.id};
    const preview=createPreviewWorld(scene,tank),direct=wrap(Math.atan2(foe.centre.y-tank.turret.y,foe.centre.x-tank.turret.x)+Math.PI/2);
    const launch=preview.run(entry,direct,50,true).launch;
    const factor=launch?Math.hypot(launch.vx,launch.vy)/50:8,gravity=launch?.gravity||300;
    const seeds=[{rotation:tank.turret.rotation,power:tank.power},{rotation:direct,power:tank.power}];
    if(kind!=='beam')seeds.push(...ballisticSeeds(tank.turret,foe.centre,factor,gravity).sort((a,b)=>Math.abs(a.power-tank.power)-Math.abs(b.power-tank.power)));
    const rules=entry.mechanicalRules||[];
    if(kind==='projectile'&&(rules.includes('apex-dive')||entry.behavior==='cluster'||['split','scatterbuild'].includes(entry.classicMechanic))){
        const dx=foe.centre.x-tank.turret.x;
        for(let power=10;power<=100;power+=2){
            const v=power*factor,ratio=2*gravity*Math.max(0,Math.abs(dx)-12)/(v*v);
            if(ratio>1)continue;
            for(const up of [Math.asin(ratio)/2,(Math.PI-Math.asin(ratio))/2])seeds.push({rotation:wrap((dx<0?Math.PI+up:-up)+Math.PI/2),power});
        }
    }
    // A broad search also covers returns, banks, burrowing and non-ballistic
    // authored rules; it includes firing away from the opponent.
    if(kind!=='beam')for(let angle=-175;angle<=175;angle+=25)for(const power of [25,50,75,100])seeds.push({rotation:angle*Math.PI/180,power});
    else for(let offset=-12;offset<=12;offset+=1)seeds.push({rotation:direct+offset*Math.PI/180,power:tank.power});
    let best=null,trials=0,lastYield=performance.now();const seen=new Set();
    const test=async candidate=>{
        candidate={rotation:wrap(candidate.rotation),power:Math.max(1,Math.min(100,Math.round(candidate.power)))};
        const key=candidate.power+':'+candidate.rotation.toFixed(5);if(seen.has(key))return;seen.add(key);
        if(!isCurrent())return;
        const result=preview.run(entry,candidate.rotation,candidate.power);
        // Damage is authoritative for offensive payloads. For a harmless
        // builder or tracer, target the actual delivery instead.
        const rank=(result.score>0?10000+Math.min(2000,result.score)*10:0)-Math.min(5000,result.distance)+(result.score<0?result.score*10:0);
        const adjustment=Math.abs(wrap(candidate.rotation-tank.turret.rotation))*.01+Math.abs(candidate.power-tank.power)*.0001;
        const value=(result.deliveries>0||result.score>0)?rank-adjustment:-Infinity;
        if(Number.isFinite(value)&&(!best||value>best.value))best={...candidate,...result,value};
        trials++;
        if(performance.now()-lastYield>12){await yieldControl();lastYield=performance.now();}
    };
    for(const seed of seeds){await test(seed);if(!isCurrent())return {status:'cancelled'};if(best?.distance===0&&best.score>=0)break;}
    // Integer power matches Tank.setPower. Refine angle below the hull width
    // even at the far edge of the battlefield.
    for(const step of [2,.5,.125]){
        if(!best)break;const center={...best};
        for(let dp=-2;dp<=2;dp++)for(let da=-2;da<=2;da++)await test({rotation:center.rotation+da*step*Math.PI/180,power:center.power+dp});
        if(!isCurrent())return {status:'cancelled'};
    }
    if(!best)return {status:'blocked',trials,weaponId:entry.id};
    return {...best,status:best.score>0||best.distance<24?'aimed':'best',trials,weaponId:entry.id};
}

export async function assistTank(tank) {
    if(tank.gameType===3||!tank.active||tank.turret.activeWeapon||!tank.weapons[tank.selectedWeapon])return {status:'unavailable'};
    const token={};tank.aimRequest=token;
    const scene=tank.scene,id=tank.weapons[tank.selectedWeapon].id,foe=tank===scene.tank1?scene.tank2:scene.tank1;
    const snapshot=()=>[tank.x,tank.y,tank.rotation,foe.x,foe.y,foe.rotation,tank.power,tank.turret.relativeRotation,tank.selectedWeapon,scene.activeTank,scene.terrain.revision];
    const initial=JSON.stringify(snapshot());
    const isCurrent=()=>tank.aimRequest===token&&tank.scene===scene&&tank.active&&!tank.turret.activeWeapon&&tank.weapons[tank.selectedWeapon]?.id===id&&JSON.stringify(snapshot())===initial&&scene.scene.isActive();
    const result=await findAim(tank,{isCurrent});
    if(!isCurrent())return {status:'cancelled'};
    if(Number.isFinite(result.rotation)&&Number.isFinite(result.power)){
        tank.turret.setRelativeRotation(wrap(result.rotation-tank.rotation));tank.setPower(result.power);
        scene.HUD?.mobileAim?.refresh();
    }
    tank.lastAimResult=result;
    return result;
}
