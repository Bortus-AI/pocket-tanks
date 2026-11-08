// Every firing entry point shares the same turn and animation checks.
export const canFireShot = hud => {
    const scene = hud?.scene;
    if (!scene || !scene.scene.isActive() || document.hidden || scene.gameOver || scene.exitMenuContent ||
        hud.mouseLocked || hud.shotRequestPending || hud.overlay?.visible || hud.mobileAim?.isEditing) return false;
    const tank = scene.activeTank === 1 ? scene.tank1 : scene.activeTank === 2 ? scene.tank2 : null;
    if (!tank?.active || !tank.weapons?.[tank.selectedWeapon] || scene.tank1.turret.activeWeapon || scene.tank2.turret.activeWeapon ||
        !scene.tank1.settled || !scene.tank2.settled || scene.tank1.moving || scene.tank2.moving ||
        scene.terrain.animate || scene.terrain.blastArray.length) return false;
    if ([1, 3].includes(scene.sceneData.gameType) && scene.activeTank !== 1) return false;
    if (scene.sceneData.gameType === 3 && (!window.socket?.connected || !window.onlineSession?.roomId ||
        window.onlineSession.paused || window.onlineSession.restoring || window.onlineSession.parked ||
        window.onlineSession.turn?.activeRole !== window.onlineSession.role || scene.onlineShotId ||
        Number(scene.onlineTurnNumber) !== Number(window.onlineSession.turn?.number))) return false;
    return true;
};

// Fire requires a fresh press and release on the same button. Dragging from an
// aiming control, a cancelled touch or a repeated release cannot fire.
export const bindTapToFire = (button, {canFire, onFire, key = () => ''}) => {
    let press = null;
    const cancel = () => {press=null;};
    const down = event => {
        if (press || !canFire() || (event.button !== undefined && event.button !== 0)) return;
        press={id:event.pointerId,x:event.clientX,y:event.clientY,key:key()};
    };
    const move = event => {if(press?.id===event.pointerId&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)cancel();};
    const up = event => {
        const previous=press;cancel();if(!previous||previous.id!==event.pointerId||previous.key!==key()||!canFire())return;
        const bounds=button.getBoundingClientRect();
        if(Math.hypot(event.clientX-previous.x,event.clientY-previous.y)>10||event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)return;
        onFire();
    };
    const click=event=>{if(event.detail===0&&canFire())onFire();};
    const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:cancel,blur:cancel,click};
    for(const [name,handler]of Object.entries(events))button.addEventListener(name,handler);
    return {cancel,destroy(){cancel();for(const [name,handler]of Object.entries(events))button.removeEventListener(name,handler);}};
};
