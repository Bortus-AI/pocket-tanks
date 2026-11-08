import { bindTapToFire, canFireShot } from './fire-control-state';

export const normalizeAimAngle = degrees => ((Math.round(degrees) % 360) + 360) % 360;
export const tankAimAngle = tank => normalizeAimAngle(90 - tank.turret.rotation * 180 / Math.PI);

// This replaces the scaled canvas controls inside the existing HUD footprint.
// The battlefield keeps its full size; portrait letterboxing accommodates the
// taller stacked control rows without covering terrain or the weapon selector.
export const createMobileAimControls = hud => {
    const scene = hud.scene;
    if (scene.game.device.os.desktop) return null;
    const root = document.createElement('section');
    root.id = 'mobile-aim-controls'; root.setAttribute('aria-label', 'Combat controls');
    const toolbar = document.createElement('div'); toolbar.className = 'mobile-combat-toolbar';
    const ammo = document.createElement('select'); ammo.setAttribute('aria-label', 'Selected weapon');
    const makeButton = (label, text) => {
        const button = document.createElement('button'); button.type = 'button';
        button.setAttribute('aria-label', label); button.textContent = text; return button;
    };
    const left = makeButton('Move left', '←'), right = makeButton('Move right', '→');
    const menu = makeButton('Match menu', '☰'), fire = makeButton('Fire selected weapon', 'FIRE');
    fire.className = 'mobile-aim-fire';
    toolbar.append(ammo, left, right, menu, fire);
    const controls = document.createElement('div'); controls.className = 'mobile-aim-rows';
    const description = document.createElement('div'); description.className = 'mobile-combat-description';
    root.append(toolbar, controls, description); document.body.append(root);
    const legacy = hud.legacyControls || [];
    const hideLegacy = object => {
        object.setVisible?.(false); object.disableInteractive?.();
        if (Array.isArray(object.list)) object.list.forEach(hideLegacy);
    };
    legacy.forEach(object => {if (object !== hud.overlay && object.y >= hud.height * 2 / 3) hideLegacy(object);});
    hud.canvasFireButton?.setVisible(false).disableInteractive();

    let disposed = false, delay, repeat, heldButton, heldPointer, inventoryKey = '', lastPosition = '';
    let keyboardWasEnabled = true, focusedNumber = null;
    const pointers = new Set(), fields = [];
    const tank = () => scene.activeTank === 1 ? scene.tank1 : scene.activeTank === 2 ? scene.tank2 : null;
    const visible = () => !disposed && !document.hidden && scene.scene.isActive() && !scene.exitMenuContent && !scene.gameOver &&
        (scene.sceneData.gameType !== 3 || !!window.onlineSession?.roomId);
    const allowed = () => {
        const current = tank(), online = scene.sceneData.gameType === 3, session = window.onlineSession;
        return visible() && current?.active && !hud.overlay?.visible && !hud.mouseLocked && !hud.shotRequestPending &&
            !scene.tank1.turret.activeWeapon && !scene.tank2.turret.activeWeapon &&
            (![1,3].includes(scene.sceneData.gameType) || scene.activeTank === 1) &&
            (!online || (!session?.paused && !session?.restoring && !session?.parked && !scene.onlineShotId && session?.turn?.activeRole === session?.role));
    };
    const stopHold = () => {
        clearTimeout(delay); clearInterval(repeat);
        const button = heldButton, pointer = heldPointer; heldButton = null; heldPointer = null;
        if (button?.hasPointerCapture?.(pointer)) button.releasePointerCapture(pointer);
    };
    const blurNumbers = () => {if (focusedNumber) focusedNumber.blur(); pointers.clear(); stopHold();};
    const sync = () => {
        const current = tank(); if (!current) return;
        for (const field of fields) {
            const value = field.key === 'angle' ? tankAimAngle(current) : current.power;
            field.slider.value = value;
            if (document.activeElement !== field.number) field.number.value = value;
        }
    };
    const setValue = (key, value) => {
        if (!allowed() || !Number.isFinite(value)) return;
        const current = tank();
        if (key === 'angle') {current.turret.setRelativeRotation((90 - normalizeAimAngle(value)) * Math.PI / 180 - current.rotation); hud.crossAir.visibleTime = 60;}
        else current.setPower(Math.round(value));
        scene.hideTurnPointer(); sync();
    };
    const addField = (key, label, max, unit) => {
        const row = document.createElement('div'); row.className = 'mobile-aim-row';
        const valueBox = document.createElement('div'); valueBox.className = 'mobile-aim-value';
        const caption = document.createElement('label'); caption.htmlFor = `mobile-aim-${key}`; caption.textContent = `${label} ${unit}`;
        const number = document.createElement('input'); number.id = caption.htmlFor; number.type = 'number'; number.inputMode = 'numeric';
        number.min = key === 'angle' ? '0' : '1'; number.max = String(max); number.step = '1';
        number.setAttribute('aria-label', label); number.setAttribute('enterkeyhint', 'done'); valueBox.append(caption, number);
        const slider = document.createElement('input'); slider.type = 'range'; slider.min = number.min; slider.max = number.max; slider.step = '1';
        slider.setAttribute('aria-label', `${label} slider`);
        const stepButton = direction => {
            const button = makeButton(`${direction > 0 ? 'Increase' : 'Decrease'} ${key}`, direction > 0 ? '+' : '−');
            const step = () => {if (!allowed()) {stopHold(); return;} const current=tank(); setValue(key, (key === 'angle' ? tankAimAngle(current) : current.power) + direction);};
            button.addEventListener('pointerdown', event => {
                if (!allowed() || (event.button !== undefined && event.button !== 0)) return;
                event.preventDefault(); stopHold(); heldButton=button; heldPointer=event.pointerId; button.setPointerCapture?.(event.pointerId);
                step(); delay=setTimeout(() => {step(); repeat=setInterval(step,75);},350);
            });
            for (const event of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(event,stopHold);
            button.addEventListener('click',event => {if (event.detail === 0) step();}); return button;
        };
        const minus=stepButton(-1),plus=stepButton(1); row.append(valueBox,minus,slider,plus); controls.append(row);
        fields.push({key,number,slider,minus,plus});
        number.addEventListener('input',()=>{if(number.value!=='')setValue(key,Number(number.value));});
        number.addEventListener('focus',()=>{focusedNumber=number;keyboardWasEnabled=scene.input.keyboard.enabled;scene.input.keyboard.resetKeys?.();scene.input.keyboard.enabled=false;});
        number.addEventListener('blur',()=>{if(tank())number.value=key==='angle'?tankAimAngle(tank()):tank().power;if(focusedNumber===number){focusedNumber=null;scene.input.keyboard.resetKeys?.();scene.input.keyboard.enabled=keyboardWasEnabled;}});
        number.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();number.blur();}});
        slider.addEventListener('input',()=>setValue(key,Number(slider.value)));
    };
    addField('angle','Angle',359,'°'); addField('power','Power',100,'%');
    const refresh = () => {
        root.hidden=!visible(); if(root.hidden)blurNumbers();
        const enabled=!!allowed(),current=tank();
        if(!enabled)stopHold();
        for(const field of fields)for(const element of [field.number,field.slider,field.minus,field.plus])element.disabled=!enabled;
        ammo.disabled=!enabled; left.disabled=right.disabled=!enabled||!current?.movesRemaining;
        fire.disabled=!canFireShot(hud); if(fire.disabled||root.hidden)fireGesture.cancel();
        const key=`${scene.activeTank}:${current?.weapons.map(weapon=>`${weapon.id}:${weapon.name}`).join('|')}`;
        if(key!==inventoryKey){inventoryKey=key;ammo.replaceChildren();current?.weapons.forEach((weapon,index)=>{const option=document.createElement('option');option.value=index;option.textContent=weapon.name;ammo.append(option);});if(!current?.weapons.length){const option=document.createElement('option');option.textContent='No weapons';ammo.append(option);}}
        if(current)ammo.value=String(current.selectedWeapon);
        description.textContent=enabled?(hud.weaponDescription?.text||''):'Waiting for your turn';
        left.title=right.title=`${current?.movesRemaining||0} moves remaining`;
        sync();
        const canvas=scene.game.canvas?.getBoundingClientRect();
        if(canvas){
            const position=[canvas.left,canvas.top+canvas.height*2/3,canvas.width].join(':');
            if(position!==lastPosition){
                lastPosition=position;root.style.left=`${canvas.left}px`;root.style.top=`${canvas.top+canvas.height*2/3}px`;root.style.width=`${canvas.width}px`;
                const compact=canvas.width<520&&!(window.innerWidth>window.innerHeight&&canvas.width>=360);
                root.classList.toggle('compact',compact);
                root.classList.toggle('dense',window.innerHeight-(canvas.top+canvas.height*2/3)<(compact?175:125));
            }
        }
    };
    const fireGesture=bindTapToFire(fire,{canFire:()=>canFireShot(hud),onFire:()=>hud.fire(),key:()=>`${scene.activeTank}:${scene.onlineMatchId}:${scene.onlineTurnNumber}:${tank()?.selectedWeapon}`});
    ammo.addEventListener('change',()=>{if(!allowed())return;const index=Number(ammo.value);if(!tank()?.weapons[index])return;tank().selectedWeapon=index;hud.weaponScrollDisplay.setActive(index);hud.reset();});
    left.addEventListener('click',()=>{if(allowed()&&tank()?.movesRemaining){tank().stepLeft();if(scene.sceneData.gameType===3)window.socket.emit('stepLeft',{});}});
    right.addEventListener('click',()=>{if(allowed()&&tank()?.movesRemaining){tank().stepRight();if(scene.sceneData.gameType===3)window.socket.emit('stepRight',{});}});
    menu.addEventListener('click',()=>{blurNumbers();scene.showExitMenu();refresh();});
    root.addEventListener('pointerdown',event=>{if(event.target.closest('.mobile-aim-row'))pointers.add(event.pointerId);});
    const release=event=>pointers.delete(event.pointerId);
    for(const event of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(event,release,true);
    const stop=event=>event.stopPropagation();
    for(const event of ['pointerdown','pointerup','pointermove','keydown','keyup'])root.addEventListener(event,stop);
    const hide=()=>{blurNumbers();fireGesture.cancel();root.hidden=true;};
    const onVisibility=()=>document.hidden?hide():refresh();
    scene.events.on('pause',hide);scene.events.on('resume',refresh);
    document.addEventListener('visibilitychange',onVisibility);window.addEventListener('blur',hide);
    const destroy=()=>{if(disposed)return;hide();disposed=true;fireGesture.destroy();root.remove();scene.events.off('pause',hide);scene.events.off('resume',refresh);scene.events.off('shutdown',destroy);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('blur',hide);};
    scene.events.once('shutdown',destroy);refresh();
    return {element:root,refresh,destroy,open:refresh,close:blurNumbers,get isOpen(){return false;},get isEditing(){return !!focusedNumber||pointers.size>0;}};
};
