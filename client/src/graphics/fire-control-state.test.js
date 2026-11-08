import { bindTapToFire, canFireShot } from './fire-control-state';

const touch = (button, type, x = 50, y = 25, pointerId = 1) => {
    const event = new Event(type, {bubbles:true,cancelable:true});
    Object.assign(event, {clientX:x,clientY:y,pointerId,button:0}); button.dispatchEvent(event);
};
const holdFixture = () => {
    jest.useFakeTimers();
    const button = document.createElement('button'); document.body.append(button);
    button.getBoundingClientRect = () => ({left:0,right:200,top:0,bottom:50});
    let enabled = true, turn = 'host:0';
    const fire = jest.fn(), control = bindTapToFire(button, {canFire:()=>enabled,key:()=>turn,onFire:fire});
    return {button,fire,control,disable(){enabled=false;},nextTurn(){turn='player:1';}};
};
afterEach(() => {document.body.replaceChildren();jest.useRealTimers();delete window.onlineSession;delete window.socket;});

test('a normal fresh press and release fires once; entering from another control cannot fire', () => {
    const {button,fire,control} = holdFixture();
    touch(button,'pointerup'); expect(fire).not.toHaveBeenCalled();
    touch(button,'pointerdown'); expect(fire).not.toHaveBeenCalled();
    touch(button,'pointerup'); touch(button,'pointerup'); expect(fire).toHaveBeenCalledTimes(1); control.destroy();
});

test('dragging, cancellation, loss of turn, and a second pointer never complete a shot', () => {
    const {button,fire,control,nextTurn} = holdFixture();
    touch(button,'pointerdown'); jest.advanceTimersByTime(500); touch(button,'pointermove',70,25); touch(button,'pointerup');
    touch(button,'pointerdown'); jest.advanceTimersByTime(500); touch(button,'pointercancel'); touch(button,'pointerup');
    touch(button,'pointerdown'); jest.advanceTimersByTime(500); touch(button,'pointerup',50,25,2); expect(fire).not.toHaveBeenCalled();
    nextTurn(); touch(button,'pointerup'); expect(fire).not.toHaveBeenCalled(); control.destroy();
});

test('disabled/blurred controls and shutdown cancel an otherwise complete hold', () => {
    const {button,fire,control,disable} = holdFixture();
    touch(button,'pointerdown'); jest.advanceTimersByTime(500); button.dispatchEvent(new Event('blur')); touch(button,'pointerup');
    touch(button,'pointerdown'); jest.advanceTimersByTime(500); disable(); touch(button,'pointerup');
    control.destroy(); touch(button,'pointerdown'); jest.advanceTimersByTime(1000); touch(button,'pointerup'); expect(fire).not.toHaveBeenCalled();
});

test('shared Fire guard rejects aiming, pending grants, animation, movement, empty weapons and the opponent', () => {
    const makeTank = () => ({active:true,weapons:[{id:0}],selectedWeapon:0,settled:true,moving:false,turret:{activeWeapon:null}});
    const scene = {scene:{isActive:()=>true},sceneData:{gameType:2},activeTank:1,tank1:makeTank(),tank2:makeTank(),terrain:{animate:false,blastArray:[]}};
    const hud = {scene,overlay:{visible:false}};
    expect(canFireShot(hud)).toBe(true);
    for (const [object,key,value] of [[hud,'mouseLocked',true],[hud,'shotRequestPending',true],[scene.terrain,'animate',true],[scene.tank1,'moving',true],[scene.tank2,'settled',false]]) {
        const old=object[key];object[key]=value;expect(canFireShot(hud)).toBe(false);object[key]=old;
    }
    hud.mobileAim={isEditing:true};expect(canFireShot(hud)).toBe(false);hud.mobileAim.isEditing=false;
    scene.sceneData.gameType=3;scene.onlineTurnNumber=0;window.socket={connected:true};window.onlineSession={roomId:'test-room',role:'host',turn:{number:0,activeRole:'host'}};
    expect(canFireShot(hud)).toBe(true);scene.activeTank=2;expect(canFireShot(hud)).toBe(false);
    scene.activeTank=1;window.onlineSession.restoring=true;expect(canFireShot(hud)).toBe(false);
});
