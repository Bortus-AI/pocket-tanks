import { GameObjects, Physics } from "phaser";
import { Weapon } from "./Weapon";
import Phaser from "phaser";
import { socket } from "../socket";

export class Turret extends GameObjects.Sprite {
    /**
    * @param {Phaser.Scene} scene
    */

    constructor (scene, tank, id) {
        var canvas = document.createElement('canvas');
        canvas.height = 32 // turret height
        canvas.width = 6  // turret width
        
        if (scene.textures.exists('turret' + id)) scene.textures.remove('turret' + id)
        scene.textures.addCanvas('turret' + id, canvas);
        super(scene, 0, 0, 'turret' + id)
        scene.add.existing(this)

        this.tank = tank
        this.canvas = canvas
        this.scene = scene
        this.setDepth(-3)
        this.rotationDelta = 0.05
        this.relativeRotation = 0
        this.activeWeapon = null
        this.id = id
        this.powerFactor = 8
        this.gameType = this.scene.sceneData.gameType
        this.aimRotation = 0
        this.needEmitAngleChange = false
        this.previousAngleTimer = null

        this.keyQ = this.scene.input.keyboard.addKey('Q');
        this.keyE = this.scene.input.keyboard.addKey('E');
        
        this.create()
    }



    create = () => {
        var ctx = this.canvas.getContext('2d')
        const steel = ctx.createLinearGradient(1, 0, 5, 0)
        steel.addColorStop(0, '#304c51')
        steel.addColorStop(.45, '#b4c8b9')
        steel.addColorStop(1, '#405e5c')
        ctx.fillStyle = steel
        ctx.fillRect(1.5, 0, 3, this.canvas.height/2)
        ctx.fillStyle = '#263f44'
        ctx.fillRect(.5, 0, 5, 3)
        ctx.fillStyle = '#bed4bf'
        ctx.fillRect(1, 3, 4, 1)
        this.scene.textures.get('turret' + this.id).refresh()

        // Socket handlers must leave with the sprite when a saved match is parked.
        const onOnlineEvent = (event, handler) => {
            socket.on(event, handler)
            this.once('destroy', () => socket.off(event, handler))
        }

        onOnlineEvent('opponentAngleChange', ({rotation}) => {
            if(this.scene?.sceneData?.gameType!==3)return
            if (this.tank.active && this.tank === this.scene.tank2) {
                this.aimRotation = rotation

                if (this.previousAngleTimer !== null) {
                    this.previousAngleTimer.destroy()
                }

                this.previousAngleTimer = this.scene.time.addEvent({delay: 20, callback: () => {this.lerpRelativeRotation()}, callbackScope: this, loop: true})
            }
        })

        this.scene.time.addEvent({delay: 500, callback: this.emitRotation, callbackScope: this, loop: true})

        this.scene.physics.world.on('worldstep', this.weaponUpdate, this)
    }



    weaponUpdate = () => {
        if (this.activeWeapon !== null) {
            this.activeWeapon.update()
        }
    }



    emitRotation = () => {
        if (this.gameType === 3 && this.tank === this.scene.tank1 && this.tank.active) {
            if (this.needEmitAngleChange) {
                window.socket.emit('angleChange', {rotation: this.relativeRotation})
                this.needEmitAngleChange = false
            }
        }
    }



    lerpRelativeRotation = () => {
        var a_rad = this.relativeRotation
        var b_rad = this.aimRotation

        var difference = Phaser.Math.Angle.ShortestBetween(Phaser.Math.RadToDeg(a_rad), Phaser.Math.RadToDeg(b_rad))

        var angle = Phaser.Math.Angle.RotateTo(a_rad, b_rad, 0.05)
        this.relativeRotation = angle

        if (Math.abs(difference) < 1) {
            this.relativeRotation =  this.aimRotation
            this.previousAngleTimer.destroy()
            this.previousAngleTimer = null
        }
    }



    update = () => {
        const crossAirRadius = 80
        var x = this.tank.body.x + (this.tank.height/2) * Math.sin(this.tank.rotation)
        var y = this.tank.body.y - (this.tank.height/2) * Math.cos(this.tank.rotation)
        this.setPosition(x, y)

        if (this.keyQ?.isDown) {
            if (this.tank.active) {
                if ((this.gameType === 3 && this.tank === this.scene.tank1) || this.gameType !== 3){
                    this.relativeRotation -= this.rotationDelta
                    this.setRotation(this.relativeRotation + this.tank.rotation)
                    const alpha = this.rotation
                    this.scene.HUD.crossAir.setPosition(this.x + crossAirRadius * Math.sin(alpha), this.y - crossAirRadius * Math.cos(alpha))
                    this.scene.HUD.crossAir.visibleTime = 40
                }
            }
        }
        if (this.keyE?.isDown) {
            if (this.tank.active) {
                if ((this.gameType === 3 && this.tank === this.scene.tank1) || this.gameType !== 3){
                    this.relativeRotation += this.rotationDelta
                    this.setRotation(this.relativeRotation + this.tank.rotation)
                    const alpha = this.rotation
                    this.scene.HUD.crossAir.setPosition(this.x + crossAirRadius * Math.sin(alpha), this.y - crossAirRadius * Math.cos(alpha))
                    this.scene.HUD.crossAir.visibleTime = 40
                }
            }
        }

        this.setRotation(this.relativeRotation + this.tank.rotation)
    }



    // Clearing (or replacing) the active weapon ends that shot: its shutdown
    // listener, timers and per-shot textures are released exactly once.
    get activeWeapon() {
        return this._activeWeapon ?? null
    }

    set activeWeapon(weapon) {
        const previous = this._activeWeapon ?? null
        this._activeWeapon = weapon ?? null
        if (previous && previous !== this._activeWeapon) previous.finish?.()
    }



    shoot = (selectedWeapon) => {
        const weapon = new Weapon(this.scene, this.tank, selectedWeapon)
        // A weapon whose create() failed has already cleaned itself up.
        this.activeWeapon = weapon.finished ? null : weapon
    }


    setRelativeRotation = (r) => {
        this.relativeRotation = r
        this.setRotation(this.relativeRotation + this.tank.rotation)
        this.needEmitAngleChange = true
    }
}