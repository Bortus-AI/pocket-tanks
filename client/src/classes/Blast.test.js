import { Blast } from './Blast';
import { emitWeaponImpact } from '../graphics/weapon-fx';
import { legacyWeaponStyle } from '../graphics/legacy-weapon-style';
import { applyLegacyAftermath } from '../weapons/expansion/unique-mechanics';

jest.mock('phaser', () => ({ Math:{ Distance:{ Between:jest.fn() } } }));
jest.mock('../graphics/weapon-fx', () => ({ emitWeaponImpact:jest.fn(()=>true) }));
jest.mock('../graphics/impact', () => ({ addImpact:jest.fn() }));
jest.mock('../weapons/expansion/unique-mechanics',()=>({applyLegacyAftermath:jest.fn(),legacyMechanicalRules:()=>[]}));

const context=()=>({beginPath:jest.fn(),arc:jest.fn(),closePath:jest.fn(),fill:jest.fn()});
const fixture=()=>{
    const terrainContext=context();
    const image={setOrigin:jest.fn().mockReturnThis(),setVisible:jest.fn().mockReturnThis(),destroy:jest.fn()};
    const scene={activeTank:1,tank1:{turret:{activeWeapon:null}},terrain:{canvas:{getContext:()=>terrainContext},fixTerrain:jest.fn()},
        textures:{addCanvas:jest.fn(),remove:jest.fn()},add:{image:()=>image},sound:{play:jest.fn()}};
    return {scene,image,terrainContext};
};

beforeEach(()=>{jest.clearAllMocks();emitWeaponImpact.mockReturnValue(true);});
test('legacy impacts choose elemental families and hide only the old ring presentation',()=>{
    const {scene,image,terrainContext}=fixture();
    const blast=new Blast(scene,1,100,120,12,{thickness:3,gradient:[]},false,'15');
    expect(emitWeaponImpact).toHaveBeenCalledWith(scene,100,120,12,expect.objectContaining({payload:'fire',behavior:'napalm'}));
    expect(image.setVisible).toHaveBeenCalledWith(false);
    blast.update();
    expect(terrainContext.arc).toHaveBeenCalledWith(100,120,1,0,Math.PI*2);
    expect(terrainContext.globalCompositeOperation).toBe('destination-out');
    expect(blast.innerRadius).toBe(0);
});
test.each([[1,16],[2,22],[3,24]])('modern type%i preserves the original crater and settling lifetime', (type,ticks)=>{
    const {scene,image,terrainContext}=fixture();
    const blast=new Blast(scene,type,100,120,12,{thickness:3,gradient:[],circles:[[],[],[]]},false,'0');
    let steps=0;while(!blast.toRemove&&steps<50){blast.update();steps++;}
    expect(steps).toBe(ticks);
    expect(scene.terrain.fixTerrain).toHaveBeenCalledWith(100,120,12);
    expect(image.destroy).toHaveBeenCalledTimes(1);
    expect(terrainContext.arc.mock.calls.some(call=>call[2]===12)).toBe(true);
    expect(blast.innerRadius).toBe(12);
});
test('legacy style uses a definition when available and original family IDs otherwise',()=>{
    expect(legacyWeaponStyle({},'16')).toMatchObject({payload:'frost',behavior:'hailstorm'});
    expect(legacyWeaponStyle({},'27')).toMatchObject({payload:'seismic',behavior:'excavator'});
    expect(legacyWeaponStyle({},'0')).toMatchObject({payload:'kinetic',behavior:'shell'});
    expect(legacyWeaponStyle({activeTank:2,tank2:{turret:{activeWeapon:{weaponHandler:{definition:{payload:{key:'acid',color:0xade46f},behavior:'drill'}}}}}},'0'))
        .toMatchObject({payload:'acid',color:0xade46f,behavior:'drill',classicMechanic:undefined});
});

test('original authored aftermath resolves after its terrain animation, even after the handler finishes',()=>{
    const {scene}=fixture();const original={id:1,scene,terrain:scene.terrain};scene.tank1.turret.activeWeapon=original;
    const blast=new Blast(scene,1,100,120,12,{thickness:3,gradient:[]},false,'1');
    scene.tank1.turret.activeWeapon=null;expect(applyLegacyAftermath).not.toHaveBeenCalled();
    while(!blast.toRemove)blast.update();
    expect(applyLegacyAftermath).toHaveBeenCalledTimes(1);
    expect(applyLegacyAftermath).toHaveBeenCalledWith(original,{x:100,y:120,radius:12});
});
