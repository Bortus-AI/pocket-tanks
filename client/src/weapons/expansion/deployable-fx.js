import { weaponArt } from '../../graphics/weapon-art';
import { drawOwnedFrame } from '../../graphics/weapon-art/frames';
// Presentation-only device renderer. All firing/terrain results are computed at
// accepted shot boundaries; these animations never modify combat state.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angleTo=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
export const RUN_ANIMATION_MS=650;
export const DEVICE_EFFECT_LIFETIMES={missile:1050,run:950,deploy:700,burst:430,wreck:650,vent:600,lock:400};
export const deviceShotDelay=(effect,shot,index)=>{
    if(effect?.kind==='run'){
        const distance=effect.to.x-effect.from.x;
        if(Math.abs(distance)>.001)return clamp((shot.from.x-effect.from.x)/distance,0,1)*RUN_ANIMATION_MS;
    }
    return index*85;
};
const stroke=(c,color,width,points)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();};
const polygon=(c,points,fill,outline='#18262b')=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=outline;c.lineWidth=1;c.stroke();};
class DevicePresentation {
    constructor(scene){
        this.scene=scene;this.time=0;this.effects=[];this.births=new Map();this.disposed=false;
        this.canvas=document.createElement('canvas');this.canvas.width=scene.renderer.width;this.canvas.height=scene.terrain?.height||Math.floor(scene.renderer.height*2/3);
        this.ctx=this.canvas.getContext('2d');this.key=`device-fx-${scene.sys.settings.key}`;
        if(scene.textures.exists(this.key))scene.textures.remove(this.key);
        this.texture=scene.textures.addCanvas(this.key,this.canvas);this.image=scene.add.image(this.canvas.width/2,this.canvas.height/2,this.key).setDepth(6);
        this.onUpdate=(_,delta)=>this.update(delta);this.onShutdown=()=>this.dispose();scene.events.on('update',this.onUpdate);scene.events.once('shutdown',this.onShutdown);
    }
    sound(kind){
        const context=this.scene.sound?.context;if(!context||this.scene.sound.mute||context.state!=='running')return;
        try{
            const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();osc.connect(gain);gain.connect(context.destination);
            const preset={deploy:[150,420,.16],burst:[170,45,.07],lock:[680,920,.12],missile:[90,280,.3],run:[210,390,.14],vent:[440,100,.16],wreck:[95,25,.2]}[kind]||[200,100,.1];
            osc.type=kind==='lock'?'sine':'sawtooth';osc.frequency.setValueAtTime(preset[0],now);osc.frequency.exponentialRampToValueAtTime(preset[1],now+preset[2]);
            gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='burst'?.035:.018,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+preset[2]);osc.start(now);osc.stop(now+preset[2]+.02);
        }catch{}
    }
    add(kind,device,data={}){if(this.effects.length>=48)this.effects.shift();const weaponId=device.weaponId??{sentry:731,silo:692,runner:566}[device.kind];const art=this.scene.weaponFX?.owned.get(weaponArt({weaponId}));this.effects.push({kind,id:device.id,weaponId,art,x:device.x,y:device.y,start:this.time,...data});this.sound(kind);}
    deploy(device){this.births.set(device.id,this.time);this.add('deploy',device);}
    burst(device,shots){this.add('burst',device,{shots});}
    lock(device){this.add('lock',device);}
    missile(device,path){this.add('missile',device,{path});}
    run(device,from,to,shots){this.add('run',device,{from,to,shots});}
    vent(device){this.add('vent',device);}
    wreck(device){this.add('wreck',device);}
    restore(){this.effects=[];this.births.clear();}
    update(delta=16){
        if(this.disposed)return;this.time+=Math.min(60,Math.max(0,delta||16));const c=this.ctx;
        const devices=this.scene.tacticalWorld?.devices||[];
        if(!devices.length&&!this.effects.length){if(this.drew){c.clearRect(0,0,this.canvas.width,this.canvas.height);this.texture.refresh();this.drew=false;}return;}
        this.drew=true;c.clearRect(0,0,this.canvas.width,this.canvas.height);
        for(const device of devices)this.drawDevice(c,device);
        this.effects=this.effects.filter(effect=>this.time-effect.start<(DEVICE_EFFECT_LIFETIMES[effect.kind]||500));
        for(const effect of this.effects)this.drawEffect(c,effect);
        this.texture.refresh();
    }
    drawDevice(c,d){
        const birth=this.births.has(d.id)?clamp((this.time-this.births.get(d.id))/450,0,1):1;
        const foe=d.owner===this.scene.tank1?this.scene.tank2:this.scene.tank1;
        const target=foe?.centre||foe||{x:d.x+d.heading*100,y:d.y-14};
        c.save();c.translate(d.x,d.y);c.globalAlpha=d.buried?.35:1;
        // Light and dark metal surfaces remain legible against earth.
        if(d.kind==='sentry'){
            for(const sign of [-1,1]){stroke(c,'#17252a',4,[{x:0,y:-7*birth},{x:sign*11*birth,y:0}]);stroke(c,'#a1b4a4',1,[{x:0,y:-8*birth},{x:sign*11*birth,y:-1}]);c.fillStyle='#435d59';c.fillRect(sign*11*birth-3,-2,6,3);}
            polygon(c,[[-5,-13],[4,-14],[7,-8],[-6,-7]],'#718e7d');
            c.save();c.translate(0,-14*birth);let angle=angleTo({x:d.x,y:d.y-14},target);if(Math.cos(angle)*d.heading<0)angle=d.heading>0?0:Math.PI;c.rotate(angle);
            const firing=this.effects.find(e=>e.id===d.id&&e.kind==='burst'&&this.time-e.start<180);const recoil=firing?2:0;
            polygon(c,[[-5,-5],[5,-5],[8,-2],[5,4],[-5,4]],d.heat>=4?'#c28a58':'#a3b6a2');c.fillStyle='#263a3d';c.fillRect(4-recoil,-3,14,5);c.fillStyle='#98aaa0';c.fillRect(8-recoil,-3,9,1);c.fillStyle=d.heat>=4?'#ed8150':'#e3d4a1';c.fillRect(17-recoil,-3,3,5);c.restore();
            c.fillStyle=d.buried?'#a6a38a':'#76f0c1';c.fillRect(-3,-12,2,2);
            for(let i=0;i<Math.ceil(d.ammo/2);i++){c.fillStyle='#e2c787';c.fillRect(7+i*3,-7,2,4);}
        }else if(d.kind==='silo'){
            polygon(c,[[-17,0],[-13,-5],[13,-5],[17,0]],'#647b74');
            polygon(c,[[-11,-5],[-11,-23*birth],[8,-26*birth],[12,-20*birth],[12,-5]],'#a1aa8b');
            c.fillStyle='#283b40';c.fillRect(-7,-21*birth,14,14*birth);c.fillStyle=d.lock?'#ff8c5f':'#74d7be';c.fillRect(-5,-19*birth,4,3);
            for(let i=0;i<d.ammo;i++){c.fillStyle='#ddc58c';c.fillRect(4,-19*birth+i*6,3,4);}
            const launch=this.effects.find(e=>e.id===d.id&&e.kind==='missile'&&this.time-e.start<400),open=launch?9:d.lock?4:0;
            stroke(c,'#e2d5a4',3,[{x:-11-open,y:-25*birth},{x:0-open,y:-26*birth}]);stroke(c,'#e2d5a4',3,[{x:1+open,y:-26*birth},{x:12+open,y:-24*birth}]);
            c.fillStyle='#e8c66b';c.fillRect(-10,-7,4,2);c.fillRect(1,-7,4,2);
        }else{
            const run=this.effects.find(e=>e.id===d.id&&e.kind==='run');if(run){const t=clamp((this.time-run.start)/RUN_ANIMATION_MS,0,1);c.translate((run.from.x+(run.to.x-run.from.x)*t)-d.x,(run.from.y+(run.to.y-run.from.y)*t)-d.y);}
            c.translate(0,-23-Math.sin(this.time/180)*1.2);c.scale(d.heading,1);
            polygon(c,[[-17,-3],[-9,-8],[10,-6],[17,-1],[8,5],[-10,5]],'#7b9da0');
            c.fillStyle='#213a41';c.fillRect(-13,-4,7,8);c.fillRect(5,-4,7,8);
            const spin=this.time/35;for(const x of [-9,9]){c.save();c.translate(x,0);c.rotate(spin);c.fillStyle='#bfd0c0';c.fillRect(-4,-.7,8,1.4);c.fillRect(-.7,-4,1.4,8);c.restore();}
            c.fillStyle='#e4bf7b';c.fillRect(12,0,12,3);c.fillStyle=d.heat?'#ffa868':'#75edca';c.fillRect(-2,-7,4,3);
            c.fillStyle='#6ce4eb88';c.beginPath();c.moveTo(-14,5);c.lineTo(-10,11+Math.sin(this.time/45)*2);c.lineTo(-6,5);c.fill();
        }
        c.restore();
        if(d.lock){const t=this.time/240,x=d.lock.x,y=d.lock.y;c.save();c.strokeStyle='#ff9b6c';c.lineWidth=1.5;c.globalAlpha=.65+.3*Math.sin(t);for(const [sx,sy]of [[-1,-1],[-1,1],[1,-1],[1,1]])stroke(c,'#ff9b6c',1.5,[{x:x+sx*15,y:y+sy*8},{x:x+sx*15,y:y+sy*15},{x:x+sx*8,y:y+sy*15}]);stroke(c,'#ffdfb0',1,[{x:x-5,y},{x:x+5,y}]);c.fillStyle='#ffcf99';c.font='9px Arial';c.textAlign='center';c.fillText('LOCKED',x,y-20);c.restore();}
    }
    drawShots(c,shots,age,effect){
        shots.forEach((shot,index)=>{const a=age-deviceShotDelay(effect,shot,index);if(a<0||a>220)return;const f=clamp(a/110,0,1),start=Math.max(0,f-.23),dx=shot.to.x-shot.from.x,dy=shot.to.y-shot.from.y;
            stroke(c,'#fff4c4',2,[{x:shot.from.x+dx*start,y:shot.from.y+dy*start},{x:shot.from.x+dx*f,y:shot.from.y+dy*f}]);
            if(a<55){c.save();c.translate(shot.from.x,shot.from.y);c.rotate(angleTo(shot.from,shot.to));polygon(c,[[0,-2],[12,-5],[8,0],[13,4],[0,2]],'#ffdb8e','#ffecc4');c.restore();}
            const seconds=a/1000;c.save();c.translate(shot.from.x-12*seconds,shot.from.y-25*seconds+170*seconds*seconds);c.rotate(seconds*18);c.fillStyle='#d8b36f';c.fillRect(-1,-1,4,2);c.restore();
            if(shot.hit&&a>110){const alpha=1-(a-110)/110;c.globalAlpha=alpha;stroke(c,'#fff3b8',1,[{x:shot.to.x-4,y:shot.to.y-3},{x:shot.to.x+4,y:shot.to.y+3}]);c.globalAlpha=1;}
        });
    }
    drawEffect(c,e){
        if(e.art){this.drawOwnedEffect(c,e);return;}
        const age=this.time-e.start;c.save();
        if(e.kind==='burst')this.drawShots(c,e.shots,age);
        if(e.kind==='run'){c.globalAlpha=clamp(1-age/750,0,1)*.6;for(let i=0;i<4;i++)stroke(c,'#67dce3',1,[{x:e.from.x-i*5,y:e.from.y-21+i*3},{x:e.to.x-i*5,y:e.to.y-21+i*3}]);c.globalAlpha=1;this.drawShots(c,e.shots,age,e);}
        if(e.kind==='missile'){
            const f=clamp(age/760,0,1),index=Math.min(e.path.length-1,Math.floor(f*(e.path.length-1))),p=e.path[index],previous=e.path[Math.max(0,index-1)];
            if(f<1){stroke(c,'#e2e3d288',4,e.path.slice(Math.max(0,index-14),index+1));c.translate(p.x,p.y);c.rotate(angleTo(previous,p));polygon(c,[[-9,-3],[6,-3],[12,0],[6,3],[-9,3]],'#dad6b4');polygon(c,[[-8,-2],[-17,-4],[-12,0],[-19,4],[-8,2]],'#ffaf51','#ffe3a4');}
            else{const end=e.path[e.path.length-1],r=(age-760)/12+6;c.translate(end.x,end.y);c.globalAlpha=clamp(1-(age-760)/290,0,1);const points=Array.from({length:16},(_,i)=>{const a=i/16*Math.PI*2,rr=r*(i%2?.5:1);return [Math.cos(a)*rr,Math.sin(a)*rr];});polygon(c,points,'#ffd593','#f58a50');}
        }
        if(['deploy','wreck','vent'].includes(e.kind)){
            const t=age/1000;c.globalAlpha=clamp(1-age/650,0,1);
            for(let i=0;i<8;i++){const dx=(i-3.5)*(e.kind==='wreck'?19:9)*t,dy=e.kind==='vent'?-20*t: -32*t+60*t*t;c.fillStyle=e.kind==='vent'?'#c9d9d1':e.kind==='wreck'?'#bd9270':'#b4ab89';c.fillRect(e.x+dx,e.y-8+dy-(i%3)*3,2+i%2,2+i%3);}
        }
        c.restore();
    }
    drawOwnedTexture(c,art,channel,progress,x,y,size,angle=0){
        const counts={impact:12,body:2,trail:3,residue:3,muzzle:2,beam:2,debris:1},index=Math.min(counts[channel]-1,Math.floor(clamp(progress,0,1)*counts[channel]));
        const name=`${channel}-${index}`;c.save();c.translate(x,y);c.rotate(angle);
        const origin=['impact','residue'].includes(channel)?.85:.5;drawOwnedFrame(c,art,name,-size/2,-size*origin,size,size);c.restore();
    }
    drawOwnedEffect(c,e){
        const age=this.time-e.start,art=e.art;c.save();
        if(e.kind==='burst'||e.kind==='run'){
            if(e.kind==='run')for(let i=0;i<5;i++){const t=i/5;c.globalAlpha=.35*(1-age/950);this.drawOwnedTexture(c,art,'trail',age/950,e.from.x+(e.to.x-e.from.x)*t,e.from.y-18,35);}
            c.globalAlpha=1;
            e.shots.forEach((shot,index)=>{
                const a=age-deviceShotDelay(e,shot,index);if(a<0||a>220)return;
                const f=clamp(a/110,0,1),dx=shot.to.x-shot.from.x,dy=shot.to.y-shot.from.y,angle=Math.atan2(dy,dx);
                if(a<110)this.drawOwnedTexture(c,art,'body',f,shot.from.x+dx*f,shot.from.y+dy*f,28,angle);
                if(a<55)this.drawOwnedTexture(c,art,'muzzle',a/55,shot.from.x,shot.from.y,34,angle);
                if(shot.hit&&a>110)this.drawOwnedTexture(c,art,'impact',(a-110)/110,shot.to.x,shot.to.y,55);
            });
        }else if(e.kind==='missile'){
            const f=clamp(age/760,0,1),index=Math.min(e.path.length-1,Math.floor(f*(e.path.length-1))),p=e.path[index],previous=e.path[Math.max(0,index-1)];
            if(f<1){
                for(let i=Math.max(0,index-12);i<index;i+=3){c.globalAlpha=(i-index+15)/15*.7;this.drawOwnedTexture(c,art,'trail',(index-i)/15,e.path[i].x,e.path[i].y,31);}
                c.globalAlpha=1;this.drawOwnedTexture(c,art,'body',f,p.x,p.y,48,angleTo(previous,p));
            }else this.drawOwnedTexture(c,art,'impact',(age-760)/290,p.x,p.y,125);
        }else if(['deploy','wreck','vent'].includes(e.kind)){
            c.globalAlpha=clamp(1-age/650,0,1);this.drawOwnedTexture(c,art,e.kind==='wreck'?'impact':'residue',age/650,e.x,e.y,e.kind==='wreck'?80:55);
        }
        c.restore();
    }
    dispose(){if(this.disposed)return;this.disposed=true;this.scene.events.off('update',this.onUpdate);this.scene.events.off('shutdown',this.onShutdown);this.image.destroy();if(this.scene.textures.exists(this.key))this.scene.textures.remove(this.key);this.effects=[];}
}
export const devicePresentation=scene=>{
    if(scene.deployableFX&&!scene.deployableFX.disposed)return scene.deployableFX;
    if(!scene.sys?.game||!scene.renderer||!scene.textures?.addCanvas||!scene.events?.on||!scene.add?.image)return null;
    scene.deployableFX=new DevicePresentation(scene);return scene.deployableFX;
};
