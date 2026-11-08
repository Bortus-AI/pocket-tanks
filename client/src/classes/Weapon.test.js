import { EventEmitter } from 'events';
import { Weapon } from './Weapon';
import { createWeaponProjectile, emitWeaponMuzzle, getWeaponFX } from '../graphics/weapon-fx';
import { scoreHit } from '../weapons/expansion/tactics';
jest.mock('phaser',()=>({}));
jest.mock('./Turret',()=>({}));
jest.mock('../weapons/array',()=>({weaponArray:[{name:'Single Shot',createInstance:()=>({name:'Single Shot',create:jest.fn(),update:jest.fn()})}]}));
jest.mock('../weapons/expansion/tactics',()=>({splashScore:jest.fn(),scoreHit:jest.fn(()=>7)}));
jest.mock('../graphics/legacy-weapon-style',()=>({legacyWeaponStyle:()=>({payload:'kinetic',behavior:'shell'})}));
jest.mock('../graphics/weapon-fx',()=>({getWeaponFX:jest.fn(),createWeaponProjectile:jest.fn(),emitWeaponMuzzle:jest.fn()}));
const setup=()=>{
    const scene={terrain:{},events:new EventEmitter(),time:{delayedCall:jest.fn()}},tank={power:60,turret:{powerFactor:8,rotation:0,x:100,y:200,height:32}};
    const visual={setPosition:jest.fn(),setVisible:jest.fn(),destroy:jest.fn()};
    getWeaponFX.mockReturnValue({});createWeaponProjectile.mockReturnValue(visual);
    const object=new EventEmitter();Object.assign(object,{scene,active:true,visible:true,x:100,y:200,body:{setGravityY:jest.fn(),setSize:jest.fn(),preUpdate:jest.fn()}});
    for(const method of ['setPosition','setRotation','setVelocity','setDepth','setAlpha'])object[method]=jest.fn(()=>object);
    return {scene,object,visual,weapon:new Weapon(scene,tank,0)};
};
beforeEach(()=>jest.clearAllMocks());
test('original projectile keeps its physics object but receives its own registered visual identity',()=>{
    const {weapon,object}=setup();weapon.defaultShoot(object);
    expect(createWeaponProjectile).toHaveBeenCalledWith(weapon.scene,100,200,expect.objectContaining({weaponId:0,weaponName:'Single Shot'}));
    expect(object.setAlpha).toHaveBeenCalledWith(0);expect(object.setVelocity).toHaveBeenCalled();expect(emitWeaponMuzzle).toHaveBeenCalled();
});
test('legacy hidden/revealed probes synchronize visibility and position without a second projectile',()=>{
    const {weapon,object,visual}=setup();weapon.defaultShoot(object);weapon.allowUpdate=true;
    object.visible=false;object.x=140;object.y=260;weapon.update();
    expect(visual.setPosition).toHaveBeenCalledWith(140,260);expect(visual.setVisible).toHaveBeenCalledWith(false);
    object.visible=true;weapon.update();expect(visual.setVisible).toHaveBeenLastCalledWith(true);
    object.emit('destroy');expect(visual.destroy).toHaveBeenCalledTimes(1);expect(weapon.legacyVisuals.size).toBe(0);
});
test('scene shutdown disposes remaining original visuals; cheap mocks retain their old visible sprite',()=>{
    const {scene,weapon,object,visual}=setup();weapon.defaultShoot(object);scene.events.emit('shutdown');expect(visual.destroy).toHaveBeenCalled();expect(weapon.legacyVisuals.size).toBe(0);
    const fallback=setup();getWeaponFX.mockReturnValue(null);fallback.weapon.defaultShoot(fallback.object);expect(fallback.object.setAlpha).not.toHaveBeenCalled();
});
test('secondary original physics fragments receive visuals once without treating tanks as projectiles',()=>{
    const {scene,weapon,object}=setup();
    object.body.velocity={x:30,y:-20};object.canvas={getContext:jest.fn()};
    const tank={...object,texture:{key:'tank-blue'}};scene.tank1=tank;
    weapon.weaponHandler.fragments=[object,tank];weapon.allowUpdate=true;
    weapon.update();weapon.update();
    expect(createWeaponProjectile).toHaveBeenCalledTimes(1);
    expect(createWeaponProjectile).toHaveBeenCalledWith(scene,100,200,expect.objectContaining({weaponId:0,small:true}));
    expect(weapon.legacyVisuals.has(tank)).toBe(false);
});

const textures=()=>{const keys=new Set();return {keys,exists:k=>keys.has(k),remove:jest.fn(k=>keys.delete(k)),addCanvas:k=>keys.add(k)};};
const handlerWeapon=(handler,extra={})=>{
    const scene={terrain:{width:1000,height:600,getPixel:()=>({alpha:0})},events:new EventEmitter(),time:{delayedCall:jest.fn((ms,cb)=>({cb,remove:jest.fn()}))},textures:textures(),...extra};
    const turret={powerFactor:8,rotation:0,x:100,y:200,height:32,activeWeapon:null};
    const tank={power:60,turret,isPointInside:()=>false};scene.tank1=tank;scene.tank2={isPointInside:()=>false,centre:{x:500,y:300}};
    const weapon=new Weapon(scene,tank,0,handler);turret.activeWeapon=weapon;return {scene,turret,tank,weapon};
};
const baseHandler=over=>({name:'Probe',create:jest.fn(),shoot:jest.fn(),update:jest.fn(),onOutOfBound:jest.fn(),onBaseHit:jest.fn(),onTerrainHit:jest.fn(),onTankHit:jest.fn(),...over});

test('a finished shot removes its own shutdown listener instead of leaking one per shot',()=>{
    const {scene,weapon}=handlerWeapon(baseHandler());
    expect(scene.events.listenerCount('shutdown')).toBe(1);
    weapon.finish();weapon.finish();
    expect(scene.events.listenerCount('shutdown')).toBe(0);expect(weapon.finished).toBe(true);
});

test('an exception in update is logged and force-finishes the shot so the turn advances',()=>{
    const error=jest.spyOn(console,'error').mockImplementation(()=>{});
    const handler=baseHandler({update:()=>{throw new Error('boom');}});
    const {turret,weapon}=handlerWeapon(handler);weapon.allowUpdate=true;
    expect(()=>weapon.update()).not.toThrow();
    expect(error).toHaveBeenCalled();expect(turret.activeWeapon).toBeNull();expect(weapon.finished).toBe(true);
    weapon.update();expect(error).toHaveBeenCalledTimes(1);error.mockRestore();
});

test('an exception in shoot destroys live projectiles and clears the active weapon',()=>{
    const error=jest.spyOn(console,'error').mockImplementation(()=>{});
    const handler=baseHandler({shoot:()=>{throw new Error('bad shoot');}});
    const {scene,turret,weapon}=handlerWeapon(handler);
    const projectile={scene,active:true,body:{},destroy:jest.fn()};handler.projectile=projectile;
    // previews do not schedule; drive the real shoot path directly
    weapon.runSafely('shoot',weapon.shoot);
    expect(projectile.destroy).toHaveBeenCalled();expect(turret.activeWeapon).toBeNull();error.mockRestore();
});

test('per-shot texture keys are unique and released when the shot finishes',()=>{
    const a=handlerWeapon(baseHandler()),b=handlerWeapon(baseHandler());
    const keyA=a.weapon.texKey('projectile'),keyB=b.weapon.texKey('projectile');
    expect(keyA).not.toBe(keyB);
    a.scene.textures.addCanvas(keyA);a.weapon.finish();
    expect(a.scene.textures.exists(keyA)).toBe(false);
});

test('zero-gravity objects that leave the top of the screen count as out of bounds',()=>{
    const handler=baseHandler();const {weapon}=handlerWeapon(handler);
    const object=(y,g)=>({body:{x:300,y,gravity:{y:g},velocity:{x:0,y:-50}},setRotation:jest.fn(),rotation:0});
    weapon.defaultUpdate(object(-150,0));expect(handler.onOutOfBound).not.toHaveBeenCalled();
    weapon.defaultUpdate(object(-250,300));expect(handler.onOutOfBound).not.toHaveBeenCalled();
    const lost=object(-250,0);weapon.defaultUpdate(lost);expect(handler.onOutOfBound).toHaveBeenCalledWith(weapon,lost);
    expect(()=>weapon.defaultUpdate({body:undefined})).not.toThrow();
});

test('fixCloseToTank pulls an overshooting projectile back to the trigger radius',()=>{
    const {weapon,scene}=handlerWeapon(baseHandler());
    const velocity={x:100,y:0,angle:()=>0};
    const obj={body:{x:460,y:300,velocity,speed:100,gravity:{x:0,y:0}}};
    weapon.fixCloseToTank(obj,{oppTankDist:80});
    const d=Math.hypot(obj.body.x-scene.tank2.centre.x,obj.body.y-300);
    expect(d).toBeLessThan(80);expect(d).toBeGreaterThan(79);
});

test('scoreTarget routes direct hits through scoreHit for shields, acid and self-hit penalties',()=>{
    const {weapon,tank,scene}=handlerWeapon(baseHandler());scoreHit.mockReturnValue(7);
    expect(weapon.scoreTarget(scene.tank2,70)).toBe(7);expect(scoreHit).toHaveBeenCalledWith(tank,scene.tank2,70);
    scoreHit.mockClear();expect(weapon.scoreTarget(scene.tank2,0)).toBe(0);expect(scoreHit).not.toHaveBeenCalled();
});
