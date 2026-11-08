import { applyPayload, distance, enemyOf, scoreHit } from './tactics';
import { emitTerrainBuild, emitWeaponImpact, emitWeaponBeam } from '../../graphics/weapon-fx';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const settledChanged = runtime => {
    [runtime.scene.tank1, runtime.scene.tank2].forEach(tank => {tank.settled = false;});
};
const delivery = (runtime, point) => {runtime.lastDeliveryPoint = {x:point.x, y:point.y};};

// These are complete weapon signatures. They share only low-level runtime
// operations; an ordinary explosion is never substituted for a missing action.
export function shootEarlyEffect(runtime) {
    const name = runtime.definition.name;
    if (name === 'Smoke Bomb') runtime.smokeAffected = new Set();
    if (name === 'Whiplash') runtime.whiplashOrigin = {...runtime.origin()};
    if (name === 'Lucky Shot') {
        const origin = runtime.origin();
        for(let step=0;step<=72;step+=8)runtime.carve(origin.x+Math.cos(origin.angle)*step,origin.y+Math.sin(origin.angle)*step,10);
    }
    if (name === 'Stun Gun') {
        const origin = runtime.origin(),speed=runtime.weapon.tank.power*8;
        for(const offset of[-.09,.09])runtime.fireFrom(origin.x,origin.y,origin.angle+offset,speed,{gravity:300});
        return true;
    }
    if (name === 'Saucer Attack') {
        const foe=enemyOf(runtime.scene,runtime.weapon.tank);
        for(let index=0;index<2;index++)runtime.spawn(clamp(foe.centre.x+(index?90:-90),4,runtime.terrain.width-5),-24-index*20,0,0,{
            child:true,gravity:0,earlyLaserBot:true,laserRole:'saucer',botPhase:index*Math.PI,botPulses:0,
        });
        return true;
    }
    return false;
}

function returnWhiplash(runtime, projectile, replace) {
    const foe = enemyOf(runtime.scene, runtime.weapon.tank);
    const returnY = projectile.y - (replace ? 8 : 0);
    const dx = foe.centre.x - projectile.x, dy = foe.centre.y - returnY;
    const length = Math.max(1, Math.hypot(dx, dy));
    const speed = clamp(Math.hypot(projectile.vx, projectile.vy), 220, 420);
    if (replace) {
        runtime.remove(projectile);
        runtime.spawn(projectile.x, returnY, dx / length * speed, dy / length * speed, {
            gravity:0, guided:true, whiplashReturning:true,
        });
    } else {
        projectile.vx = dx / length * speed;
        projectile.vy = dy / length * speed;
        projectile.gravity = 0;
        projectile.guided = true;
        projectile.whiplashReturning = true;
    }
}

const elements = {
    fire:{key:'fire',name:'Ember',color:0xff834f,radius:.85,damage:.8},
    frost:{key:'frost',name:'Rime',color:0x92e9ff,radius:.8,damage:.65},
};
const withElement = (runtime, key, action) => {
    const definition = runtime.definition, color = runtime.color;
    runtime.definition = {...definition, payload:{...definition.payload, ...elements[key]}};
    runtime.color = elements[key].color;
    try {return action();} finally {runtime.definition=definition;runtime.color=color;}
};

function downhillDirection(runtime,x,y,direction) {
    const step=runtime.options.speed||2.5;
    const left=runtime.ground(x-step),right=runtime.ground(x+step);
    if(direction&&runtime.ground(x+direction*step)>=y-.5)return direction;
    if(left>=y-.5||right>=y-.5)return right>left?1:left>right?-1:direction;
    return 0;
}
function startRolling(runtime,projectile,kind) {
    runtime.walker(projectile);
    const walker=runtime.walkers.at(-1);walker.earlyRolling=kind;walker.earlyHit=new Set();
}
function smokeControls(runtime,projectile) {
    if(!projectile.child||(projectile.classicBounces||0)<(runtime.options.bounces||3))return;
    if(!runtime.smokeAffected)runtime.smokeAffected=new Set();
    for(const tank of[runtime.scene.tank1,runtime.scene.tank2]) {
        if(runtime.smokeAffected.has(tank)||distance(tank.centre,projectile)>runtime.definition.radius+36)continue;
        runtime.smokeAffected.add(tank);
        tank.turret.setRelativeRotation(tank.turret.rotation-(tank.rotation||0)+(runtime.random()<.5?-1:1)*Math.PI/3);
        const amount=15+Math.floor(runtime.random()*26),direction=tank.power>50?-1:1;
        tank.setPower(clamp(tank.power+direction*amount,1,100));
    }
}
function tractorLift(runtime,point) {
    const targets=[runtime.scene.tank1,runtime.scene.tank2].filter(tank=>distance(tank.centre,point)<runtime.definition.radius+100);
    runtime.earlyLifts=targets.map(tank=>{
        const destination=clamp(Math.min(runtime.ground(tank.x)-100,point.y-80),20,runtime.terrain.height-40);
        for(let y=tank.y+8;y>=destination-20;y-=12)runtime.carve(tank.x,y,22);
        tank.body.stop();tank.body.setGravityY(0);tank.settled=false;
        return{tank,x:tank.x,start:tank.y,destination,age:0};
    });
    // Keep-alive pushed directly: the bounded schedule() may drop it, ending the
    // turn mid-lift.
    if(runtime.earlyLifts.length)runtime.events.push({at:runtime.tick+46,fn:()=>{}});
}

export function impactEarlyEffect(runtime, projectile) {
    const name = runtime.definition.name;
    const {x, y} = projectile, terrain = runtime.terrain;
    if(name==='Smoke Bomb')smokeControls(runtime,projectile);
    if (projectile.earlyLaserBot) {
        runtime.remove(projectile);
        return true;
    }
    if (name === 'Fire + Ice' && projectile.child && projectile.childPayloadKey) {
        runtime.remove(projectile);
        const element = projectile.childPayloadKey;
        const bounces = projectile.classicBounces || 0;
        if (bounces < (runtime.options.bounces || 3)) {
            const angle = element === 'fire' ? -Math.PI + .2 + runtime.random() : -.2 - runtime.random();
            const speed = 45 + runtime.random() * 45;
            withElement(runtime, element, () => runtime.spawn(x, y - 5, Math.cos(angle)*speed, Math.sin(angle)*speed, {
                child:true, small:true, gravity:300, childPayloadKey:element, classicBounces:bounces+1,
                childRadius:projectile.childRadius || runtime.definition.radius,
                childStrength:projectile.childStrength || runtime.definition.strength,
            }));
        } else {
            withElement(runtime, element, () => runtime.burst(x, y,
                projectile.childRadius || runtime.definition.radius,
                projectile.childStrength || runtime.definition.strength));
        }
        return true;
    }
    if (name === 'Snowballs' && projectile.child && projectile.earlySnowball) {
        runtime.remove(projectile);
        const hops=projectile.snowBounces||0;
        if(hops<(runtime.options.bounces||3)) {
            const direction=downhillDirection(runtime,x,runtime.ground(x),Math.sign(projectile.vx)||runtime.direction||1);
            runtime.spawn(x,y-5,direction*Math.max(35,Math.abs(projectile.vx)*.7),-Math.max(30,Math.abs(projectile.vy)*.55),{
                child:true,small:true,gravity:300,earlySnowball:true,snowBounces:hops+1,
            });
        } else startRolling(runtime,projectile,'snow');
        return true;
    }
    if (projectile.child) return false;
    if (name === 'Glue Gun' || name === 'Gyro Glue') {
        runtime.remove(projectile);delivery(runtime,projectile);
        withElement(runtime,'fire',()=>{
            runtime.coat(x,y,runtime.options.radius||runtime.definition.radius,false);
            applyPayload(runtime.weapon,x,y,runtime.definition.radius);
        });
        return true;
    }
    if (name === 'Funnel') {
        runtime.remove(projectile);const surface=runtime.ground(x);
        runtime.carve(x,surface+35,80);
        runtime.build(x-95,surface,'wall');runtime.build(x+95,surface,'wall');
        runtime.coat(x,surface+10,180,true);delivery(runtime,projectile);
        applyPayload(runtime.weapon,x,y,runtime.definition.radius);
        return true;
    }
    if (name === 'Rockslide') {
        runtime.remove(projectile);startRolling(runtime,projectile,'rock');delivery(runtime,projectile);
        return true;
    }
    if (name === 'Snowballs') {
        runtime.remove(projectile);
        const direction=downhillDirection(runtime,x,runtime.ground(x),Math.sign(projectile.vx)||runtime.direction||1);
        runtime.spawn(x,y-5,direction*clamp(Math.abs(projectile.vx)*.6,55,150),-90,{
            child:true,small:true,gravity:300,earlySnowball:true,snowBounces:0,
        });
        delivery(runtime,projectile);return true;
    }
    if (name === 'Tractor Beam') {
        runtime.remove(projectile);delivery(runtime,projectile);
        tractorLift(runtime,projectile);
        runtime.burst(x,y,runtime.definition.radius,runtime.definition.strength);
        return true;
    }
    if (name === 'Super Star') {
        runtime.remove(projectile);delivery(runtime,projectile);
        const foe=enemyOf(runtime.scene,runtime.weapon.tank),centerY=Math.min(y-55,foe.centre.y-100);
        for(let index=0;index<3;index++) {
            const phase=index/3*Math.PI*2;
            runtime.spawn(x+Math.cos(phase)*55,centerY+Math.sin(phase)*55,0,0,{
                child:true,gravity:0,earlyLaserBot:true,laserRole:'star',botPhase:phase,botPulses:0,orbitX:x,orbitY:centerY,
            });
        }
        return true;
    }
    if (name === 'Fire + Ice') {
        runtime.remove(projectile);delivery(runtime, projectile);
        const count = clamp(runtime.options.shots || runtime.definition.count || 14, 2, 24);
        const pairs = Math.ceil(count / 2);
        emitWeaponImpact(runtime.scene, x, y, 22, runtime.fxOptions({phase:'split'}));
        for(let index=0;index<count;index++) {
            const fire = index % 2 === 0, slot = Math.floor(index / 2);
            const up = .15 + slot / Math.max(1,pairs-1) * 1.15;
            const angle = fire ? -Math.PI + up : -up;
            const element = fire ? 'fire' : 'frost', speed = 80 + runtime.random() * 70;
            withElement(runtime, element, () => runtime.spawn(x + (fire ? -10 : 10), y-6, Math.cos(angle)*speed, Math.sin(angle)*speed, {
                child:true, small:true, gravity:300, childPayloadKey:element, classicBounces:0,
                childRadius:runtime.definition.radius, childStrength:runtime.definition.strength,
            }));
        }
        return true;
    }
    if (name === 'Hot Potato' && (projectile.classicBounces || 0) >= (runtime.options.bounces || 5)) {
        const bounces = clamp((projectile.classicBounces || 0) + (projectile.bounces || 0), 0, 12);
        const radius = clamp(runtime.definition.radius * (1 + bounces*.14), 4, 105);
        const strength = Math.min(1.6, runtime.definition.strength * (1 + bounces*.12));
        runtime.remove(projectile);delivery(runtime, projectile);
        runtime.pointBurst(x,y,radius,strength);
        if(runtime.options.rubber)runtime.coat(x,y,radius+14,true);
        return true;
    }
    if (name === 'Whiplash' && !projectile.whiplashReturning) {
        const foe = enemyOf(runtime.scene, runtime.weapon.tank);
        const hit = [runtime.scene.tank1, runtime.scene.tank2].some(tank => tank.isPointInside(x, y));
        if (!hit && distance(projectile, foe.centre) > (runtime.options.range || 75)) {
            returnWhiplash(runtime, projectile, true);
            return true;
        }
        return false;
    }
    if (!['Great Wall', 'Glue Storm', 'Blockade', 'Nanobots'].includes(name)) return false;
    runtime.remove(projectile);
    delivery(runtime, projectile);
    if (name === 'Great Wall') {
        const ctx = terrain.context;
        ctx.save();ctx.globalCompositeOperation = 'source-over';ctx.fillStyle = '#75886b';
        ctx.fillRect(clamp(x - 12, 0, terrain.width - 24), 0, 24, terrain.height);ctx.restore();
        terrain.update();settledChanged(runtime);
        applyPayload(runtime.weapon, x, y, runtime.definition.radius);
        emitTerrainBuild(runtime.scene, x, y, 'wall', runtime.fxOptions({height:terrain.height}));
        return true;
    }
    if (name === 'Glue Storm') {
        const ctx = terrain.context;
        ctx.save();ctx.globalCompositeOperation = 'source-atop';ctx.fillStyle = 'rgb(135,155,82)';
        ctx.fillRect(0, 0, terrain.width, terrain.height);ctx.restore();terrain.update();
        applyPayload(runtime.weapon, x, y, runtime.definition.radius);
        emitTerrainBuild(runtime.scene, x, y, 'glue', runtime.fxOptions({radius:terrain.width}));
        return true;
    }
    if (name === 'Blockade') {
        const tanks = [runtime.scene.tank1, runtime.scene.tank2];
        const enclosed = tanks.filter(tank => tank.isPointInside(x, y) || distance(tank.centre, projectile) < 36)
            .sort((a, b) => distance(a.centre, projectile) - distance(b.centre, projectile))[0];
        const center = enclosed?.centre || {x, y:y - 8};
        const ctx = terrain.context;
        // Construction space is cut directly so finishing the shot does not
        // schedule explosion collapse through its new roof.
        ctx.save();ctx.globalCompositeOperation = 'destination-out';ctx.globalAlpha = 1;
        ctx.beginPath();ctx.arc(center.x, center.y, 48, 0, Math.PI * 2);ctx.fill();ctx.restore();
        ctx.save();ctx.globalCompositeOperation = 'source-over';ctx.globalAlpha = 1;ctx.lineWidth = 10;
        ctx.strokeStyle = runtime.options.rubber ? 'rgb(230,0,230)' : '#75886b';
        ctx.beginPath();ctx.arc(center.x, center.y, 62, 0, Math.PI * 2);ctx.stroke();ctx.restore();
        terrain.update();settledChanged(runtime);delivery(runtime, center);
        applyPayload(runtime.weapon, center.x, center.y, 62);
        emitTerrainBuild(runtime.scene, center.x, center.y, 'dome', runtime.fxOptions({radius:62}));
        return true;
    }
    emitWeaponImpact(runtime.scene, x, y, 24, runtime.fxOptions({phase:'swarm'}));
    const count = clamp(runtime.options.shots || runtime.definition.count || 10, 1, 16);
    for (let index = 0; index < count; index++) {
        const phase = index / count * Math.PI * 2;
        runtime.spawn(clamp(x + Math.cos(phase) * 18, 3, terrain.width - 4), y - 22 + Math.sin(phase) * 12, 0, 0, {
            child:true, small:true, gravity:0, earlyLaserBot:true, botPhase:phase, botPulses:0,
        });
    }
    return true;
}

const activeEarlyNames=new Set(['Tractor Beam','Rockslide','Snowballs','Nanobots','Saucer Attack','Super Star','Glue Gun','Whiplash']);
export function updateEarlyEffect(runtime) {
    if(!activeEarlyNames.has(runtime.definition.name))return;
    const foe=enemyOf(runtime.scene,runtime.weapon.tank),name=runtime.definition.name;
    const remaining=[];
    for(const lift of runtime.earlyLifts||[]) {
        lift.age++;
        const tank=lift.tank,progress=Math.min(1,lift.age/45),eased=1-(1-progress)*(1-progress);
        tank.body.stop();tank.body.setGravityY(0);tank.setPosition(lift.x,lift.start+(lift.destination-lift.start)*eased);
        tank.body.updateFromGameObject();tank.body.preUpdate?.(false,0);tank.settled=false;
        if(lift.age%6===0)emitWeaponBeam(runtime.scene,lift.x,lift.start,lift.x,tank.y,runtime.fxOptions({heavy:false}));
        if(progress>=1){tank.body.setVelocity(0,-60);tank.body.setGravityY(300);}else remaining.push(lift);
    }
    runtime.earlyLifts=remaining;
    for(const walker of runtime.walkers||[]) {
        if(!walker.earlyRolling||walker.done)continue;
        walker.direction=downhillDirection(runtime,walker.x,walker.y,walker.direction);
        for(const tank of[runtime.scene.tank1,runtime.scene.tank2]) {
            if(walker.earlyHit.has(tank)||distance(tank.centre,{x:walker.x,y:walker.y-5})>runtime.definition.radius+10)continue;
            walker.earlyHit.add(tank);
            const dealt=scoreHit(runtime.weapon.tank,tank,8);
            applyPayload(runtime.weapon,walker.x,walker.y-5,runtime.definition.radius,tank===runtime.weapon.tank?0:dealt);
            if(walker.earlyRolling==='rock'){runtime.dirtAt(walker.x,walker.y-5,Math.min(18,runtime.definition.radius));tank.body.setVelocity((walker.direction||1)*90,-60);tank.body.setGravityY(300);tank.settled=false;}
        }
    }
    for(const projectile of runtime.projectiles) {
        if(projectile.removed)continue;
        if(projectile.earlyLaserBot) {
            const role=projectile.laserRole||'robot',lifetime=role==='saucer'?240:role==='star'?180:210;
            if(projectile.age>=lifetime){runtime.remove(projectile);continue;}
            const phase=projectile.botPhase+projectile.age*(role==='star'?.055:.025);
            let targetX,targetY;
            if(role==='star') {
                targetX=projectile.orbitX+Math.cos(phase)*65;targetY=projectile.orbitY+Math.sin(phase)*65;
            } else if(role==='saucer') {
                targetX=foe.centre.x+Math.cos(phase)*100;
                targetY=Math.min(foe.centre.y-110,runtime.ground(projectile.x)-70)+Math.sin(phase*1.5)*12;
            } else {
                targetX=foe.centre.x+Math.cos(phase)*80;targetY=foe.centre.y-55+Math.sin(phase)*30;
            }
            targetY=clamp(targetY,8,runtime.terrain.height-12);
            projectile.vx=clamp((targetX-projectile.x)*3,-180,180);projectile.vy=clamp((targetY-projectile.y)*3,-180,180);
            const cadence=role==='saucer'?30:role==='star'?22:24,maximum=role==='saucer'?6:role==='star'?5:4,range=role==='robot'?260:450;
            if(projectile.y>=2&&projectile.age>=12&&projectile.age%cadence===12&&projectile.botPulses<maximum&&distance(projectile,foe.centre)<range) {
                runtime.ray(projectile.x,projectile.y,Math.atan2(foe.centre.y-projectile.y,foe.centre.x-projectile.x),range,false,runtime.definition.strength*(role==='robot'?8:12));
                projectile.botPulses++;
            }
            continue;
        }
        if(name==='Glue Gun'&&!projectile.child&&distance(projectile,foe.centre)<130){runtime.impact(projectile);continue;}
        if(name!=='Whiplash'||projectile.child||projectile.whiplashReturning)continue;
        const direction=Math.sign(projectile.vx)||runtime.direction||1;
        const nextX=projectile.x+projectile.vx/60,nextY=projectile.y+projectile.vy/60;
        const escaped=nextX<3||nextX>=runtime.terrain.width-3||nextY>=runtime.terrain.height-3;
        const passed=projectile.age>12&&direction*(projectile.x-foe.centre.x)>35&&distance(projectile,foe.centre)>(runtime.options.range||75);
        if(escaped||passed)returnWhiplash(runtime,projectile,false);
    }
}

export function disposeEarlyEffect(runtime) {
    for(const lift of runtime.earlyLifts||[]) {
        if(!lift.tank.body)continue;
        lift.tank.body.stop();lift.tank.body.setGravityY(300);lift.tank.settled=false;
    }
    runtime.earlyLifts=[];
}
