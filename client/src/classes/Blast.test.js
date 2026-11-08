import { Blast } from './Blast';
import { emitWeaponImpact } from '../graphics/weapon-fx';
import { legacyWeaponStyle } from '../graphics/legacy-weapon-style';
import { applyLegacyAftermath } from '../weapons/expansion/unique-mechanics';

jest.mock('phaser', () => ({ Math:{ Distance:{ Between:jest.fn() } } }));
jest.mock('../graphics/weapon-fx', () => ({ emitWeaponImpact:jest.fn(()=>true) }));
jest.mock('../graphics/impact', () => ({ addImpact:jest.fn() }));
jest.mock('../weapons/expansion/unique-mechanics',()=>({applyLegacyAftermath:jest.fn(),legacyMechanicalRules:()=>[]}));
jest.mock('../audio/weapon-audio',()=>({playThrottledSample:jest.fn(()=>true)}));
const { playThrottledSample } = require('../audio/weapon-audio');
const { BlastCache } = require('./BlastCache');

const context=()=>{
    const state={globalCompositeOperation:'source-over',globalAlpha:.4,beginPath:jest.fn(),arc:jest.fn(),closePath:jest.fn(),fill:jest.fn()},stack=[];
    state.save=jest.fn(()=>stack.push({globalCompositeOperation:state.globalCompositeOperation,globalAlpha:state.globalAlpha}));
    state.restore=jest.fn(()=>Object.assign(state,stack.pop()));return state;
};
const fixture=()=>{
    const terrainContext=context();
    const image={setOrigin:jest.fn().mockReturnThis(),setVisible:jest.fn().mockReturnThis(),setAlpha:jest.fn().mockReturnThis(),destroy:jest.fn()};
    const refresh=jest.fn(),listeners={},added=new Set();
    const scene={activeTank:1,tank1:{turret:{activeWeapon:null}},terrain:{canvas:{getContext:()=>terrainContext},fixTerrain:jest.fn()},
        textures:{addCanvas:jest.fn(k=>{added.add(k);return {refresh};}),remove:jest.fn(k=>added.delete(k)),exists:jest.fn(k=>added.has(k))},add:{image:jest.fn(()=>image)},sound:{play:jest.fn()},
        events:{once:jest.fn((e,f)=>{listeners[e]=f;}),off:jest.fn()},blastCache:new BlastCache()};
    return {scene,image,terrainContext,refresh,listeners};
};

beforeEach(()=>{jest.clearAllMocks();emitWeaponImpact.mockReturnValue(true);});
test('legacy impacts choose elemental families and never allocate the old ring texture',()=>{
    const {scene,terrainContext}=fixture();
    const blast=new Blast(scene,1,100,120,12,{thickness:3,gradient:[]},false,'15');
    expect(emitWeaponImpact).toHaveBeenCalledWith(scene,100,120,12,expect.objectContaining({payload:'fire',behavior:'napalm',weaponId:15,audio:'layer'}));
    expect(scene.textures.addCanvas).not.toHaveBeenCalled();expect(scene.add.image).not.toHaveBeenCalled();
    blast.update();
    expect(terrainContext.arc).toHaveBeenCalledWith(100,120,1,0,Math.PI*2);
    expect(terrainContext.globalCompositeOperation).toBe('source-over');
    expect(terrainContext.globalAlpha).toBe(.4);
    expect(blast.innerRadius).toBe(0);
});
test.each([[1,16],[2,22],[3,24]])('modern type%i preserves the original crater and settling lifetime', (type,ticks)=>{
    const {scene,image,terrainContext}=fixture();
    const blast=new Blast(scene,type,100,120,12,{thickness:3,gradient:[],circles:[[],[],[]]},false,'0');
    let steps=0;while(!blast.toRemove&&steps<50){blast.update();steps++;}
    expect(steps).toBe(ticks);
    expect(scene.terrain.fixTerrain).toHaveBeenCalledWith(100,120,12);
    expect(image.destroy).not.toHaveBeenCalled();expect(scene.textures.addCanvas).not.toHaveBeenCalled();
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

const gradientContext=()=>new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true;}});
test('legacy presentation path owns a unique texture, refreshes it after drawing and disposes on shutdown',()=>{
    emitWeaponImpact.mockReturnValue(false);
    const spy=jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(gradientContext());
    try{
        const a=fixture(),b=fixture();
        const first=new Blast(a.scene,1,100,120,12,{thickness:3,gradient:[]},false,'0'),second=new Blast(b.scene,1,50,60,12,{thickness:3,gradient:[]},false,'0');
        const keyA=a.scene.textures.addCanvas.mock.calls[0][0],keyB=b.scene.textures.addCanvas.mock.calls[0][0];
        expect(keyA).not.toBe(keyB);expect(keyA).toMatch(/^legacy-blast-\d+$/);
        first.update();expect(a.refresh).toHaveBeenCalledTimes(1);
        a.listeners.shutdown();expect(a.scene.textures.remove).toHaveBeenCalledWith(keyA);expect(a.image.destroy).toHaveBeenCalledTimes(1);
        while(!second.toRemove)second.update();
        expect(b.scene.textures.remove).toHaveBeenCalledTimes(1);expect(b.scene.textures.remove).toHaveBeenCalledWith(keyB);
        expect(b.scene.events.off).toHaveBeenCalledWith('shutdown',expect.any(Function));
    }finally{spy.mockRestore();}
});
test('untyped blasts never populate a shared undefined cache bucket',()=>{
    emitWeaponImpact.mockReturnValue(false);
    const spy=jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(gradientContext());
    try{const {scene}=fixture();const blast=new Blast(scene,1,100,120,8,{thickness:3,gradient:[]},false,undefined);
        while(!blast.toRemove)blast.update();
        expect(scene.blastCache.existsType(undefined)).toBe(false);expect(scene.blastCache.exists(undefined,3)).toBe(false);
    }finally{spy.mockRestore();}
});
test('legacy wav goes through the throttled player with volume clamped to 1',()=>{
    const {scene}=fixture();
    new Blast(scene,1,100,120,12,{thickness:3,gradient:[],soundEffect:'hailstorm',soundConfig:{volume:2.5}},false,'16');
    expect(playThrottledSample).toHaveBeenCalledWith(scene,'hailstorm',{volume:1});expect(scene.sound.play).not.toHaveBeenCalled();
});
test('delayed blasts keep their source weapon instead of the newly active weapon',()=>{
    const {scene}=fixture();
    const other={id:3,weaponHandler:{id:3,name:'5 Shot'}};scene.activeTank=2;scene.tank2={turret:{activeWeapon:other}};
    const blast=new Blast(scene,1,100,120,12,{thickness:3,gradient:[]},false,'15.2');
    expect(emitWeaponImpact).toHaveBeenLastCalledWith(scene,100,120,12,expect.objectContaining({weaponId:15,payload:'fire'}));
    expect(blast.originalWeapon).toBeNull();
    expect(legacyWeaponStyle(scene,'3')).toMatchObject({weaponId:3,weaponName:'5 Shot'});
});
