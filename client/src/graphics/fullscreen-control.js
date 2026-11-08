// One control belongs to the game, rather than to the loading/menu scene.
// Browsers require a user gesture, so the first game tap is the default entry.
export const installFullscreenControl = game => {
    const button=document.createElement('button');
    button.type='button';button.id='game-fullscreen-toggle';button.textContent='⛶';
    button.setAttribute('aria-label','Enter fullscreen');
    document.body.append(button);
    let attempted=false,disposed=false;
    const isFullscreen=()=>!!(document.fullscreenElement||document.webkitFullscreenElement||game.scale.fullscreen?.active);
    const enter=()=>{attempted=true;try{game.scale.startFullscreen();}catch{button.title='Tap to try fullscreen again';}};
    const sync=()=>{
        if(disposed)return;
        const fullscreen=isFullscreen();
        if(fullscreen)attempted=true;
        button.setAttribute('aria-label',fullscreen?'Exit fullscreen':'Enter fullscreen');
        button.setAttribute('aria-pressed',String(fullscreen));
        button.title=fullscreen?'Exit fullscreen':'Enter fullscreen';
        const recovery=document.querySelector('#online-connection-status > div');
        const hud=document.querySelector('#mobile-aim-controls:not([hidden]) .mobile-combat-toolbar');
        if(recovery){
            if(button.parentNode!==recovery)recovery.append(button);
            button.className='fullscreen-recovery';button.removeAttribute('style');return;
        }
        if(hud){
            if(button.parentNode!==hud)hud.insertBefore(button,hud.querySelector('.mobile-aim-fire'));
            hud.classList.add('has-fullscreen-control');button.className='';button.removeAttribute('style');return;
        }
        if(button.parentNode!==document.body)document.body.append(button);
        button.className='fullscreen-standalone';
        const canvas=game.canvas?.getBoundingClientRect();button.hidden=!canvas;if(!canvas)return;
        const main=game.scene?.isActive('main-scene');
        const size=main&&game.device.os.desktop?Math.min(44,canvas.height*.05):44;
        button.style.width=`${size}px`;button.style.height=`${size}px`;
        button.style.left=`${main?canvas.left+canvas.width*.5-size/2:canvas.right-size-8}px`;
        button.style.top=`${main?canvas.top+canvas.height*.85-size/2:canvas.top+8}px`;
    };
    const toggle=()=>{attempted=true;if(isFullscreen())game.scale.stopFullscreen();else enter();sync();};
    const firstTap=event=>{
        if(attempted||event.target===button||!event.isTrusted)return;
        if(!event.target?.closest?.('#game canvas, #mobile-aim-controls button, #online-connection-status .resume-match'))return;
        enter();
    };
    const stop=event=>event.stopPropagation();
    button.addEventListener('click',toggle);
    for(const event of ['pointerdown','pointerup','keydown','keyup'])button.addEventListener(event,stop);
    document.addEventListener('pointerup',firstTap,true);
    document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);
    game.events.on('poststep',sync);
    const destroy=()=>{
        if(disposed)return;disposed=true;button.remove();
        document.removeEventListener('pointerup',firstTap,true);
        document.removeEventListener('fullscreenchange',sync);document.removeEventListener('webkitfullscreenchange',sync);
        game.events.off('poststep',sync);game.events.off('destroy',destroy);
    };
    game.events.once('destroy',destroy);sync();
    const control={button,sync,destroy};game.fullscreenControl=control;return control;
};
