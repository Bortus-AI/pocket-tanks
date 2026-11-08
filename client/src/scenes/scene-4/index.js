import { addBattlefield } from '../../graphics/battlefield';
import { Scene, GameObjects, BlendModes, Textures } from 'phaser';
import { type1 } from './types/type1';
import { type2 } from './types/type2';
import { type3 } from './types/type3';
import { type4 } from './types/type4';
import { drawBackBtn } from '../../graphics/back-btn';
import { parkOnlineMatch, onlineSession } from '../../socket/session';

export class Scene4 extends Scene {
    constructor() {
        super('scene-4');
        this.sceneData = null
    }



    init = (data) => {
        this.sceneData = data
    }



    preload = () => {
        //this.sound.add('click')
        //this.load.baseURL = 'assets/';
        //this.load.image('tank', 'sprites/tank.png');
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
        backbtn.setName('online-lobby-back')
        backbtn.setDepth(10)
        
        backbtn.setInteractive()

        backbtn.on('pointerdown', () => {
            this.sound.play('click', {volume: 0.3})
            if (this.sceneData.gameType === 3) {
                //console.log(this.roomList?.length)
                //console.log('clearing rooms')
                this.clearRooms()
                if(onlineSession.roomId){parkOnlineMatch();return}
            }
            this.scene.start('scene-3', {gameType: this.sceneData.gameType})
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
        type4(this)
    }



    update = (time, delta) => {
        //this.fps.setText(this.game.loop.actualFps)
    }

}

