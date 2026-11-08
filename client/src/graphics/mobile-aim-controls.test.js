import { EventEmitter } from 'events';
import { createMobileAimControls, normalizeAimAngle, tankAimAngle } from './mobile-aim-controls';
const fixture=(gameType=2,desktop=false)=>{
 const makeTank=()=>{const tank={active:true,selectedWeapon:0,settled:true,moving:false,movesRemaining:4,power:60,rotation:.3,weapons:[{id:0,name:'Single Shot'},{id:30,name:'Impact Howitzer'}],turret:{rotation:.3,activeWeapon:null}};tank.setPower=value=>tank.power=Math.max(1,Math.min(100,Math.round(value)));tank.turret.setRelativeRotation=value=>{tank.turret.relativeRotation=value;tank.turret.rotation=value+tank.rotation;};tank.stepLeft=jest.fn();tank.stepRight=jest.fn();return tank;};
 const scene={game:{device:{os:{desktop}},canvas:{getBoundingClientRect:()=>({left:0,top:200,width:390,height:260})}},sceneData:{gameType},scene:{isActive:()=>true},events:new EventEmitter(),input:{keyboard:{enabled:true,resetKeys:jest.fn()}},terrain:{animate:false,blastArray:[]},tank1:makeTank(),tank2:makeTank(),activeTank:1,hideTurnPointer:jest.fn(),showExitMenu:jest.fn(),children:{list:[]}};
 const hud={scene,height:800,overlay:{visible:false},crossAir:{},fire:jest.fn(),reset:jest.fn(),weaponScrollDisplay:{setActive:jest.fn()},weaponDescription:{text:'A medium shell.'}};
 const controls=createMobileAimControls(hud);hud.mobileAim=controls;
 return {scene,hud,controls,element:label=>document.querySelector(`[aria-label="${label}"]`)};
};
const input=(element,value)=>{element.value=value;element.dispatchEvent(new Event('input',{bubbles:true}));};
const pointer=(element,type)=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:1,button:0,clientX:0,clientY:0});element.dispatchEvent(event);};
afterEach(()=>{document.body.replaceChildren();jest.useRealTimers();delete window.onlineSession;});
test('inline controls keep world angle exact on slopes, including underground shots',()=>{
 const {scene,controls,element}=fixture();for(const angle of [0,90,180,270,359]){input(element('Angle'),String(angle));expect(tankAimAngle(scene.tank1)).toBe(angle);expect(scene.tank1.turret.relativeRotation).toBeCloseTo((90-angle)*Math.PI/180-.3);}expect(normalizeAimAngle(-1)).toBe(359);expect(normalizeAimAngle(360)).toBe(0);controls.destroy();
});
test('power limits, focused numeric editing and sliders stay synchronized',()=>{
 const {scene,controls,element}=fixture();const field=element('Power');field.focus();expect(scene.input.keyboard.enabled).toBe(false);input(field,'150');expect(scene.tank1.power).toBe(100);expect(element('Power slider').value).toBe('100');field.blur();expect(field.value).toBe('100');expect(scene.input.keyboard.enabled).toBe(true);input(element('Power slider'),'1');element('Decrease power').click();expect(scene.tank1.power).toBe(1);controls.destroy();
});
test('one-step taps and held repeat stop on release and scene pause',()=>{
 jest.useFakeTimers();const {scene,controls,element}=fixture();const button=element('Increase power');pointer(button,'pointerdown');pointer(button,'pointerup');jest.advanceTimersByTime(500);expect(scene.tank1.power).toBe(61);pointer(button,'pointerdown');jest.advanceTimersByTime(650);expect(scene.tank1.power).toBeGreaterThan(63);scene.events.emit('pause');const power=scene.tank1.power;jest.advanceTimersByTime(1200);expect(scene.tank1.power).toBe(power);expect(controls.element.hidden).toBe(true);controls.destroy();
});
test('native ammo and firing are distinct; editing cannot activate Fire',()=>{
 const {hud,controls,element}=fixture();expect(element('Selected weapon').options).toHaveLength(2);element('Selected weapon').value='1';element('Selected weapon').dispatchEvent(new Event('change'));expect(hud.weaponScrollDisplay.setActive).toHaveBeenCalledWith(1);element('Power').focus();element('Fire selected weapon').click();expect(hud.fire).not.toHaveBeenCalled();element('Power').blur();element('Fire selected weapon').click();expect(hud.fire).toHaveBeenCalledTimes(1);controls.destroy();
});
test('only the current local player changes; online opponent and modals cannot aim',()=>{
 const {scene,controls,element}=fixture();scene.activeTank=2;controls.refresh();input(element('Power'),'37');expect(scene.tank2.power).toBe(37);expect(scene.tank1.power).toBe(60);scene.sceneData.gameType=3;window.onlineSession={roomId:'test',role:'host',turn:{number:0,activeRole:'player'}};controls.refresh();expect(element('Power').disabled).toBe(true);input(element('Power'),'80');expect(scene.tank2.power).toBe(37);scene.exitMenuContent={};controls.refresh();expect(controls.element.hidden).toBe(true);controls.destroy();
});
test('native HUD uses the existing footer without resizing the canvas and cleans up on shutdown',()=>{
 const {scene,controls,element}=fixture();expect(controls.element.style.top).toBe(`${200+260*2/3}px`);expect(controls.element.style.width).toBe('390px');expect(document.body.classList.contains('has-mobile-battle-controls')).toBe(false);element('Match menu').click();expect(scene.showExitMenu).toHaveBeenCalledTimes(1);scene.events.emit('shutdown');expect(document.getElementById('mobile-aim-controls')).toBeNull();expect(scene.events.listenerCount('pause')).toBe(0);controls.destroy();
});
test('desktop retains the canvas HUD',()=>expect(fixture(2,true).controls).toBeNull());
