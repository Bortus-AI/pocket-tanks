import { impactEarlyEffect, shootEarlyEffect, updateEarlyEffect, disposeEarlyEffect } from './early-classic-effects';
import { applyPayload } from './tactics';

jest.mock('./tactics', () => ({
    applyPayload:jest.fn(), scoreHit:jest.fn(()=>8), distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
    enemyOf:(scene,tank)=>tank===scene.tank1?scene.tank2:scene.tank1,
}));
jest.mock('../../graphics/weapon-fx', () => ({emitTerrainBuild:jest.fn(),emitWeaponImpact:jest.fn(),emitWeaponBeam:jest.fn()}));
const fixture = (name, options={}) => {
    const tank=x=>{
        const target={x,y:349,power:40,rotation:0,centre:{x,y:343},isPointInside:(bx,by)=>Math.abs(bx-x)<10&&by>=337&&by<350,
            turret:{rotation:0,setRelativeRotation:jest.fn()},body:{stop:jest.fn(),setVelocity:jest.fn(),setGravityY:jest.fn(),updateFromGameObject:jest.fn(),preUpdate:jest.fn()}};
        target.setPower=jest.fn(value=>{target.power=value;});
        target.setPosition=jest.fn((x,y)=>{target.x=x;target.y=y;target.centre={x,y:y-6};});
        return target;
    };
    const scene={tank1:tank(300),tank2:tank(720)};
    const context=Object.fromEntries(['save','restore','fillRect','beginPath','arc','stroke','fill'].map(key=>[key,jest.fn()]));
    context.fillModes=[];context.fill=jest.fn(()=>context.fillModes.push(context.globalCompositeOperation));
    const runtime={definition:{name,id:570,radius:40,strength:.65,count:10},options,scene,
        terrain:{width:1200,height:533,context,update:jest.fn()},projectiles:[],direction:1,
        origin:()=>({x:300,y:337,angle:-Math.PI/4}),fxOptions:extra=>extra,ground:()=>350,carve:jest.fn(),build:jest.fn(),dirtAt:jest.fn(),walkers:[],schedule:jest.fn(),events:[],tick:0,
        remove:jest.fn(p=>{p.removed=true;}),ray:jest.fn(),random:()=>.5,pointBurst:jest.fn(),coat:jest.fn(),burst:jest.fn(),
    };
    runtime.weapon={id:570,scene,tank:scene.tank1,weaponHandler:runtime};
    runtime.spawn=jest.fn((x,y,vx,vy,extra)=>runtime.projectiles.push({x,y,vx,vy,age:0,...extra}));
    runtime.fireFrom=jest.fn((x,y,angle,speed,extra)=>runtime.spawn(x,y,Math.cos(angle)*speed,Math.sin(angle)*speed,extra));
    runtime.walker=jest.fn(p=>runtime.walkers.push({x:p.x,y:p.y,direction:1,age:0}));
    const projectile={x:720,y:349,vx:200,vy:100,age:30};runtime.projectiles.push(projectile);
    return {runtime,projectile,context,scene};
};
afterEach(()=>jest.clearAllMocks());

test('Great Wall extends continuously from the top to the bottom of the battlefield',()=>{
    const {runtime,projectile,context}=fixture('Great Wall');
    expect(impactEarlyEffect(runtime,projectile)).toBe(true);
    expect(context.fillRect).toHaveBeenCalledWith(708,0,24,533);
    expect(runtime.terrain.update).toHaveBeenCalled();
    expect(projectile.removed).toBe(true);
});

test('Glue Storm coats the entire terrain using adhesive without filling empty air',()=>{
    const {runtime,projectile,context}=fixture('Glue Storm');
    impactEarlyEffect(runtime,projectile);
    expect(context.globalCompositeOperation).toBe('source-atop');
    expect(context.fillStyle).toBe('rgb(135,155,82)');
    expect(context.fillRect).toHaveBeenCalledWith(0,0,1200,533);
    expect(applyPayload).toHaveBeenCalledWith(runtime.weapon,720,349,40);
});

test('Blockade encloses the nearby tank in a hollow shell rather than solid clumps',()=>{
    const {runtime,projectile,context}=fixture('Blockade',{rubber:true});
    impactEarlyEffect(runtime,projectile);
    expect(context.arc).toHaveBeenCalledWith(720,343,62,0,Math.PI*2);
    expect(context.stroke).toHaveBeenCalledTimes(1);expect(context.fillModes).toEqual(['destination-out']);
    expect(runtime.spawn).not.toHaveBeenCalled();expect(runtime.lastDeliveryPoint).toEqual({x:720,y:343});
});

test('Nanobots spawn bounded laser robots, fire actual rays, and retire without explosions',()=>{
    const {runtime,projectile}=fixture('Nanobots',{shots:10});
    impactEarlyEffect(runtime,projectile);
    const bots=runtime.projectiles.filter(p=>p.earlyLaserBot);expect(bots).toHaveLength(10);
    for(const age of [12,36,60,84,108,132]){
        bots.forEach(bot=>{bot.age=age;bot.x=700;bot.y=290;});updateEarlyEffect(runtime);
    }
    expect(runtime.ray).toHaveBeenCalledTimes(40);
    expect(bots.every(bot=>bot.botPulses===4)).toBe(true);
    expect(bots.some(bot=>bot.vx!==0||bot.vy!==0)).toBe(true);
    bots.forEach(bot=>{bot.age=210;});updateEarlyEffect(runtime);
    expect(bots.every(bot=>bot.removed)).toBe(true);
    const blocked={earlyLaserBot:true};expect(impactEarlyEffect(runtime,blocked)).toBe(true);expect(blocked.removed).toBe(true);
});

test('Whiplash takes one second pass when it misses, then resolves normally',()=>{
    const {runtime,projectile}=fixture('Whiplash',{range:75});
    shootEarlyEffect(runtime);
    Object.assign(projectile,{x:850,y:200,vx:240,vy:40,age:40});
    updateEarlyEffect(runtime);
    expect(projectile.whiplashReturning).toBe(true);expect(projectile.vx).toBeLessThan(0);expect(projectile.guided).toBe(true);
    expect(impactEarlyEffect(runtime,projectile)).toBe(false);
    expect(runtime.spawn).not.toHaveBeenCalled();
});

test('Whiplash launches its second chance out of a missed ground contact only once',()=>{
    const {runtime,projectile}=fixture('Whiplash',{range:75});Object.assign(projectile,{x:500,y:350});
    expect(impactEarlyEffect(runtime,projectile)).toBe(true);
    const returning=runtime.projectiles.at(-1);
    expect(returning.whiplashReturning).toBe(true);expect(returning.y).toBe(342);expect(returning.gravity).toBe(0);
    expect(impactEarlyEffect(runtime,returning)).toBe(false);
    expect(runtime.spawn).toHaveBeenCalledTimes(1);
});


test('Hot Potato terminal blast grows with accumulated bounces and stays bounded',()=>{
    const {runtime,projectile}=fixture('Hot Potato',{bounces:5,rubber:true});runtime.definition.radius=34;
    impactEarlyEffect(runtime,{...projectile,classicBounces:5,bounces:0});
    impactEarlyEffect(runtime,{...projectile,classicBounces:5,bounces:2});
    impactEarlyEffect(runtime,{...projectile,classicBounces:5,bounces:100});
    const calls=runtime.pointBurst.mock.calls;
    expect(calls[1][2]).toBeGreaterThan(calls[0][2]);expect(calls[1][3]).toBeGreaterThan(calls[0][3]);
    expect(calls[2][2]).toBeLessThanOrEqual(105);expect(calls[2][3]).toBeLessThanOrEqual(1.6);
    expect(runtime.coat).toHaveBeenCalledTimes(3);
});

test('Fire + Ice alternates separated elemental fragments and applies each child payload without changing the registry definition',()=>{
    const {runtime,projectile}=fixture('Fire + Ice',{shots:14,bounces:3});
    runtime.definition.radius=20;runtime.definition.strength=.5;const original=runtime.definition;
    const keys=[];runtime.burst=jest.fn(()=>keys.push(runtime.definition.payload.key));
    impactEarlyEffect(runtime,projectile);
    const children=runtime.projectiles.filter(p=>p.child);
    expect(children).toHaveLength(14);
    expect(children.every((p,i)=>p.childPayloadKey===(i%2?'frost':'fire'))).toBe(true);
    expect(children.filter(p=>p.childPayloadKey==='fire').every(p=>p.vx<0)).toBe(true);
    expect(children.filter(p=>p.childPayloadKey==='frost').every(p=>p.vx>0)).toBe(true);
    for(const p of children.slice(0,2)){p.classicBounces=3;impactEarlyEffect(runtime,p);}
    expect(keys).toEqual(['fire','frost']);expect(runtime.definition).toBe(original);
});


test('Lucky Shot clears a short muzzle lane before delegating its normal guided launch',()=>{
    const {runtime}=fixture('Lucky Shot');
    expect(shootEarlyEffect(runtime)).toBe(false);
    expect(runtime.carve).toHaveBeenCalledTimes(10);expect(runtime.spawn).not.toHaveBeenCalled();
    expect(runtime.carve.mock.calls.at(-1)[0]).toBeGreaterThan(runtime.carve.mock.calls[0][0]);
});

test('Stun Gun launches exactly two diverging bullets',()=>{
    const {runtime}=fixture('Stun Gun');runtime.projectiles=[];
    expect(shootEarlyEffect(runtime)).toBe(true);expect(runtime.projectiles).toHaveLength(2);
    expect(runtime.projectiles[0].vx).not.toBe(runtime.projectiles[1].vx);
});

test('Saucer Attack calls two moving firing craft and Super Star releases three orbit pieces',()=>{
    const saucers=fixture('Saucer Attack').runtime;
    expect(shootEarlyEffect(saucers)).toBe(true);expect(saucers.projectiles.filter(p=>p.laserRole==='saucer')).toHaveLength(2);
    const {runtime,projectile}=fixture('Super Star');impactEarlyEffect(runtime,projectile);
    const stars=runtime.projectiles.filter(p=>p.laserRole==='star');expect(stars).toHaveLength(3);
    stars.forEach(p=>{p.age=34;});updateEarlyEffect(runtime);
    expect(runtime.ray).toHaveBeenCalledTimes(3);expect(stars.some(p=>p.vx!==0||p.vy!==0)).toBe(true);
});

test('Glue Gun triggers before ground contact and both glue weapons apply a burning adhesive payload',()=>{
    for(const name of['Glue Gun','Gyro Glue']){
        const {runtime,projectile}=fixture(name);const keys=[];
        applyPayload.mockImplementation(weapon=>keys.push(weapon.weaponHandler.definition.payload.key));
        impactEarlyEffect(runtime,projectile);
        expect(runtime.coat).toHaveBeenCalledWith(720,349,40,false);expect(keys).toEqual(['fire']);
    }
    const {runtime,projectile}=fixture('Glue Gun');Object.assign(projectile,{x:650,y:310});runtime.impact=jest.fn();
    updateEarlyEffect(runtime);expect(runtime.impact).toHaveBeenCalledWith(projectile);
});

test('Funnel excavates a deep valley and coats its steep walls with rubber',()=>{
    const {runtime,projectile}=fixture('Funnel');impactEarlyEffect(runtime,projectile);
    expect(runtime.carve).toHaveBeenCalledWith(720,385,80);expect(runtime.build).toHaveBeenCalledTimes(2);
    expect(runtime.coat).toHaveBeenCalledWith(720,360,180,true);
});

test('Rockslide rolls downhill while Snowballs hop before their rolling stage',()=>{
    const {runtime,projectile}=fixture('Rockslide',{dirt:true,downhill:true});impactEarlyEffect(runtime,projectile);
    runtime.ground=x=>x<720?360:340;updateEarlyEffect(runtime);
    expect(runtime.walkers[0].direction).toBe(-1);expect(runtime.walkers[0].earlyRolling).toBe('rock');
    const snow=fixture('Snowballs',{bounces:3}).runtime;const parent=snow.projectiles[0];impactEarlyEffect(snow,parent);
    const first=snow.projectiles.at(-1);expect(first.earlySnowball).toBe(true);expect(first.vy).toBeLessThan(0);
    Object.assign(first,{snowBounces:3});impactEarlyEffect(snow,first);
    expect(snow.walkers[0].earlyRolling).toBe('snow');
});

test('Smoke Bomb changes nearby controls once while leaving acid resolution to the runtime',()=>{
    const {runtime,projectile,scene}=fixture('Smoke Bomb',{bounces:3});shootEarlyEffect(runtime);
    const child={...projectile,child:true,classicBounces:3};
    expect(impactEarlyEffect(runtime,child)).toBe(false);impactEarlyEffect(runtime,{...child});
    expect(scene.tank2.setPower).toHaveBeenCalledTimes(1);expect(scene.tank2.turret.setRelativeRotation).toHaveBeenCalledTimes(1);
    expect(scene.tank1.setPower).not.toHaveBeenCalled();
});

test('Tractor Beam clears burial, holds a deterministic lift, then releases gravity and cleans up cancellation',()=>{
    const {runtime,projectile,scene}=fixture('Tractor Beam');runtime.definition.radius=100;
    scene.tank2.setPosition(720,430);impactEarlyEffect(runtime,projectile);
    expect(runtime.carve).toHaveBeenCalled();expect(runtime.events).toEqual([{at:46,fn:expect.any(Function)}]);
    for(let tick=0;tick<45;tick++)updateEarlyEffect(runtime);
    expect(scene.tank2.y).toBe(250);expect(scene.tank2.body.preUpdate).toHaveBeenCalled();
    expect(scene.tank2.body.setGravityY).toHaveBeenLastCalledWith(300);expect(runtime.earlyLifts).toHaveLength(0);
    runtime.earlyLifts=[{tank:scene.tank2}];disposeEarlyEffect(runtime);
    expect(runtime.earlyLifts).toHaveLength(0);expect(scene.tank2.body.setGravityY).toHaveBeenLastCalledWith(300);
});
