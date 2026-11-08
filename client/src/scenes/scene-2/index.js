import { TERRAIN_PROFILES } from '../../graphics/terrain-layouts';
import { addBattlefield } from '../../graphics/battlefield';
import { Scene, GameObjects, BlendModes, Textures } from 'phaser';
import { drawBackBtn } from '../../graphics/back-btn';
import WebFontFile from '../../classes/WebFontFile';

export class Scene2 extends Scene {
    constructor() {
        super('scene-2');
        //this.clicktext = null
    }



    preload = () => {
        //this.load.baseURL = 'assets/';
        //this.load.image('tank', 'sprites/tank.png');
        //this.sound.add('click')
    }



    create = () => {
        //this.fps = this.add.text(0, 0, this.game.loop.actualFps)
        //this.clicktext = this.add.text(0, 0, "click").setFontFamily('Verdana').setVisible(false).setFontSize(14)

        addBattlefield(this, 'mode-landscape')
        this.add.rectangle(600,400,1200,800,0x091e28,.7)
        this.add.text(600,85,'CHOOSE YOUR ENGAGEMENT',{fontFamily:'Arial',fontSize:18,color:'#a9c6bd',letterSpacing:4}).setOrigin(.5)
        const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2;
        const h = this.game.renderer.height

        const layouts=[{key:'random',name:'SURPRISE ME'},...TERRAIN_PROFILES]
        let layoutIndex=Math.max(0,layouts.findIndex(layout=>layout.key===this.registry.get('terrainKind')))
        const terrainButton=this.add.text(screenCenterX,h-63,'',{fontFamily:'Arial',fontSize:16,color:'#c9d8c5',backgroundColor:'#1b3842',padding:{x:18,y:13}}).setOrigin(.5).setInteractive({useHandCursor:true})
        const updateTerrainChoice=()=>terrainButton.setText(`TERRAIN: ${layouts[layoutIndex].name.toUpperCase()}   ›`)
        updateTerrainChoice()
        terrainButton.on('pointerdown',()=>{layoutIndex=(layoutIndex+1)%layouts.length;this.registry.set('terrainKind',layouts[layoutIndex].key);updateTerrainChoice()})

        const a = this.add.text(screenCenterX, h/12 * 3, 'ONE PLAYER');
        const b = this.add.text(screenCenterX, h/12 * 5, 'TWO PLAYERS');
        const c = this.add.text(screenCenterX, h/12 * 7, 'PLAY ONLINE');
        const d = this.add.text(screenCenterX, h/12 * 9, 'TARGET PRACTICE');
        const font = '"Days One"'

        a.setOrigin(0.5).setFontSize(50).setFontFamily(font).setColor('rgba(102,255,51,1)')
        b.setOrigin(0.5).setFontSize(50).setFontFamily(font).setColor('rgba(255,255,0,1)')
        c.setOrigin(0.5).setFontSize(50).setFontFamily(font).setColor('rgba(255,153,51,1)')
        d.setOrigin(0.5).setFontSize(50).setFontFamily(font).setColor('rgba(255,51,0,1)')

        ;[a,b,c,d].forEach((text,i)=>{
            const plate=this.add.rectangle(screenCenterX,text.y,610,94,0x1b3842,.92).setStrokeStyle(1,0x4a686c).setDepth(-1);
            text.setFontFamily('Arial').setFontStyle('bold').setFontSize(30).setColor('#e2e7d5');
            text.on('pointerover',()=>{plate.setFillStyle(0x355b60);text.setColor('#f6ce9c')});
            text.on('pointerout',()=>{plate.setFillStyle(0x1b3842);text.setColor('#e2e7d5')});
        });

        var canvas = document.createElement('canvas')
        var ctx = canvas.getContext('2d')
        canvas.width = 150
        canvas.height = 100
        drawBackBtn(ctx, canvas.width, canvas.height)
        var backtexture = this.textures.addCanvas('back-btn', canvas, true)
        var backbtn = this.add.image(100, this.game.renderer.height - 100, backtexture)
        backbtn.setDepth(10)
        
        backbtn.setInteractive()
        backbtn.on('pointerdown', () => {
            this.sound.play('click', {volume: 0.3})
            this.scene.start('scene-1')
        })

        a.setInteractive()
        b.setInteractive()
        c.setInteractive()
        d.setInteractive()

        this.addClickable(a)
        this.addClickable(b)
        this.addClickable(c)
        this.addClickable(d)

        a.on('pointerdown', () => {
            this.sound.play('click', {volume: 0.3})
            this.scene.start('scene-3', {gameType: 1})
        })
        b.on('pointerdown', () => {
            this.sound.play('click', {volume: 0.3})
            this.scene.start('scene-3', {gameType: 2})
        })
        c.on('pointerdown', () => {
            this.sound.play('click', {volume: 0.3})
            this.scene.start('scene-3', {gameType: 3})
        })
        d.on('pointerdown', () => {
            this.sound.play('click', {volume: 0.3})
            this.scene.start('scene-3', {gameType: 4})
        })

        // this.input.on('pointerdown', () => {
        //     if (window.game.sound.mute === true) {
        //         window.game.sound.mute = false
        //     }
        // })
    }

    addClickable = (btn) => {
        return
        btn.on('pointermove', () => {
            //this.clicktext.setPosition(this.input.mousePointer.x, this.input.mousePointer.y + 32)
        })

        btn.on('pointerover', () => {
            //this.clicktext.setPosition(this.input.mousePointer.x, this.input.mousePointer.y + 32)
            //this.clicktext.setVisible(true)
        })

        btn.on('pointerout', () => {
            //this.clicktext.setVisible(false)
        })
    }


    update = (time, delta) => {
        //this.fps.setText(this.game.loop.actualFps)
    
    }

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
