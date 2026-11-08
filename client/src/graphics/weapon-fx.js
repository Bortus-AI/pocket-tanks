// Scene-owned, presentation-only compositor. Gameplay never samples this canvas.
// Textured sprites, emissive passes and ballistic debris share one Phaser texture.
import { weaponIdentity,identitySignature } from './weapon-identity';
import { drawIdentityGeometry } from './weapon-identity-geometry';
import { storyboardPose,materialActors } from './weapon-identity-animation';
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const random=(a,b)=>a+Math.random()*(b-a);
const css=c=>typeof c==='number'?`#${c.toString(16).padStart(6,'0')}`:c||'#ffbd76';
const sprites=new Map();
const COLORS={kinetic:'#ffd18b',fire:'#ff8b35',volatile:'#ffae49',frost:'#9cdeff',acid:'#b7f55c',ion:'#bb9bff',foam:'#b2ffde',magnet:'#67dfdf',leech:'#f18bd0',seismic:'#c9b08e'};
const earthKinds=new Set(['drill','tunnel','fault','trench','excavator','crater','longtunnel','carpet']);
const fieldKinds=new Set(['shield','repair','cleanse','selfdome','selfrubberdome','selfshelter']);
const warpKinds=new Set(['blink','swap','randomblink','selfescape']);
const styleOf=o=>fieldKinds.has(o.classicMechanic||o.behavior)?'field':warpKinds.has(o.classicMechanic||o.behavior)?'warp':o.payload&&o.payload!=='kinetic'&&o.payload!=='seismic'?o.payload:earthKinds.has(o.classicMechanic||o.behavior)||o.payload==='seismic'?'earth':'kinetic';
const hasIdentity=options=>Number.isInteger(options.weaponId)||!!options.weaponName;
const groundStories=new Set(['wall','dome','berm','platform','bridge','selfbridge','seed','pedestal','selfdome','selfrubberdome','selfshelter','scatterbuild','pillars','groundwave','fault','trench','crater','pitfall','pitfirebury','landslide','foam','autoturrets','missileturret','runngun','shield','repair','cleanse','oil','acidpool','mine']);
const profileCache=new Map();
const SURFACES={
    ballistic:['#39464b','#b49a72','#fff0bd'],thermal:['#a52c16','#fa792f','#fff1ac'],crystalline:['#487d9c','#8ec7e2','#edffff'],
    solvent:['#405d24','#8fbc43','#ddff91'],staccato:['#6857a6','#bdabff','#f8edff'],stratified:['#514d3d','#98866a','#d8c6a3'],
    returnflow:['#71385a','#d57cad','#ffe1ed'],pneumatic:['#6eab91','#b8e6cb','#f1fff4'],ferrous:['#345d60','#75b9b9','#d2ffff'],unstable:['#783720','#d3813a','#fff0a0'],
};
const surfacePaint=(c,primary,size,monochrome)=>{
    const colors=monochrome?['#555555','#aaaaaa','#f3f3f3']:(SURFACES[primary]||SURFACES.ballistic);
    const gradient=c.createLinearGradient?.(-size,-size,size,size);
    if(gradient){gradient.addColorStop(0,colors[2]);gradient.addColorStop(.2,colors[1]);gradient.addColorStop(1,colors[0]);}
    return {fill:gradient||colors[1],edge:colors[2],dark:colors[0]};
};
const profileFor=options=>{
    const key=[options.weaponId,options.weaponName,options.classicMechanic,options.behavior,options.payload,JSON.stringify(options.semanticRules||[]),JSON.stringify(options.mechanicOptions||{})].join(':');
    if(profileCache.has(key))return profileCache.get(key);
    const profile=weaponIdentity(options);profile.renderSignature=identitySignature(profile);if(profileCache.size>=1024)profileCache.delete(profileCache.keys().next().value);profileCache.set(key,profile);return profile;
};

// Irregular lit smoke billboards, flame tongues and radial light are cached once
// across matches. They are bitmap detail, rather than solid geometry primitives.
function sprite(kind,color) {
    const key=kind+color;if(sprites.has(key))return sprites.get(key);
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const c=canvas.getContext('2d');
    if(kind==='smoke'||kind==='dust'||kind==='vapor') {
        const palette=kind==='smoke'?['rgba(123,129,131,.55)','rgba(41,47,52,.62)']:kind==='dust'?['rgba(211,194,152,.43)','rgba(112,105,85,.38)']:[color+'50',color+'16'];
        for(let i=0;i<13;i++){
            const angle=i*2.399,rad=11+Math.sqrt(i)*7,x=64+Math.cos(angle)*rad,y=64+Math.sin(angle)*rad,r=22+i%4*3;
            const g=c.createRadialGradient(x-7,y-10,1,x,y,r);g.addColorStop(0,palette[0]);g.addColorStop(.53,palette[1]);g.addColorStop(1,'rgba(0,0,0,0)');
            c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
        }
        // Fine wisps break up the billboard edge without a runtime blur filter.
        for(let i=0;i<28;i++){
            const x=25+(i*47%79),y=24+(i*31%81),r=5+i%7;
            const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(171,177,173,.055)');g.addColorStop(1,'rgba(140,145,142,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
        }
    } else if(kind==='flame') {
        const g=c.createRadialGradient(64,94,2,64,81,54);g.addColorStop(0,'rgba(255,255,218,.98)');g.addColorStop(.22,'rgba(255,226,120,.95)');g.addColorStop(.47,'rgba(255,129,34,.83)');g.addColorStop(.73,'rgba(226,51,15,.38)');g.addColorStop(1,'rgba(120,25,5,0)');
        c.fillStyle=g;c.beginPath();c.moveTo(64,121);c.bezierCurveTo(9,112,29,72,45,51);c.bezierCurveTo(49,77,61,65,57,6);c.bezierCurveTo(84,32,88,58,83,77);c.bezierCurveTo(101,59,110,87,103,105);c.quadraticCurveTo(90,126,64,121);c.fill();
        const core=c.createLinearGradient(0,60,0,124);core.addColorStop(0,'rgba(255,211,94,0)');core.addColorStop(.65,'rgba(255,239,156,.85)');core.addColorStop(1,'rgba(255,255,229,.95)');c.fillStyle=core;c.beginPath();c.moveTo(43,115);c.quadraticCurveTo(60,87,63,55);c.quadraticCurveTo(81,82,84,115);c.fill();
    } else {
        const g=c.createRadialGradient(64,64,0,64,64,63);g.addColorStop(0,'rgba(255,255,242,.94)');g.addColorStop(.065,'rgba(255,248,214,.83)');g.addColorStop(.2,color);g.addColorStop(.42,color+'70');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,128,128);
    }
    sprites.set(key,canvas);return canvas;
}

export class WeaponFX {
    constructor(scene) {
        this.scene=scene;this.particles=[];this.bursts=[];this.stories=[];this.beams=[];this.projectiles=new Map();this.zones=new Map();this.sequence=0;this.time=0;this.disposed=false;this.drawMs=0;this.hadVisuals=false;
        this.mobile=!scene.game.device.os.desktop;this.reducedMotion=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.particleLimit=this.mobile?200:650;this.storyLimit=this.mobile?14:24;this.beamLimit=this.mobile?12:24;this.lastShake=-100;
        this.canvas=document.createElement('canvas');this.canvas.width=scene.renderer.width;this.canvas.height=Math.floor(scene.renderer.height*2/3);
        this.ctx=this.canvas.getContext('2d');
        this.textureKey=`weapon-fx-${scene.sys.settings.key}`;
        if(scene.textures.exists(this.textureKey))scene.textures.remove(this.textureKey);
        this.texture=scene.textures.addCanvas(this.textureKey,this.canvas);
        this.image=scene.add.image(this.canvas.width/2,this.canvas.height/2,this.textureKey).setDepth(5);
        this.onUpdate=(_,delta)=>this.update(delta);this.onShutdown=()=>this.dispose();
        scene.events.on('update',this.onUpdate);scene.events.once('shutdown',this.onShutdown);
    }
    stats(){return {particleCount:this.particles.length,particleLimit:this.particleLimit,projectileCount:this.projectiles.size,zoneCount:this.zones.size,beamCount:this.beams.length,beamLimit:this.beamLimit,burstCount:this.bursts.length,storyCount:this.stories.length,storyLimit:this.storyLimit,drawMs:this.drawMs,reducedMotion:this.reducedMotion,textureCount:this.disposed?0:1};}
    story(x,y,r,options={}) {
        if(!hasIdentity(options))return null;
        const profile=profileFor(options),color=css(options.color||COLORS[options.payload]||COLORS.kinetic);
        const story={x,y,r:clamp(r,15,100),age:0,life:this.reducedMotion?1.3:1.8,profile,color,angle:Number.isFinite(options.angle)?options.angle:(options.direction<0?Math.PI:0),weaponId:options.weaponId,signature:profile.renderSignature};
        if(this.stories.length>=this.storyLimit)this.stories.shift();this.stories.push(story);return story;
    }
    particle(kind,x,y,opts={}) {
        if(this.particles.length>=this.particleLimit)return;
        this.particles.push({kind,x,y,vx:0,vy:0,gravity:0,drag:.2,age:0,life:1,size:6,growth:1,rotation:random(0,TAU),spin:random(-1,1),alpha:1,color:'#ffd18b',seed:random(0,TAU),...opts});
    }
    impact(x,y,r=40,options={}) {
        if(this.disposed)return false;
        r=clamp(r,7,130);const style=styleOf(options),color=css(options.color||COLORS[options.payload]||COLORS.kinetic);
        const identity=this.story(x,y,r,options),crowded=this.particles.length>this.particleLimit*.75,scale=(crowded?.25:1)*(identity?.38:1),weight=clamp(r/55,.65,1.55);
        if(identity?.profile.presentation==='probe')return true;
        if(!identity){if(this.bursts.length>=48)this.bursts.shift();this.bursts.push({x,y,r,color,style,age:0,life:['field','warp'].includes(style)?1.3:.48,seed:random(0,TAU)});}
        if(style==='field'||style==='warp') {
            for(let i=0;i<20*scale;i++) {
                const a=i/20*TAU;this.particle('energy',x+Math.cos(a)*r*.65,y+Math.sin(a)*r*.5,{vx:-Math.cos(a)*25,vy:-Math.sin(a)*25,life:random(.45,1.1),size:2,color:style==='field'?'#9effdd':color,alpha:.9});
            }
            return true;
        }
        const amount=Math.round(clamp(r*.32,10,32)*scale);
        // Earth and kinetic attacks have visible weight, fragments and dust.
        if(style==='earth'||style==='kinetic'||style==='fire'||style==='volatile') {
            for(let i=0;i<amount;i++) {
                const a=random(-Math.PI,0),speed=random(35,r*3.1);
                this.particle('debris',x+random(-8,8),y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-25,gravity:350,drag:.15,life:random(.5,1.3),size:random(1.8,5.5),spin:random(-9,9),color:i%3?'#7e7660':'#b5ad91'});
            }
            for(let i=0;i<8*scale;i++)this.particle('dust',x+random(-r*.4,r*.4),y+random(-4,8),{vx:random(-r,r),vy:random(-35,-5),drag:1.4,life:random(.65,1.3),size:random(15,27),growth:40,alpha:.45});
        }
        if(style==='kinetic'||style==='fire'||style==='volatile') {
            const fiery=style!=='kinetic',fireCount=Math.round((fiery?20:9)*scale);
            for(let i=0;i<fireCount;i++)this.particle('flame',x+random(-r*.3,r*.3),y+random(-5,3),{vx:random(-r*.65,r*.65),vy:random(-r*2,-25),drag:2.2,life:random(fiery?.4:.2,fiery?.9:.5),size:random(14,fiery?35:24)*weight,growth:10*weight,rotation:random(-.6,.6),spin:random(-.4,.4),alpha:fiery?.85:.75});
            for(let i=0;i<(fiery?12:7)*scale;i++)this.particle('smoke',x+random(-r*.35,r*.35),y-random(4,14),{age:-random(.04,.22),vx:random(-26,26),vy:random(-65,-28),drag:.8,life:random(1,1.9),size:random(22,38)*weight,growth:random(22,42)*weight,alpha:random(.5,.75)});
            for(let i=0;i<amount;i++){const a=random(-Math.PI,Math.PI),speed=random(40,r*4);this.particle('spark',x,y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,gravity:180,drag:1.5,life:random(.18,.65),size:random(1,2),color:i%4?'#ffc779':'#fff4d3'});}
        } else if(style==='frost') {
            for(let i=0;i<amount*1.3;i++){const a=random(0,TAU),speed=random(25,r*3.5);this.particle('ice',x,y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-40,gravity:160,life:random(.5,1.1),size:random(4,10),spin:random(-7,7),color:'#b7edff'});}
            for(let i=0;i<8*scale;i++)this.particle('vapor',x+random(-r*.3,r*.3),y,{vx:random(-70,70),vy:random(-25,-5),life:random(.6,1.2),size:24,growth:45,alpha:.7,color:'#d1eeff'});
        } else if(style==='acid'||style==='foam') {
            for(let i=0;i<amount;i++){const a=random(-Math.PI,0),speed=random(30,r*2.8);this.particle('drop',x,y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,gravity:280,drag:.6,life:random(.4,.9),size:random(2,6),color:style==='acid'?'#b5f75c':'#baffdf'});}
            for(let i=0;i<5*scale;i++)this.particle('vapor',x+random(-15,15),y,{vx:random(-18,18),vy:random(-65,-20),life:1.2,size:20,growth:35,alpha:.7,color});
        } else {
            for(let i=0;i<amount;i++){const a=random(0,TAU),speed=random(50,r*3.2);this.particle('energy',x,y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,drag:1.8,life:random(.25,.8),size:random(2,4),color});}
            if(style==='ion')for(let i=0;i<4*scale;i++){const a=random(0,TAU);this.beam(x,y,x+Math.cos(a)*r*1.6,y+Math.sin(a)*r,{color,payload:'ion',life:.2,heavy:false});}
        }
        if(!this.reducedMotion&&r>65&&this.time-this.lastShake>.25){this.scene.cameras?.main?.shake(110,.0018);this.lastShake=this.time;}
        return true;
    }
    beam(x1,y1,x2,y2,options={}) {
        if(this.disposed)return false;if(this.beams.length>=this.beamLimit)this.beams.shift();
        this.beams.push({x1,y1,x2,y2,color:css(options.color||COLORS[options.payload]||COLORS.ion),heavy:options.heavy,age:0,life:options.life||.42,seed:random(0,TAU),electric:options.payload==='ion'||options.payload==='magnet',profile:hasIdentity(options)?profileFor(options):null});
        if(hasIdentity(options))this.story(x2,y2,options.heavy?35:25,{...options,angle:Math.atan2(y2-y1,x2-x1)});
        for(let i=0;i<5;i++)this.particle('spark',x2,y2,{vx:random(-90,90),vy:random(-110,25),gravity:140,life:.4,size:1.5,color:css(options.color||COLORS.ion)});
        return true;
    }
    muzzle(x,y,angle,options={}) {
        const color=css(options.color||COLORS[options.payload]||COLORS.kinetic);
        for(let i=0;i<7;i++){const a=angle+random(-.2,.2),speed=random(60,210);this.particle('spark',x,y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:random(.07,.18),size:random(1,2),color});}
        this.particle('light',x,y,{life:.1,size:options.heavy?38:24,color,alpha:.75});
        for(let i=0;i<3;i++)this.particle('smoke',x,y,{vx:Math.cos(angle)*random(25,50),vy:Math.sin(angle)*35-20,life:.6,size:12,growth:18,alpha:.35});
    }
    projectile(x,y,options={}) {
        const id=++this.sequence,p={x,y,px:x,py:y,history:[],age:0,color:css(options.color||COLORS[options.payload]||COLORS.kinetic),options,trailClock:0,visible:true,profile:hasIdentity(options)?profileFor(options):null};
        if(this.projectiles.size<128)this.projectiles.set(id,p);
        const visual={x,y,visible:true,setPosition:(nx,ny)=>{visual.x=nx;visual.y=ny;p.px=p.x;p.py=p.y;p.x=nx;p.y=ny;p.history.unshift({x:nx,y:ny});if(p.history.length>16)p.history.length=16;return visual;},setVisible:value=>{p.visible=visual.visible=!!value;if(!p.visible)p.history.length=0;return visual;},destroy:()=>this.projectiles.delete(id)};
        return visual;
    }
    zone(options) {
        const id=++this.sequence,z={...options,id,age:0,clock:0,seed:random(0,TAU)};
        if(this.zones.size>=32)this.zones.delete(this.zones.keys().next().value);
        this.zones.set(id,z);return {destroy:()=>this.zones.delete(id)};
    }
    build(x,y,kind,options={}) {
        this.story(x,y,kind==='bridge'?70:kind==='wall'?55:40,{...options,angle:0});
        const span=kind==='bridge'?95:kind==='seed'?65:35;
        for(let i=0;i<12;i++)this.particle('dust',x+random(-span,span),y-random(0,kind==='wall'?70:10),{vx:random(-35,35),vy:random(-30,-10),life:random(.5,1.1),size:random(12,23),growth:25,alpha:.5});
        for(let i=0;i<9;i++)this.particle('debris',x+random(-span,span),y,{vx:random(-60,60),vy:random(-150,-45),gravity:240,life:.7,size:random(2,5),color:'#a6b693',spin:random(-5,5)});
    }
    reset(){this.particles.length=0;this.beams.length=0;this.bursts.length=0;this.stories.length=0;this.projectiles.clear();this.zones.clear();this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.texture.refresh();}
    dispose(){if(this.disposed)return;this.disposed=true;this.scene.events.off('update',this.onUpdate);this.scene.events.off('shutdown',this.onShutdown);this.particles=[];this.beams=[];this.bursts=[];this.stories=[];this.projectiles.clear();this.zones.clear();this.image.destroy();if(this.scene.textures.exists(this.textureKey))this.scene.textures.remove(this.textureKey);if(this.scene.weaponFX===this)this.scene.weaponFX=null;}
    update(delta=16.67) {
        if(this.disposed)return;const started=performance.now(),dt=clamp(delta/1000,0,.04);this.time+=dt;
        this.zones.forEach(z=>{z.age+=dt;z.clock+=dt;if(z.clock>.09){z.clock=0;const x=z.x+Math.sin(z.age*11+z.seed)*z.radius*.8;
            if(z.kind==='fire'){this.particle('flame',x,z.y-4,{vy:random(-60,-30),vx:random(-8,8),life:random(.5,.9),size:random(18,29),growth:6,rotation:random(-.25,.25),alpha:.85});if(Math.random()<.25)this.particle('smoke',x,z.y-12,{vx:random(-10,10),vy:-30,life:1.6,size:21,growth:25,alpha:.45});}
            if(z.kind==='acid'){this.particle('vapor',x,z.y-3,{vy:random(-48,-24),life:1.4,size:20,growth:23,alpha:.62,color:'#b4e578'});if(Math.random()<.3)this.particle('drop',x,z.y-3,{vx:random(-12,12),vy:-35,gravity:150,life:.35,size:3,color:'#b7ed69'});}
        }});
        this.projectiles.forEach(p=>{p.age+=dt;p.trailClock+=dt;if(p.visible&&p.trailClock>.065){p.trailClock=0;const style=styleOf(p.options);if(['kinetic','earth','fire','volatile'].includes(style))this.particle(p.age%1<.2?'smoke':'vapor',p.x,p.y,{life:style==='fire'?.6:.4,size:style==='fire'?12:6,growth:18,alpha:.35,vx:random(-3,3),vy:-8,color:'#c3d0cf'});}});
        let write=0;
        for(const p of this.particles){p.age+=dt;if(p.age>p.life)continue;if(p.age>=0){p.vy+=p.gravity*dt;const drag=Math.exp(-p.drag*dt);p.vx*=drag;p.vy*=drag;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rotation+=p.spin*dt;}this.particles[write++]=p;}this.particles.length=write;
        this.beams=this.beams.filter(b=>(b.age+=dt)<b.life);this.bursts=this.bursts.filter(b=>(b.age+=dt)<b.life);this.stories=this.stories.filter(s=>(s.age+=dt)<s.life);
        const hasFields=[this.scene.tank1,this.scene.tank2].some(tank=>tank?.tactics&&(tank.tactics.shield>0||tank.tactics.frost));
        const active=this.particles.length||this.beams.length||this.bursts.length||this.stories.length||this.projectiles.size||this.zones.size||hasFields;
        if(!active&&!this.hadVisuals)return;this.hadVisuals=!!active;
        const c=this.ctx;c.clearRect(0,0,this.canvas.width,this.canvas.height);
        this.zones.forEach(z=>this.drawZone(c,z));
        for(const p of this.particles)if(['smoke','dust','vapor'].includes(p.kind)&&p.age>=0)this.drawParticle(c,p);
        for(const b of this.bursts)this.drawBurst(c,b);
        for(const story of this.stories)this.drawStory(c,story);
        this.projectiles.forEach(p=>this.drawProjectile(c,p));
        for(const p of this.particles)if(!['smoke','dust','vapor'].includes(p.kind)&&p.age>=0)this.drawParticle(c,p);
        for(const b of this.beams)this.drawBeam(c,b);
        this.drawTankFields(c);
        c.globalAlpha=1;c.globalCompositeOperation='source-over';this.texture.refresh();this.drawMs=this.drawMs*.9+(performance.now()-started)*.1;
    }
    drawStory(c,story) {
        const {profile,r}=story,t=story.age/story.life,ground=groundStories.has(profile.mechanic);
        const orientation=ground?0:story.angle;
        const glyph=(name,progress,motion,scale=1,offset=0,role='action')=>{
            if(progress<0||progress>1)return;
            const p=storyboardPose(motion,progress,this.reducedMotion);
            c.save();c.translate(story.x,story.y);c.rotate(orientation);
            c.translate(p.x*r*.55,p.y*r*.55+offset*r);c.rotate(p.rotation);c.scale(p.sx,p.sy);
            const actors=['primary','mass','warning'].includes(role)?materialActors(profile.material.primary,progress,this.reducedMotion):[{x:0,y:0,rotation:0,sx:1,sy:1,alpha:1}];
            for(const actor of actors){
                c.save();c.translate(actor.x*r*.65,actor.y*r*.65);c.rotate(actor.rotation);c.scale(actor.sx,actor.sy);
                const paint=surfacePaint(c,profile.material.primary,r*scale,this.monochrome);
                c.globalAlpha=p.alpha*actor.alpha*(role==='warning'?.52:role==='mass'?.88:role==='residue'?.76:.94);
                c.lineJoin='round';c.lineCap='round';c.lineWidth=role==='mass'?.8:role==='rule'?2:role==='primary'?1.8:1.2;
                c.strokeStyle=role==='residue'?paint.dark:paint.edge;c.fillStyle=paint.fill;
                const hollow=['moat','crosscut','roofslot','undercut','flanks','surveygrid'].includes(name);
                drawIdentityGeometry(c,name,r*scale,{fill:role!=='warning'&&!hollow});
                c.restore();
            }
            c.restore();
        };
        // The whole family changes its physical breakup and timing with its
        // material. Filled, lit masses carry the effect; outlines are secondary.
        const probe=profile.presentation==='probe';
        if(profile.presentation==='physical')glyph(profile.material.mass,t/.88,'strike',.38,0,'mass');
        glyph(profile.warning,t/.24,'mark',.64,0,probe?'probe':'warning');
        const timing=probe?{start:.04,spacing:.22,duration:.42}:profile.presentation==='field'?{start:.01,spacing:.16,duration:.5}:profile.material;
        profile.action.forEach((name,index)=>glyph(name,(t-timing.start-index*timing.spacing)/timing.duration,profile.rhythm,1.05+index*.1,0,probe?'probe':'primary'));
        if(!probe)glyph(profile.material.accent,(t-.035)/.75,profile.material.motion,.4,0,'primary');
        glyph(profile.aftermath,(t-.62)/.38,'mark',1,.12,'residue');
        if(!probe)glyph(profile.material.residue,(t-.7)/.3,'mark',.32,.23,'residue');
        // Real terrain/status rules own the resolution shot rather than hiding
        // behind the family flash as a small decorative marker.
        profile.rules.forEach((rule,index)=>{
            const start={flight:.04,contact:.12,resolve:.36,aftermath:.62}[rule.stage]??.36;
            glyph(rule.geometry,(t-start-index*.035)/.38,rule.motion,1.08,rule.stage==='aftermath'?.08:0,'rule');
        });
    }
    drawIdentityProjectile(c,p) {
        const profile=p.profile,dx=p.x-p.px,dy=p.y-p.py;
        if(Math.hypot(dx,dy)>.001)p.identityAngle=Math.atan2(dy,dx);
        const angle=p.identityAngle??p.options.angle??0,size=p.options.small?3.8:7.5;
        if(p.history.length>1){
            c.save();c.strokeStyle=this.monochrome?'#bcbcbc':p.color;c.lineWidth=1;c.globalAlpha=.42;
            c.beginPath();p.history.forEach((point,index)=>index?c.lineTo(point.x,point.y):c.moveTo(point.x,point.y));c.stroke();
            const step=this.mobile?6:4;
            for(let index=2;index<p.history.length;index+=step){
                const point=p.history[index],prior=p.history[Math.max(0,index-1)];
                if(profile.presentation==='probe')continue;
                c.save();c.translate(point.x,point.y);c.rotate(Math.atan2(prior.y-point.y,prior.x-point.x));
                c.globalAlpha=.45*(1-index/p.history.length);c.lineWidth=.85;
                drawIdentityGeometry(c,profile.trail,size*(.7+index/p.history.length));c.restore();
                c.save();c.translate(point.x,point.y);c.rotate(Math.atan2(prior.y-point.y,prior.x-point.x));
                const paint=surfacePaint(c,profile.material.primary,size,this.monochrome);c.strokeStyle=paint.edge;c.fillStyle=paint.fill;c.globalAlpha=.7*(1-index/p.history.length);
                drawIdentityGeometry(c,profile.material.wake,size*.5,{fill:true});c.restore();
            }
            c.restore();
        }
        c.save();c.translate(p.x,p.y);c.rotate(angle);c.globalAlpha=1;
        const paint=surfacePaint(c,profile.material.primary,size,this.monochrome);c.strokeStyle=paint.edge;c.fillStyle=paint.fill;c.lineWidth=.9;
        if(profile.presentation!=='probe')drawIdentityGeometry(c,profile.material.hull,size*(profile.material.primary==='ballistic'?.7:.85),{fill:true});
        c.fillStyle=paint.dark;c.strokeStyle=paint.edge;c.lineWidth=.8;
        drawIdentityGeometry(c,profile.body,size,{fill:true});
        c.strokeStyle=this.monochrome?'#ffffff':p.color;c.globalAlpha=.8;c.lineWidth=.8;
        if(profile.presentation!=='probe')drawIdentityGeometry(c,profile.material.accent,size*.36);
        for(const rule of profile.rules.filter(value=>value.stage==='flight')){
            c.save();const pose=storyboardPose(rule.motion,(p.age%1.2)/1.2,this.reducedMotion);
            c.translate(pose.x*size*.4,-size*.9);c.rotate(pose.rotation*.25);c.scale(pose.sx,pose.sy);
            drawIdentityGeometry(c,rule.geometry,size*.65);c.restore();
        }
        if(p.options.fuse||p.options.phase==='fuse'){
            c.save();c.translate(0,-size*1.5);c.strokeStyle='#ffd19a';drawIdentityGeometry(c,'fuseclock',size*.75);c.restore();
        }
        c.restore();
    }
    drawParticle(c,p) {
        const t=p.age/p.life,fade=Math.sin(Math.min(1,t*5)*Math.PI/2)*Math.pow(1-t,p.kind==='smoke'?.7:1.2),size=p.size+p.growth*t;
        c.save();c.translate(p.x,p.y);c.rotate(p.rotation);c.globalAlpha=p.alpha*fade;
        if(['smoke','dust','vapor'].includes(p.kind)){c.drawImage(sprite(p.kind,p.color),-size,-size,size*2,size*2);}
        else if(p.kind==='flame'){c.globalCompositeOperation='lighter';c.drawImage(sprite('flame','#ff9b34'),-size*.6,-size*1.5,size*1.2,size*1.8);}
        else if(p.kind==='light'||p.kind==='energy'){c.globalCompositeOperation='lighter';const r=p.kind==='energy'?size*4:size;c.drawImage(sprite('light',p.color),-r,-r,r*2,r*2);if(p.kind==='energy'){c.strokeStyle='#f1fcff';c.lineWidth=.8;c.beginPath();c.moveTo(-size,0);c.lineTo(size,0);c.stroke();}}
        else if(p.kind==='spark'){c.globalCompositeOperation='lighter';c.rotate(Math.atan2(p.vy,p.vx)-p.rotation);c.strokeStyle=p.color;c.lineWidth=p.size;c.beginPath();c.moveTo(-Math.min(18,Math.hypot(p.vx,p.vy)*.04),0);c.lineTo(1,0);c.stroke();}
        else if(p.kind==='debris'){c.fillStyle=p.color;c.beginPath();c.moveTo(-size,-size*.4);c.lineTo(-size*.3,-size);c.lineTo(size*.75,-size*.6);c.lineTo(size,size*.4);c.lineTo(0,size*.7);c.closePath();c.fill();c.strokeStyle='rgba(229,211,165,.5)';c.lineWidth=.6;c.stroke();}
        else if(p.kind==='ice'){c.globalCompositeOperation='lighter';c.fillStyle='#8ccfe8';c.strokeStyle='#ecffff';c.lineWidth=.7;c.beginPath();c.moveTo(0,-size*1.7);c.lineTo(size*.45,0);c.lineTo(0,size);c.lineTo(-size*.5,0);c.closePath();c.fill();c.stroke();c.beginPath();c.moveTo(0,-size);c.lineTo(0,size*.7);c.stroke();}
        else if(p.kind==='drop'){c.fillStyle=p.color;c.beginPath();c.moveTo(0,-size*1.8);c.bezierCurveTo(size,-size*.1,size,size,-size*.1,size);c.bezierCurveTo(-size,size,-size,0,0,-size*1.8);c.fill();}
        c.restore();
    }
    drawBurst(c,b) {
        const t=b.age/b.life,r=b.r;
        c.save();c.translate(b.x,b.y);
        if(b.style==='field'){c.globalAlpha=(1-t)*.7;this.hexField(c,0,-12,r*(.65+t*.3),'#9ef5d7',t*3);}
        else if(b.style==='warp'||b.style==='magnet'||b.style==='leech'){
            c.globalCompositeOperation='lighter';c.globalAlpha=(1-t)*.65;c.strokeStyle=b.color;c.lineWidth=1.8;
            for(let arm=0;arm<4;arm++){c.beginPath();for(let i=0;i<30;i++){const a=i*.16+arm*TAU/4+t*5,rr=(i/30)*r*(1-t*.5);const x=Math.cos(a)*rr,y=Math.sin(a)*rr*.55;if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.stroke();}
        } else if(b.style!=='earth'){
            c.globalCompositeOperation='lighter';c.globalAlpha=Math.max(0,1-t*2.7)*.8;
            const rr=r*(.9+t*1.2);c.drawImage(sprite('light',b.color),-rr,-rr,rr*2,rr*2);
            // A thin ground pressure front, flattened and broken into streaks.
            if(b.style==='kinetic'||b.style==='fire'||b.style==='volatile'){c.globalAlpha=(1-t)*.32;c.strokeStyle='#e7c69b';c.lineWidth=2;for(let side of [-1,1]){c.beginPath();c.moveTo(side*r*t*.5,4);c.quadraticCurveTo(side*r*t*1.3,2,side*r*t*2,8);c.stroke();}}
        }
        c.restore();
    }
    drawBeam(c,b) {
        const dx=b.x2-b.x1,dy=b.y2-b.y1,length=Math.max(1,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length,fade=Math.pow(1-b.age/b.life,.65);
        c.save();c.globalCompositeOperation='lighter';
        const path=()=>{c.beginPath();c.moveTo(b.x1,b.y1);const segments=Math.ceil(length/15);for(let i=1;i<segments;i++){const k=i/segments,j=b.electric?Math.sin(i*5.7+Math.floor(b.age*24)*2+b.seed)*5:Math.sin(i*3+b.seed)*.8;c.lineTo(b.x1+dx*k+nx*j,b.y1+dy*k+ny*j);}c.lineTo(b.x2,b.y2);};
        for(const [width,alpha,color] of [[b.heavy?20:11,.10,b.color],[b.heavy?9:5,.5,b.color],[b.heavy?3:1.5,1,'#effdff']]){c.globalAlpha=fade*alpha;c.strokeStyle=color;c.lineWidth=width;path();c.stroke();}
        if(b.electric){c.strokeStyle=b.color;c.globalAlpha=fade*.65;c.lineWidth=.8;for(let i=1;i<4;i++){const k=i/4,x=b.x1+dx*k,y=b.y1+dy*k;c.beginPath();c.moveTo(x,y);c.lineTo(x+nx*(15+i*3)+dx*.02,y+ny*(15+i*3)+dy*.02);c.lineTo(x+nx*9+dx*.05,y+ny*9+dy*.05);c.stroke();}}
        c.globalAlpha=fade*.65;c.drawImage(sprite('light',b.color),b.x2-28,b.y2-28,56,56);c.restore();
    }
    drawProjectile(c,p) {
        if(!p.visible)return;
        if(p.profile){this.drawIdentityProjectile(c,p);return;}
        const style=styleOf(p.options),angle=Math.atan2(p.y-p.py,p.x-p.px),small=p.options.small,size=small?2.5:4;
        c.save();
        if(p.history.length>1){c.globalCompositeOperation='lighter';for(let pass=0;pass<2;pass++){c.strokeStyle=pass?'#eafcff':p.color;c.lineWidth=pass?1:small?3:5;c.globalAlpha=pass?.5:.2;c.beginPath();p.history.forEach((h,i)=>{if(i)c.lineTo(h.x,h.y);else c.moveTo(h.x,h.y);});c.stroke();}}
        c.translate(p.x,p.y);c.rotate(angle);c.globalAlpha=1;
        if(['ion','magnet','foam','leech'].includes(style)){c.globalCompositeOperation='lighter';c.drawImage(sprite('light',p.color),-13,-13,26,26);c.fillStyle='#edffff';c.fillRect(-size,-1,size*2,2);}
        else if(style==='frost'){c.fillStyle='#c1f3ff';c.beginPath();c.moveTo(size*2,0);c.lineTo(-size,-size*.7);c.lineTo(-size*.5,0);c.lineTo(-size,size*.7);c.closePath();c.fill();}
        else {c.globalCompositeOperation='source-over';c.fillStyle='#617980';c.beginPath();c.moveTo(size*1.8,0);c.lineTo(size*.5,-size*.65);c.lineTo(-size*1.4,-size*.65);c.lineTo(-size*1.4,size*.65);c.lineTo(size*.5,size*.65);c.closePath();c.fill();c.strokeStyle='#dae6d1';c.lineWidth=.7;c.stroke();c.fillStyle=p.color;c.fillRect(-size,-size*.6,1.5,size*1.2);c.globalCompositeOperation='lighter';c.drawImage(sprite('light',style==='acid'?'#a3f36e':'#ffbf68'),-size*5,-size*2,size*5,size*4);}
        c.restore();
    }
    drawZone(c,z) {
        c.save();c.translate(z.x,z.y);
        if(z.kind==='mine') {c.fillStyle='#22353a';c.strokeStyle='#b3a17c';c.lineWidth=1;c.beginPath();c.moveTo(-7,2);c.lineTo(-4,-5);c.lineTo(4,-5);c.lineTo(7,2);c.closePath();c.fill();c.stroke();c.fillStyle=Math.sin(z.age*5)>0?'#ffcd71':'#745340';c.fillRect(-1.5,-5,3,2);c.strokeStyle='rgba(243,198,110,.18)';c.setLineDash([3,7]);c.beginPath();c.ellipse(0,2,z.radius,5,0,0,TAU);c.stroke();}
        else {
            const acid=z.kind==='acid',fire=z.kind==='fire';c.globalAlpha=fire?.23:.7;c.fillStyle=acid?'#46692a':fire?'#a85124':'#1d2431';c.beginPath();
            for(let i=0;i<=32;i++){const a=i/32*TAU,rr=z.radius*(.9+.07*Math.sin(a*7+z.seed));const x=Math.cos(a)*rr,y=Math.sin(a)*(acid?7:5)+Math.sin(a*5+z.age)*1.3;if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.closePath();c.fill();
            c.globalAlpha=.45;c.strokeStyle=acid?'#b2e477':fire?'#e9a04a':'#8c82b2';c.lineWidth=1;c.beginPath();c.moveTo(-z.radius*.7,0);c.bezierCurveTo(-z.radius*.3,-4,z.radius*.4,5,z.radius*.8,-1);c.stroke();
            if(acid){c.globalAlpha=.6;for(let i=0;i<5;i++){const phase=(z.age*.8+i*.21)%1,x=Math.sin(i*7+z.seed)*z.radius*.8;c.strokeStyle='#c9f18a';c.beginPath();c.ellipse(x,-phase*4,2+phase*2,1+phase,0,Math.PI,TAU);c.stroke();}}
        }
        c.restore();
    }
    hexField(c,x,y,r,color,phase=0) {
        c.save();c.translate(x,y);c.strokeStyle=color;c.lineWidth=1;
        // Hex mesh clipped to a hemisphere, with a brighter moving rim.
        c.beginPath();c.arc(0,0,r,Math.PI,TAU);c.lineTo(r,6);c.lineTo(-r,6);c.closePath();c.save();c.clip();
        for(let row=-5;row<=1;row++)for(let col=-7;col<=7;col++){const hx=col*10+(row%2)*5,hy=row*8;c.globalAlpha*=.999;c.beginPath();for(let k=0;k<6;k++){const a=k*TAU/6;const px=hx+Math.cos(a)*5.5,py=hy+Math.sin(a)*5.5;if(k)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();c.stroke();}
        c.restore();c.lineWidth=1.5;c.beginPath();c.arc(0,0,r,Math.PI+phase*.05,TAU-phase*.05);c.stroke();c.restore();
    }
    drawTankFields(c) {
        for(const tank of [this.scene.tank1,this.scene.tank2]){if(!tank?.tactics)continue;const s=tank.tactics;c.save();
            if(s.shield>0){c.globalAlpha=.2+Math.min(s.shield/150,.5);this.hexField(c,tank.x,tank.y-3,25,'#8ff4da',Math.sin(this.time*2));}
            if(s.frost){c.strokeStyle='rgba(181,230,255,.8)';c.lineWidth=1;for(let i=0;i<5;i++){const x=tank.x-14+i*7,y=tank.y-3;c.beginPath();c.moveTo(x-3,y);c.lineTo(x,y-10-i%2*6);c.lineTo(x+3,y);c.stroke();}}
            c.restore();
        }
    }
}

export const getWeaponFX=scene=>{
    if(scene.weaponFX&&!scene.weaponFX.disposed)return scene.weaponFX;
    // Unit/AI mocks deliberately keep a cheap legacy visual fallback.
    if(!scene.sys?.game||!scene.textures?.addCanvas||!scene.add?.image||!scene.events?.on)return null;
    scene.weaponFX=new WeaponFX(scene);return scene.weaponFX;
};
export const emitWeaponImpact=(scene,x,y,r,options={})=>getWeaponFX(scene)?.impact(x,y,r,options)||false;
export const emitWeaponBeam=(scene,x1,y1,x2,y2,options={})=>getWeaponFX(scene)?.beam(x1,y1,x2,y2,options)||false;
export const emitWeaponMuzzle=(scene,x,y,angle,options={})=>getWeaponFX(scene)?.muzzle(x,y,angle,options);
export const createWeaponProjectile=(scene,x,y,options={})=>{
    const fx=getWeaponFX(scene);if(fx)return fx.projectile(x,y,options);
    return scene.add.circle(x,y,options.small?2:3,options.color||0xffd18b).setDepth(4);
};
export const createWeaponZone=(scene,options)=>getWeaponFX(scene)?.zone(options)||null;
export const emitTerrainBuild=(scene,x,y,kind,options={})=>getWeaponFX(scene)?.build(x,y,kind,options);
