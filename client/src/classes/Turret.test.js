import { Turret } from './Turret';
jest.mock('phaser',()=>({__esModule:true,default:{},GameObjects:{Sprite:class {}},Physics:{}}));
jest.mock('./Weapon',()=>({Weapon:class {}}));
jest.mock('../socket',()=>({socket:{on:()=>{},off:()=>{}}}));

const fakeTurret=()=>{
    const turret={};
    Object.defineProperty(turret,'activeWeapon',Object.getOwnPropertyDescriptor(Turret.prototype,'activeWeapon'));
    return turret;
};

test('clearing activeWeapon finishes the previous shot exactly once',()=>{
    const turret=fakeTurret(),weapon={finish:jest.fn()};
    turret.activeWeapon=weapon;expect(turret.activeWeapon).toBe(weapon);
    turret.activeWeapon=null;turret.activeWeapon=null;
    expect(weapon.finish).toHaveBeenCalledTimes(1);expect(turret.activeWeapon).toBeNull();
});

test('replacing the active weapon finishes the old one but not the new one',()=>{
    const turret=fakeTurret(),first={finish:jest.fn()},second={finish:jest.fn()};
    turret.activeWeapon=first;turret.activeWeapon=second;
    expect(first.finish).toHaveBeenCalledTimes(1);expect(second.finish).not.toHaveBeenCalled();
    turret.activeWeapon=second;expect(second.finish).not.toHaveBeenCalled();
});
