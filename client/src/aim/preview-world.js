import Phaser from 'phaser';
import { Weapon } from '../classes/Weapon';
import { beginTacticalShot } from '../weapons/expansion/tactics';

const noop=()=>{};
const visual=(x=0,y=0)=>{
    let proxy;
    const object={x,y,active:true,destroy(){this.active=false;},setPosition(x,y){this.x=x;this.y=y;return proxy;}};
    proxy=new Proxy(object,{get(o,k){return k in o?o[k]:()=>proxy;}});
    return proxy;
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Private Canvas rasterization preserves the runtime's dirt/rubber semantics.
// Read only changed rectangles back; a drilling shot can edit hundreds of times.
export function copyTerrain(source) {
    const {width,height}=source,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const base=source.context.getImageData(0,0,width,height),cached=new Uint8ClampedArray(source.data||base.data),pixels=new Uint8ClampedArray(cached);
    const stale=cached.some((v,i)=>v!==base.data[i]);let synchronized=!stale;
    const state=Object.fromEntries(['globalCompositeOperation','globalAlpha','lineWidth','lineCap','lineJoin','fillStyle','strokeStyle'].map(key=>[key,source.context[key]]));
    ctx.putImageData(base,0,0);Object.assign(ctx,state);
    let path=null,dirty=null,touched=null;
    const union=(a,b)=>!a?b:[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];
    const bounds=(x,y,w=0,h=0)=>[Math.min(x,x+w),Math.min(y,y+h),Math.max(x,x+w),Math.max(y,y+h)];
    const mark=b=>{if(!b)return;const pad=ctx.lineWidth+2;dirty=union(dirty,[clamp(Math.floor(b[0]-pad),0,width),clamp(Math.floor(b[1]-pad),0,height),clamp(Math.ceil(b[2]+pad),0,width),clamp(Math.ceil(b[3]+pad),0,height)]);};
    const context=new Proxy(ctx,{set(o,k,v){o[k]=v;return true;},get(o,k){
        if(typeof o[k]!=='function')return o[k];
        return (...args)=>{
            if(k==='beginPath')path=null;
            if(k==='moveTo'||k==='lineTo')path=union(path,bounds(args[0],args[1]));
            if(k==='rect')path=union(path,bounds(...args));
            if(k==='arc')path=union(path,bounds(args[0]-args[2],args[1]-args[2],args[2]*2,args[2]*2));
            if(k==='ellipse')path=union(path,bounds(args[0]-args[2],args[1]-args[3],args[2]*2,args[3]*2));
            if(k==='fill'||k==='stroke')mark(path);
            if(k==='fillRect'||k==='clearRect'||k==='strokeRect')mark(bounds(...args));
            if(k==='putImageData')mark(bounds(args[1],args[2],args[0].width,args[0].height));
            if(k==='quadraticCurveTo'||k==='bezierCurveTo')for(let i=0;i<args.length;i+=2)path=union(path,bounds(args[i],args[i+1]));
            if(['translate','rotate','scale','transform','setTransform','resetTransform'].includes(k))mark([0,0,width,height]);
            return o[k](...args);
        };
    }});
    const copyRows=(data,x,y,w,h)=>{for(let row=0;row<h;row++)pixels.set(data.subarray(row*w*4,(row+1)*w*4),((y+row)*width+x)*4);};
    const terrain={width,height,canvas,context,getContext:()=>context,refresh:noop,fixTerrain:noop,
        getPixel(x,y){x=Math.abs(Math.round(x));y=Math.abs(Math.round(y));if(!Number.isFinite(x)||!Number.isFinite(y)||x>=width||y>=height)return {alpha:255,r:0,g:0,b:0,red:0,green:0,blue:0};const i=(y*width+x)*4;return {alpha:pixels[i+3],r:pixels[i],g:pixels[i+1],b:pixels[i+2],red:pixels[i],green:pixels[i+1],blue:pixels[i+2]};},
        update(){if(!dirty)return;const [x,y,x2,y2]=dirty,w=x2-x,h=y2-y;if(!synchronized){pixels.set(ctx.getImageData(0,0,width,height).data);synchronized=true;}else if(w&&h)copyRows(ctx.getImageData(x,y,w,h).data,x,y,w,h);touched=union(touched,dirty);dirty=null;},
        reset(){if(touched){const [x,y,x2,y2]=touched;ctx.putImageData(base,0,0,x,y,x2-x,y2-y);for(let row=y;row<y2;row++){const start=(row*width+x)*4,end=(row*width+x2)*4;pixels.set(base.data.subarray(start,end),start);}}if(stale)pixels.set(cached);synchronized=!stale;Object.assign(ctx,state);dirty=null;touched=null;path=null;},
        getSurfaceUp(x,y){for(let i=0;i<60;i++)if(!this.getPixel(x,y-i-1).alpha)return {x,y:y-i};return null;},
    };
    for(const [method,direction] of [['getLeftGround',-1],['getRightGround',1]])terrain[method]=(x,y)=>{
        if(direction===1?x>=width:x<=0)return null;
        const pos=[[0,1],[direction,1],[direction,0],[direction,-1],[0,-1],[-direction,1],[-direction,0],[-direction,-1]];
        const checks=[[direction,1],[direction,0],[direction,-1],[0,-1],[-direction,-1],[0,1],[-direction,1],[-direction,0]];
        let found=null;pos.forEach(([dx,dy],i)=>{if(terrain.getPixel(x+dx,y+dy).alpha&&!terrain.getPixel(x+checks[i][0],y+checks[i][1]).alpha)found={x:x+dx,y:y+dy};});return found;
    };
    terrain.getSlope=(x,y,count=5)=>{
        let left=terrain.getLeftGround(x,y)||{x,y},right=terrain.getRightGround(x,y)||{x,y};
        for(let i=0;i<Math.floor(count/2);i++)left=terrain.getLeftGround(left.x,left.y)||left;
        for(let i=Math.ceil(count/2);i<count;i++)right=terrain.getRightGround(right.x,right.y)||right;
        return right.x===left.x?undefined:Math.atan((right.y-left.y)/(right.x-left.x))+(right.x<left.x?Math.PI:0);
    };
    return terrain;
}

function copyTank(original) {
    const tank={x:original.x,y:original.y,width:original.width,height:original.height,hitRadius:original.hitRadius,rotation:original.rotation,power:original.power,movesRemaining:original.movesRemaining,centre:{...original.centre},top:{...original.top},tactics:{shield:0,frost:0,frostMoves:0,acid:0,marked:0,...original.tactics},score:0};
    tank.updateScore=n=>{tank.score+=n;};
    tank.setPower=p=>{tank.power=clamp(Math.floor(p),1,100);};
    tank.setPosition=(x,y)=>{const dx=x-tank.x,dy=y-tank.y;tank.x=x;tank.y=y;tank.centre.x+=dx;tank.centre.y+=dy;tank.top.x+=dx;tank.top.y+=dy;return tank;};
    tank.setY=y=>tank.setPosition(tank.x,y);
    tank.body={x:original.body.x,y:original.body.y,velocity:new Phaser.Math.Vector2(),gravity:new Phaser.Math.Vector2(),setVelocity(x,y){this.velocity.set(x,y);return this;},setGravityY(y){this.gravity.y=y;return this;},stop(){this.velocity.set(0);return this;},updateFromGameObject(){this.x=tank.x+(original.body.x-original.x);this.y=tank.y+(original.body.y-original.y);}};
    tank.turret={x:original.turret.x,y:original.turret.y,height:32,powerFactor:8,rotation:original.turret.rotation};
    tank.turret.setRelativeRotation=r=>{tank.turret.rotation=r+tank.rotation;};
    tank.isPointInside=(x,y)=>{
        const dx=Math.cos(tank.rotation)*tank.width/4,dy=Math.sin(tank.rotation)*tank.width/4;
        const points=[[tank.body.x-dx,tank.body.y-dy],[tank.top.x-dx,tank.top.y-dy],[tank.top.x+dx,tank.top.y+dy],[tank.body.x+dx,tank.body.y+dy]];
        let inside=false;for(let i=0,j=3;i<4;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;
    };
    return tank;
}

function legacyPhysics(scene) {
    const objects=[],textures=new Map();
    scene.textures={exists:key=>textures.has(key),remove:key=>textures.delete(key),addCanvas(key,canvas){const texture={key,canvas,refresh:noop};textures.set(key,texture);return texture;}};
    const sprite=(x,y,key)=>{
        const object=visual(x,y);object.scene=scene;object.rotation=0;object.scaleX=1;object.scaleY=1;object.texture=textures.get(key)||{key,canvas:document.createElement('canvas')};object.canvas=object.texture.canvas;
        const body={x,y,prev:new Phaser.Math.Vector2(),prevFrame:new Phaser.Math.Vector2(),velocity:new Phaser.Math.Vector2(),gravity:new Phaser.Math.Vector2(),width:1,height:1,
            get position(){return new Phaser.Math.Vector2(this.x,this.y);},get speed(){return this.velocity.length();},get center(){return {x:this.x+.5,y:this.y+.5};},
            setSize(w,h){this.width=w;this.height=h;return this;},setGravityY(g){this.gravity.y=g;return this;},setVelocity(x,y){this.velocity.set(x,y);return this;},stop(){this.velocity.set(0);return this;},
            updateFromGameObject(){this.x=object.x-.5*object.scaleX;this.y=object.y-.5*object.scaleY;},preUpdate(){this.updateFromGameObject();this.prev.set(this.x,this.y);this.prevFrame.set(this.x,this.y);}};
        object.body=body;object.setScale=(x,y=x)=>{object.scaleX=x;object.scaleY=y;return object;};object.setRotation=r=>{object.rotation=r;return object;};object.setAngle=d=>object.setRotation(d*Math.PI/180);
        object.setVelocity=(x,y)=>{body.setVelocity(x,y);return object;};object.setGravityY=g=>{body.gravity.y=g;return object;};object.setGravity=(x,y=x)=>{body.gravity.set(x,y);return object;};
        object.destroy=()=>{object.active=false;object.body=undefined;};objects.push(object);return object;
    };
    scene.physics={add:{sprite}};
    return {objects,step(){for(const o of [...objects])if(o.active&&o.body){const b=o.body;b.updateFromGameObject();b.prev.set(b.x,b.y);b.prevFrame.set(b.x,b.y);b.velocity.x+=b.gravity.x/60;b.velocity.y+=b.gravity.y/60;b.x+=b.velocity.x/60;b.y+=b.velocity.y/60;}},postStep(){for(const o of objects)if(o.active&&o.body){o.x+=o.body.x-o.body.prevFrame.x;o.y+=o.body.y-o.body.prevFrame.y;}}};
}

// All previews own their handlers, tanks, timers, terrain, and tactical state.
// They never allocate live Phaser textures or invoke real scene callbacks.
export function createPreviewWorld(live,shooter) {
    const terrain=copyTerrain(live.terrain);
    return {terrain,run(entry,rotation,power,launchOnly=false){
        terrain.reset();
        // isAimPreview: weapons whose outcome must stay hidden (Mystery Box) skip it.
        const scene={isAimPreview:true,terrain,add:new Proxy({},{get:()=>visual}),events:{once:noop,off:noop},cache:{audio:{exists:()=>false}},sound:{play:noop,get:()=>null,stopByKey:noop},tweens:{add:()=>visual()},time:{delayedCall:noop,addEvent:noop}};
        scene.tank1=copyTank(live.tank1);scene.tank2=copyTank(live.tank2);
        const tank=shooter===live.tank1?scene.tank1:scene.tank2,foe=tank===scene.tank1?scene.tank2:scene.tank1;
        tank.power=power;tank.turret.rotation=rotation;
        const world=live.tacticalWorld||{};
        const copyOwner=o=>o===live.tank1?scene.tank1:scene.tank2;
        scene.tacticalWorld={...world,shot:world.shot||0,nextZone:world.nextZone||1,zones:(world.zones||[]).map(z=>({...z,owner:copyOwner(z.owner),visual:visual()})),devices:(world.devices||[]).map(d=>({...d,owner:copyOwner(d.owner),lock:d.lock?{...d.lock}:null}))};
        beginTacticalShot(scene,tank);tank.score=0;foe.score=0;
        let distance=Infinity,deliveries=0;
        const record=(x,y)=>{if(Number.isFinite(x)&&Number.isFinite(y)){distance=Math.min(distance,foe.isPointInside(x,y)?0:Math.hypot(x-foe.centre.x,y-foe.centre.y));deliveries++;}};
        let runtime,launch;
        if(entry.createInstance){
            runtime=entry.createInstance();const weapon={id:entry.id,scene,tank,turret:tank.turret,terrain,weaponHandler:runtime};runtime.create(weapon);
            for(const key of ['burst','pointBurst','build','coat','dirtAt'])if(runtime[key]){const owner=runtime,original=owner[key];owner[key]=(...args)=>{record(args[0],args[1]);return original.apply(owner,args);};}
            // Record the final delivery, including tracers, mines and devices.
            const impact=runtime.impact;runtime.impact=p=>{
                const rules=runtime.definition.mechanicalRules||[];
                const pending=(rules.includes('contact-bank')&&!p.ruleBanked)||(rules.includes('burrow-step')&&!p.ruleBurrowed)||(rules.includes('contact-fuse')&&!p.ruleFuseReady);
                if(!pending&&(['mine','oil','acidpool','blink','swap'].includes(entry.behavior)||['tracer','autoturrets','missileturret','runngun','pillars','island'].includes(entry.classicMechanic)))record(p.x,p.y);
                return impact(p);
            };
            runtime.shoot();
            for(let tick=0;tick<961&&!runtime.done;tick++){
                if(!launch&&runtime.projectiles.length){const p=runtime.projectiles.find(p=>!p.child);if(p)launch={vx:p.vx,vy:p.vy,gravity:p.gravity??300};}
                if(launchOnly&&launch)break;
                runtime.update();
            }
            if(runtime.lastDeliveryPoint)record(runtime.lastDeliveryPoint.x,runtime.lastDeliveryPoint.y);
            runtime.dispose();
        }else{
            const physics=legacyPhysics(scene),handler=new entry.constructor();
            const weapon=new Weapon(scene,tank,entry.id,handler);runtime=handler;
            weapon.updateTail=noop;weapon.defaultDigTerrain=noop;handler.releaseParticles=noop;
            // Capture delivery before legacy timed/cosmetic aftermath. Flight,
            // homing, rubber reflections, underground motion and rolling still
            // execute the original handler's update/collision methods.
            const finish=(...args)=>{
                const object=args.find(a=>a?.body&&typeof a.destroy==='function'&&a!==tank&&a!==foe)||handler.projectile;
                if(!object?.body)return;
                record(object.body.x,object.body.y);object.destroy();
                for(const key of Object.keys(handler))if(Array.isArray(handler[key]))handler[key]=handler[key].filter(o=>o!==object);
            };
            handler.blast=finish;
            if(entry.id===15){handler.scoreTween=visual();handler.removeTweens=[];}
            if(entry.id===16)handler.dissociate=()=>finish(handler.projectile);
            // Tommy Gun's wall-clock launcher uses the same twelve offsets.
            if(entry.id===26){
                const speeds=[0,12,-3,4,-8,6,2,0,-4,-13,5,-1],angles=[0,-3,4,6,-1,0,2,5,-3.5,4.5,-1.5,2];
                handler.particles=speeds.map((v,i)=>{const o=scene.physics.add.sprite(0,0,'projectile-'+i);o.bounceCount=3;weapon.defaultShoot(o,power*8+v,300,undefined,rotation-Math.PI/2+angles[i]*Math.PI/180);return o;});
            }else handler.shoot(weapon);
            const p=physics.objects.find(p=>p.body?.speed>0);if(p)launch={vx:p.body.velocity.x,vy:p.body.velocity.y,gravity:p.body.gravity.y};
            if(!launchOnly)for(let tick=0;tick<960;tick++){
                if(!physics.objects.some(o=>o.active&&o.body)&&!(entry.id===10&&handler.dissipated&&handler.frameCount<=26))break;
                physics.step();handler.update(weapon);physics.postStep();
            }
            physics.objects.forEach(o=>{if(o.active)o.destroy();});
        }
        return {distance,deliveries,score:tank.score,launch};
    }};
}
