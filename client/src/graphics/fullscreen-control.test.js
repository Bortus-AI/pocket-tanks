import { EventEmitter } from 'events';
import { installFullscreenControl } from './fullscreen-control';
const fixture=()=>{
    const game={events:new EventEmitter(),device:{os:{desktop:true}},scene:{isActive:()=>false},canvas:{getBoundingClientRect:()=>({left:0,top:0,right:1200,width:1200,height:800})},scale:{fullscreen:{active:false}}};
    game.scale.startFullscreen=jest.fn(()=>{game.scale.fullscreen.active=true;document.dispatchEvent(new Event('fullscreenchange'));});
    game.scale.stopFullscreen=jest.fn(()=>{game.scale.fullscreen.active=false;document.dispatchEvent(new Event('fullscreenchange'));});
    return {game,control:installFullscreenControl(game)};
};
afterEach(()=>document.body.replaceChildren());
test('fullscreen control survives entering, external exit, and entering again',()=>{
    const {game,control}=fixture();control.button.click();expect(game.scale.startFullscreen).toHaveBeenCalledTimes(1);
    expect(control.button.getAttribute('aria-label')).toBe('Exit fullscreen');
    game.scale.fullscreen.active=false;document.dispatchEvent(new Event('fullscreenchange'));
    expect(control.button.isConnected).toBe(true);expect(control.button.getAttribute('aria-label')).toBe('Enter fullscreen');
    control.button.click();expect(game.scale.startFullscreen).toHaveBeenCalledTimes(2);control.destroy();
});
test('the same control moves with phone HUD and recovery instead of being lost when scenes end',()=>{
    const {game,control}=fixture();const hud=document.createElement('section');hud.id='mobile-aim-controls';hud.innerHTML='<div class="mobile-combat-toolbar"><button class="mobile-aim-fire">FIRE</button></div>';document.body.append(hud);
    control.sync();expect(control.button.parentElement.classList.contains('mobile-combat-toolbar')).toBe(true);
    hud.remove();game.events.emit('poststep');expect(control.button.parentElement).toBe(document.body);
    const overlay=document.createElement('section');overlay.id='online-connection-status';overlay.innerHTML='<div></div>';document.body.append(overlay);control.sync();expect(overlay.contains(control.button)).toBe(true);
    overlay.remove();game.events.emit('poststep');expect(control.button.isConnected).toBe(true);
    expect(document.querySelectorAll('#game-fullscreen-toggle')).toHaveLength(1);control.destroy();
});
test('game destruction cleans up the persistent control and listeners',()=>{
    const {game,control}=fixture();game.events.emit('destroy');expect(control.button.isConnected).toBe(false);expect(game.events.listenerCount('poststep')).toBe(0);
});
