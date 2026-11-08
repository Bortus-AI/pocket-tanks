import { createPlayerNameInput } from '../../../graphics/player-name-input';
import { Display } from "phaser";
import { usernameArray } from "../../../utils/usernames";

/**
* @param {Phaser.Scene} scene
*/

export const type4 = (scene) => {
    const screenCenterX = scene.cameras.main.worldView.x + scene.cameras.main.width / 2;
    const screenCenterY = scene.cameras.main.worldView.y + scene.cameras.main.height / 2;
    const a = scene.add.text(screenCenterX, 100, 'PLAYER 1').setFontSize(50);

    const b = scene.add.text(screenCenterX, 200, 'NAME :  ').setFontSize(50);
    const c = createPlayerNameInput(scene, screenCenterX, 194, usernameArray[Math.floor(Math.random()*usernameArray.length)], {label: 'Player 1 name'});

    if (window.sdk === 'kongregate' && !window.kongregate.services.isGuest()) {
        var username = window.kongregate.services.getUsername()
        username = username.length < 16 ? username : username.substr(0, 15)
        c.setText(username)
    }

    const e = scene.add.text(screenCenterX, 300, 'COLOR :  ').setFontSize(50);
    const f = scene.add.text(screenCenterX, 300, '').setFontSize(50);

    [a,b,e,f].forEach((text) => { text.setFontFamily('"Days One"') })

    a.setOrigin(0.5, 0)
    b.setOrigin(1, 0)
    e.setOrigin(1, 0)
    f.setOrigin(0, 0)

    a.setColor('rgba(240,240,240,1)')
    strokeText(a, 6)
    b.setColor('rgba(180,180,180,1)')
    strokeText(b, 6)
    e.setColor('rgba(180,180,180,1)')
    strokeText(e, 6)

    var colors = []
    var colorValues = [0xFF0000, 0xFF9900, 0xFFFF00, 0x66FF33, 0x00FFFF, 0x0000FF, 0x9933FF, 0xCC0099]
    var selectedColor

    
    colors.push({ name: 'RED', box: scene.add.rectangle(screenCenterX - 350, 500, 100, 100)})
    colors.push({ name: 'ORANGE', box: scene.add.rectangle(screenCenterX - 250, 500, 100, 100)})
    colors.push({ name: 'YELLOW', box: scene.add.rectangle(screenCenterX - 150, 500, 100, 100)})
    colors.push({ name: 'GREEN', box: scene.add.rectangle(screenCenterX - 50, 500, 100, 100)})
    colors.push({ name: 'CYAN', box: scene.add.rectangle(screenCenterX + 50, 500, 100, 100)})
    colors.push({ name: 'BLUE', box: scene.add.rectangle(screenCenterX + 150, 500, 100, 100)})
    colors.push({ name: 'VIOLET', box: scene.add.rectangle(screenCenterX + 250, 500, 100, 100)})
    colors.push({ name: 'MAGENTA', box: scene.add.rectangle(screenCenterX + 350, 500, 100, 100)})

    colors.forEach((color, index) => {
        color.box.setInteractive()
        color.box.setFillStyle(colorValues[index], 1)
        color.box.on('pointerdown', () => {
            scene.sound.play('click', {volume: 0.3})
            f.setText(color.name)
            f.setColor(int2rgba(colorValues[index]))
            strokeText(f, 6)
            selectedColor = index
        })
    })

    // set random color
    selectedColor = (new Date()).getSeconds() % 8
    f.setText(colors[selectedColor].name)
    f.setColor(int2rgba(colorValues[selectedColor]))
    strokeText(f, 6)

    //
    const g = scene.add.text(screenCenterX, 700, 'CONTINUE').setFontSize(50);
    g.setFontFamily('"Days One"')
    g.setOrigin(0.5)
    g.setColor('rgba(255,255,0,1)')
    strokeText(g, 6)

    g.setInteractive()
    g.on('pointerdown', () => {
        scene.sound.play('click', {volume: 0.3})
        scene.scene.start('scene-4', {gameType: 4, player1: {name: c.text, color: colorValues[selectedColor]}})
    })
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
