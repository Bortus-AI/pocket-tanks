import { drawPanel } from './panel';
import { HUD } from "../classes/HUD"
import Phaser from "phaser"

/**
 * @param {CanvasRenderingContext2D} ctx 
 */

const drawAngleFrame = (ctx, width, height, scene) => {
    drawPanel(ctx, width, height, 'Elevation', 38);
}


/**
 * @param {CanvasRenderingContext2D} ctx 
 */

 const drawCrossair = (ctx, width, height) => {
    // ctx.textAlign = 'center'
    // ctx.fillStyle = 'rgba(255,255,255,1)'
    // ctx.font = '16px Arial'
    // ctx.fillText('o', width/2, height * 3/4)
    ctx.fillStyle = 'rgba(240,240,240,1)'
    ctx.moveTo(width/2, height * 2/5)
    ctx.lineTo(width/2 - width/20, height/8)
    ctx.arcTo(width/2, 0, width/2 + width/20, height/8, height/16)
    ctx.closePath()
    ctx.fill()

    ctx.moveTo(width * 3/5 - 1, height/2)
    ctx.lineTo(width * 7/8, height/2 - height/20)
    ctx.arcTo(width, height/2, width * 7/8, height/2 + height/20, width/16)
    ctx.closePath()
    ctx.fill()

    ctx.moveTo(width/2, height * 3/5)
    ctx.lineTo(width/2 - width/20, height * 7/8)
    ctx.arcTo(width/2, height, width/2 + width/20, height * 7/8, height/16)
    ctx.closePath()
    ctx.fill()

    ctx.moveTo(width * 2/5 + 1, height/2)
    ctx.lineTo(width * 1/8, height/2 - height/20)
    ctx.arcTo(0, height/2, width * 1/8, height/2 + height/20, width/16)
    ctx.closePath()
    ctx.fill()
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

export const createAngleDisplay = (hud) => {
    var h = 90, w = 120

    var [angleBtn, angleLeftBtn, angleRightBtn, angleDisplayText] = drawAngleDisplay(hud.scene, hud.width * 3/4, hud.height * 9/12, h, w)
    
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d')
    canvas.height = 30 
    canvas.width = 30
    drawCrossair(ctx, canvas.width, canvas.height, Math.PI)
    if (hud.scene.textures.exists('angle-aim-display')) hud.scene.textures.remove('angle-aim-display')
    hud.scene.textures.addCanvas('angle-aim-display', canvas);

    const crossAirRadius = 80
    hud.crossAir = hud.scene.add.image(0, 0, 'angle-aim-display')
    hud.crossAir.setDepth(7).setVisible(false)
    hud.crossAir.setData('toShow', false)


    const releasePointer = () => {
        if (hud.crossAir.getData('toShow') === true) {
            if (hud.crossAir.getData('allowHide') === false) {
                hud.crossAir.setData('allowHide', true)
                //hud.mouseLocked = false
            }
            else {
                hud.scene.sound.play('click', {volume: 0.3})
                hud.crossAir.setVisible(false)
                hud.crossAir.setData('toShow', false)
                hud.mouseLocked = false
                hud.scene.input.off('pointerup', releasePointer)
            }
        }
    }

    angleBtn.on('pointerdown', (e) => {
        if (hud.mobileAim) { hud.mobileAim.open(); return }
        if (hud.mouseLocked === true) return
        if (hud.crossAir.getData('toShow') === true) return
        hud.mouseLocked = true

        hud.scene.sound.play('click', {volume: 0.3})
        hud.scene.hideTurnPointer()

        if (hud.scene.activeTank === 1) {
            hud.scene.input.on('pointerup', releasePointer)
            hud.crossAir.setVisible(true)
            hud.crossAir.setData('allowHide', false)
            hud.crossAir.setData('toShow', true)
            var alpha = hud.scene.tank1.turret.rotation
            hud.crossAir.setPosition(hud.scene.tank1.turret.x + crossAirRadius * Math.sin(alpha), hud.scene.tank1.turret.y - crossAirRadius * Math.cos(alpha))
            
        }
        else if (hud.scene.activeTank === 2) {
            hud.scene.input.on('pointerup', releasePointer)
            hud.crossAir.setVisible(true)
            hud.crossAir.setData('toShow', true)
            hud.crossAir.setData('allowHide', false)
            var alpha = hud.scene.tank2.turret.rotation
            hud.crossAir.setPosition(hud.scene.tank2.turret.x + crossAirRadius * Math.sin(alpha), hud.scene.tank2.turret.y - crossAirRadius * Math.cos(alpha)) 
        }
    })


    hud.crossAir.refresh = () => {
        if (hud.crossAir.visibleTime && hud.crossAir.visibleTime > 0) {
            hud.crossAir.setVisible(true)
            hud.crossAir.visibleTime--

            var tank = hud.scene.activeTank === 1 ? hud.scene.tank1 : hud.scene.tank2
            hud.crossAir.setPosition(tank.turret.x + crossAirRadius * Math.cos(tank.turret.rotation - Math.PI/2), tank.turret.y + crossAirRadius * Math.sin(tank.turret.rotation - Math.PI/2))
        }
        else {
            hud.crossAir.setVisible(false)
        }
        
        if (hud.crossAir.getData('toShow') === true) {
            hud.crossAir.setVisible(true)
        }
    

        if (hud.scene.activeTank === 1 && hud.crossAir.getData('toShow')) {
            var prevX, prevY, currX, currY, vec1, vec2, angle, sign;
            prevX = hud.crossAir.x
            prevY = hud.crossAir.y

            var delX = hud.scene.input.activePointer.x - hud.scene.input.activePointer.prevPosition.x
            var delY = hud.scene.input.activePointer.y - hud.scene.input.activePointer.prevPosition.y

            hud.crossAir.setPosition(hud.crossAir.x + delX, hud.crossAir.y + delY)
            Phaser.Actions.RotateAroundDistance([hud.crossAir], {x: hud.scene.tank1.turret.x, y: hud.scene.tank1.turret.y}, 0, crossAirRadius)

            currX = hud.crossAir.x
            currY = hud.crossAir.y
            vec1 = new Phaser.Math.Vector2(currX - hud.scene.tank1.turret.x, currY - hud.scene.tank1.turret.y)
            vec2 = new Phaser.Math.Vector2(prevX - hud.scene.tank1.turret.x, prevY - hud.scene.tank1.turret.y)
            angle = Math.acos(vec1.dot(vec2) / (vec1.length()*vec2.length()))
            if (isNaN(angle)) return
            sign = vec1.cross(vec2)
            angle = sign >= 0 ? -angle : angle 
            
            hud.scene.tank1.turret.setRelativeRotation(hud.scene.tank1.turret.relativeRotation + angle)
        }

        else if (hud.scene.activeTank === 2 && hud.crossAir.getData('toShow')) {
            var prevX, prevY, currX, currY, vec1, vec2, angle;
            prevX = hud.crossAir.x
            prevY = hud.crossAir.y

            var delX = hud.scene.input.activePointer.x - hud.scene.input.activePointer.prevPosition.x
            var delY = hud.scene.input.activePointer.y - hud.scene.input.activePointer.prevPosition.y

            hud.crossAir.setPosition(hud.crossAir.x + delX, hud.crossAir.y + delY)
            Phaser.Actions.RotateAroundDistance([hud.crossAir], {x: hud.scene.tank2.turret.x, y: hud.scene.tank2.turret.y}, 0, crossAirRadius)

            currX = hud.crossAir.x
            currY = hud.crossAir.y

            vec1 = new Phaser.Math.Vector2(currX - hud.scene.tank2.turret.x, currY - hud.scene.tank2.turret.y)
            vec2 = new Phaser.Math.Vector2(prevX - hud.scene.tank2.turret.x, prevY - hud.scene.tank2.turret.y)

            angle = Math.acos(vec1.dot(vec2) / (vec1.length()*vec2.length()))
            if (isNaN(angle)) return
            sign = vec1.cross(vec2)
            angle = sign >= 0 ? -angle : angle
            
            hud.scene.tank2.turret.setRelativeRotation(hud.scene.tank2.turret.relativeRotation + angle)
        }
    }

    angleRightBtn.on('pointerdown', () => {
        if (hud.mouseLocked === true) return
        hud.scene.sound.play('click', {volume: 0.3})
        hud.crossAir.visibleTime = 60

        hud.scene.hideTurnPointer()
        if (hud.scene.activeTank === 1) {
            hud.scene.tank1.turret.setRelativeRotation(hud.scene.tank1.turret.relativeRotation + Math.PI/180)
        }
        else if (hud.scene.activeTank === 2) {
            hud.scene.tank2.turret.setRelativeRotation(hud.scene.tank2.turret.relativeRotation + Math.PI/180)
        }
    })

    angleLeftBtn.on('pointerdown', () => {
        if (hud.mouseLocked === true) return
        hud.scene.sound.play('click', {volume: 0.3})
        hud.crossAir.visibleTime = 60

        hud.scene.hideTurnPointer()
        if (hud.scene.activeTank === 1) {
            hud.scene.tank1.turret.setRelativeRotation(hud.scene.tank1.turret.relativeRotation - Math.PI/180)
        }
        else if (hud.scene.activeTank === 2) {
            hud.scene.tank2.turret.setRelativeRotation(hud.scene.tank2.turret.relativeRotation - Math.PI/180)
        }
    })

    hud.angleDisplayText = angleDisplayText
    
}


/**
 * 
 * @param {Phaser.Scene} scene 
 * @param {*} x 
 * @param {*} y 
 * @param {*} h 
 * @param {*} w 
 * @returns 
 */
export const drawAngleDisplay = (scene, x, y, h = 90, w = 120) => {
    if (!scene.game.device.os.desktop) {
        h = h * 1.3
        w = w * 1.3
    }

    var angleDisplay = scene.add.container(x, y)
    var arrowBoxSize = 30 * h / 90

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d')

    canvas.height = h
    canvas.width = w

    drawAngleFrame(ctx, canvas.width, canvas.height, scene)
    if (scene.textures.exists('angle-display')) scene.textures.remove('angle-display')
    scene.textures.addCanvas('angle-display', canvas);

    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d')
    canvas.height = arrowBoxSize 
    canvas.width = arrowBoxSize
    drawArrow(ctx, canvas.width, canvas.height, 0, scene)
    if (scene.textures.exists('angle-display-right')) scene.textures.remove('angle-display-right')
    scene.textures.addCanvas('angle-display-right', canvas);

    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d')
    canvas.height = arrowBoxSize 
    canvas.width = arrowBoxSize
    drawArrow(ctx, canvas.width, canvas.height, Math.PI, scene)
    if (scene.textures.exists('angle-display-left')) scene.textures.remove('angle-display-left')
    scene.textures.addCanvas('angle-display-left', canvas);

    var angleBtn = scene.add.image(0, 0, 'angle-display')
    angleDisplay.add(angleBtn)
    angleDisplay.setDepth(6)
    angleBtn.setInteractive();

    var angleRightBtn = scene.add.image(w/2, h/2, 'angle-display-right')
    angleDisplay.add(angleRightBtn)
    angleRightBtn.setInteractive().setOrigin(1,1);

    var angleLeftBtn = scene.add.image(-w/2, h/2, 'angle-display-left')
    angleDisplay.add(angleLeftBtn)
    angleLeftBtn.setInteractive().setOrigin(0,1);

    var angleDisplayText = scene.add.text(0, h/3, '90' + String.fromCharCode(176)).setOrigin(0.5).setFont('18px Geneva')
    if (!scene.game.device.os.desktop){
        angleDisplayText.setFontSize(32)
    }
    angleDisplay.add(angleDisplayText)

    return [angleBtn, angleLeftBtn, angleRightBtn, angleDisplayText]
}
