import { requestOnlineShot } from '../socket/session';
import { canFireShot } from './fire-control-state';

/**
 * @param {CanvasRenderingContext2D} ctx 
 */

const drawFireFrame = (ctx, width, height, scene) => {
    ctx.fillStyle = '#e7b17b'
    ctx.beginPath(); ctx.roundRect(1,1,width-2,height-2,8); ctx.fill()
    ctx.fillStyle = '#172f37'; ctx.textAlign = 'center'
    ctx.font = 'bold 23px Arial'
    ctx.fillText('FIRE  ↗', width/2, height/2 + 8)

}


export const createFireButton = (hud) => {
    var x = hud.height * 9/12
    var y = hud.width * 1/2

    var h = 60
    var w = 160
    
    var fireButton = drawFireBtn(hud.scene, x, y, h, w)[0]

    const fire = async () => {
        if (!canFireShot(hud)) return {ok:false, blocked:true}
        const scene = hud.scene, tank = scene.activeTank === 1 ? scene.tank1 : scene.tank2
        if (scene.sceneData.gameType === 3) {
            const shot = {selectedWeapon:tank.selectedWeapon, power:tank.power,
                rotation:tank.turret.relativeRotation, rotation1:scene.tank1.rotation, rotation2:scene.tank2.rotation,
                position1:{x:scene.tank1.x,y:scene.tank1.y}, position2:{x:scene.tank2.x,y:scene.tank2.y}}
            hud.shotRequestPending = true
            let grant
            try {
                grant = await requestOnlineShot(scene, shot)
            } catch (error) {
                return {ok:false,message:error.message}
            } finally {hud.shotRequestPending = false}
            if (!grant?.ok || grant.duplicate) return grant
            if (scene.HUD !== hud || !scene.scene.isActive() || scene.activeTank !== 1 || !tank.active ||
                window.onlineSession?.paused || window.onlineSession?.restoring || scene.onlineShotId !== grant.shotId) return {...grant,deferred:true}
            tank.selectedWeapon = shot.selectedWeapon
            tank.setPower(shot.power)
            tank.turret.setRelativeRotation(shot.rotation)
        }
        scene.sound.play('click', {volume:.3})
        scene.hideTurnPointer()
        const fired = tank.shoot() !== false
        if (fired) {hud.disable();hud.mobileAim?.refresh()}
        return {ok:fired}
    }

    // Only a fresh press released inside the button counts. Dragging across it
    // while aiming never starts a shot.
    let press
    fireButton.on('pointerdown', pointer => {
        if (!pointer || !canFireShot(hud)) return
        press = {id:pointer.id,x:pointer.x,y:pointer.y}
    })
    fireButton.on('pointerout', () => {press = null})
    fireButton.on('pointerup', pointer => {
        const previous = press; press = null
        if (!previous || previous.id !== pointer?.id || Math.hypot(pointer.x-previous.x,pointer.y-previous.y) > 10) return
        fire()
    })
    const release = () => {press = null}
    hud.scene.input.on('pointerup', release)
    hud.scene.input.on('gameout', release)
    hud.scene.events.once('shutdown', () => {hud.scene.input.off('pointerup', release);hud.scene.input.off('gameout', release)})
    hud.scene.input.keyboard.on('keydown-SPACE', event => {if (!event?.repeat) fire()})
    hud.fire = fire
    hud.canvasFireButton = fireButton
}

export const drawFireBtn = (scene, x, y, h = 60, w = 160) => {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d')

    if (!scene.game.device.os.desktop) {
        h = h * 1.3
        w = w * 1.3
    }

    canvas.height = h
    canvas.width = w

    drawFireFrame(ctx, canvas.width, canvas.height, scene)

    if (scene.textures.exists('fireButton')) scene.textures.remove('fireButton')
    scene.textures.addCanvas('fireButton', canvas);
    
    var fireButton = scene.add.image(x, y, 'fireButton')
    fireButton.setDepth(6)
    fireButton.setInteractive();
    
    return [fireButton]
}
