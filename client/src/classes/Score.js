import { reducedMotion } from '../graphics/motion';

export class Score {
    /**
     * @param {Phaser.Scene} scene 
     * @param {*} tank 
     */
    constructor(scene, tank) {
        this.scene = scene
        this.tank = tank
        this.pointsArray = []
    }


    add = (points) => {
        var initX = this.tank.x
        var initY = this.tank.y

        this.tank.score = this.tank.score + points
        const minimal = reducedMotion()
        const text = this.scene.add.text(initX, initY - 22, points > 0 ? `+${points}` : String(points), {
            fontFamily:'Arial',fontSize:this.scene.game.device.os.desktop?18:22,fontStyle:'bold',
            color:points>0?'#fff0c4':'#ffb291',stroke:'#172f37',strokeThickness:3,
        }).setOrigin(.5).setDepth(7)
        this.pointsArray.push({text})
        this.scene.tweens.add({targets:text,y:initY-(minimal?30:80),alpha:0,duration:minimal?900:1300,ease:'Cubic.Out',onComplete:()=>text.destroy()})
        if(!minimal){text.setScale(.75);this.scene.tweens.add({targets:text,scaleX:1,scaleY:1,duration:200,ease:'Back.Out'})}
    }



    update = () => {
        this.pointsArray = this.pointsArray.filter(point => !!point.text.scene)
    }


}
