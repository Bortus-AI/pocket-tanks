import { emitWeaponImpact, emitWeaponBeam, createWeaponProjectile, emitWeaponMuzzle, emitTerrainBuild } from '../../graphics/weapon-fx';
import { applyPayload, splashScore, tankState, addShield, clearStatuses, clearZones, addZone, enemyOf, distance, tanksInRange } from './tactics';
import { withMechanicalRules, installMechanicalRules, applyBuildingPayload, mayReleaseAtApex } from './unique-mechanics';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const builders=['wall','dome','berm','platform','bridge','seed'];

export class ExpansionRuntime {
    constructor(definition) {this.definition=withMechanicalRules(definition);this.projectiles=[];this.events=[];this.tick=0;this.done=false;this.dirty=[];if(new.target===ExpansionRuntime)installMechanicalRules(this);}
    create = weapon => {
        this.weapon=weapon;weapon.weaponHandler=this;this.scene=weapon.scene;this.terrain=weapon.terrain;
        this.seed=(this.definition.id*49157+Math.round(weapon.tank.x)*157+Math.round(weapon.tank.y)*37+weapon.tank.power*19)>>>0;
        this.trail=this.scene.add.graphics().setDepth(3);
        this.color=this.definition.payload.color;
        this.onShutdown = () => this.dispose();
        this.scene.events.once('shutdown', this.onShutdown);
    };
    fxOptions = (overrides = {}) => ({
        payload:this.definition.payload.key, behavior:this.definition.behavior,
        classicMechanic:this.definition.classicMechanic, color:this.color,
        weaponId:this.weapon?.id??this.definition.id,weaponName:this.definition.name,
        identity:this.definition.visualIdentity,mechanicOptions:this.definition.options,
        semanticRules:this.definition.mechanicalRules||[],direction:this.direction,
        angle:Number.isFinite(this.lastImpactAngle)?this.lastImpactAngle:undefined, ...overrides,
    });
    random = () => {this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;};
    schedule = (delay,fn) => {if(this.events.length<80)this.events.push({at:this.tick+Math.max(1,Math.round(delay*60)),fn});};
    ground = x => {x=clamp(Math.round(x),0,this.terrain.width-1);for(let y=0;y<this.terrain.height;y++)if(this.terrain.getPixel(x,y).alpha>0)return y;return this.terrain.height-1;};
    carve = (x,y,r) => {
        x=clamp(x,0,this.terrain.width-1);y=clamp(y,0,this.terrain.height-1);r=clamp(r,1,120);
        const ctx=this.terrain.context;ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();
        this.terrain.update();this.dirty.push({x:Math.round(x),y:Math.round(y),r:Math.ceil(r)});
    };
    build = (x,y,kind) => {
        const ctx=this.terrain.context;ctx.save();ctx.beginPath();ctx.rect(0,0,this.terrain.width,this.terrain.height);ctx.clip();
        const gradient=ctx.createLinearGradient(0,y-90,0,y+25);gradient.addColorStop(0,'#b8be93');gradient.addColorStop(1,'#526457');
        ctx.fillStyle=gradient;ctx.strokeStyle='#c1cea1';ctx.lineWidth=2;ctx.beginPath();
        if(kind==='wall')ctx.rect(x-12,y-100,24,110);
        if(kind==='dome'){ctx.arc(x,y-4,55,Math.PI,0);ctx.arc(x,y-4,43,0,Math.PI,true);ctx.closePath();}
        if(kind==='berm')ctx.ellipse(x,y,53,48,0,Math.PI,Math.PI*2);
        if(kind==='platform')ctx.rect(x-34,y-8,68,22);
        if(kind==='bridge')ctx.rect(x-95,y-7,190,9);
        if(kind==='seed')for(let i=-2;i<=2;i++){const bx=clamp(x+i*23,0,this.terrain.width-1),by=this.ground(bx);ctx.moveTo(bx-7,by+6);ctx.lineTo(bx,by-35-Math.abs(i)*8);ctx.lineTo(bx+7,by+6);}
        ctx.fill();ctx.stroke();ctx.restore();this.terrain.update();
        emitTerrainBuild(this.scene,x,y,kind,this.fxOptions());
        [this.scene.tank1,this.scene.tank2].forEach(t=>{t.settled=false;});
    };
    coat = (x,y,r,rubber) => {
        const ctx=this.terrain.context;ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle=rubber?'rgb(230,0,230)':'rgb(135,155,82)';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();this.terrain.update();
        emitTerrainBuild(this.scene,x,y,rubber?'rubber':'glue',this.fxOptions({radius:r}));
    };
    burst = (x,y,r=this.definition.radius,strength=this.definition.strength,withPayload=true) => {
        r=clamp(r*this.definition.payload.radius,4,115);y=clamp(y,0,this.terrain.height-1);x=clamp(x,0,this.terrain.width-1);
        this.carve(x,y,r);
        const damage=splashScore(this.weapon,x,y,r+12,strength*this.definition.payload.damage);
        emitWeaponImpact(this.scene,x,y,r,this.fxOptions());
        if(withPayload)applyPayload(this.weapon,x,y,r,damage);
        if(withPayload&&this.definition.payload.key==='volatile')this.schedule(.45,()=>this.burst(x,y,r*.65,strength*.5,false));
    };
    spawn = (x,y,vx,vy,options={}) => {
        if(this.projectiles.length>=48)return;
        const visual=createWeaponProjectile(this.scene,x,y,this.fxOptions({small:!!options.small,angle:Math.atan2(vy,vx)}));
        this.projectiles.push({x,y,vx,vy,visual,age:0,bounces:0,...options});
    };
    shoot = () => {
        const {behavior,count}=this.definition, {tank,turret}=this.weapon;
        this.direction=Math.sign(Math.sin(turret.rotation))||1;
        emitWeaponMuzzle(this.scene,turret.x+16*Math.sin(turret.rotation),turret.y-16*Math.cos(turret.rotation),turret.rotation-Math.PI/2,this.fxOptions({heavy:this.definition.radius>65}));
        if(this.definition.payload.key==='volatile')splashScore(this.weapon,tank.centre.x,tank.centre.y,15,.5);
        if(['shield','repair','cleanse','kamikaze'].includes(behavior)) {
            if(behavior==='shield')addShield(tank,70);
            if(behavior==='repair'){clearStatuses(tank);addShield(tank,20);tank.movesRemaining=Math.min(tank.movesRemaining+1,8);}
            if(behavior==='cleanse'){clearZones(this.scene,tank.x,tank.y,90);tanksInRange(this.scene,tank.x,tank.y,65).forEach(clearStatuses);}
            if(behavior==='kamikaze')this.burst(tank.centre.x,tank.centre.y);
            else {applyBuildingPayload(this,tank.x,tank.y,this.definition.radius);emitWeaponImpact(this.scene,tank.x,tank.y,35,this.fxOptions());}
            return;
        }
        if(['selfdome','selfrubberdome','well','pedestal','jump','randomblink','longtunnel','cheapshot'].includes(behavior)) {
            if(behavior==='selfdome'||behavior==='selfrubberdome')this.build(tank.x,tank.y,'dome');
            if(behavior==='selfrubberdome')this.coat(tank.x,tank.y-24,65,true);
            if(behavior==='well')for(let y=0;y<tank.y;y+=22)this.carve(tank.x,y,18);
            if(behavior==='pedestal'){this.build(tank.x,tank.y-30,'wall');tank.setY(tank.y-100);tank.body.updateFromGameObject();tank.settled=false;}
            if(behavior==='jump'){tank.body.setVelocity(Math.sin(turret.rotation)*tank.power*4,-Math.cos(turret.rotation)*tank.power*4);tank.body.setGravityY(300);tank.settled=false;}
            if(behavior==='randomblink'){const x=24+this.random()*(this.terrain.width-48);tank.setPosition(x,this.ground(x)-1);tank.body.updateFromGameObject();tank.body.stop();tank.settled=false;}
            if(behavior==='longtunnel'){for(let x=0;x<this.terrain.width;x+=20)this.carve(x,tank.y+12,16);}
            if(behavior==='cheapshot'){const foe=enemyOf(this.scene,tank);this.burst(foe.centre.x,foe.centre.y);}
            else applyBuildingPayload(this,tank.x,tank.y,this.definition.radius);
            return;
        }
        const angle=turret.rotation-Math.PI/2;
        const origin={x:turret.x+16*Math.cos(angle),y:turret.y+16*Math.sin(angle)};
        if(behavior==='laser'||behavior==='rail'){this.beam(origin,angle,behavior==='rail');return;}
        const speed=tank.power*8*(behavior==='mortar'?.65:1);
        const shots=behavior==='barrage'?count:1;
        for(let i=0;i<shots;i++) {
            const a=angle+(i-(shots-1)/2)*.055;
            const launch=()=>this.spawn(origin.x,origin.y,speed*Math.cos(a),speed*Math.sin(a),{gravity:behavior==='mortar'?180:300});
            if(behavior==='barrage')this.schedule(i*.12,launch);else launch();
        }
        if(this.scene.cache.audio.exists('launch'))this.scene.sound.play('launch',{volume:.25});
    };
    beam = (origin,angle,piercing) => {
        let end={...origin};const hit=new Set();
        for(let step=0;step<(this.definition.options?.range||750);step+=3) {
            const x=origin.x+Math.cos(angle)*step,y=origin.y+Math.sin(angle)*step;
            if(x<0||x>=this.terrain.width||y>=this.terrain.height)break;
            end={x,y};if(y<0)continue;
            const solid=this.terrain.getPixel(x,y).alpha>0;
            for(const tank of [this.scene.tank1,this.scene.tank2])if(tank.isPointInside(x,y)&&!hit.has(tank)){hit.add(tank);splashScore(this.weapon,x,y,40,1.1);applyPayload(this.weapon,x,y,25);if(this.definition.options?.force){tank.body.setVelocity(Math.cos(angle)*this.definition.options.force,Math.sin(angle)*this.definition.options.force-70);tank.body.setGravityY(300);tank.settled=false;}}
            if(solid){if(piercing){this.carve(x,y,6);}else break;}
            if(!piercing&&hit.size)break;
        }
        emitWeaponBeam(this.scene,origin.x,origin.y,end.x,end.y,this.fxOptions({heavy:piercing}));
        this.lastDeliveryPoint=end;
        this.burst(end.x,end.y);
        if(this.definition.mechanicalRules?.includes('border-wrap')&&!this.ruleBeamWrapped&&(end.x<5||end.x>this.terrain.width-5)){
            this.ruleBeamWrapped=true;
            this.beam({x:end.x<5?this.terrain.width-4:4,y:end.y},angle,piercing);
        }
    };
    impact = p => {
        if(p.removed)return;p.removed=true;p.visual.destroy();
        this.lastImpactAngle=Math.atan2(p.vy,p.vx);
        const {behavior,count,radius,strength}=this.definition;const {x,y}=p;
        if(p.child){this.burst(x,y,p.childRadius||radius,p.childStrength||strength);return;}
        if(behavior==='cluster'){
            for(let i=0;i<count;i++)this.spawn(x,y,(i-(count-1)/2)*65,30+this.random()*70,{gravity:300,child:true,small:true});
            return;
        }
        if(['rubber','rubberwall','glue'].includes(behavior)){if(behavior==='rubberwall')this.build(x,y,'wall');this.coat(x,y,behavior==='rubberwall'?110:radius,behavior!=='glue');applyPayload(this.weapon,x,y,radius);return;}
        if(behavior==='golden'){const jackpot=this.random()<1/31;this.burst(x,y,jackpot?110:6,jackpot?2:.02);return;}
        if(builders.includes(behavior)){this.build(x,y,behavior);applyBuildingPayload(this,x,y,radius);return;}
        if(['mine','oil','acidpool'].includes(behavior)){addZone(this.scene,this.weapon.tank,behavior==='acidpool'?'acid':behavior,x,y,radius,this.definition.payload.key);applyPayload(this.weapon,x,y,radius);return;}
        if(behavior==='emp'){tanksInRange(this.scene,x,y,radius+20).forEach(t=>{tankState(t).shield=0;tankState(t).frost=2;tankState(t).frostMoves=0;});this.burst(x,y);return;}
        if(behavior==='blink') {const t=this.weapon.tank;emitWeaponImpact(this.scene,t.x,t.y,30,this.fxOptions());t.setPosition(clamp(x,24,this.terrain.width-24),this.ground(x)-1);t.body.updateFromGameObject();t.body.stop();t.settled=false;emitWeaponImpact(this.scene,t.x,t.y,30,this.fxOptions());applyPayload(this.weapon,x,y,radius);return;}
        if(behavior==='swap'){const foe=enemyOf(this.scene,this.weapon.tank),t=this.weapon.tank;if(distance(foe.centre,{x,y})<75){const pos={x:t.x,y:t.y};emitWeaponImpact(this.scene,t.x,t.y,30,this.fxOptions());emitWeaponImpact(this.scene,foe.x,foe.y,30,this.fxOptions());t.setPosition(foe.x,foe.y);foe.setPosition(pos.x,pos.y);[t,foe].forEach(tank=>{tank.body.updateFromGameObject();tank.body.stop();tank.settled=false;});}applyPayload(this.weapon,x,y,radius);return;}
        if(behavior==='vortex'||behavior==='repulsor') {
            tanksInRange(this.scene,x,y,radius+80).forEach(t=>{const sign=behavior==='vortex'?1:-1;const angle=Math.atan2(y-t.y,x-t.x),force=this.definition.options?.force||170;t.body.setVelocity(sign*Math.cos(angle)*force,-force*.94);t.body.setGravityY(300);t.settled=false;});
        }
        if(behavior==='siphon'){const foe=enemyOf(this.scene,this.weapon.tank);if(distance(foe.centre,{x,y})<radius+20){const stolen=Math.min(25,tankState(foe).shield);tankState(foe).shield-=stolen;addShield(this.weapon.tank,stolen);}}
        if(behavior==='roulette'){const roll=this.random();if(roll<.3){this.burst(this.weapon.tank.x,this.weapon.tank.y,60,1);return;}this.burst(x,y,roll>.8?105:12,roll>.8?1.8:.08);return;}
        if(['tunnel','fault','trench','crater','carpet'].includes(behavior)) {
            for(let i=0;i<count;i++)this.schedule(i*.08,()=>{
                const bx=clamp(x+(behavior==='crater'?0:(i-(behavior==='trench'||behavior==='carpet'?(count-1)/2:0))*22*this.direction),1,this.terrain.width-2);
                const by=behavior==='crater'?y+i*18:behavior==='fault'?y+i*13:behavior==='tunnel'?y+14:this.ground(bx)+4;
                this.burst(bx,by,radius,strength,i===0||i===count-1);
            });return;
        }
        if(behavior==='skyfall'){
            for(let i=0;i<count;i++)this.schedule(i*.14,()=>this.spawn(clamp(x+(i-(count-1)/2)*25,2,this.terrain.width-3),-10,0,320,{gravity:200,child:true}));
            applyPayload(this.weapon,x,y,radius);return;
        }
        this.burst(x,y);
    };
    update = () => {
        if(this.done)return;this.tick++;this.trail.clear();
        const due=this.events.filter(e=>e.at<=this.tick);this.events=this.events.filter(e=>e.at>this.tick);due.forEach(e=>e.fn());
        for(const p of [...this.projectiles]) {
            if(p.removed)continue;p.age++;
            if(this.definition.behavior==='boomerang'&&p.age===30)p.vx*=-1;
            const foe=enemyOf(this.scene,this.weapon.tank);
            if(tankState(foe).marked>0&&distance(p,foe.centre)<150){p.vx+=(foe.centre.x-p.x)*.013;p.vy+=(foe.centre.y-p.y)*.013;}
            p.vy+=(p.gravity??300)/60;
            if(this.definition.behavior==='cluster'&&!p.child&&p.vy>=0&&mayReleaseAtApex(this,p)){
                this.impact(p);continue;
            }
            const ox=p.x,oy=p.y,dx=p.vx/60,dy=p.vy/60,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/2));
            for(let n=1;n<=steps;n++) {
                p.x=ox+dx*n/steps;p.y=oy+dy*n/steps;
                if(p.x<1||p.x>=this.terrain.width-1||p.y>this.terrain.height-1||p.age>720){p.removed=true;p.visual.destroy();break;}
                if(p.y<0)continue;
                const pixel=this.terrain.getPixel(p.x,p.y);
                const solid=pixel.alpha>0;
                const rubber=pixel.red===230&&pixel.green===0&&pixel.blue===230;
                const tankHit=[this.scene.tank1,this.scene.tank2].some(t=>t.isPointInside(p.x,p.y));
                if(solid&&this.definition.behavior==='drill'&&!p.child){
                    p.drilled=(p.drilled||0)+2;this.carve(p.x,p.y,5);
                    if(p.drilled<150&&!tankHit)continue;
                }
                if(solid&&(this.definition.behavior==='ricochet'||rubber)&&p.bounces<2){
                    const slope=this.terrain.getSlope(Math.round(p.x),Math.round(p.y));
                    const angle=Number.isFinite(slope)?2*slope-Math.atan2(p.vy,p.vx):-Math.atan2(p.vy,p.vx);
                    const speed=Math.hypot(p.vx,p.vy)*.65;p.vx=Math.cos(angle)*speed;p.vy=Math.sin(angle)*speed;
                    p.x=ox;p.y=oy;p.bounces++;break;
                }
                if(solid||tankHit){this.impact(p);break;}
            }
            if(!p.removed)p.visual.setPosition(p.x,p.y);
        }
        this.projectiles=this.projectiles.filter(p=>!p.removed);
        if((!this.projectiles.length&&!this.events.length)||this.tick>=960)this.finish();
    };
    dispose = () => {
        this.done = true;
        this.projectiles.forEach(projectile => projectile.visual.destroy());
        this.projectiles = [];
        this.events = [];
        this.trail?.destroy();
        this.scene.events.off('shutdown', this.onShutdown);
    };
    finish = () => {
        if (this.done) return;
        this.dispose();
        // Merge nearby digs before asking the legacy settling system to collapse columns.
        const areas = [];
        this.dirty.forEach(dig => {
            if (!areas.some(area => Math.abs(area.x-dig.x)<20 && Math.abs(area.y-dig.y)<30)) areas.push(dig);
        });
        areas.slice(0,60).forEach(dig => this.terrain.fixTerrain(dig.x,dig.y,dig.r));
        this.dirty = [];
        if (this.weapon.turret.activeWeapon?.weaponHandler === this || !this.weapon.turret.activeWeapon?.weaponHandler) this.weapon.turret.activeWeapon = null;
    };

}

export const weaponIcon = definition => {
    const canvas=document.createElement('canvas');canvas.width=28;canvas.height=28;
    const ctx=canvas.getContext('2d');const color=`#${definition.payload.color.toString(16).padStart(6,'0')}`;
    ctx.fillStyle='#1b303b';ctx.fillRect(0,0,28,28);ctx.strokeStyle=color;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(14,14,10,0,Math.PI*2);ctx.stroke();ctx.fillStyle=color;ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText(definition.category.slice(0,1),14,18);
    ctx.fillRect(3+definition.id%7*3,24,3,2);return canvas;
};
export const makeExpansionWeapon = definition => {
    definition=withMechanicalRules(definition);
    let icon;
    return {...definition,createInstance:()=>new ExpansionRuntime(definition),get logoCanvas(){return icon||(icon=weaponIcon(definition));}};
};
