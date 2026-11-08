import { Computer } from './Computer';

const makeCpu=()=>{
    // Flat ground at y=400 across a 1000px field; CPU on the right, player on the left.
    const terrain={width:1000,height:600,getPixel:(x,y)=>({alpha:y>=400?255:0})};
    const tank={x:800,y:395,rotation:0,powerFactor:8,turret:{x:800,y:380,setRotation:jest.fn()},setPower:jest.fn(),shoot:jest.fn(),weapons:[]};
    const scene={tank1:{x:200,y:395},terrain,HUD:{weaponScrollDisplay:{setActive:jest.fn()}},hideTurnPointer:jest.fn()};
    const cpu=new Computer(scene,tank,8);cpu.deviate=jest.fn();
    return {cpu,tank,scene};
};

test('dirt builders (type 4) are fired as cover in front of the CPU, not at the enemy',()=>{
    const {cpu,tank}=makeCpu();
    tank.weapons=[{id:12,name:'Magic Wall',type:4}];
    const spy=jest.spyOn(cpu,'handleType0');
    cpu.play();
    expect(spy).not.toHaveBeenCalled();expect(tank.shoot).toHaveBeenCalledTimes(1);
    const angle=tank.turret.setRotation.mock.calls[0][0];
    // Negative turret rotation = aiming left, towards the player.
    expect(angle).toBeLessThan(0);
});

test('findLandingShot lands close to the requested cover point',()=>{
    const {cpu,tank}=makeCpu();
    const shot=cpu.findLandingShot(650,-1);
    expect(shot).not.toBeNull();
    const theta=Math.PI/2-shot.angle,v=shot.v;
    let x=0;for(let t=0.05;t<5;t+=0.01){x=tank.turret.x+v*Math.cos(theta)*t;const y=tank.turret.y-v*Math.sin(theta)*t+150*t*t;if(y>=400)break;}
    expect(Math.abs(x-650)).toBeLessThan(40);
});
