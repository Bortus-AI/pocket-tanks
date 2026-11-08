import { attachDraftPreview } from '../../../weapons/expansion/draft-preview';
import { weaponIconTexture } from '../../../weapons/expansion/presentation';
import { weaponArray } from "../../../weapons/array";
import { Display } from "phaser";


/**
* @param {Phaser.Scene} scene
*/

export const type2 = (scene) => {
    const totalWeapons = 20

    scene.player1 = scene.sceneData.player1
    scene.player2 = scene.sceneData.player2

    const screenCenterX = scene.cameras.main.worldView.x + scene.cameras.main.width / 2;
    const screenCenterY = scene.cameras.main.worldView.y + scene.cameras.main.height / 2;
    const a = scene.add.text(screenCenterX / 2 - 150, 170, scene.player1.name);
    const b = scene.add.text(screenCenterX * 3/2 + 150, 170, scene.player2.name);

    a.setFontFamily('"Days One"')
    b.setFontFamily('"Days One"')
    a.setColor(int2rgba(scene.player1.color))
    b.setColor(int2rgba(scene.player2.color))

    const c = scene.add.text(screenCenterX, 100, 'WEAPON SHOP').setFontSize(50);
    c.setColor('rgba(240,240,240,1)')
    c.setOrigin(0.5, 0.5)
    c.setFontFamily('"Days One"')
    strokeText(c, 6)

    a.setOrigin(0.5).setFontSize(30)
    b.setOrigin(0.5).setFontSize(30)

    var rect1 = scene.add.rectangle(screenCenterX / 2 - 150, screenCenterY, scene.renderer.width/4 - 80, scene.renderer.height/2 + 20)
    rect1.setStrokeStyle(4, scene.player1.color)
    
    var rect2 = scene.add.rectangle(screenCenterX, screenCenterY, scene.renderer.width/3 - 100, scene.renderer.height/2)
    //rect2.setStrokeStyle(6, 0xFFFFFF)

    var rect3 = scene.add.rectangle(screenCenterX * 3/2 + 150, screenCenterY, scene.renderer.width/4 - 80, scene.renderer.height/2 + 20)
    rect3.setStrokeStyle(4, scene.player2.color)

    var canvas = document.createElement('canvas')
    canvas.width = 50
    canvas.height = 50
    var w = 50
    var h = 50
    var ctx = canvas.getContext('2d')

    ctx.fillStyle = "rgba(240,240,240,1)"
    ctx.moveTo(0, h/2)
    ctx.lineTo(w * (3/5), 0)
    ctx.lineTo(w/2, h * (1/3))
    ctx.lineTo(w, h * (1/3))
    ctx.lineTo(w, h * (2/3))
    ctx.lineTo(w/2, h * (2/3))
    ctx.lineTo(w * (3/5), h)
    ctx.lineTo(0, h/2)
    ctx.closePath()
    ctx.fill()
    
    scene.textures.addCanvas('arrow-left', canvas)
    var arrowleft = scene.add.image((screenCenterX / 2 - 300 + screenCenterX)/2, screenCenterY, 'arrow-left')
    arrowleft.setDepth(10)

    canvas = document.createElement('canvas')
    canvas.width = 50
    canvas.height = 50
    ctx = canvas.getContext('2d')

    ctx.fillStyle = "rgba(240,240,240,1)"
    ctx.moveTo(w, h/2)
    ctx.lineTo(w * (2/5), 0)
    ctx.lineTo(w/2, h * (1/3))
    ctx.lineTo(0, h * (1/3))
    ctx.lineTo(0, h * (2/3))
    ctx.lineTo(w/2, h * (2/3))
    ctx.lineTo(w * (2/5), h)
    ctx.lineTo(w, h/2)
    ctx.closePath()
    ctx.fill()
    
    scene.textures.addCanvas('arrow-right', canvas)
    var arrowright = scene.add.image((screenCenterX * 3/2 + 300 + screenCenterX)/2, screenCenterY, 'arrow-right')
    arrowright.setDepth(10)
    arrowright.setVisible(false)

    scene.player1.weapons = []
    scene.player2.weapons = []

    var turn = 1
    var pickableArray = []
    var remainingArray = []

    scene.tweens.add({
        targets: arrowleft,
        x: arrowleft.x - 5,
        repeat: -1,
        yoyo: true,
        duration: 300,
    })

    scene.tweens.add({
        targets: arrowright,
        x: arrowright.x + 5,
        repeat: -1,
        yoyo: true,
        duration: 300
    })

    const pickWeapon = (pickable) => {
        if (turn === 1) {
            var x = rect1.x - rect1.width/2 + 10
            var y = rect1.y - rect1.height/2 + 10 + scene.player1.weapons.length * 40
            pickable.setPosition(x, y)
            pickable.rect.removeInteractive()
            scene.player1.weapons.push({id: pickable.weaponIndex, name: pickable.text, type: pickable.type})
            turn = 2
            arrowleft.setVisible(false)
            remainingArray = remainingArray.filter((ele) => { return ele !== pickable.arrayIndex })
            if (scene.player2.weapons.length < totalWeapons/2)
                arrowright.setVisible(true)
            if (scene.player1.weapons.length + scene.player2.weapons.length === totalWeapons) {
                g.setText('CONTINUE')
                g.setColor('rgba(255,255,0,1)')
                strokeText(g, 6)
            }
        }
        else if (turn === 2) {
            var x = rect3.x - rect3.width/2 + 10
            var y = rect3.y - rect3.height/2 + 10 + scene.player2.weapons.length * 40
            pickable.setPosition(x, y)
            pickable.rect.removeInteractive()
            scene.player2.weapons.push({id: pickable.weaponIndex, name: pickable.text, type: pickable.type})
            turn = 1
            arrowright.setVisible(false)
            remainingArray = remainingArray.filter((ele) => { return ele !== pickable.arrayIndex })
            if (scene.player1.weapons.length < totalWeapons/2)
                arrowleft.setVisible(true)
            if (scene.player1.weapons.length + scene.player2.weapons.length === totalWeapons) {
                g.setText('CONTINUE')
                g.setColor('rgba(255,255,0,1)')
                strokeText(g, 6)
            }
        }
    }

    for (let index = 0; index < totalWeapons/2; index++) {
        var randomWeaponIndex = Math.floor(Math.random() * weaponArray.length)
        var pickable = scene.add.container(rect2.x - rect2.width/2 - 80, rect2.y - rect2.height/2 + 10 + index * 40)
        var txt = scene.add.text(30,5,weaponArray[randomWeaponIndex].name).setDepth(10)
        var img = scene.add.image(10,15, weaponIconTexture(scene, weaponArray[randomWeaponIndex])).setDepth(10)
        var rect = scene.add.rectangle(110,15,250,36).setDepth(2)
        //rect.setStrokeStyle(2, 0xff0000)
        pickable.add(txt)
        pickable.text = weaponArray[randomWeaponIndex].name
        pickable.add(rect)
        pickable.add(img)
        pickable.rect = rect
        pickableArray.push(pickable)
        txt.setFontSize(20)
        txt.setFontFamily('"Andale Mono"')
        pickable.weaponIndex =  weaponArray[randomWeaponIndex].id
        pickable.arrayIndex = index
        pickable.type = weaponArray[randomWeaponIndex].type
        remainingArray.push(index)

        rect.setInteractive()
        rect.on('pointerdown', () => {
            scene.sound.play('click', {volume: 0.3})
            pickWeapon(pickableArray[index])
        })
    }

    for (let index = 0; index < totalWeapons/2; index++) {
        var randomWeaponIndex = Math.floor(Math.random() * weaponArray.length)
        var pickable = scene.add.container(rect2.x - rect2.width/2 + 180, rect2.y - rect2.height/2 + 10 + index * 40)
        var txt = scene.add.text(30,5,weaponArray[randomWeaponIndex].name).setDepth(10)
        var img = scene.add.image(10,15, weaponIconTexture(scene, weaponArray[randomWeaponIndex])).setDepth(10)
        var rect = scene.add.rectangle(110,15,250,36).setDepth(2)
        //rect.setStrokeStyle(2, 0xff0000)
        pickable.add(txt)
        pickable.text = weaponArray[randomWeaponIndex].name
        pickable.add(rect)
        pickable.add(img)
        pickable.rect = rect
        pickableArray.push(pickable)
        txt.setFontSize(20)
        txt.setFontFamily('"Andale Mono"')
        pickable.weaponIndex =  weaponArray[randomWeaponIndex].id
        pickable.arrayIndex = index + totalWeapons/2
        pickable.type = weaponArray[randomWeaponIndex].type
        remainingArray.push(index + totalWeapons/2)

        rect.setInteractive()
        rect.on('pointerdown', () => {
            scene.sound.play('click', {volume: 0.3})
            pickWeapon(pickableArray[index + totalWeapons/2])
        })
    }

    attachDraftPreview(scene, pickableArray)

    pickableArray.forEach(pickable => {
        pickable.rect.on('pointerdown', () => {
            pickable.rect.setStrokeStyle(0,0,0)
        })
        pickable.rect.on('pointerover', () => {
            pickable.rect.setStrokeStyle(2, 0x00ccff, 1)
        })
        pickable.rect.on('pointerout', () => {
            pickable.rect.setStrokeStyle(2, 0x00ccff, 0)
        })
    })

    const randomPick = () => {
        if (remainingArray.length === 0) {
            g.setInteractive()
            return
        }

        if (turn === 1) {
            setTimeout(() => {
                var randomIndex = Math.floor(Math.random() * remainingArray.length)
                var pick = pickableArray[remainingArray[randomIndex]]
        
                var x = rect1.x - rect1.width/2 + 10
                var y = rect1.y - rect1.height/2 + 10 + scene.player1.weapons.length * 40
                pick.setPosition(x, y)
                pick.rect.removeInteractive()
                remainingArray = remainingArray.filter((ele) => { return ele !== pick.arrayIndex })
                scene.player1.weapons.push({id: pick.weaponIndex, name: pick.text, type: pick.type})
                turn = 2
                if (remainingArray.length > 0)
                    arrowright.setVisible(true)
                arrowleft.setVisible(false)
                if (remainingArray.length === 0) {
                    g.setText('CONTINUE')
                    g.setColor('rgba(255,255,0,1)')
                    strokeText(g, 6)
                }

                randomPick()
            }, 100);
        }
        else if (turn === 2) {
            setTimeout(() => {
                var randomIndex = Math.floor(Math.random() * remainingArray.length)
                var pick = pickableArray[remainingArray[randomIndex]]
        
                var x = rect3.x - rect3.width/2 + 10
                var y = rect3.y - rect3.height/2 + 10 + scene.player2.weapons.length * 40
                pick.setPosition(x, y)
                pick.rect.removeInteractive()
                remainingArray = remainingArray.filter((ele) => { return ele !== pick.arrayIndex })
                scene.player2.weapons.push({id: pick.weaponIndex, name: pick.text, type: pick.type})
                turn = 1
                if (remainingArray.length > 0)
                    arrowleft.setVisible(true)
                arrowright.setVisible(false)
                if (remainingArray.length === 0) {
                    g.setText('CONTINUE')
                    g.setColor('rgba(255,255,0,1)')
                    strokeText(g, 6)
                }
                
                randomPick()
            }, 100);
        }
    }


    const g = scene.add.text(screenCenterX, 700, 'RANDOM ALL').setFontSize(50).setOrigin(0.5);
    g.setFontFamily('"Days One"')
    g.setOrigin(0.5)
    g.setColor('rgba(240,240,240,1)')
    strokeText(g, 6)

    g.setInteractive()
    g.on('pointerdown', () => {
        scene.sound.play('click', {volume: 0.3})
        if (scene.player1.weapons.length + scene.player2.weapons.length === totalWeapons)
            scene.scene.start('main-scene', {gameType: 2, player1: scene.player1, player2: scene.player2})
        else {
            g.removeInteractive()
            pickableArray.forEach(pickable => {
                pickable.rect.removeInteractive()
            })
            randomPick()
        }
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
