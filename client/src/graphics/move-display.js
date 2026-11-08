import { drawPanel } from './panel';
import { HUD } from "../classes/HUD"

/**
 * @param {CanvasRenderingContext2D} ctx 
 */

const drawMoveFrame = (ctx, width, height, scene) => {
    drawPanel(ctx, width, height, 'Drive', 18);
}


/**
 * @param {CanvasRenderingContext2D} ctx 
 */

const drawArrow = (ctx, width, height, angle, scene) => {
    drawPanel(ctx,width,height);
    ctx.fillStyle='#c8d9cd'; ctx.textAlign='center'; ctx.font='18px Arial';
    ctx.fillText(angle === Math.PI ? '‹' : '›',width/2,height*.72);
}


/**
 * @param {HUD} hud 
 */

export const createMoveDisplay = (hud) => {
    var w = 60
    var h = 60

    var [moveBtn, moveDisplayText, moveLeftBtn, moveRightBtn] = drawMoveDisplay(hud.scene, hud.width * 1/4, hud.height * 9/12, w, h)

    moveRightBtn.on('pointerdown', () => {
        if (hud.mouseLocked === true) return

        hud.scene.sound.play('click', {volume: 0.3})
        hud.scene.hideTurnPointer()
        if (hud.scene.activeTank === 1) {
            hud.scene.tank1.stepRight()
            window.socket.emit('stepRight', {})
        }
        else if (hud.scene.activeTank === 2) {
            hud.scene.tank2.stepRight()
            window.socket.emit('stepRight', {})
        }
    })

    moveLeftBtn.on('pointerdown', () => {
        if (hud.mouseLocked === true) return

        hud.scene.sound.play('click', {volume: 0.3})
        hud.scene.hideTurnPointer()
        if (hud.scene.activeTank === 1) {
            hud.scene.tank1.stepLeft()
            window.socket.emit('stepLeft', {})
            
        }
        else if (hud.scene.activeTank === 2) {
            hud.scene.tank2.stepLeft()
            window.socket.emit('stepLeft', {})
        }
    })

    hud.moveDisplayText = moveDisplayText
}


export const drawMoveDisplay = (scene, x, y, w = 60, h = 60) => {
    var moveDisplay = scene.add.container(x, y)

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d')

    if (!scene.game.device.os.desktop) {
        h = h * 1.3
        w = w * 1.3
    }

    canvas.height = h
    canvas.width = w

    drawMoveFrame(ctx, canvas.width, canvas.height, scene)
    if (scene.textures.exists('move-display')) scene.textures.remove('move-display')
    scene.textures.addCanvas('move-display', canvas);

    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d')
    canvas.height = h
    canvas.width = w
    drawArrow(ctx, canvas.width, canvas.height, 0, scene)
    if (scene.textures.exists('move-display-right')) scene.textures.remove('move-display-right')
    scene.textures.addCanvas('move-display-right', canvas);

    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d')
    canvas.height = h
    canvas.width = w
    drawArrow(ctx, canvas.width, canvas.height, Math.PI, scene)
    if (scene.textures.exists('move-display-left')) scene.textures.remove('move-display-left')
    scene.textures.addCanvas('move-display-left', canvas);
    
    var moveBtn = scene.add.image(0, 0, 'move-display')
    moveDisplay.add(moveBtn)
    moveDisplay.setDepth(6)
    moveBtn.setInteractive();

    var moveRightBtn = scene.add.image(w/2, 0, 'move-display-right')
    moveDisplay.add(moveRightBtn)
    moveRightBtn.setInteractive().setOrigin(0, 0.5);

    var moveLeftBtn = scene.add.image(-w/2, 0, 'move-display-left')
    moveDisplay.add(moveLeftBtn)
    moveLeftBtn.setInteractive().setOrigin(1,0.5);

    var moveDisplayText = scene.add.text(0, -h/2 + h * 4/9 + h * 5/18, '4').setOrigin(0.5).setFont('26px Geneva')
    if (!scene.game.device.os.desktop){
        moveDisplayText.setFontSize(36)
    }
    moveDisplay.add(moveDisplayText)

    return [moveBtn, moveDisplayText, moveLeftBtn, moveRightBtn]
}
