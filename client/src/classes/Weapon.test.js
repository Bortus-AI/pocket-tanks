import { EventEmitter } from 'events';
import { Weapon } from './Weapon';
import { createWeaponProjectile, emitWeaponMuzzle, getWeaponFX } from '../graphics/weapon-fx';
jest.mock('phaser',()=>({}));
jest.mock('./Turret',()=>({}));
jest.mock('../weapons/array',()=>({weaponArray:[{name:'Single Shot',createInstance:()=>({name:'Single Shot',create:jest.fn(),update:jest.fn()})}]}));
jest.mock('../weapons/expansion/tactics',()=>({splashScore:jest.fn()}));
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
