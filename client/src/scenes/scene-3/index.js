import { addBattlefield } from '../../graphics/battlefield';
import { Scene, GameObjects, BlendModes, Textures } from 'phaser';
import { type1 } from './types/type1';
import { type2 } from './types/type2';
import { type3 } from './types/type3';
import { type4 } from './types/type4';
import { drawBackBtn } from '../../graphics/back-btn';
import WebFontFile from '../../classes/WebFontFile';

export class Scene3 extends Scene {
    constructor() {
        super('scene-3');
        this.sceneData = null;
    }



    init = (data) => {
        this.sceneData = data
    }



    preload = () => {
        //this.load.addFile(new WebFontFile(this.load, ['Audiowide', 'Exo 2:600', 'Bungee', 'Righteous', 'Days One', 'Iceland']))
        //this.load.baseURL = 'assets/';
        //this.load.image('tank', 'sprites/tank.png');
        //this.sound.add('click')
    }



    create = () => {
        addBattlefield(this, 'setup-landscape')
        this.add.rectangle(600,400,1200,800,0x091e28,.88).setDepth(-9)

        //this.fps = this.add.text(0, 0, this.game.loop.actualFps)

        if (this.sceneData.gameType === 1) {
            this.handleType1()
        }
        else if (this.sceneData.gameType === 2) {
            this.handleType2()
        }
        else if (this.sceneData.gameType === 3) {
            this.handleType3()
        }
        else if (this.sceneData.gameType === 4) {
            this.handleType4()
        }

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
            this.scene.start('scene-2')
        })

        // this.input.on('pointerdown', () => {
        //     if (window.game.sound.mute === true) {
        //         window.game.sound.mute = false
        //     }
        // })
    }



    handleType1 = () => {
        type1(this)
    }



    handleType2 = () => {
        type2(this)
    }



    handleType3 = () => {
        type3(this)
    }



    handleType4 = () => {
        type4(this);
    }



    update = (time, delta) => {
        //this.fps.setText(this.game.loop.actualFps)
    
    }

}
