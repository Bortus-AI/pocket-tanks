import { assistTank, ballisticSeeds, findAim } from './assist';
import { createPreviewWorld } from './preview-world';
jest.mock('./preview-world',()=>({createPreviewWorld:jest.fn()}));

const fixture=()=>{
    const tank={x:200,y:350,rotation:0,power:50,active:true,gameType:4,weapons:[{id:50}],selectedWeapon:0,turret:{x:200,y:338,rotation:Math.PI/4,relativeRotation:Math.PI/4,setRelativeRotation:jest.fn()},setPower:jest.fn()};
    const foe={x:800,y:350,rotation:0,centre:{x:800,y:344}};
    tank.scene={tank1:tank,tank2:foe,activeTank:1,terrain:{revision:1},scene:{isActive:()=>true},arsenal:{catalog:[{id:50,behavior:'mortar'}]}};
    return tank;
};
afterEach(()=>jest.clearAllMocks());

test('mortar seeds account for muzzle, slower launch, and discrete gravity across both directions and elevations',()=>{
    for(const target of [{x:800,y:344},{x:800,y:220},{x:80,y:440}]){
        const origin={x:400,y:338},seeds=ballisticSeeds(origin,target,5.2,180);
        expect(seeds.length).toBeGreaterThan(0);
        const errors=seeds.map(({rotation,power})=>{
            const a=rotation-Math.PI/2,v=power*5.2,x=origin.x+16*Math.cos(a),y=origin.y+16*Math.sin(a),t=(target.x-x)/(v*Math.cos(a));
            return Math.abs(y+v*Math.sin(a)*t+180*t*(t+1/60)/2-target.y);
        });
        expect(Math.min(...errors)).toBeLessThan(.2);
    }
});

test('rejects a previously requested aim when manual power changes during prediction',async()=>{
    const tank=fixture();let trials=0;
    createPreviewWorld.mockReturnValue({run(){if(++trials===3)tank.power=51;return {distance:20,score:0,deliveries:1,launch:{vx:260,vy:0,gravity:180}};}});
    expect((await assistTank(tank)).status).toBe('cancelled');
    expect(tank.setPower).not.toHaveBeenCalled();expect(tank.turret.setRelativeRotation).not.toHaveBeenCalled();
});

test('does not enable assist online or change a self-use weapon',async()=>{
    const tank=fixture();tank.gameType=3;
    expect((await assistTank(tank)).status).toBe('unavailable');expect(createPreviewWorld).not.toHaveBeenCalled();
    tank.gameType=4;tank.scene.arsenal.catalog[0].behavior='shield';
    expect((await assistTank(tank)).status).toBe('self');expect(tank.setPower).not.toHaveBeenCalled();expect(tank.turret.setRelativeRotation).not.toHaveBeenCalled();
});

test('a blocked search never resets the controls to zero',async()=>{
    const tank=fixture();createPreviewWorld.mockReturnValue({run:()=>({distance:Infinity,score:0,deliveries:0})});
    const result=await findAim(tank,{yieldControl:async()=>{}});
    expect(result.status).toBe('blocked');expect(result.rotation).toBeUndefined();expect(result.power).toBeUndefined();
});
