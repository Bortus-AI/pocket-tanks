import { drawPanel } from './panel';
import { HUD } from "../classes/HUD"

/**
 * @param {CanvasRenderingContext2D} ctx 
 */

const drawPowerFrame = (ctx, width, height, scene) => {
    drawPanel(ctx, width, height, '', 0);
}

const drawPowerMeter = (ctx, width, height, percentage = 0, color) => {
    ctx.fillStyle = '#0d2029'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#77c8b7'
    if (color) {
        ctx.fillStyle = color
    }
    ctx.fillRect(0, 0, Math.max(Math.ceil(width * percentage/100), 1), height)
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

export const createPowerDisplay = (hud) => {
    var w = 200
    var h = 80

    var [powerBtn, powerDisplayText, powerMeter, powerLeftBtn, powerRightBtn] = drawPowerDisplay(hud.scene, hud.width * 3/4, hud.height * 10.8/12, w, h)

    hud.scene.add.text(hud.width * 3/4, hud.height * 10.8/12 - 58, 'POWER',{fontFamily:'Arial',fontSize:13,color:'#bdcec5'}).setOrigin(.5).setDepth(6)
    hud.powerDisplayText = powerDisplayText
    hud.powerMeter = powerMeter
    var powerSelectTimer = Date.now()

    var startDragPos = null

    const releasePointer = (e) => {
        if (powerBtn.getData('active') === true) {
            console.log('lift to select')

            if (startDragPos.clone().subtract(hud.scene.input.activePointer.position).length() > 2) {
                hud.scene.sound.play('click', {volume: 0.3})
                powerBtn.setData('active', false)
                hud.mouseLocked = false
                hud.scene.input.off('pointerup', releasePointer)
            }
        }
    }

    powerBtn.on('pointerdown', (e) => {
        if (hud.mobileAim) { hud.mobileAim.open(); return }
        if (hud.mouseLocked === true) return
        if (powerBtn.getData('active') === true) return
        hud.mouseLocked = true
        hud.scene.sound.play('click', {volume: 0.3})
        hud.scene.hideTurnPointer()
        //console.log(e.position, hud)
        powerBtn.setData('active', true)
        //powerBtn.setData('allowHide', false)
        startDragPos = hud.scene.input.activePointer.position.clone()
        hud.scene.input.on('pointerup', releasePointer)
        powerSelectTimer = Date.now()
    })

    powerRightBtn.on('pointerdown', () => {
        if (hud.mouseLocked === true) return
        hud.scene.sound.play('click', {volume: 0.3})

        hud.scene.hideTurnPointer()
        if (hud.scene.activeTank === 1) {
            hud.scene.tank1.setPower(hud.scene.tank1.power + 1)
        }
        else if (hud.scene.activeTank === 2) {
            hud.scene.tank2.setPower(hud.scene.tank2.power + 1)
        }
    })

    powerLeftBtn.on('pointerdown', () => {
        if (hud.mouseLocked === true) return

        hud.scene.sound.play('click', {volume: 0.3})
        hud.scene.hideTurnPointer()
        if (hud.scene.activeTank === 1) {
            hud.scene.tank1.setPower(hud.scene.tank1.power - 1)
        }
        else if (hud.scene.activeTank === 2) {
            hud.scene.tank2.setPower(hud.scene.tank2.power - 1)
        }
    })

    hud.powerMeter.refresh = () => {
        var curr = hud.scene.input.activePointer
        var prev = hud.scene.input.activePointer.prev ? hud.scene.input.activePointer.prev : hud.scene.input.activePointer.prevPosition
        var delX = (curr.x - prev.x)/2

        if (delX > 0) {
            delX = Math.ceil(delX)
        }
        else {
            delX = Math.floor(delX)
        }

        var canvas = powerMeter.texture.canvas
        var ctx = canvas.getContext('2d')
        var color = '#77c8b7'

        if (hud.scene.activeTank === 1) {
            if (powerBtn.getData('active') === true) {
                hud.scene.tank1.setPower(hud.scene.tank1.power + delX)
                hud.scene.input.activePointer.movementX = 0
                var g = Math.max(Math.floor((Date.now() - powerSelectTimer)/4)%300 - 150, -(Math.floor((Date.now() - powerSelectTimer)/4)%300) + 150)
                var b = Math.max(Math.floor((Date.now() - powerSelectTimer)/4)%200 - 100, -(Math.floor((Date.now() - powerSelectTimer)/4)%200) + 100)
                color = `rgba(230,${g},${b},1)`
            }
            //console.log(color)
        }
        else if (hud.scene.activeTank === 2) {
            if (powerBtn.getData('active') === true) {
                hud.scene.tank2.setPower(hud.scene.tank2.power + delX)
                hud.scene.input.activePointer.movementX = 0
                var g = Math.max(Math.floor((Date.now() - powerSelectTimer)/4)%300 - 150, -(Math.floor((Date.now() - powerSelectTimer)/4)%300) + 150)
                var b = Math.max(Math.floor((Date.now() - powerSelectTimer)/4)%200 - 100, -(Math.floor((Date.now() - powerSelectTimer)/4)%200) + 100)
                color = `rgba(230,${g},${b},1)`
            }
        }
        const tank = hud.scene.activeTank === 1 ? hud.scene.tank1 : hud.scene.activeTank === 2 ? hud.scene.tank2 : null
        const paintKey = tank ? `${tank.power}:${color}` : null
        if (tank && paintKey !== powerMeter.paintKey) {
            drawPowerMeter(ctx, canvas.width, canvas.height, tank.power, color)
            powerMeter.texture.refresh()
            powerMeter.paintKey = paintKey
        }
    }
}



export const drawPowerDisplay = (scene, x, y, w = 200, h = 80) => {
    var powerDisplay = scene.add.container(x, y)

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d')

    if (!scene.game.device.os.desktop) {
        h = h * 1.3
        w = w * 1.3
    }

    canvas.height = h
    canvas.width = w

    drawPowerFrame(ctx, canvas.width, canvas.height, scene)
    if (scene.textures.exists('power-display')) scene.textures.remove('power-display')
    scene.textures.addCanvas('power-display', canvas);

    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d')
    canvas.height = 30 * h / 80
    canvas.width = 30 * h / 80
    drawArrow(ctx, canvas.width, canvas.height, 0, scene)
    if (scene.textures.exists('power-display-right')) scene.textures.remove('power-display-right')
    scene.textures.addCanvas('power-display-right', canvas);

    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d')
    canvas.height = 30 * h / 80
    canvas.width = 30 * h / 80
    drawArrow(ctx, canvas.width, canvas.height, Math.PI, scene)
    if (scene.textures.exists('power-display-left')) scene.textures.remove('power-display-left')
    scene.textures.addCanvas('power-display-left', canvas);
    
    var powerBtn = scene.add.image(0, 0, 'power-display')
    powerDisplay.add(powerBtn)
    powerDisplay.setDepth(6)
    powerBtn.setInteractive();

    var powerRightBtn = scene.add.image(w/2, 0, 'power-display-right')
    powerDisplay.add(powerRightBtn)
    powerRightBtn.setInteractive().setOrigin(1,0);

    var powerLeftBtn = scene.add.image(-w/2 + w * 2/5, 0, 'power-display-left')
    powerDisplay.add(powerLeftBtn)
    powerLeftBtn.setInteractive().setOrigin(0,0);

    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d')
    canvas.height = h * 3/12
    canvas.width = w * 19/20
    drawPowerMeter(ctx, canvas.width, canvas.height, 60)

    if (scene.textures.exists('power-display-meter')) scene.textures.remove('power-display-meter')
    scene.textures.addCanvas('power-display-meter', canvas);
    var powerMeter = scene.add.image(0, -h/4, 'power-display-meter')
    powerDisplay.add(powerMeter)

    var powerDisplayText = scene.add.text(-w/2 + w * 2/5 + w * 3/10, h * 1/5, '60').setOrigin(0.5).setFont('20px Geneva')
    if (!scene.game.device.os.desktop){
        powerDisplayText.setFontSize(32)
    }
    powerDisplay.add(powerDisplayText)

    return [powerBtn, powerDisplayText, powerMeter, powerLeftBtn, powerRightBtn]
}
