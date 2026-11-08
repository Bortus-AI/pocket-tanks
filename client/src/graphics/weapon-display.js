import { fitWeaponName, weaponIconTexture } from '../weapons/expansion/presentation';
import { drawPanel } from './panel';
import { HUD } from "../classes/HUD"
import { ScrollList } from "../classes/ScrollList"
import { weaponArray } from "../weapons/array"

/**
 * @param {CanvasRenderingContext2D} ctx 
 */
const drawWeaponBox = (ctx, width, height, scene) => {
    drawPanel(ctx, width, height, 'Arsenal', 19);
}


/**
 * @param {CanvasRenderingContext2D} ctx 
 */

const drawWeaponScrollBox = (ctx, width, height, scene) => {
    drawPanel(ctx, width, height, 'SELECT WEAPON', 19);

}


/**
 * @param {CanvasRenderingContext2D} ctx 
 */

const drawArrow = (ctx, width, height, angle) => {
    
}


/**
 * @param {HUD} hud 
 */

export const createWeaponDisplay = (hud) => {
    var w = 220
    var h = 80
    
    var [weaponBox, weaponName, weaponLogo, weaponDisplayBackground] = drawWeaponDisplay(hud.scene, hud.width * 1/4, hud.height * 10.6/12, w, h)
    hud.weaponBox = weaponBox
    hud.weaponName = weaponName

    createWeaponScrollDisplay(hud, weaponLogo)
}

const createWeaponScrollDisplay = (hud, weaponLogo) => {
    var w = 340
    var h = 280

    if (!hud.scene.game.device.os.desktop) {
        w = w * 1.3
        h = h * 1.3
    }

    hud.weaponScrollDisplay = new ScrollList(hud.scene, hud.weaponName, hud.weaponBox, weaponLogo)

    var scrollContainer = hud.scene.add.container(hud.width * 1/4, hud.height * 11/12 - h * 1/3)
    scrollContainer.setDepth(20)

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d')

    canvas.height = h
    canvas.width = w

    drawWeaponScrollBox(ctx, canvas.width, canvas.height, hud.scene)
    if (hud.scene.textures.exists('weapon-scroll-box')) hud.scene.textures.remove('weapon-scroll-box')
    hud.scene.textures.addCanvas('weapon-scroll-box', canvas);

    hud.weaponScrollDisplay.scrollBox = hud.scene.add.image(0, 0, 'weapon-scroll-box').setOrigin(0.5)
    scrollContainer.add(hud.weaponScrollDisplay.scrollBox)

    hud.weaponScrollDisplay.scrollBackground = hud.scene.add.rectangle(0, h/24, w - w/12, h - h/6, 0x122b35)
    scrollContainer.add(hud.weaponScrollDisplay.scrollBackground)

    hud.weaponScrollDisplay.tileHeight = h/3 - h/6

    hud.weaponScrollDisplay.create()
}


export const drawWeaponDisplay = (scene, x, y, w = 220, h = 80) => {
    var weaponContainer = scene.add.container(x, y)
    weaponContainer.setDepth(6)

    if (!scene.game.device.os.desktop) {
        h = h * 1.3
        w = w * 1.3
    }

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d')

    canvas.height = h
    canvas.width = w

    drawWeaponBox(ctx, canvas.width, canvas.height, scene)
    if (scene.textures.exists('weapon-box')) scene.textures.remove('weapon-box')
    scene.textures.addCanvas('weapon-box', canvas);

    var weaponBox = scene.add.image(0, 0, 'weapon-box')
    weaponContainer.add(weaponBox)

    var innerW = w - w/12
    var innerH = h - h/2
    var weaponDisplay = scene.add.container(0, h/8)
    const tank = scene.activeTank === 2 ? scene.tank2 : scene.tank1
    const entry = weaponArray[tank?.weapons?.[tank.selectedWeapon]?.id] || weaponArray[0]
    const key = weaponIconTexture(scene, entry)
    const logoCanvas = entry.logoCanvas

    var margin = (innerH - logoCanvas.height * ((innerH/logoCanvas.height) * 0.9))/2
    var weaponLogo = scene.add.image(-(w - w/12)/2 + margin, 0, key)
    weaponLogo.setOrigin(0, 0.5).setScale(innerH/weaponLogo.height * 0.9, innerH/weaponLogo.height * 0.9)

    var weaponDisplayBackground = scene.add.rectangle(0, 0, w - w/12, h - h/2, 0x122b35).setOrigin(0.5)
    weaponDisplay.add(weaponDisplayBackground)
    weaponDisplay.setDepth(15)

    weaponDisplay.add(weaponLogo)

    const iconSize = innerH * .8
    weaponLogo.setDisplaySize(iconSize, iconSize)
    const textWidth = innerW - iconSize - 16
    const weaponName = scene.add.text(-innerW/2 + iconSize + 10, 0, entry.name, {fontFamily:'Arial',fontSize:18,color:'#e2e8d6'}).setOrigin(0,.5)
    weaponName.setData('maxWidth', textWidth)
    fitWeaponName(weaponName,textWidth,scene.game.device.os.desktop?18:24)
    weaponDisplay.add(weaponName)

    weaponContainer.add(weaponDisplay)

    weaponBox.setInteractive()

    return [weaponBox, weaponName, weaponLogo, weaponDisplayBackground]
}