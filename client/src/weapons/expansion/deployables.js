import { devicePresentation } from './deployable-fx';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const center=tank=>tank.centre||tank;
const world=scene=>{
    const state=scene.tacticalWorld||(scene.tacticalWorld={shot:0,zones:[],nextZone:1});
    if(!state.devices)state.devices=[];
    if(!state.nextDevice)state.nextDevice=1;
    return state;
};
const solid=(terrain,x,y)=>Boolean(x>=0&&x<terrain.width&&y>=0&&y<terrain.height&&terrain.getPixel(Math.floor(x),Math.floor(y)).alpha);
const floorBelow=(terrain,x,y)=>{
    for(let row=clamp(Math.floor(y),0,terrain.height-1);row<terrain.height;row++)if(solid(terrain,x,row))return row;
    return terrain.height;
};
const opponent=(scene,owner)=>owner===scene.tank1?scene.tank2:scene.tank1;
const facingAngle=direction=>direction>0?0:Math.PI;
const inArc=(device,target,arc)=>{
    const p=center(target),angle=Math.atan2(p.y-(device.y-14),p.x-device.x);
    return Math.abs(Math.atan2(Math.sin(angle-facingAngle(device.heading)),Math.cos(angle-facingAngle(device.heading))))<=arc/2;
};

// Devices are scene state, never members of a disposable shot runtime. No timer
// advances combat: accepted shot boundaries are the only reaction clock.
const add=(scene,owner,kind,point,heading,settings={})=>{
    const state=world(scene),terrain=scene.terrain;
    const x=clamp(point.x,12,terrain.width-13),y=floorBelow(terrain,x,point.y-3);
    if(y>=terrain.height)return null;
    const device={id:state.nextDevice++,kind,owner,x,y,heading:heading<0?-1:1,ammo:6,heat:0,health:18,
        ttl:6,armedAt:state.shot+1,lastReaction:-1,lastBoundary:state.shot,buried:false,lock:null,...settings};
    state.devices.push(device);devicePresentation(scene)?.deploy(device);return device;
};
const replace=(scene,owner,kind)=>{
    const state=world(scene);
    state.devices=state.devices.filter(device=>device.owner!==owner||device.kind!==kind);
};
export const deploySentries=(scene,tank,point,heading=1,config={})=>{
    replace(scene,tank,'sentry');
    return [-20,20].map(offset=>add(scene,tank,'sentry',{x:point.x+offset,y:point.y},heading,config)).filter(Boolean);
};
export const deployMissileSilo=(scene,tank,point,heading=1,config={})=>{
    replace(scene,tank,'silo');return add(scene,tank,'silo',point,heading,{ammo:2,health:28,ttl:9,...config});
};
export const deployRunGun=(scene,tank,point,heading=1,config={})=>{
    replace(scene,tank,'runner');return add(scene,tank,'runner',point,heading,{ammo:9,health:12,ttl:7,...config});
};
export const deployWeaponDevice=(weapon,kind,options={})=>{
    const scene=weapon.scene;
    if(!scene.terrain&&weapon.terrain)scene.terrain=weapon.terrain;
    const point=options.point||{x:weapon.tank.x,y:weapon.tank.y},heading=options.heading||1;
    if(kind==='autoturrets')return deploySentries(scene,weapon.tank,point,heading,options.config);
    if(kind==='missileturret')return deployMissileSilo(scene,weapon.tank,point,heading,options.config);
    if(kind==='runngun')return deployRunGun(scene,weapon.tank,point,heading,options.config);
    return null;
};

// Return the first terrain or tank along a real firing lane. A friendly tank
// intercepts its owner's rounds exactly like the enemy can.
export const traceDeviceRay=(scene,from,to,maxRange=240)=>{
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.min(Math.hypot(dx,dy),maxRange);
    const angle=Math.atan2(dy,dx);
    for(let d=2;d<=length;d+=2){
        const x=from.x+Math.cos(angle)*d,y=from.y+Math.sin(angle)*d;
        if(x<1||x>=scene.terrain.width-1||y<0||y>=scene.terrain.height)return {x,y,blocked:true};
        if(solid(scene.terrain,x,y))return {x,y,blocked:true};
        const hit=[scene.tank1,scene.tank2].find(tank=>tank.isPointInside?.(x,y));
        if(hit)return {x,y,tank:hit};
    }
    return {x:from.x+Math.cos(angle)*length,y:from.y+Math.sin(angle)*length};
};
const blast=(scene,device,x,y,radius,damage,scoreHit)=>{
    for(const tank of [scene.tank1,scene.tank2]){
        const p=center(tank),distance=Math.hypot(p.x-x,p.y-y);
        if(distance<radius)scoreHit(device.owner,tank,damage*(1-distance/radius));
    }
};
const wreck=(scene,device,scoreHit)=>{
    if(device.destroyed)return;
    device.destroyed=true;
    if(device.ammo>0)blast(scene,device,device.x,device.y-8,30,18,scoreHit);
    devicePresentation(scene)?.wreck(device);
};
export const damageDeployables=(scene,x,y,radius,amount,scoreHit)=>{
    const state=world(scene);
    for(const device of state.devices){
        const distance=Math.hypot(device.x-x,device.y-10-y);
        if(distance<radius){device.health-=Math.max(1,amount*(1-distance/Math.max(radius,1)));if(device.health<=0)wreck(scene,device,scoreHit);}
    }
    state.devices=state.devices.filter(device=>!device.destroyed);
};
export const disruptDeployables=(scene,x,y,radius,payload)=>{
    for(const device of world(scene).devices){
        if(Math.hypot(device.x-x,device.y-12-y)>radius)continue;
        if(payload==='ion'||payload==='frost')device.jammedUntil=world(scene).shot+(payload==='ion'?2:1);
        if(payload==='fire')device.heat=Math.min(4,device.heat+2);
    }
};
const support=(scene,device,scoreHit)=>{
    const terrain=scene.terrain;
    if(!solid(terrain,device.x,device.y+2)){
        const y=floorBelow(terrain,device.x,device.y+2);
        if(y>=terrain.height||y-device.y>70){wreck(scene,device,scoreHit);return false;}
        device.y=y;
    }
    device.buried=solid(terrain,device.x,device.y-14);
    return !device.buried;
};
const fireRound=(scene,device,origin,target,damage,scoreHit)=>{
    const hit=traceDeviceRay(scene,origin,center(target),240);
    if(hit.tank)scoreHit(device.owner,hit.tank,damage);
    return {from:origin,to:{x:hit.x,y:hit.y},hit:!!hit.tank};
};
const sentry=(scene,device,target,scoreHit)=>{
    if(device.heat>=4){device.heat=1;devicePresentation(scene)?.vent(device);return;}
    const p=center(target),distance=Math.hypot(p.x-device.x,p.y-(device.y-14));
    if(distance>240||!inArc(device,target,110*Math.PI/180)){device.heat=Math.max(0,device.heat-1);return;}
    const origin={x:device.x,y:device.y-14},lane=traceDeviceRay(scene,origin,p,240);
    if(lane.blocked){device.heat=Math.max(0,device.heat-1);return;}
    const rounds=Math.min(2,device.ammo),shots=[];
    for(let i=0;i<rounds;i++)shots.push(fireRound(scene,device,origin,target,6,scoreHit));
    device.ammo-=rounds;device.heat+=2;device.lastReaction=world(scene).shot;
    devicePresentation(scene)?.burst(device,shots);
};
const missilePath=(scene,device,target)=>{
    const from={x:device.x,y:device.y-20},peak={x:(from.x+target.x)/2,y:Math.max(5,Math.min(from.y,target.y)-140)},points=[from];
    for(let i=1;i<=60;i++){
        const t=i/60,u=1-t,x=u*u*from.x+2*u*t*peak.x+t*t*target.x,y=u*u*from.y+2*u*t*peak.y+t*t*target.y;
        points.push({x,y});
        if(solid(scene.terrain,x,y)||[scene.tank1,scene.tank2].some(tank=>tank.isPointInside?.(x,y)))break;
    }
    return points;
};
const silo=(scene,device,target,scoreHit)=>{
    const state=world(scene),fx=devicePresentation(scene);
    if(device.lock){
        if(state.shot<device.lock.fireAt)return;
        const path=missilePath(scene,device,device.lock),hit=path[path.length-1];
        blast(scene,device,hit.x,hit.y,44,35,scoreHit);
        const terrain=scene.terrain,ctx=terrain.context;
        if(ctx){ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(hit.x,hit.y,22,0,Math.PI*2);ctx.fill();ctx.restore();terrain.update();terrain.fixTerrain?.(Math.round(hit.x),Math.round(hit.y),22);}
        device.ammo--;device.lock=null;device.heat=1;device.lastReaction=state.shot;
        fx?.missile(device,path);return;
    }
    if(device.heat){device.heat--;return;}
    const p=center(target);
    if(Math.hypot(p.x-device.x,p.y-device.y)>500)return;
    for(let dy=18;dy<65;dy+=4)if(solid(scene.terrain,device.x,device.y-dy))return;
    device.lock={x:p.x,y:p.y,fireAt:state.shot+1};fx?.lock(device);
};
const runner=(scene,device,target,scoreHit)=>{
    if(device.heat){device.heat=0;devicePresentation(scene)?.vent(device);return;}
    const from={x:device.x,y:device.y},shots=[];
    for(let step=0;step<6;step++){
        const x=clamp(device.x+device.heading*14,12,scene.terrain.width-13),y=floorBelow(scene.terrain,x,Math.max(0,device.y-45));
        if(x===device.x||y>=scene.terrain.height||Math.abs(y-device.y)>65){wreck(scene,device,scoreHit);break;}
        device.x=x;device.y=y;
        if(step%2===1&&device.ammo>0&&inArc(device,target,150*Math.PI/180)&&Math.hypot(center(target).x-x,center(target).y-y)<240){
            const origin={x,y:y-23},lane=traceDeviceRay(scene,origin,center(target),240);
            if(!lane.blocked){shots.push(fireRound(scene,device,origin,target,8,scoreHit));device.ammo--;device.lastReaction=world(scene).shot;}
        }
    }
    device.heat=1;devicePresentation(scene)?.run(device,from,{x:device.x,y:device.y},shots);
};

export const advanceDeployables=(scene,epoch,scoreHit)=>{
    const state=world(scene);
    for(const device of [...state.devices]){
        if(device.destroyed||device.lastBoundary>=epoch)continue;
        device.lastBoundary=epoch;
        if(epoch<device.armedAt)continue;
        device.ttl--;if(device.ttl<0){device.destroyed=true;continue;}
        if(!support(scene,device,scoreHit)||device.ammo<=0||epoch<=Number(device.jammedUntil||0))continue;
        const target=opponent(scene,device.owner);
        if(device.kind==='sentry')sentry(scene,device,target,scoreHit);
        else if(device.kind==='silo')silo(scene,device,target,scoreHit);
        else if(device.kind==='runner')runner(scene,device,target,scoreHit);
    }
    state.devices=state.devices.filter(device=>!device.destroyed&&device.ttl>=0&&(device.ammo>0||device.lock));
};
export const exportDeployables=scene=>world(scene).devices.map(({owner,...device})=>({...device,lock:device.lock?{...device.lock}:null,owner:owner===scene.tank1?1:2}));
export const importDeployables=(scene,devices=[],nextDevice)=>{
    const state=world(scene);
    state.devices=devices.filter(device=>['sentry','silo','runner'].includes(device.kind)).slice(0,8).map(device=>({...device,lock:device.lock?{...device.lock}:null,owner:device.owner===1?scene.tank2:scene.tank1}));
    state.nextDevice=Math.max(Number(nextDevice)||1,...state.devices.map(device=>device.id+1));
    devicePresentation(scene)?.restore();
};
