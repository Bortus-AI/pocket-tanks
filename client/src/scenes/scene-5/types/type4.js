import { weaponArray } from "../../../weapons/array";
import { Display } from "phaser";


/**
* @param {Phaser.Scene} scene
*/

export const type4 = (scene) => {
    scene.player1 = scene.sceneData.player1
    scene.player2 = scene.sceneData.player2

    scene.player1.weapons = []
    scene.player2.weapons = []

    weaponArray.forEach((weapon) => {
        scene.player1.weapons.push({id: weapon.id, name: weapon.name, type: weapon.type})
        scene.player2.weapons.push({id: weapon.id, name: weapon.name, type: weapon.type})
    })

    scene.scene.start('main-scene', {gameType: 4, player1: scene.player1, player2: scene.player2})
}


const int2rgba = (colorInt) => {
    var rgba = new Display.Color.IntegerToRGB(colorInt)
    var rgbaString = 'rgba(' + rgba.r + ',' + rgba.g + ',' + rgba.b + ',' + rgba.a + ')'
    return rgbaString
}

const strokeText = (txt, thickness) => {
    var re = /rgba\((\d+),(\d+),(\d+),(\d+)\)/
    var match = new RegExp(re).exec(txt.style.color)
    var r, g, b, a, k = 0.7;
    r = parseInt(match[1])
    g = parseInt(match[2])
    b = parseInt(match[3])
    a = parseInt(match[4])

    r = Math.ceil(r * k)
    g = Math.ceil(g * k)
    b = Math.ceil(b * k)

    txt.setStroke('rgba(' + r + ',' + g + ',' + b + ',' + a + ')', thickness)
}
