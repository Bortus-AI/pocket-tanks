// Scene-owned material effects. Gameplay never samples presentation pixels.
// Textured bursts and physical debris use sprites; beams and fields use canvas.
import { weaponIdentity } from './weapon-identity';
import { ParticleSprites, particleAtlas, drawParticleFrame, animatedParticleFrame, isMaterialBurst } from './particle-sprites';
import { materialRecipe, materialSample } from './weapon-materials';
import { drawMaterialProjectile } from './material-projectile';
import { terrainProfile } from './terrain-layouts';
import { WeaponArt, weaponArt, artVersion, impactArtSize } from './weapon-art';
import { ownedFrame, drawOwnedFrame } from './weapon-art/frames';
import { impactStyle, shakeFor } from './impact-style';
import { reducedMotion as prefersReducedMotion, watchReducedMotion } from './motion';
import { playWeaponSound, weaponAudio } from '../audio/weapon-audio';
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
const profileCache=new Map(),jsonCache=new WeakMap(),optionProfiles=new WeakMap();
// Rule arrays and option objects are definition-owned and reused, so their
// serialisation is computed once rather than on every frame.
const stableJSON=value=>{
    if(!value||typeof value!=='object')return JSON.stringify(value??null);
    let text=jsonCache.get(value);if(text===undefined){text=JSON.stringify(value);jsonCache.set(value,text);}return text;
};
// Baked designs.json materials predate some classic payload re-tunings. When
// the live definition's payload disagrees, owned art is tinted toward the live
// payload colour and its effect family follows the live payload.
const liveArt=new Map();
const sameFamily=(a,b)=>a===b||(a==='seismic'&&b==='earth')||(a==='earth'&&b==='seismic');
const livePayloadOf=options=>typeof options.payload==='string'?options.payload:options.payload?.key;
const noteLivePayload=(art,options)=>{
    const live=livePayloadOf(options);if(!art||!live||!COLORS[live])return;
    if(sameFamily(art.material,live)){liveArt.delete(art.id);return;}
    liveArt.set(art.id,{material:live,tint:parseInt(COLORS[live].slice(1),16)});
};
export const liveArtMaterial=design=>liveArt.get(design?.id)?.material||design?.material;
export const profileFor=options=>{
    const version=artVersion(),cached=optionProfiles.get(options);
    if(cached&&cached.version===version)return cached.profile;
    const key=[version,options.weaponId,options.weaponName,options.classicMechanic,options.behavior,options.payload,stableJSON(options.semanticRules||null),stableJSON(options.mechanicOptions||null)].join(':');
    let profile=profileCache.get(key);
    if(!profile){
        profile=weaponIdentity(options);profile.recipe=materialRecipe(profile);profile.art=weaponArt(options);profile.renderSignature=profile.art?.signature||JSON.stringify(profile.recipe);
        if(profile.art)noteLivePayload(profile.art,options);
        profile.style=impactStyle(options,profile.art&&!liveArt.has(profile.art.id)?profile.art:null);
        if(profileCache.size>=1024)profileCache.delete(profileCache.keys().next().value);profileCache.set(key,profile);
    }
    if(profile.art)noteLivePayload(profile.art,options);
    optionProfiles.set(options,{version,profile});return profile;
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
        this.scene=scene;this.particles=[];this.bursts=[];this.stories=[];this.beams=[];this.projectiles=new Map();this.zones=new Map();this.sequence=0;this.time=0;this.disposed=false;this.drawMs=0;this.hadVisuals=false;this.canvasUploads=0;
        this.mobile=!scene.game.device.os.desktop;this.reducedMotion=prefersReducedMotion();this.dirty=true;this.lastSlowDraw=-1;this.fieldKey='';
        this.stopWatchingMotion=watchReducedMotion(value=>{this.reducedMotion=value;this.dirty=true;if(this.scene.battleFX)this.scene.battleFX.reducedMotion=value;});
        this.particleLimit=this.mobile?200:650;this.storyLimit=this.mobile?14:24;this.beamLimit=this.mobile?12:24;this.lastShake=-100;
        this.canvas=document.createElement('canvas');this.canvas.width=scene.renderer.width;this.canvas.height=Math.floor(scene.renderer.height*2/3);
        this.ctx=this.canvas.getContext('2d');
        this.textureKey=`weapon-fx-${scene.sys.settings.key}`;
        if(scene.textures.exists(this.textureKey))scene.textures.remove(this.textureKey);
        this.texture=scene.textures.addCanvas(this.textureKey,this.canvas);
        this.image=scene.add.image(this.canvas.width/2,this.canvas.height/2,this.textureKey).setDepth(5);
        const materialArt=scene.textures.exists('material-fx-art')?scene.textures.get('material-fx-art').getSourceImage():null;
        this.atlas=particleAtlas(sprite,materialArt);
        this.gpuParticles=scene.renderer.gl?new ParticleSprites(scene,this.atlas,this.particleLimit):null;
        // The material sheet may finish loading after the battle starts: rebuild
        // the particle atlas and rebind the GPU texture instead of keeping a stale one.
        this.onTextureAdded=key=>{if(key!=='material-fx-art'||this.disposed)return;const art=scene.textures.get(key).getSourceImage();this.atlas=particleAtlas(sprite,art);this.gpuParticles?.bind(this.atlas);this.dirty=true;};
        scene.textures.on?.('addtexture',this.onTextureAdded);
        this.owned=new WeaponArt(scene,()=>this.activeArtIds());
        const warm=[...(scene.tank1?.weapons||[]),...(scene.tank2?.weapons||[])].map(w=>w.id);
        this.ready=this.owned.prewarm(warm);
        this.lastWeaponOptions=null;
        this.onUpdate=(_,delta)=>this.update(delta);this.onShutdown=()=>this.dispose();
        scene.events.on('update',this.onUpdate);scene.events.once('shutdown',this.onShutdown);
    }
    stats(){return {effectStyle:'individual',materialArt:[...this.owned.entries.values()].some(entry=>entry.loaded),dedicatedWeaponDesigns:770,sharedWeaponEffects:0,...this.owned.stats(),particleCount:this.particles.length,particleLimit:this.particleLimit,projectileCount:this.projectiles.size,zoneCount:this.zones.size,beamCount:this.beams.length,beamLimit:this.beamLimit,burstCount:this.bursts.length,storyCount:this.stories.length,storyLimit:this.storyLimit,drawMs:this.drawMs,reducedMotion:this.reducedMotion,textureCount:this.disposed?0:1,particleRenderer:this.gpuParticles?'webgl':'canvas',spritePool:this.gpuParticles?.images.length||0,canvasUploads:this.canvasUploads};}
    story(x,y,r,options={}) {
        if(!hasIdentity(options))return null;
        const profile=profileFor(options),color=css(options.color||COLORS[options.payload]||COLORS.kinetic);
        const story={x,y,r:clamp(r,4,260),age:0,life:.85,profile,recipe:profile.recipe,nextPulse:0,color,angle:Number.isFinite(options.angle)?options.angle:(options.direction<0?Math.PI:0),weaponId:options.weaponId,signature:profile.renderSignature,style:profile.style};
        if(this.stories.length>=this.storyLimit)this.stories.shift();this.stories.push(story);return story;
    }
    prepareWeapon(id){return this.owned.prewarm([id]);}
    activeArtIds(){
        const ids=new Set();for(const p of this.particles)if(p.art)ids.add(p.art.id);
        for(const p of this.projectiles.values())if(p.profile?.art)ids.add(p.profile.art.id);
        for(const z of this.zones.values())if(z.art)ids.add(z.art.id);
        for(const effect of this.scene.deployableFX?.effects||[])if(effect.art)ids.add(effect.art.id);return ids;
    }
    // Returns false when the weapon's texture slot is unavailable (all slots
    // in use on mobile) so the caller can fall back to the material burst.
    ownImpact(x,y,r,options,story){
        const design=story.profile.art,art=this.owned.get(design);if(!art)return false;
        const material=liveArtMaterial(design);
        this.scene.battleFX?.impact(x,y,r,design.construction?'earth':material);
        for(const tank of [this.scene.tank1,this.scene.tank2]){
            const strength=clamp(1-Math.hypot(tank?.x-x,tank?.y-y)/(r*3),0,1);if(strength>0)tank?.presentation?.impact(strength,Math.sign(tank.x-x)||1);
        }
        // Size the frames so the widest impact frame spans exactly the blast radius.
        const size=impactArtSize(design,r);
        this.particle('owned',x,y+3,{art,channel:'impact',life:design.duration,size,growth:0,rotation:0,spin:0,alpha:1});
        const count=this.reducedMotion?3:design.construction?8:12;
        for(let i=0;i<count;i++){
            const a=-Math.PI+(i+.5)/count*Math.PI,speed=random(30,Math.max(36,r*1.6));
            this.particle('owned',x,y,{art,channel:'debris',life:random(.45,1.1),size:random(12,23),vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-15,gravity:material==='foam'?90:290,rotation:a,spin:random(-4,4),alpha:.95});
        }
        this.particle('owned',x,y,{art,channel:'residue',age:-.35,life:1.25,size:size*.92,growth:size*.06,rotation:0,spin:0,alpha:.7});
        this.shake(r);return true;
    }
    ownBeam(x1,y1,x2,y2,options,profile){
        const art=this.owned.get(profile.art);if(!art)return false;
        const length=Math.hypot(x2-x1,y2-y1);this.particle('owned',(x1+x2)/2,(y1+y2)/2,{art,channel:'beam',life:options.life||.35,size:Math.max(1,length),beamWidth:options.heavy?30:18,rotation:Math.atan2(y2-y1,x2-x1),spin:0,alpha:1});
        const story=this.story(x2,y2,options.heavy?32:22,options);if(story&&!profile.art.presentation.includes('probe'))this.ownImpact(x2,y2,story.r,options,story);return true;
    }
    shake(r){
        const shake=shakeFor(r,this.reducedMotion);if(!shake||this.time-this.lastShake<=.25)return;
        this.scene.cameras?.main?.shake(shake.duration,shake.intensity);this.lastShake=this.time;
    }
    drawOwnedBody(c,p,art){
        const dx=p.x-p.px,dy=p.y-p.py;if(Math.hypot(dx,dy)>.001)p.travelAngle=Math.atan2(dy,dx);
        const name=`body-${Math.floor((p.age||0)*8)%2}`,size=p.options.small?22:34;
        c.save();c.translate(p.x,p.y);c.rotate(p.travelAngle??p.options.angle??0);drawOwnedFrame(c,art,name,-size/2,-size/2,size,size);c.restore();
    }
    drawOwnedParticle(c,p){
        const t=p.age/p.life,name=ownedFrame(p),size=p.size+p.growth*t;
        const fade=p.channel==='impact'?1:Math.pow(Math.max(0,1-t),.5);
        c.save();c.translate(p.x,p.y);c.rotate(p.rotation);c.globalAlpha=p.alpha*fade;
        if(p.channel==='beam')drawOwnedFrame(c,p.art,name,-size/2,-p.beamWidth/2,size,p.beamWidth);
        else {const origin=p.channel==='impact'||p.channel==='residue'?.85:.5;drawOwnedFrame(c,p.art,name,-size/2,-size*origin,size,size);}
        c.restore();
    }
    particle(kind,x,y,opts={}) {
        if(this.particles.length>=this.particleLimit)return;
        if(opts.art&&opts.artTint===undefined)opts.artTint=liveArt.get(opts.art.id)?.tint??null;
        this.particles.push({kind,x,y,vx:0,vy:0,gravity:0,drag:.2,age:0,life:1,size:6,growth:1,rotation:random(0,TAU),spin:random(-1,1),alpha:1,color:'#ffd18b',seed:random(0,TAU),...opts});
    }
    impact(x,y,r=40,options={}) {
        if(this.disposed)return false;
        // Visual extent follows the real blast radius (callers may pass the
        // scoring radius as damageRadius when it differs from the crater).
        r=clamp(Number.isFinite(options.damageRadius)?options.damageRadius:r,2,260);const style=styleOf(options),color=css(options.color||COLORS[options.payload]||COLORS.kinetic);
        const identity=this.story(x,y,r,options),crowded=this.particles.length>this.particleLimit*.75,weight=clamp(r/55,.65,1.55);
        if(identity?.profile.presentation==='probe')return true;
        if(identity?.profile.art&&this.ownImpact(x,y,r,options,identity))return true;
        const look=identity?.style||impactStyle(options,null),accent=look.accent,scale=(crowded?.35:1)*(this.reducedMotion?.45:1)*look.countScale;
        this.scene.battleFX?.impact(x,y,r,style);
        for(const tank of [this.scene.tank1,this.scene.tank2]) {
            const strength=clamp(1-Math.hypot(tank?.x-x,tank?.y-y)/(r*3),0,1);
            if(strength>0)tank?.presentation?.impact(strength,Math.sign(tank.x-x)||1);
        }
        if(['kinetic','fire','volatile','earth'].includes(style)) {
            if(!this.reducedMotion&&style!=='earth'&&!identity?.recipe?.construction)this.particle('explosion',x,y+3,{life:.85,size:r*1.2,growth:r*.25,alpha:1,rotation:0,spin:0});
            this.particle('light',x,y-4,{life:this.reducedMotion?.24:.16,size:r*1.7,growth:r*.2,alpha:this.reducedMotion?.09:.24,color});
        }
        const materialBurst={frost:'frostburst',acid:'acidburst',foam:'foamburst'}[style];
        if(materialBurst)this.particle(materialBurst,x,y+3,{life:.85,size:r*1.1,growth:r*.2,alpha:.95,rotation:0,spin:0});
        if(this.bursts.length>=48)this.bursts.shift();
        this.bursts.push({x,y,r,color,accent,ring:look.ring,ringWidth:look.ringWidth,style,identity:!!identity,age:0,life:['field','warp'].includes(style)?1.3:.48,seed:random(0,TAU)});
        if(style==='field'||style==='warp') {
            for(let i=0;i<20*scale;i++) {
                const a=i/20*TAU;this.particle('energy',x+Math.cos(a)*r*.65,y+Math.sin(a)*r*.5,{vx:-Math.cos(a)*25,vy:-Math.sin(a)*25,life:random(.45,1.1),size:2,color:style==='field'?'#9effdd':color,alpha:.9});
            }
            return true;
        }
        const amount=Math.round(clamp(r*.32,10,32)*scale);
        // Earth and kinetic attacks have visible weight, fragments and dust.
        if(style==='earth'||style==='kinetic'||style==='fire'||style==='volatile') {
            const soil=terrainProfile(this.scene.terrain?.layoutKind).soil;
            for(let i=0;i<amount;i++) {
                const a=random(-Math.PI,0),speed=random(35,r*2.4*look.spread);
                this.particle('debris',x+random(-8,8),y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-25,gravity:350,drag:.15,life:random(.5,1.3),size:random(1.8,5.5),spin:random(-9,9),color:soil[i%3]});
            }
            for(let i=0;i<8*scale;i++)this.particle('dust',x+random(-r*.4,r*.4),y+random(-4,8),{vx:random(-r,r),vy:random(-35,-5),drag:1.4,life:random(.65,1.3),size:random(15,27),growth:40,alpha:.45});
        }
        if((style==='kinetic'||style==='fire'||style==='volatile')&&!identity?.recipe?.construction) {
            const fiery=style!=='kinetic',fireCount=Math.round((fiery?20:9)*scale);
            for(let i=0;i<fireCount;i++)this.particle('flame',x+random(-r*.3,r*.3),y+random(-5,3),{vx:random(-r*.65,r*.65),vy:random(-r*2,-25),drag:2.2,life:random(fiery?.4:.2,fiery?.9:.5),size:random(14,fiery?35:24)*weight,growth:10*weight,rotation:random(-.6,.6),spin:random(-.4,.4),alpha:fiery?.85:.75});
            for(let i=0;i<(fiery?10:6)*scale;i++)this.particle('smoke',x+random(-r*.35,r*.35),y-random(4,14),{age:-random(.08,.3),vx:random(-26,26),vy:random(-45,-18),drag:.8,life:random(1.2,2),size:random(18,30)*weight,growth:random(25,42)*weight,alpha:random(.42,.65)});
            for(let i=0;i<amount;i++){const a=random(-Math.PI,Math.PI),speed=random(40,r*4);this.particle('spark',x,y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,gravity:180,drag:1.5,life:random(.18,.65),size:random(1,2),color:i%3===0?accent:i%4?'#ffc779':'#fff4d3'});}
        } else if(style==='frost') {
            for(let i=0;i<amount*1.3;i++){const a=random(0,TAU),speed=random(25,r*3.5);this.particle('ice',x,y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-40,gravity:160,life:random(.5,1.1),size:random(4,10),spin:random(-7,7),color:'#b7edff'});}
            for(let i=0;i<8*scale;i++)this.particle('vapor',x+random(-r*.3,r*.3),y,{vx:random(-70,70),vy:random(-25,-5),life:random(.6,1.2),size:24,growth:45,alpha:.7,color:'#d1eeff'});
        } else if(style==='acid'||style==='foam') {
            for(let i=0;i<amount;i++){const a=random(-Math.PI,0),speed=random(30,r*2.8);this.particle('drop',x,y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,gravity:280,drag:.6,life:random(.4,.9),size:random(2,6),color:style==='acid'?'#b5f75c':'#baffdf'});}
            for(let i=0;i<5*scale;i++)this.particle('vapor',x+random(-15,15),y,{vx:random(-18,18),vy:random(-65,-20),life:1.2,size:20,growth:35,alpha:.7,color});
        } else {
            for(let i=0;i<amount;i++){const a=random(0,TAU),speed=random(50,r*2.6*look.spread);this.particle('energy',x,y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,drag:1.8,life:random(.25,.8),size:random(2,4),color:i%3?color:accent});}
            if(style==='ion')for(let i=0;i<4*scale;i++){const a=random(0,TAU);this.beam(x,y,x+Math.cos(a)*r*1.6,y+Math.sin(a)*r,{color,payload:'ion',life:.2,heavy:false});}
        }
        this.shake(r);
        return true;
    }
    beam(x1,y1,x2,y2,options={}) {
        if(this.disposed)return false;
        const own=profileFor(options);if(own.art&&this.ownBeam(x1,y1,x2,y2,options,own))return true;
        if(this.beams.length>=this.beamLimit)this.beams.shift();
        this.beams.push({x1,y1,x2,y2,color:css(options.color||COLORS[options.payload]||COLORS.ion),heavy:options.heavy,age:0,life:options.life||.42,seed:random(0,TAU),electric:options.payload==='ion'||options.payload==='magnet',profile:hasIdentity(options)?own:null});
        if(hasIdentity(options))this.story(x2,y2,options.heavy?35:25,{...options,angle:Math.atan2(y2-y1,x2-x1)});
        for(let i=0;i<5;i++)this.particle('spark',x2,y2,{vx:random(-90,90),vy:random(-110,25),gravity:140,life:.4,size:1.5,color:css(options.color||COLORS.ion)});
        return true;
    }
    muzzle(x,y,angle,options={}) {
        const profile=profileFor(options);if(profile.art){const art=this.owned.get(profile.art);if(art){this.particle('owned',x,y,{art,channel:'muzzle',life:.16,size:options.heavy?48:34,rotation:angle,spin:0,alpha:1});return;}}
        const color=css(options.color||COLORS[options.payload]||COLORS.kinetic);
        for(let i=0;i<7;i++){const a=angle+random(-.2,.2),speed=random(60,210);this.particle('spark',x,y,{vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:random(.07,.18),size:random(1,2),color});}
        this.particle('light',x,y,{life:.1,size:options.heavy?38:24,color,alpha:.75});
        for(let i=0;i<3;i++)this.particle('smoke',x,y,{vx:Math.cos(angle)*random(25,50),vy:Math.sin(angle)*35-20,life:.6,size:12,growth:18,alpha:.35});
    }
    projectile(x,y,options={}) {
        const profile=profileFor(options),id=++this.sequence,p={x,y,px:x,py:y,history:[],age:0,idle:0,color:css(options.color||COLORS[options.payload]||COLORS.kinetic),accent:profile.style.accent,trail:profile.style.trail,options,trailClock:0,visible:true,profile:hasIdentity(options)?profile:null,fallback:profile};
        if(this.projectiles.size<128)this.projectiles.set(id,p);
        const visual={x,y,visible:true,setPosition:(nx,ny)=>{visual.x=nx;visual.y=ny;p.px=p.x;p.py=p.y;p.x=nx;p.y=ny;p.idle=0;p.history.unshift({x:nx,y:ny});if(p.history.length>16)p.history.length=16;return visual;},setVisible:value=>{p.visible=visual.visible=!!value;if(!p.visible)p.history.length=0;return visual;},destroy:()=>this.projectiles.delete(id)};
        return visual;
    }
    zone(options) {
        const profile=profileFor(options),art=profile.art?this.owned.get(profile.art):null;
        const id=++this.sequence,z={...options,id,age:0,clock:0,seed:random(0,TAU),art};
        if(this.zones.size>=32)this.zones.delete(this.zones.keys().next().value);
        this.zones.set(id,z);this.dirty=true;return {destroy:()=>{if(this.zones.delete(id))this.dirty=true;}};
    }
    build(x,y,kind,options={}) {
        // One build event -> one story (previously two were pushed).
        const story=this.story(x,y,kind==='bridge'?70:kind==='wall'?55:40,{...options,angle:0});if(story?.profile.art&&this.ownImpact(x,y,story.r,options,story))return;
        const span=kind==='bridge'?95:kind==='seed'?65:35;
        for(let i=0;i<12;i++)this.particle('dust',x+random(-span,span),y-random(0,kind==='wall'?70:10),{vx:random(-35,35),vy:random(-30,-10),life:random(.5,1.1),size:random(12,23),growth:25,alpha:.5});
        for(let i=0;i<9;i++)this.particle('debris',x+random(-span,span),y,{vx:random(-60,60),vy:random(-150,-45),gravity:240,life:.7,size:random(2,5),color:'#a6b693',spin:random(-5,5)});
    }
    reset(){this.particles.length=0;this.beams.length=0;this.bursts.length=0;this.stories.length=0;this.projectiles.clear();this.zones.clear();this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.texture.refresh();this.gpuParticles?.reset();this.hadVisuals=false;this.dirty=true;}
    // Turn handoff / checkpoint import: drop in-flight presentation (particles,
    // beams, bursts, stories, projectiles) but keep persistent zones.
    resetTransient(){if(this.disposed)return;this.particles.length=0;this.beams.length=0;this.bursts.length=0;this.stories.length=0;this.projectiles.clear();this.gpuParticles?.reset();this.dirty=true;}
    dispose(){if(this.disposed)return;this.disposed=true;this.stopWatchingMotion?.();this.scene.textures.off?.('addtexture',this.onTextureAdded);this.scene.events.off('update',this.onUpdate);this.scene.events.off('shutdown',this.onShutdown);this.particles=[];this.beams=[];this.bursts=[];this.stories=[];this.projectiles.clear();this.zones.clear();this.gpuParticles?.dispose();this.owned.dispose();this.image.destroy();if(this.scene.textures.exists(this.textureKey))this.scene.textures.remove(this.textureKey);if(this.scene.weaponFX===this)this.scene.weaponFX=null;}
    update(delta=16.67) {
        if(this.disposed)return;const started=performance.now(),ageDt=clamp(delta/1000,0,1),dt=Math.min(ageDt,.04);this.time+=ageDt;
        this.zones.forEach(z=>{z.age+=ageDt;z.clock+=ageDt;if(z.clock>.09){z.clock=0;const x=z.x+Math.sin(z.age*11+z.seed)*z.radius*.8;
            if(z.art){if(z.kind==='fire'||z.kind==='acid')this.particle('owned',x,z.y,{art:z.art,channel:'trail',life:1,size:z.kind==='fire'?44:34,growth:10,vy:z.kind==='fire'?-23:-12,rotation:0,spin:0,alpha:.9});return;}
            if(z.kind==='fire'){this.particle('flame',x,z.y-4,{vy:random(-60,-30),vx:random(-8,8),life:random(.5,.9),size:random(18,29),growth:6,rotation:random(-.25,.25),alpha:.85});if(Math.random()<.25)this.particle('smoke',x,z.y-12,{vx:random(-10,10),vy:-30,life:1.6,size:21,growth:25,alpha:.45});}
            if(z.kind==='acid'){this.particle('vapor',x,z.y-3,{vy:random(-48,-24),life:1.4,size:20,growth:23,alpha:.62,color:'#b4e578'});if(Math.random()<.3)this.particle('drop',x,z.y-3,{vx:random(-12,12),vy:-35,gravity:150,life:.35,size:3,color:'#b7ed69'});}
        }});
        this.projectiles.forEach((p,id)=>{
            p.age+=ageDt;p.trailClock+=ageDt;p.idle+=ageDt;
            // A runtime that dropped its visual without destroy() must not leave
            // a frozen projectile drawn forever.
            if(p.idle>8){this.projectiles.delete(id);return;}
            if(p.visible&&p.trailClock>.035){
                p.trailClock=0;const recipe=(p.profile||p.fallback).recipe,material=recipe.material;
                if(recipe.probe&& !p.profile?.art)return;
                if(p.profile?.art){const art=this.owned.get(p.profile.art);if(art){const count=clamp(Math.ceil(Math.hypot(p.x-p.px,p.y-p.py)/14),1,this.reducedMotion?1:3);for(let i=0;i<count;i++)this.particle('owned',p.px+(p.x-p.px)*(i+1)/count,p.py+(p.y-p.py)*(i+1)/count,{art,channel:'trail',life:recipe.probe?.25:.65,size:recipe.probe?10:23,growth:recipe.probe?0:12,vy:-9,rotation:0,spin:0,alpha:recipe.probe?.6:.85});}return;}
                const kind=recipe.projectile==='rocket'||material==='fire'||material==='volatile'?'flame':material==='earth'?'dust':material==='frost'||material==='acid'||material==='foam'?'vapor':material==='kinetic'?'smoke':'energy';
                const count=clamp(Math.ceil(Math.hypot(p.x-p.px,p.y-p.py)/10),1,4);
                const dx=p.x-p.px,dy=p.y-p.py,len=Math.hypot(dx,dy)||1;
                for(let i=0;i<count;i++){
                    // Per-weapon trail shape on top of the material wake.
                    const k=(i+1)/count,wobble=p.trail==='helix'?Math.sin(p.age*28+i)*4:0,tx=p.px+dx*k-dy/len*wobble,ty=p.py+dy*k+dx/len*wobble;
                    this.particle(kind,tx,ty,{life:kind==='flame'?.25:p.trail==='ribbon'?.8:.5,size:kind==='flame'?9:kind==='energy'?1.8:p.trail==='ribbon'?3.5:5,growth:kind==='energy'?2:p.trail==='ribbon'?6:13,alpha:kind==='energy'?.35:.42,vx:random(-3,3),vy:-8,color:p.color});
                    if(p.trail==='sparks')this.particle('spark',tx,ty,{vx:-dx*4+random(-20,20),vy:-dy*4+random(-20,20),drag:2,life:.22,size:1.2,color:p.accent});
                    else if(p.trail==='beads'&&i===0)this.particle('energy',tx,ty,{life:.35,size:1.4,growth:0,alpha:.5,color:p.accent});
                }
            }
        });
        for(const story of this.stories){story.age+=ageDt;this.emitStoryParticles(story);}
        let write=0;
        for(const p of this.particles){p.age+=ageDt;if(p.age>p.life)continue;if(p.age>=0){p.vy+=p.gravity*dt;const drag=Math.exp(-p.drag*dt);p.vx*=drag;p.vy*=drag;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rotation+=p.spin*dt;}this.particles[write++]=p;}this.particles.length=write;
        this.beams=this.beams.filter(b=>(b.age+=ageDt)<b.life);this.bursts=this.bursts.filter(b=>(b.age+=ageDt)<b.life);this.stories=this.stories.filter(s=>s.age<s.life);
        const fieldKey=this.fieldsKey(),hasFields=fieldKey!=='';
        if(fieldKey!==this.fieldKey){this.fieldKey=fieldKey;this.dirty=true;}
        this.gpuParticles?.render(this.particles);
        // Fast content (moving particles/beams/bursts/projectiles) redraws every
        // frame. Zones and tank fields alone redraw on change, and their slow
        // animation is throttled to ~15fps (static under reduced motion).
        const fast=(!this.gpuParticles&&this.particles.length)||this.beams.length||this.bursts.length||this.projectiles.size;
        const slow=this.zones.size||hasFields,active=fast||slow;
        if(!active&&!this.hadVisuals){this.drawMs=this.drawMs*.9+(performance.now()-started)*.1;return;}
        if(!fast&&slow&&!this.dirty&&this.hadVisuals!=='fast'&&(this.reducedMotion||this.time-this.lastSlowDraw<1/15)){this.drawMs=this.drawMs*.9+(performance.now()-started)*.1;return;}
        this.hadVisuals=fast?'fast':slow?'slow':false;this.dirty=false;this.lastSlowDraw=this.time;
        const c=this.ctx;c.clearRect(0,0,this.canvas.width,this.canvas.height);
        this.zones.forEach(z=>this.drawZone(c,z));
        if(!this.gpuParticles)for(const p of this.particles)if(['smoke','dust','vapor'].includes(p.kind)&&p.age>=0)this.drawParticle(c,p);
        for(const b of this.bursts)this.drawBurst(c,b);
        this.projectiles.forEach(p=>this.drawProjectile(c,p));
        if(!this.gpuParticles)for(const p of this.particles)if(!['smoke','dust','vapor'].includes(p.kind)&&p.age>=0)this.drawParticle(c,p);
        for(const b of this.beams)this.drawBeam(c,b);
        this.drawTankFields(c);
        c.globalAlpha=1;c.globalCompositeOperation='source-over';this.texture.refresh();this.canvasUploads++;this.drawMs=this.drawMs*.9+(performance.now()-started)*.1;
    }
    fieldsKey(){
        let key='';for(const tank of [this.scene.tank1,this.scene.tank2]){const s=tank?.tactics;if(s&&(s.shield>0||s.frost))key+=`${Math.round(tank.x)},${Math.round(tank.y)},${s.shield|0},${s.frost?1:0};`;}return key;
    }
    emitStoryParticles(story) {
        const {recipe,r,x,y,color}=story;
        if(story.profile?.art||recipe.probe)return;
        while(story.nextPulse<recipe.pulses.length&&story.age>=recipe.pulses[story.nextPulse]){
            const phase=recipe.pulses[story.nextPulse++],count=this.reducedMotion?2:recipe.construction?7:5;
            for(let i=0;i<count;i++){
                const sample=materialSample(recipe,phase,i,count),material=recipe.material;
                const kind=recipe.construction||material==='earth'?'dust':material==='fire'||material==='volatile'?'smoke':material==='foam'?'foamburst':'vapor';
                this.particle(kind,x+sample.x*r,y+sample.y*r,{vx:sample.vx,vy:sample.vy,life:kind==='foamburst'?.65:.9,size:kind==='dust'?r*.18:r*.25,growth:r*.3,alpha:kind==='smoke'?.48:.35,color:material==='earth'?'#ad9a78':color,rotation:0,spin:random(-.35,.35)});
            }
        }
    }
    drawIdentityProjectile(c,p) {this.drawProjectile(c,p);}
    drawParticle(c,p) {
        if(p.art){this.drawOwnedParticle(c,p);return;}
        const t=p.age/p.life,fade=isMaterialBurst(p.kind)?Math.pow(1-t,.35):Math.sin(Math.min(1,t*5)*Math.PI/2)*Math.pow(1-t,p.kind==='smoke'?.55:1.2),size=p.size+p.growth*t;
        c.save();c.translate(p.x,p.y);c.rotate(p.rotation);c.globalAlpha=p.alpha*fade;
        if(['smoke','dust','vapor'].includes(p.kind)){drawParticleFrame(c,this.atlas,animatedParticleFrame(p),-size,-size,size*2,size*2,p.kind==='smoke'?null:p.color);}
        else if(p.kind==='flame'){drawParticleFrame(c,this.atlas,animatedParticleFrame(p),-size*.75,-size*1.76,size*1.5,size*2);}
        else if(isMaterialBurst(p.kind)){drawParticleFrame(c,this.atlas,animatedParticleFrame(p),-size,-size*1.7,size*2,size*2);}
        else if(p.kind==='light'||p.kind==='energy'){c.globalCompositeOperation='lighter';const r=p.kind==='energy'?size*4:size;c.drawImage(sprite('light',p.color),-r,-r,r*2,r*2);if(p.kind==='energy'){c.strokeStyle='#f1fcff';c.lineWidth=.8;c.beginPath();c.moveTo(-size,0);c.lineTo(size,0);c.stroke();}}
        else if(p.kind==='spark'){c.globalCompositeOperation='lighter';c.rotate(Math.atan2(p.vy,p.vx)-p.rotation);c.strokeStyle=p.color;c.lineWidth=p.size;c.beginPath();c.moveTo(-Math.min(18,Math.hypot(p.vx,p.vy)*.04),0);c.lineTo(1,0);c.stroke();}
        else if(p.kind==='debris'){c.fillStyle=p.color;c.beginPath();c.moveTo(-size,-size*.4);c.lineTo(-size*.3,-size);c.lineTo(size*.75,-size*.6);c.lineTo(size,size*.4);c.lineTo(0,size*.7);c.closePath();c.fill();c.strokeStyle='rgba(229,211,165,.5)';c.lineWidth=.6;c.stroke();}
        else if(p.kind==='ice'){
            c.fillStyle='#477b96';c.beginPath();c.moveTo(0,-size*1.7);c.lineTo(size*.45,0);c.lineTo(0,size);c.lineTo(-size*.5,0);c.closePath();c.fill();
            c.fillStyle='#9ccad9';c.beginPath();c.moveTo(0,-size*1.7);c.lineTo(0,size);c.lineTo(-size*.5,0);c.closePath();c.fill();
            c.fillStyle='#dfedf0';c.beginPath();c.moveTo(0,-size*1.7);c.lineTo(size*.15,0);c.lineTo(-size*.3,size*.2);c.closePath();c.fill();
        }
        else if(p.kind==='drop'){c.fillStyle=p.color;c.beginPath();c.moveTo(0,-size*1.8);c.bezierCurveTo(size,-size*.1,size,size,-size*.1,size);c.bezierCurveTo(-size,size,-size,0,0,-size*1.8);c.fill();}
        c.restore();
    }
    drawRing(c,b,t){
        const r=b.r*(.35+t*.65),alpha=Math.max(0,1-t)*.55;if(alpha<=0)return;
        c.save();c.globalCompositeOperation='lighter';c.globalAlpha=alpha;c.strokeStyle=b.accent;c.lineWidth=b.ringWidth;
        if(b.ring==='dashed')c.setLineDash?.([6,5]);
        if(b.ring==='spokes'){for(let i=0;i<8;i++){const a=b.seed+i/8*TAU;c.beginPath();c.moveTo(Math.cos(a)*r*.55,Math.sin(a)*r*.4);c.lineTo(Math.cos(a)*r,Math.sin(a)*r*.7);c.stroke();}}
        else{c.beginPath();c.ellipse(0,0,r,r*(b.ring==='rim'?.28:.7),0,b.ring==='rim'?Math.PI:0,TAU);c.stroke();
            if(b.ring==='double'){c.beginPath();c.ellipse(0,0,r*.7,r*.49,0,0,TAU);c.stroke();}
            if(b.ring==='shockwave'){c.lineWidth=b.ringWidth*3;c.globalAlpha=alpha*.25;c.beginPath();c.ellipse(0,0,r*1.08,r*.76,0,0,TAU);c.stroke();}}
        c.restore();
    }
    drawBurst(c,b) {
        const t=b.age/b.life,r=b.r;
        c.save();c.translate(b.x,b.y);
        if(b.accent&&b.ring&&!this.reducedMotion)this.drawRing(c,b,t);
        if(b.identity){c.restore();return;}
        if(b.style==='field'){c.globalAlpha=(1-t)*.7;this.hexField(c,0,-12,r*(.65+t*.3),'#9ef5d7',t*3);}
        else if(b.style==='warp'||b.style==='magnet'||b.style==='leech'){
            c.globalCompositeOperation='lighter';c.globalAlpha=(1-t)*.32;
            const size=r*(.5+t*.4);c.drawImage(sprite('light',b.color),-size,-size,size*2,size*2);
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
        const profile=p.profile||p.fallback||profileFor(p.options);
        if(profile.art&&this.owned){const art=this.owned.get(profile.art);if(art){this.drawOwnedBody(c,p,art);return;}}
        drawMaterialProjectile(c,p,profile.recipe||materialRecipe(profile),sprite);
    }
    drawZone(c,z) {
        if(z.art){const name=`residue-${Math.floor(z.age*3)%3}`;c.save();c.globalAlpha=.85;drawOwnedFrame(c,z.art,name,z.x-z.radius*1.3,z.y-z.radius*.9,z.radius*2.6,z.radius*1.06);c.restore();return;}
        c.save();c.translate(z.x,z.y);
        if(z.kind==='mine') {c.fillStyle='#22353a';c.strokeStyle='#b3a17c';c.lineWidth=1;c.beginPath();c.moveTo(-7,2);c.lineTo(-4,-5);c.lineTo(4,-5);c.lineTo(7,2);c.closePath();c.fill();c.stroke();c.fillStyle=Math.sin(z.age*5)>0?'#ffcd71':'#745340';c.fillRect(-1.5,-5,3,2);}
        else {
            const acid=z.kind==='acid',fire=z.kind==='fire';c.globalAlpha=fire?.23:.7;c.fillStyle=acid?'#46692a':fire?'#a85124':'#1d2431';c.beginPath();
            for(let i=0;i<=32;i++){const a=i/32*TAU,rr=z.radius*(.9+.07*Math.sin(a*7+z.seed));const x=Math.cos(a)*rr,y=Math.sin(a)*(acid?7:5)+Math.sin(a*5+z.age)*1.3;if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.closePath();c.fill();
            c.globalAlpha=.45;c.strokeStyle=acid?'#b2e477':fire?'#e9a04a':'#8c82b2';c.lineWidth=1;c.beginPath();c.moveTo(-z.radius*.7,0);c.bezierCurveTo(-z.radius*.3,-4,z.radius*.4,5,z.radius*.8,-1);c.stroke();
            if(acid){c.globalAlpha=.6;for(let i=0;i<5;i++){const phase=(z.age*.8+i*.21)%1,x=Math.sin(i*7+z.seed)*z.radius*.8;c.strokeStyle='#c9f18a';c.beginPath();c.ellipse(x,-phase*4,2+phase*2,1+phase,0,Math.PI,TAU);c.stroke();}}
        }
        c.restore();
    }
    hexField(c,x,y,r,color,phase=0) {
        c.save();c.translate(x,y);c.globalCompositeOperation='lighter';
        const field=c.createRadialGradient(0,-r*.22,r*.2,0,-r*.15,r);
        field.addColorStop(0,'rgba(100,225,216,.015)');field.addColorStop(.8,'rgba(132,244,227,.035)');
        field.addColorStop(.94,'rgba(172,255,238,.2)');field.addColorStop(1,'rgba(120,235,226,0)');
        c.fillStyle=field;c.beginPath();c.ellipse(0,-r*.12,r,r*.8,0,0,TAU);c.fill();
        c.globalAlpha*=.18;c.drawImage(sprite('light',color),-r,-r*.9,r*2,r*1.6);c.restore();
    }
    drawTankFields(c) {
        for(const tank of [this.scene.tank1,this.scene.tank2]){if(!tank?.tactics)continue;const s=tank.tactics;c.save();
            if(s.shield>0){c.globalAlpha=.2+Math.min(s.shield/150,.5);this.hexField(c,tank.x,tank.y-3,25,'#8ff4da',Math.sin(this.time*2));}
            if(s.frost){for(let i=0;i<5;i++){const x=tank.x-14+i*7,y=tank.y-3;c.fillStyle=i%2?'#71afc8':'#c9f0fa';c.beginPath();c.moveTo(x-3,y);c.lineTo(x,y-10-i%2*6);c.lineTo(x+3,y);c.closePath();c.fill();}}
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
const ownedOptions=(scene,options)=>{const fx=getWeaponFX(scene);if(!fx)return options;if(weaponArt(options)){fx.lastWeaponOptions=options;return options;}const active=(scene.activeTank===2?scene.tank2:scene.tank1)?.turret?.activeWeapon;const inferred=active?{weaponId:active.id,weaponName:active.weaponHandler?.name}:fx.lastWeaponOptions;return {...inferred,...Object.fromEntries(Object.entries(options).filter(([,value])=>value!==undefined))};};
// Audio is hooked centrally here so weapon logic needs no sound calls:
// muzzle/primary projectile -> launch, impact -> impact, beam, build.
// options.audio: false silences, 'layer' plays a quiet signature under a
// legacy wav (Blast.js).
const sound=(scene,kind,options,extra)=>{if(options.audio===false)return;playWeaponSound(scene,options.audio==='layer'&&kind==='impact'?'layer':kind,options,extra);};
export const emitWeaponImpact=(scene,x,y,r,options={})=>{
    const resolved=ownedOptions(scene,options);sound(scene,'impact',resolved,{radius:Number.isFinite(resolved.damageRadius)?resolved.damageRadius:r,x});
    return getWeaponFX(scene)?.impact(x,y,r,resolved)||false;
};
export const emitWeaponBeam=(scene,x1,y1,x2,y2,options={})=>{const resolved=ownedOptions(scene,options);sound(scene,'beam',resolved,{x:x2});return getWeaponFX(scene)?.beam(x1,y1,x2,y2,resolved)||false;};
export const emitWeaponMuzzle=(scene,x,y,angle,options={})=>{const resolved=ownedOptions(scene,options);sound(scene,'launch',resolved,{x});return getWeaponFX(scene)?.muzzle(x,y,angle,resolved);};
export const createWeaponProjectile=(scene,x,y,options={})=>{
    const fx=getWeaponFX(scene),resolved=fx?ownedOptions(scene,options):options;
    // Only the primary projectile of a shot launches audibly; split children,
    // fuses and weapons that already fired a muzzle cue stay silent.
    if(!resolved.small&&!resolved.phase&&!resolved.fuse&&!weaponAudio(scene)?.recentlyLaunched(Number(resolved.weaponId)))sound(scene,'launch',resolved,{x});
    if(fx)return fx.projectile(x,y,resolved);
    return scene.add.circle(x,y,options.small?2:3,options.color||0xffd18b).setDepth(4);
};
export const createWeaponZone=(scene,options)=>getWeaponFX(scene)?.zone(ownedOptions(scene,options))||null;
export const emitTerrainBuild=(scene,x,y,kind,options={})=>{const resolved=ownedOptions(scene,options);sound(scene,'build',resolved,{radius:resolved.radius||40,x});return getWeaponFX(scene)?.build(x,y,kind,resolved);};
// Called by the main scene at turn handoff and after checkpoint imports.
export const resetTransientWeaponFX=scene=>{if(scene?.weaponFX&&!scene.weaponFX.disposed)scene.weaponFX.resetTransient();};
