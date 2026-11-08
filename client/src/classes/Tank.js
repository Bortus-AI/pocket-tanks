import { assistTank } from '../aim/assist';
import { acceptOnlineShot } from '../socket/session';
import { chooseTankSpawn } from '../graphics/terrain-layouts';
import { beginTacticalShot, tankState } from '../weapons/expansion/tactics';
import { drawVehicle } from '../graphics/vehicle';
import { TankPresentation } from '../graphics/tank-presentation';
import { GameObjects, Physics } from "phaser";
import Phaser from "phaser";
import { Turret } from "./Turret";
import { Score } from "./Score";
import { socket } from "../socket";

export class Tank extends GameObjects.Sprite {
    static length = 36
    /**
    * @param {Phaser.Scene} scene
    */
    constructor (scene, id) {
        var canvas = document.createElement('canvas');
        canvas.height = 24 // tank height
        canvas.width = 36  // tank width

        if (scene.textures.exists('tank' + id)) scene.textures.remove('tank' + id)
        scene.textures.addCanvas('tank' + id, canvas);
        //scene.add.sprite(0, 0, 'tank');
        super(scene, 0, 0, 'tank' + id)
        scene.add.existing(this)

        this.canvas = canvas
        this.scene = scene
        this.terrain = this.scene.terrain
        this.prevPos = {x: null, y: null}
        this.power = 60;
        this.powerFactor = 8
        this.id = id
        this.active = false;
        this.weapons = []
        this.name = null
        this.score = 0
        this.selectedWeapon = 0
        this.settled = true
        this.color = null
        this.centre = {x: 0, y: 0}
        this.top = {x: 0, y: 0}
        this.leftSteps = 0
        this.rightSteps = 0
        this.movesRemaining = 4
        this.moving = false
        this.hitRadius = this.height/4
        this.gameType = this.scene.sceneData.gameType
        this.needEmitPowerChange = false
        this.aimPower = 0
        this.previousPowerTimer = null
        
        this.keyA = this.scene.input.keyboard.addKey('A');
        this.keyD = this.scene.input.keyboard.addKey('D');
        this.keyW = this.scene.input.keyboard.addKey('W');
        this.keyS = this.scene.input.keyboard.addKey('S');

        this.turret = null
        this.scoreHandler = new Score(this.scene, this)
    }



    create = (tankColor, name) => {
        var ctx = this.canvas.getContext('2d')
        this.color = tankColor
        this.name = name

        this.scene.physics.world.enable(this)

        this.randomPos()
    
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        // The physics anchor sits at the canvas midpoint; keep tracks above it.
        ctx.translate(0, -1.2);
        ctx.scale(1, .6);
        drawVehicle(ctx, typeof tankColor === 'number' ? `#${tankColor.toString(16).padStart(6, '0')}` : tankColor);
        ctx.restore();
        this.scene.textures.get('tank' + this.id).refresh();

        //this.setBlendMode(Phaser.BlendModes.MULTIPLY)
        this.selectedWeapon = this.weapons.length >= 1 ? 0 : null
        //this.body.setCollideWorldBounds(true)
        this.body.setBounce(1,0)
        //this.body.setSize(1,1)
        this.scene.physics.add.collider(this, this.scene.leftWall)
        this.scene.physics.add.collider(this, this.scene.rightWall)

        this.body.setSize(1,1)
        this.turret = new Turret(this.scene, this, this.id)
        this.presentation = new TankPresentation(this)

        // Socket handlers must leave with the sprite when a saved match is parked.
        const onOnlineEvent = (event, handler) => {
            socket.on(event, handler)
            this.once('destroy', () => socket.off(event, handler))
        }

        onOnlineEvent('opponentShoot', payload => {
            if (this.scene?.sceneData?.gameType !== 3 || this !== this.scene.tank2) return
            acceptOnlineShot(this.scene, payload)
        })

        onOnlineEvent('opponentPowerChange', ({power}) => {
            if(this.scene?.sceneData?.gameType!==3)return
            if (this.active && this === this.scene.tank2) {
                this.aimPower = power

                if (this.previousPowerTimer !== null) {
                    this.previousPowerTimer.destroy()
                }

                this.previousPowerTimer = this.scene.time.addEvent({delay: 20, callback: () => {this.lerpPower()}, callbackScope: this, loop: true})
            }
        })
        
        onOnlineEvent('opponentStepLeft', () => {
            if(this.scene?.sceneData?.gameType!==3)return
            if (this.active === false) return
            this.stepLeft()
        })

        onOnlineEvent('opponentStepRight', () => {
            if(this.scene?.sceneData?.gameType!==3)return
            if (this.active === false) return
            this.stepRight()
        })

        this.scene.input.keyboard.on('keydown-A', () => {
            if (this.gameType === 3 && this === this.scene.tank2) return 
            if (this.active && !this.moving && this.movesRemaining > 0) {
                this.scene.sound.play('click', {volume: 0.3})
                this.stepLeft()
                if(this.gameType===3)window.socket.emit('stepLeft', {})
            }
        })

        this.scene.input.keyboard.on('keydown-D', () => {
            if (this.gameType === 3 && this === this.scene.tank2) return 
            if (this.active && !this.moving && this.movesRemaining > 0) {
                this.scene.sound.play('click', {volume: 0.3})
                this.stepRight()
                if(this.gameType===3)window.socket.emit('stepRight', {})
            }
        })

        this.texture.update()
        

        this.scene.time.addEvent({delay: 500, callback: this.emitPower, callbackScope: this, loop: true})

        this.scene.physics.world.on('worldstep', this.physicsStep, this)
        this.scene.physics.world.on('worldstep', this.step, this)
    }



    emitPower = () => {
        if (this.gameType === 3 && this === this.scene.tank1 && this.active) {
            if (this.needEmitPowerChange === true) {
                window.socket.emit('powerChange', {power: this.power})
                this.needEmitPowerChange = false
            }
        }
    }



    lerpPower = () => {
        var difference = this.aimPower - this.power
        var unit = difference > 0 ? 1 : -1
        this.setPower(this.power + unit)

        if (difference === 0) {
            this.setPower(this.aimPower)
            this.previousPowerTimer.destroy()
            this.previousPowerTimer = null
        }
    }
    

    randomPos = () => {
        const spawn = chooseTankSpawn(this.terrain.path, this.terrain.width, this.terrain.height, this.id)
        const initX = spawn.x
        let initY = spawn.y
        // Read the live alpha mask, including its antialiased rim, once per tank.
        // During online setup an empty mask is allowed until the host path arrives.
        for (let y = 0; y < this.terrain.height; y++) {
            if (this.terrain.getPixel(initX, y).alpha > 0) { initY = y; break; }
        }
        this.setPosition(initX, initY)
        this.prevPos.x = initX
        this.prevPos.y = initY
        const rotation = this.terrain.path.length ? this.terrain.getSlope(initX, initY) : 0
        if (Number.isFinite(rotation)) this.setRotation(rotation)
    }



    step = () => {
        this.turret.update()
        this.scoreHandler.update()

        // find centre
        this.centre.x = this.body.x + this.height/4 * Math.sin(this.rotation)
        this.centre.y = this.body.y - this.height/4 * Math.cos(this.rotation)
        this.top.x = this.body.x + this.height/2 * Math.sin(this.rotation)
        this.top.y = this.body.y - this.height/2 * Math.cos(this.rotation)

        // movement
        if (this.keyW?.isDown) {
            if (this.active) {
                if ((this.gameType === 3 && this === this.scene.tank1) || this.gameType !== 3){
                    this.setPower(this.power + 1);
                }
            }
        }
        if (this.keyS?.isDown) {
            if (this.active) {
                if ((this.gameType === 3 && this === this.scene.tank1) || this.gameType !== 3){
                    this.setPower(this.power - 1);
                }
            }
        }

        if (this.leftSteps > 0) {
            this.leftSteps--
            this.moveLeft()
        }
        if (this.rightSteps > 0) {
            this.rightSteps--
            this.moveRight()
        } 
        if (this.leftSteps === 0 && this.rightSteps === 0) {
            this.moving = false
        }

        this.prevPos = {x: this.x, y: this.y}
    }


    physicsStep = () => {
        if (this.body.y < 0) {
            if (this.body.x < 0 || this.body.x > this.scene.terrain.width - 1) return

            if (this.body.gravity.length() === 0) {
                this.body.y = this.body.y + 1
                this.settled = false
            }
        }
        else if (this.body.y >= 0) {
            if (this.body.x < 0 || this.body.x > this.scene.terrain.width - 1) return

            var [newX, newY, prevX, prevY] = this.scene.terrain.retractPoint(this.body.x, this.body.y, this.body.velocity, this.body.acceleration, this.body.gravity)
            var pos = {x: prevX, y: prevY}
            
            if (newX === prevX && newY === prevY) {
                if (this.terrain.getPixel(this.body.x, this.body.y).alpha === 0) {
                    this.body.y = this.body.y + 1
                    if (this.terrain.getPixel(this.body.x, this.body.y).alpha !== 0) {
                        var rotation = this.terrain.getSlope(this.body.x, this.body.y)
                        if (rotation !== undefined) {
                            this.setRotation(rotation)
                        }
                        this.settled = true
                    }
                    else {
                        this.settled = false
                    }
                }
                else {
                    this.settled = true
                }
                return
            }

            this.body.x = pos.x
            this.body.y = pos.y

            var rotation = this.terrain.getSlope(pos.x, pos.y)
            if (rotation !== undefined) {
                this.setRotation(rotation)
            }
            this.settled = true
            
            this.body.stop()
            this.body.setGravity(0)
            this.body.preUpdate(true, 0)
        }
    }



    isInsideTerrain = () => {
        var x = this.body.x + 1 * Math.sin(this.rotation)
        var y = this.body.y - 1 * Math.cos(this.rotation)
        if (this.terrain.getPixel(x, y).alpha > 0) {
            return true
        }
        return false
    }



    groundRight = (x, y) => {
        var point = this.terrain.getRightGround(x, y)
        return point;
    }



    groundLeft = (x, y) => {
        var point = this.terrain.getLeftGround(x, y)
        return point;
    }



    moveLeft = () => {
        if (!this.active) return
        if (this.isInsideTerrain()) return
        this.scene.hideTurnPointer()

        var nextPos;
        nextPos = this.groundLeft(this.body.x, this.body.y);
        if (nextPos === null) {
            //
        }
        else if (this.body.x - (this.canvas.width/2) * Math.cos(this.rotation) <= 0) {
            this.body.x = (this.canvas.width/2) * Math.cos(this.rotation)
            //this.body.setVelocityX(-this.body.velocity.x)
        }
        else {
            //this.setPosition(nextPos.x, nextPos.y)
            this.body.x = nextPos.x
            this.body.y = nextPos.y
            var rotation = this.terrain.getSlope(nextPos.x, nextPos.y)
            if (rotation !== undefined) {
                this.setRotation(rotation)
            }
            //this.setRotation(this.terrain.getSlope(nextPos.x, nextPos.y))
        }
    }



    moveRight = () => {
        if (!this.active) return
        if (this.isInsideTerrain()) return
        this.scene.hideTurnPointer()

        var nextPos;
        nextPos = this.groundRight(this.body.x, this.body.y);
        if (nextPos === null) {
            //
        }
        else if (this.body.x + (this.canvas.width/2) * Math.cos(this.rotation) >= this.terrain.width) {
            this.body.x = this.terrain.width - (this.canvas.width/2) * Math.cos(this.rotation)
            //this.body.setVelocityX(-this.body.velocity.x)
        }
        else {
            //this.setPosition(nextPos.x, nextPos.y)
            this.body.x = nextPos.x
            this.body.y = nextPos.y
            var rotation = this.terrain.getSlope(nextPos.x, nextPos.y)
            if (rotation !== undefined) {
                this.setRotation(rotation)
            }
            //this.setRotation(this.terrain.getSlope(nextPos.x, nextPos.y))
        }
    }




    stepLeft = () => {
        const status = tankState(this)
        const bogged = status.frost > 0 || status.foam > 0
        if (bogged && status.frostMoves >= 1) return
        if (this.movesRemaining > 0 && bogged) status.frostMoves++

        if (this.movesRemaining > 0) {
            this.leftSteps = 80
            this.moving = true
            if (this.scene.sceneData.gameType !== 4) {
                this.movesRemaining--
            }
        }
    }



    stepRight = () => {
        const status = tankState(this)
        const bogged = status.frost > 0 || status.foam > 0
        if (bogged && status.frostMoves >= 1) return
        if (this.movesRemaining > 0 && bogged) status.frostMoves++

        if (this.movesRemaining > 0) {
            this.rightSteps = 80
            this.moving = true
            if (this.scene.sceneData.gameType !== 4) {
                this.movesRemaining--
            }
        }
    }



    shoot = () => {
        if (!this.active || this.turret.activeWeapon || !this.weapons[this.selectedWeapon]) return false
        this.scene.hideTurnPointer()
        beginTacticalShot(this.scene, this)
        this.active = false
        this.turret.shoot(this.weapons[this.selectedWeapon]?.id)
        if (this.scene.sceneData.gameType !== 4) {
            this.weapons.splice(this.selectedWeapon, 1)
        }
        this.selectedWeapon = this.weapons.length >= 1 ? Math.min(this.selectedWeapon, this.weapons.length - 1) : null
        return true
    }



    updateScore = (points) => {
        if (points === 0) return
        this.scoreHandler.add(points)
    }



    setPower = (power) => {
        power = Math.floor(power)
        if (power > 100)
            power = 100
        if (power < 1)
            power = 1
        this.power = power
        this.needEmitPowerChange = true
    }



    isPointInside = (x, y) => {
        var w = this.width

        var polygon = new Phaser.Geom.Polygon([
            //this.x - Math.cos(this.rotation) * w/3, this.y - Math.sin(this.rotation) * w/3,
            //this.centre.x - Math.cos(this.rotation) * w/2, this.centre.y - Math.sin(this.rotation) * w/2,
            //this.centre.x - Math.cos(this.rotation) * w/3, this.centre.y - Math.sin(this.rotation) * w/3,
            this.body.x - Math.cos(this.rotation) * w/4, this.body.y - Math.sin(this.rotation) * w/4,
            this.top.x - Math.cos(this.rotation) * w/4, this.top.y - Math.sin(this.rotation) * w/4,
            this.top.x + Math.cos(this.rotation) * w/4, this.top.y + Math.sin(this.rotation) * w/4,
            this.body.x + Math.cos(this.rotation) * w/4, this.body.y + Math.sin(this.rotation) * w/4,
            //this.centre.x + Math.cos(this.rotation) * w/3, this.centre.y + Math.sin(this.rotation) * w/3,
            //this.centre.x + Math.cos(this.rotation) * w/2, this.centre.y + Math.sin(this.rotation) * w/2,
            //this.x + Math.cos(this.rotation) * w/3, this.y + Math.sin(this.rotation) * w/3,
        ])

        var pointInside = false

        if (Phaser.Geom.Polygon.ContainsPoint(polygon, {x: x, y: y})) {
            pointInside = true
        }
 
        return pointInside
    }



    autoAdjust = () => assistTank(this)

}
