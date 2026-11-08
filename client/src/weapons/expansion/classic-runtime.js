import { shootTetherEffect, impactTetherEffect } from './tether-effects';
import { shootEarlyEffect, impactEarlyEffect } from './early-classic-effects';
import { shootLaterEffect, impactLaterEffect } from './later-classic-effects';
import { ExpansionRuntime, makeExpansionWeapon, weaponIcon, volatileBackblast } from './runtime';
import { applyPayload, splashScore, scoreHit, enemyOf, distance, tankState, addZone } from './tactics';
import { emitWeaponImpact, emitWeaponBeam, createWeaponProjectile, emitWeaponMuzzle, emitTerrainBuild } from '../../graphics/weapon-fx';
import { withMechanicalRules, installMechanicalRules, applyBuildingPayload, mayReleaseAtApex, continuationOptions } from './unique-mechanics';
import { deployWeaponDevice } from './deployables';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// Classic signatures are composed from flight, impact, and terrain primitives.
// Each shot owns its projectiles and seeded RNG, just like the new arsenal.
export class ClassicRuntime extends ExpansionRuntime {
    constructor(definition) {
        super(definition);
        this.baseCreate=this.create;this.baseShoot=this.shoot;this.baseImpact=this.impact;this.baseUpdate=this.update;this.baseSpawn=this.spawn;this.baseDispose=this.dispose;
        this.walkers=[];this.options=definition.options||{};
        this.create=weapon=>{this.baseCreate(weapon);this.walkers=[];};
        this.shoot=()=>this.classicShoot();
        this.impact=p=>this.classicImpact(p);
        this.update=()=>{if(this.done)return;this.classicFlight();this.baseUpdate();};
        this.dispose=()=>{this.walkers.forEach(w=>{if(!w.done)w.visual.destroy();});this.walkers=[];this.baseDispose();};
        installMechanicalRules(this);
    }
    origin() {
        const {turret}=this.weapon, angle=turret.rotation-Math.PI/2;
        return {x:turret.x+16*Math.cos(angle),y:turret.y+16*Math.sin(angle),angle};
    }
    remove(p) {if(!p.removed){p.removed=true;p.visual.destroy();}}
    // The shared event queue is bounded; a dropped detonation would leave a
    // walker, fuse, or ring silently inert, so run it immediately instead.
    defer(delay,fn) {const before=this.events.length;this.schedule(delay,fn);if(this.events.length===before)fn();}
    fireFrom(x,y,angle,speed,options={}) {
        this.baseSpawn(x,y,Math.cos(angle)*speed,Math.sin(angle)*speed,{gravity:300,...options});
    }
    // Direct rays respect dirt cover, except explicitly piercing signatures.
    ray(x,y,angle,length=300,pierce=false,power=24,reflections=0) {
        const hit=new Set();let end={x,y},remaining=length,heading=angle;
        power*=this.definition.payload?.damage??1; // rays scale with payload like blasts
        for(let bounce=0;bounce<=Math.min(12,reflections);bounce++){
            const origin={x,y};let collision=null;
            for(let d=4;d<remaining;d+=4) {
                const bx=x+Math.cos(heading)*d,by=y+Math.sin(heading)*d;
                if(bx<1||bx>=this.terrain.width-1||by<0||by>=this.terrain.height-1){collision={x:bx,y:by,d,axis:bx<1||bx>=this.terrain.width-1?'x':'y'};break;}
                const solid=this.terrain.getPixel(bx,by).alpha>0;
                if(solid&&!pierce){collision={x:bx,y:by,d};break;}
                end={x:bx,y:by};
                if(solid&&pierce&&d%12===0)this.carve(bx,by,5);
                for(const target of [this.scene.tank1,this.scene.tank2]) {
                    if(!hit.has(target)&&target.isPointInside(bx,by)){
                        hit.add(target);scoreHit(this.weapon.tank,target,power);applyPayload(this.weapon,bx,by,12);
                        if(this.options.force>0)this.impulse(target,Math.cos(heading)*this.options.force,Math.sin(heading)*this.options.force-70);
                    }
                }
            }
            emitWeaponBeam(this.scene,origin.x,origin.y,end.x,end.y,this.fxOptions({heavy:pierce}));
            if(!collision||bounce>=reflections)break;
            const slope=collision.axis?undefined:this.terrain.getSlope(Math.round(collision.x),Math.round(collision.y));
            heading=collision.axis==='x'?Math.PI-heading:collision.axis==='y'?-heading:Number.isFinite(slope)?2*slope-heading:-heading;
            remaining-=collision.d;x=end.x+Math.cos(heading)*2;y=end.y+Math.sin(heading)*2;end={x,y};
            if(remaining<=4)break;
        }
        this.lastDeliveryPoint=end;
        return end;
    }
    pointBurst(x,y,r=this.definition.radius,strength=this.definition.strength,excavate=true) {
        if(this.options.force>0)[this.scene.tank1,this.scene.tank2].filter(t=>distance(t.centre,{x,y})<r+30).forEach(t=>this.impulse(t,Math.sign(t.x-x||this.direction)*this.options.force,-this.options.force*.6));
        if(excavate){this.burst(x,y,r,strength);return;}
        const damage=splashScore(this.weapon,x,y,r,strength*this.definition.payload.damage);
        applyPayload(this.weapon,x,y,r,damage);
        emitWeaponImpact(this.scene,x,y,r,this.fxOptions({excavate:false}));
    }
    dirtAt(x,y,r=16,rubber=false,material=null) {
        const ctx=this.terrain.context;ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.beginPath();ctx.rect(0,0,this.terrain.width,this.terrain.height);ctx.clip();
        ctx.fillStyle=material==='tar'?'#050508':rubber?'rgb(230,0,230)':'#77856a';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();this.terrain.update();
        emitTerrainBuild(this.scene,x,y,material==='tar'?'tar':rubber?'rubber':'dirt',this.fxOptions({radius:r,terrainMaterial:material}));
        [this.scene.tank1,this.scene.tank2].forEach(t=>{t.settled=false;});
    }
    lift(tank,x,y) {tank.setPosition(clamp(x,22,this.terrain.width-22),clamp(y,1,this.terrain.height-2));tank.body.updateFromGameObject();tank.body.stop();tank.settled=false;}
    impulse(tank,vx,vy) {tank.body.setVelocity(vx,vy);tank.body.setGravityY(300);tank.settled=false;}
    fragments(x,y,mode=this.options.splitMode||'blast',count=this.options.shots||this.definition.count) {
        count=clamp(count,1,24);
        for(let i=0;i<count;i++) {
            const angle=-Math.PI+(i+.5)/count*Math.PI, speed=70+this.random()*100;
            this.fireFrom(x,y-4,angle,speed,{child:true,small:true,fragmentMode:mode,guided:mode==='homing',childRadius:this.options.fragmentRadius||this.definition.radius,childStrength:this.definition.strength});
        }
    }
    launchTank(clear=false) {
        const {tank,turret}=this.weapon;
        if(clear)this.carve(tank.x,tank.y-7,45);
        const boost=this.options.force||(this.definition.name==='Blast Off'?420:260);
        this.impulse(tank,Math.sin(turret.rotation)*boost,-Math.max(.2,Math.cos(turret.rotation))*boost);
    }
    classicShoot() {
        const mode=this.definition.classicMechanic, o=this.options, tank=this.weapon.tank, foe=enemyOf(this.scene,tank), origin=this.origin();
        this.direction=Math.sign(Math.cos(origin.angle))||1;
        emitWeaponMuzzle(this.scene,origin.x,origin.y,origin.angle,this.fxOptions({heavy:this.definition.radius>65}));
        // Mirrors ExpansionRuntime.shoot: unstable payloads always cost a breech backblast.
        volatileBackblast(this);
        if(shootTetherEffect(this)||shootEarlyEffect(this)||shootLaterEffect(this))return;
        if(o.enemyTurret){const turret=foe.turret;this.dirtAt((turret.x??foe.x)+Math.sin(turret.rotation)*20,(turret.y??foe.y-12)-Math.cos(turret.rotation)*20,o.radius||24,true);return;}
        if(o.both&&mode==='pitfall'){
            for(const target of [tank,foe])for(let i=0;i<5;i++)this.defer(i*.08,()=>this.carve(target.x,target.y+i*18,22));return;
        }
        if(o.force<0)this.impulse(tank,-Math.cos(origin.angle)*Math.abs(o.force),-50);
        if(mode==='selflaunch'){
            if(o.self===false){[tank,foe].forEach(target=>this.impulse(target,0,-(o.force||260)));}
            else this.launchTank(!!o.erase);return;
        }
        if(mode==='selfescape') {
            this.pointBurst(tank.x,tank.y-6,this.definition.radius,this.definition.strength);
            this.launchTank(true);return;
        }
        if(mode==='selfbridge') {
            const angle=clamp(origin.angle,-.35,.35),span=170,endX=clamp(tank.x+this.direction*span,24,this.terrain.width-24),endY=clamp(tank.y-Math.sin(angle)*span,30,this.terrain.height-25);
            const ctx=this.terrain.context;ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.strokeStyle='#859777';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(tank.x,tank.y-4);ctx.lineTo(endX,endY-4);ctx.stroke();ctx.restore();this.terrain.update();
            this.lift(tank,endX,endY-10);return;
        }
        if(mode==='selfshelter') {
            if(o.closed){const ctx=this.terrain.context;ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.strokeStyle=o.rubber?'rgb(230,0,230)':'#859777';ctx.lineWidth=10;ctx.beginPath();ctx.arc(tank.x,tank.y-10,44,0,Math.PI*2);ctx.stroke();ctx.restore();this.terrain.update();}
            else this.build(tank.x,tank.y,'dome');if(o.rubber)this.coat(tank.x,tank.y-25,65,true);
            if(o.tunnel){this.carve(tank.x+this.direction*26,tank.y-10,17);this.carve(tank.x+this.direction*45,tank.y-10,17);}
            applyBuildingPayload(this,tank.x,tank.y,this.definition.radius);return;
        }
        if(mode==='sweep') {
            for(let i=0;i<(o.shots||5);i++)this.ray(origin.x,origin.y,origin.angle+(i-((o.shots||5)-1)/2)*(o.spread||.09),o.range||720,!!o.pierce,this.definition.strength*25);
            return;
        }
        if(mode==='selflaser') {this.ray(origin.x,origin.y,Math.atan2(foe.centre.y-origin.y,foe.centre.x-origin.x),o.range||800,!!o.pierce,35);return;}
        if(mode==='wavecoat') {
            for(let x=0;x<this.terrain.width;x+=20)this.dirtAt(x,this.ground(x)+3,o.radius||8,!!o.rubber);
            return;
        }
        if((mode==='spread'&&o.side)||mode==='sideways') {
            // Level rounds enter from both world edges at the foe's hull centre,
            // alternating sides and staggered in pairs so every authored shot counts.
            const shots=clamp(Math.round(o.shots||2),1,12),targetY=clamp(foe.centre?.y??foe.y-6,15,this.terrain.height-15);
            for(let i=0;i<shots;i++){const sign=i%2?-1:1;this.defer(Math.floor(i/2)*.15,()=>this.baseSpawn(sign<0?this.terrain.width-4:4,targetY,sign*250,0,{gravity:0,guided:!!o.guided}));}
            return;
        }
        if(mode==='spread'||mode==='stream'||mode==='tracer'||mode==='roller') {
            const count=o.shots||this.definition.count||(mode==='roller'?1:5);
            for(let i=0;i<count;i++) {
                const fire=()=>this.fireFrom(origin.x,origin.y,origin.angle+(i-(count-1)/2)*(mode==='stream'?0:(o.spread>=.3?o.spread/Math.max(1,count-1):o.spread||(mode==='roller'?.055:.09))),tank.power*8,{gravity:o.gravity??300,tracerOffset:mode==='tracer'?i-(count-1)/2:null});
                if(mode==='stream')this.defer(i*.1,fire);else fire();
            }
            return;
        }
        if(mode==='groundfan') {
            for(let i=0;i<(o.shots||5);i++)this.fireFrom(origin.x,origin.y,origin.angle+(i-2)*.12,tank.power*8,{classicDig:true,guided:!!o.guided});
            return;
        }
        if(mode==='guided') {
            for(let i=0;i<(o.shots||1);i++)this.fireFrom(origin.x,origin.y,origin.angle+(i-((o.shots||1)-1)/2)*(o.spread||.09),tank.power*8,{guided:true,gravity:o.gravity??160});return;
        }
        this.fireFrom(origin.x,origin.y,origin.angle,tank.power*8*(o.speed||1),{gravity:o.gravity??300});
    }
    walker(p) {
        const o=this.options, direction=o.returnToShooter?-this.direction:this.direction;
        const walker={x:p.x,y:p.y,direction,age:0,lastZap:0,visual:createWeaponProjectile(this.scene,p.x,p.y-5,this.fxOptions({behavior:'roller'}))};
        this.walkers.push(walker);
        this.defer((o.dwell||150)/60,()=>{
            if(walker.done)return;walker.done=true;walker.visual.destroy();
            if(o.dirt)this.dirtAt(walker.x,walker.y,this.definition.radius,!!o.rubber);
            else this.pointBurst(walker.x,walker.y,this.definition.radius,this.definition.strength,!o.noCrater);
        });
    }
    classicImpact(p) {
        if(p.removed)return;
        if(impactTetherEffect(this,p)||impactEarlyEffect(this,p)||impactLaterEffect(this,p))return;
        const o=this.options, mode=this.definition.classicMechanic,{x,y}=p, foe=enemyOf(this.scene,this.weapon.tank);
        this.lastImpactAngle=Math.atan2(p.vy,p.vx);
        if(p.fragmentMode==='dirt'){this.remove(p);this.dirtAt(x,y,o.fragmentRadius||12,!!o.rubber);applyBuildingPayload(this,x,y,o.fragmentRadius||12);return;}
        if(p.fragmentMode==='laser'){this.remove(p);this.ray(x,y-7,Math.atan2(foe.centre.y-y,foe.centre.x-x),300,false,15);return;}
        if(p.fragmentMode==='bounce'&&(p.classicBounces||0)<(o.bounces||3)) {
            this.remove(p);this.fireFrom(x,y-5,-Math.PI*.8+this.random()*Math.PI*.6,80+this.random()*100,{child:true,small:true,fragmentMode:'bounce',classicBounces:(p.classicBounces||0)+1,childRadius:this.definition.radius,childStrength:this.definition.strength});return;
        }
        if(p.child){this.baseImpact(p);return;}
        this.remove(p);
        if(['autoturrets','missileturret','runngun'].includes(mode)){deployWeaponDevice(this.weapon,mode,{point:{x,y},heading:this.direction});return;}
        if(mode==='tracer') {
            const marker=this.scene.add.text(x,y-15,`${p.tracerOffset>0?'+':''}${p.tracerOffset*5}°`,{fontFamily:'Arial',fontSize:12,color:'#d8edc9'}).setOrigin(.5).setDepth(4);
            this.scene.tweens.add({targets:marker,alpha:0,duration:1800,onComplete:()=>marker.destroy()});return;
        }
        if(mode==='roller'){this.walker(p);return;}
        if((mode==='bouncer'||mode==='guided'&&o.bounces)&&(p.classicBounces||0)<(o.bounces||5)) {
            const v=Math.max(70,Math.hypot(p.vx,p.vy)*.75),slope=this.terrain.getSlope(Math.round(x),Math.round(y));
            const incident=Math.atan2(p.vy,p.vx);
            const reflect=p.boundaryAxis==='x'?Math.PI-incident:p.boundaryAxis==='y'?-incident:Number.isFinite(slope)?2*slope-incident:-incident;
            this.fireFrom(x,p.boundaryAxis?clamp(y,5,this.terrain.height-6):y-4,reflect,v,{...continuationOptions(p),classicBounces:(p.classicBounces||0)+1,gravity:o.gravity??300});
            if(o.pop)this.pointBurst(x,y,11,.25,false);
            return;
        }
        if(mode==='bouncer'&&o.rubber)this.coat(x,y,(o.radius||this.definition.radius)+16,true);
        if(mode==='bouncer'&&o.splitMode){this.fragments(x,y,o.splitMode);return;}
        if(mode==='scramble') {
            [this.scene.tank1,this.scene.tank2].filter(t=>distance(t.centre,p)<70).forEach(t=>{t.setPower(5+Math.floor(this.random()*90));t.turret.setRelativeRotation(this.random()*Math.PI*2);});
            this.pointBurst(x,y);return;
        }
        if(mode==='scatterbuild'){this.fragments(x,y,'dirt');return;}
        if(mode==='split'||mode==='proximity'){this.fragments(x,y,o.splitMode);return;}
        if(mode==='radiallaser'||mode==='orbitlaser'||mode==='ring') {
            const count=o.shots||8;
            for(let i=0;i<count;i++) {
                const angle=i/count*Math.PI*2;
                const bx=x+Math.cos(angle)*(o.orbit||35),by=y-24+Math.sin(angle)*(o.orbit||35);
                this.defer(i*.075,()=>{
                    if(mode==='ring')this.pointBurst(bx,by,this.definition.radius,this.definition.strength,!o.noCrater);
                    else this.ray(bx,by,mode==='orbitlaser'?Math.atan2(foe.centre.y-by,foe.centre.x-bx):angle,o.range||350,!!o.pierce,this.definition.strength*20);
                });
            }
            // A wide ring (orbit beyond its blast reach) closes on its centre so
            // a tank standing inside is genuinely at risk.
            const reach=this.definition.radius*(this.definition.payload.radius??1)+12;
            if(mode==='ring'&&(o.orbit||35)>reach)this.defer(count*.075+.1,()=>this.pointBurst(x,y-12,this.definition.radius,this.definition.strength*.8,!o.noCrater));
            return;
        }
        if(mode==='pitfall'||mode==='pitfirebury') {
            for(let i=0;i<5;i++)this.defer(i*.08,()=>{this.pointBurst(x,y+i*18,25,this.definition.strength);if(o.rubber)this.coat(x,y+i*18,33,true);});
            if(mode==='pitfirebury')this.defer(.5,()=>{addZone(this.scene,this.weapon.tank,'fire',x,Math.min(y+65,this.terrain.height-5),45,'fire',this.definition.id);this.dirtAt(x,y-7,24);});
            else this.defer(.5,()=>this.fragments(x,y-15,o.splitMode||'blast',o.shots||12));
            return;
        }
        if(mode==='drillburst') {
            const direction=Math.sign(foe.x-x)||this.direction,steps=clamp(Math.round(Math.abs(foe.x-x)/18),4,18);
            for(let i=0;i<steps;i++)this.defer(i*.035,()=>{
                const bx=clamp(x+direction*i*18,2,this.terrain.width-3),by=Math.min(this.terrain.height-12,y+22);
                this.carve(bx,by,12);if(o.rubber)this.coat(bx,by,20,true);
                if(i===steps-1){for(let yy=by;yy>this.ground(bx)-8;yy-=16)this.carve(bx,yy,12);this.fragments(bx,this.ground(bx)-5,o.splitMode||'blast');}
            });return;
        }
        if(mode==='terraincoat') {
            if(o.crater)this.pointBurst(x,y,o.crater,.25);
            const enclosed=o.material==='tar'?[this.scene.tank1,this.scene.tank2].find(t=>t.isPointInside(x,y)):null;
            if(o.erase)this.clearCoating(x,y,o.radius||this.definition.radius);
            else if(o.dirt)this.dirtAt(enclosed?.centre.x??x,enclosed?.centre.y??y,o.radius||this.definition.radius,!!o.rubber,o.material);
            else this.coat(x,y,o.radius||this.definition.radius,!!o.rubber);
            if(o.fire&&this.definition.payload.key!=='fire')addZone(this.scene,this.weapon.tank,'fire',x,y,this.definition.radius,'fire',this.definition.id);
            applyBuildingPayload(this,x,y,o.radius||this.definition.radius);
            return;
        }
        if(mode==='groundwave') {
            const count=o.shots||9;
            for(let i=0;i<count;i++)this.defer(i*.06,()=>{const bx=clamp(x+(i-(count-1)/2)*(o.range?o.range/Math.max(1,count-1):24),2,this.terrain.width-3),by=this.ground(bx)+4;
                if(o.dirt){this.dirtAt(bx,by,this.definition.radius,!!o.rubber);applyPayload(this.weapon,bx,by,this.definition.radius);}
                else this.pointBurst(bx,by,this.definition.radius,this.definition.strength,!o.noCrater);});
            return;
        }
        if(mode==='island') {
            const r=this.definition.radius;this.carve(x-r,y,r*.7);this.carve(x+r,y,r*.7);this.carve(x,y+r,r*.75);
            splashScore(this.weapon,x,y,r,this.definition.strength);return;
        }
        if(mode==='random') {
            const roll=this.random();
            if(roll<.3)this.fragments(x,y,'homing',6);
            else if(roll<.6)this.dirtAt(x,y,35,!!o.rubber);
            else if(roll<.85)this.pointBurst(x,y,60,1.2);
            else this.pointBurst(this.weapon.tank.x,this.weapon.tank.y,45,1);
            return;
        }
        if(mode==='pillars') {
            const count=clamp(o.shots||5,1,16),span=o.range||100;
            for(let i=0;i<count;i++){
                const bx=clamp(x+(count===1?0:(i/(count-1)-.5)*span),8,this.terrain.width-9),by=this.ground(bx);
                this.defer(i*.045,()=>{
                    const height=35+(i%3)*12,ctx=this.terrain.context;ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle=o.rubber?'rgb(230,0,230)':'#75886b';ctx.fillRect(bx-8,Math.max(0,by-height),16,height+8);ctx.restore();this.terrain.update();
                    emitTerrainBuild(this.scene,bx,by,'pillar',this.fxOptions({radius:height}));
                    applyBuildingPayload(this,bx,by,height);
                    if(o.splitMode)this.fragments(bx,by-height-5,o.splitMode,2);
                });
            }
            [this.scene.tank1,this.scene.tank2].forEach(t=>{t.settled=false;});return;
        }
        if(mode==='nonexcavate') {
            if(o.scramble)[this.scene.tank1,this.scene.tank2].filter(t=>distance(t.centre,p)<70).forEach(t=>{t.turret.setRelativeRotation(this.random()*Math.PI*2);});
            const ctx=this.terrain.context;ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle='rgba(10,16,23,.7)';ctx.beginPath();ctx.arc(x,y,this.definition.radius,0,Math.PI*2);ctx.fill();ctx.restore();this.terrain.update();
            this.pointBurst(x,y,this.definition.radius,o.decay?Math.max(.1,this.definition.strength*(1-p.age/240)):this.definition.strength,false);return;
        }
        if(mode==='projectilelaser') {this.ray(x,y-5,Math.atan2(foe.centre.y-y,foe.centre.x-x),o.range||450,!!o.pierce,this.definition.strength*45);return;}
        if(mode==='fuse') {this.defer(o.fuse||1.5,()=>this.pointBurst(x,y,this.definition.radius,this.definition.strength));return;}
        if(mode==='force') {
            const nearby=[this.scene.tank1,this.scene.tank2].filter(t=>distance(t.centre,p)<(o.range||120));
            nearby.forEach(t=>this.impulse(t,Math.sign(t.x-x||this.direction)*(o.force||230),-(o.force||230)*.7));
        }
        this.pointBurst(x,y,this.definition.radius,o.decay?Math.max(.1,this.definition.strength*(1-p.age/240)):this.definition.strength,!o.noCrater);
    }
    // Gyro rounds weave around their ballistic path: a bounded perpendicular
    // offset that never accumulates drift, so the landing point stays aimable.
    gyroWobble() {return !!this.options.oscillate||this.definition.name==='Gyro Glue';}
    wobble(p) {
        const speed=Math.hypot(p.vx,p.vy);if(speed<1)return;
        const offset=Math.sin((p.age||0)*.22)*7,delta=offset-(p.gyroOffset||0);
        p.gyroOffset=offset;p.x+=-p.vy/speed*delta;p.y+=p.vx/speed*delta;
    }
    classicFlight() {
        const mode=this.definition.classicMechanic, o=this.options, foe=enemyOf(this.scene,this.weapon.tank);
        for(const p of [...this.projectiles]) {
            if(p.removed)continue;
            if(o.wrap&&(p.wraps||0)<3){
                if(p.x+p.vx/60<2){p.x=this.terrain.width-4;p.wraps=(p.wraps||0)+1;}
                else if(p.x+p.vx/60>this.terrain.width-2){p.x=4;p.wraps=(p.wraps||0)+1;}
            }
            if(this.gyroWobble()&&!p.child)this.wobble(p);
            if(o.pierce&&(mode==='guided'||mode==='spread'||p.guided)){
                const step=Math.hypot(p.vx,p.vy)/60,angle=Math.atan2(p.vy,p.vx);
                p.pierceDistance=(p.pierceDistance||0)+step;
                if(p.pierceDistance>(o.range||650)){this.impact(p);continue;}
                for(let d=0;d<step+8;d+=5){const bx=p.x+Math.cos(angle)*d,by=p.y+Math.sin(angle)*d;if(bx>0&&bx<this.terrain.width&&by>=0&&by<this.terrain.height&&this.terrain.getPixel(bx,by).alpha>0)this.carve(bx,by,7);}
            }
            if(o.zap&&p.age>0&&p.age%24===0&&distance(p,foe.centre)<(o.range||200))this.ray(p.x,p.y,Math.atan2(foe.centre.y-p.y,foe.centre.x-p.x),o.range||200,false,this.definition.strength*15);
            if(p.guided||(mode==='guided'&&p.age>12)) {
                const dx=foe.centre.x-p.x,dy=foe.centre.y-p.y,mag=Math.max(1,Math.hypot(dx,dy)),speed=Math.max(80,Math.hypot(p.vx,p.vy));
                p.vx=p.vx*.94+dx/mag*speed*.06;p.vy=p.vy*.94+dy/mag*speed*.06;
            }
            if((mode==='split'||mode==='scatterbuild')&&!p.child&&p.age>3&&p.vy>=0&&mayReleaseAtApex(this,p))this.impact(p);
            if(mode==='proximity'&&!p.child&&distance(p,foe.centre)<(o.range||100))this.impact(p);
            if(mode==='projectilelaser'&&!p.child&&distance(p,foe.centre)<(o.range||150))this.impact(p);
            if(p.classicDig&&p.y>=0&&p.y<this.terrain.height&&this.terrain.getPixel(p.x,p.y).alpha>0){this.carve(p.x,p.y,10);p.vy=-Math.abs(p.vy)*.94;if(p.age>55){p.classicDig=false;this.fragments(p.x,p.y,'homing',3);this.remove(p);}}
            if(o.decay)p.childStrength=Math.max(.1,this.definition.strength*(1-p.age/240));
        }
        for(const w of this.walkers) {
            if(w.done)continue;w.age++;
            const glued=[w.y,w.y+1].some(y=>{const pixel=this.terrain.getPixel(w.x,y);return pixel.red===135&&pixel.green===155&&pixel.blue===82;});
            if(glued)continue;
            const previousY=w.y;
            if(o.followGround===false)w.y+=1;
            const nextX=clamp(w.x+w.direction*(o.speed||2.5),2,this.terrain.width-3),nextY=this.ground(nextX);
            if(o.downhill&&nextY<previousY-2)w.direction*=-1;
            else {w.x=nextX;w.y=nextY;}
            if(w.x<=2||w.x>=this.terrain.width-3)w.direction*=-1;
            if(o.erase&&w.age%6===0)this.carve(w.x,w.y,9);
            w.visual.setPosition(w.x,w.y-5);
            if(o.zap&&w.age-w.lastZap>20&&distance(w,foe.centre)<160){w.lastZap=w.age;this.ray(w.x,w.y-9,Math.atan2(foe.centre.y-w.y,foe.centre.x-w.x),180,false,12);}
            if(o.pop&&w.age%15===0)this.pointBurst(w.x,w.y-5,12,.3,false);
        }
    }
}

export const makeClassicWeapon=definition=>{
    definition=withMechanicalRules(definition);
    if(!definition.classicMechanic)return makeExpansionWeapon(definition);
    let icon;
    return {...definition,createInstance:()=>new ClassicRuntime(definition),get logoCanvas(){return icon||(icon=weaponIcon(definition));}};
};
