import { spider, cruiser, magicwall } from '../packs/Standard/Standard';
jest.mock('phaser',()=>({__esModule:true,default:{Math:{Vector2:class{constructor(x,y){this.x=x;this.y=y;}setAngle(){return this;}setLength(){return this;}}}},Physics:{},Scene:{}}));
jest.mock('../../classes/Weapon',()=>({Weapon:class {}}));
jest.mock('../packs/Standard/logos',()=>({}));

const fixture=()=>{
    const tank=x=>({centre:{x,y:343}});
    const tank1=tank(300),tank2=tank(720),scene={tank1,tank2,sound:{play:jest.fn()},textures:{remove:jest.fn()}};
    return {scene,tank:tank1};
};
const projectile=(x,y,vy=-100)=>({body:{x,y,velocity:{x:200,y:vy},stop:jest.fn()},texture:{key:'projectile'},destroy:jest.fn()});

test('Spider keeps a normal rising shot intact while leaving its own tank',()=>{
    const weapon=fixture(),handler=new spider();handler.projectile=projectile(380,263);handler.flightFrames=12;
    handler.checkCloseToTank(weapon);
    expect(handler.dissipated).toBe(false);expect(handler.projectile.destroy).not.toHaveBeenCalled();
});

test('Spider sprays the nearest own tank after returning to its launch area',()=>{
    const weapon=fixture(),handler=new spider();handler.projectile=projectile(330,313,100);handler.flightFrames=60;handler.clearedLaunchZone=true;
    handler.checkCloseToTank(weapon);
    expect(handler.dissipated).toBe(true);expect(handler.projectile.destroy).toHaveBeenCalled();
    const angle=Math.atan2(30,-30);expect((handler.minAngle+handler.maxAngle)/2).toBeCloseTo(angle);
});

test('Spider still activates on the original enemy proximity trigger',()=>{
    const weapon=fixture(),handler=new spider();handler.projectile=projectile(650,300);handler.flightFrames=40;
    handler.checkCloseToTank(weapon);expect(handler.dissipated).toBe(true);
});

test('adhesive terrain stops the native Cruiser without bypassing its existing fuse',()=>{
    const weapon=fixture(),handler=new cruiser();handler.projectile=projectile(500,349,0);
    handler.blast=jest.fn();weapon.terrain={getPixel:(x,y)=>y>=350?{red:135,green:155,blue:82}:{red:0,green:0,blue:0}};
    handler.roll(weapon);
    expect(handler.projectile.body.stop).toHaveBeenCalled();expect(handler.projectile.body.x).toBe(500);expect(handler.blast).not.toHaveBeenCalled();
});


test('Magic Wall refreshes its growing terrain each tween step and restores shared canvas state',()=>{
    const weapon=fixture(),handler=new magicwall(),configs=[],stack=[];
    const context={globalCompositeOperation:'source-over',globalAlpha:.4,fillStyle:'#123456',fillRect:jest.fn(),
        createLinearGradient:()=>({addColorStop:jest.fn()}),
        save(){stack.push({globalCompositeOperation:this.globalCompositeOperation,globalAlpha:this.globalAlpha,fillStyle:this.fillStyle});},
        restore(){Object.assign(this,stack.pop());},
    };
    weapon.terrain={getContext:()=>context,refresh:jest.fn(),update:jest.fn()};
    weapon.scene.add={container:()=>({setPosition:jest.fn(),add:jest.fn(),remove:jest.fn()}),circle:(x,y)=>({x,y,destroy:jest.fn()})};
    weapon.scene.tweens={add:config=>{configs.push(config);}};
    handler.projectile={...projectile(720,349),x:720,y:349};
    handler.blast(weapon,handler.projectile);
    const growth=configs.find(c=>c.duration===3000);growth.targets.h=40;growth.onUpdate();
    expect(weapon.terrain.refresh).toHaveBeenCalledTimes(1);
    expect(context.fillRect).toHaveBeenCalled();expect(context.globalCompositeOperation).toBe('source-over');
    expect(context.globalAlpha).toBe(.4);expect(context.fillStyle).toBe('#123456');expect(stack).toHaveLength(0);
});
