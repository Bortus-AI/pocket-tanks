import { addImpact } from '../graphics/impact';
import { emitWeaponImpact } from '../graphics/weapon-fx';
import { legacyWeaponStyle, sourceWeapon } from '../graphics/legacy-weapon-style';
import { reducedMotion } from '../graphics/motion';
import { playThrottledSample } from '../audio/weapon-audio';
import { applyLegacyAftermath } from '../weapons/expansion/unique-mechanics';
import Phaser from "phaser"

let blastTextureCounter = 0

export class Blast {
    /**
     * @param {Phaser.Scene} scene 
     * @param {number} animationType 
     * @param {number} x 
     * @param {number} y 
     * @param {number} radius
     * @param {boolean} blowTank
     * @param {string} blastType
     */
    constructor(scene, animationType, x, y, radius, data, blowTank, blastType) {
        this.animationType = animationType
        this.data = data
        this.scene = scene
        this.count = 0
        this.blastType = blastType
        // Only the weapon that produced this blast (matched through blastType)
        // owns its aftermath and art; a delayed blast may land on a later turn.
        const {weapon: activeWeapon} = sourceWeapon(scene, blastType)
        this.originalWeapon = activeWeapon?.id < 30 ? activeWeapon : null
        this.cacheable = blastType !== undefined && blastType !== null && blastType !== ''
        this.aftermathApplied = false
        
        this.terrain = scene.terrain
        this.maxRadius = Math.max(radius, 1)
        this.outerRadius = 0
        this.innerRadius = 0
        this.thickness = 0
        this.x = x
        this.y = y
        this.canvas = null
        this.texture = null
        this.textureId = null
        this.image = null
        this.disposed = false
        this.reducedMotion = reducedMotion()

        this.gradient = null
        this.circles = []
        this.toRemove = false
        this.blowTank = blowTank
        this.soundEffect = data.soundEffect
        this.soundConfig = data.soundConfig

        this.init()
        // Keep the old blast mask and its timing for terrain/knockback, but let
        // the compositor draw fire, debris, smoke, shards, and energy instead of
        // displaying the old expanding gradient ring. The wav above stays the
        // weapon's voice; the compositor layers its procedural signature.
        this.modernPresentation = !!emitWeaponImpact(scene, x, y, radius, {...legacyWeaponStyle(scene, blastType), audio: 'layer'})
        if (!this.modernPresentation) {
            this.createTexture()
            addImpact(scene, x, y, radius, {audio: false})
        }
        this.onShutdown = () => this.dispose()
        scene.events?.once?.('shutdown', this.onShutdown)
    }

    // The gradient canvas only exists for the legacy presentation path.
    createTexture = () => {
        this.canvas = document.createElement('canvas')
        this.canvas.width = this.maxRadius * 2
        this.canvas.height = this.maxRadius * 2
        this.textureId = `legacy-blast-${++blastTextureCounter}`
        if (this.scene.textures.exists?.(this.textureId)) this.scene.textures.remove(this.textureId)
        this.texture = this.scene.textures.addCanvas(this.textureId, this.canvas)
        this.image = this.scene.add.image(this.x, this.y, this.textureId).setOrigin(0.5, 0.5)
        if (this.reducedMotion) this.image.setAlpha?.(.45)
    }

    // Reduced motion: redraw the legacy gradient every third step only.
    skipGradientFrame = () => this.reducedMotion && this.outerRadius % 3 !== 0

    refreshTexture = () => { this.texture?.refresh?.() }

    playSound = () => {
        if (!this.soundEffect) return
        const config = this.soundConfig ? {...this.soundConfig} : {}
        if (Number.isFinite(config.volume)) config.volume = Math.min(1, Math.max(0, config.volume))
        playThrottledSample(this.scene, this.soundEffect, config)
    }

    finish = () => {
        this.innerRadius = this.maxRadius
        this.terrain.fixTerrain(this.x, this.y, this.maxRadius)
        this.toRemove = true
        this.dispose()
    }

    dispose = () => {
        if (this.disposed) return
        this.disposed = true
        this.scene.events?.off?.('shutdown', this.onShutdown)
        if (this.image) this.image.destroy(true)
        if (this.textureId && this.scene.textures?.exists?.(this.textureId)) this.scene.textures.remove(this.textureId)
        if (this.canvas) this.canvas.width = this.canvas.height = 1
        this.image = null
        this.texture = null
        this.canvas = null
    }


    init = () => {
        if (this.animationType === 1) {
            this.gradient = this.data.gradient
            this.thickness = this.data.thickness
            this.playSound()
        }
        if (this.animationType === 2) {
            this.circles = this.data.circles
            this.thickness = this.data.thickness
            this.playSound()
        }
        if (this.animationType === 3) {
            this.circles = this.data.circles
            this.thickness = this.data.thickness
            this.variableRadius = this.maxRadius
            this.playSound()
        }
    }


    update = () => {
        if (this.animationType === 1) {
            this.updateType1()
        }
        if (this.animationType === 2) {
            this.updateType2()
        }
        if (this.animationType === 3) {
            this.updateType3()
        }
        if (this.toRemove && !this.aftermathApplied && this.originalWeapon) {
            this.aftermathApplied = true
            applyLegacyAftermath(this.originalWeapon, {x:this.x,y:this.y,radius:this.maxRadius})
        }
    }




    updateType1 = () => {
        this.outerRadius++
        if (this.maxRadius > this.innerRadius) {
            this.animateHole1()
            if (this.blowTank === true) {
                var dist1 = Phaser.Math.Distance.Between(this.x, this.y, this.scene.tank1.centre.x, this.scene.tank1.centre.y)
                var dist2 = Phaser.Math.Distance.Between(this.x, this.y, this.scene.tank2.centre.x, this.scene.tank2.centre.y)
                
                var tank1 = this.scene.tank1
                var tank2 = this.scene.tank2

                var hitTank1 = false
                var hitTank2 = false

                if (tank1.isPointInside(this.x, this.y)) {
                    hitTank1 = true
                }
                if (tank2.isPointInside(this.x, this.y)) {
                    hitTank2 = true
                }

                if (hitTank1) dist1 = 0
                if (hitTank2) dist2 = 0
            }
            
            var angle = 0
            if (this.blowTank && this.innerRadius + this.thickness + this.scene.tank1.hitRadius > dist1) {
                if (this.scene.tank1.top.x === this.x) {
                    if (this.scene.tank1.top.y > this.y) angle = -Math.PI/2
                    else angle = Math.PI/2
                }
                else angle = Math.atan((this.scene.tank1.top.y - this.y) / (this.scene.tank1.top.x - this.x))
                angle = angle + ((this.scene.tank1.top.x - this.x) > 0 ? 0 : -Math.PI)
                this.scene.tank1.body.setVelocity(this.data.blowPower * Math.cos(angle), 2 * this.data.blowPower * Math.sin(angle))
                this.scene.tank1.body.setGravityY(300)
                this.scene.tank1.setPosition(this.scene.tank1.centre.x, this.scene.tank1.centre.y)
                this.scene.tank1.body.position.set(this.scene.tank1.centre.x, this.scene.tank1.centre.y)
                this.blowTank = false
            }
            if (this.blowTank && this.innerRadius + this.thickness + this.scene.tank2.hitRadius > dist2) {
                if (this.scene.tank2.top.x === this.x) {
                    if (this.scene.tank2.top.y > this.y) angle = -Math.PI/2
                    else angle = Math.PI/2
                }
                else angle = Math.atan((this.scene.tank2.top.y - this.y) / (this.scene.tank2.top.x - this.x))
                angle = angle + ((this.scene.tank2.top.x - this.x) > 0 ? 0 : -Math.PI)
                this.scene.tank2.body.setVelocity(this.data.blowPower * Math.cos(angle), 2 * this.data.blowPower * Math.sin(angle))
                this.scene.tank2.body.setGravityY(300)
                this.scene.tank2.setPosition(this.scene.tank2.centre.x, this.scene.tank2.centre.y)
                this.scene.tank2.body.position.set(this.scene.tank2.centre.x, this.scene.tank2.centre.y)
                this.blowTank = false
            }
        }
        else {
            this.finish()
        }
    }


    animateHole1 = () => {
        var ctx = this.terrain.canvas.getContext('2d')
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.globalAlpha = 1

        ctx.fillStyle = 'rgba(0,0,0,1)'
        
        ctx.beginPath()
        ctx.arc(this.x, this.y, Math.min(this.outerRadius, this.maxRadius), 0, Math.PI * 2)
        ctx.closePath()
        ctx.fill()
        ctx.restore()

        this.innerRadius = Math.max(this.outerRadius - this.thickness, 0)
        if (this.modernPresentation || !this.canvas || this.skipGradientFrame()) return

        var canvas = this.canvas
        var ctx2 = canvas.getContext('2d')
        ctx2.clearRect(0, 0, canvas.width, canvas.height)

        if (!this.cacheable || this.scene.blastCache.exists(this.blastType, this.outerRadius) === false) {
            ctx2.globalCompositeOperation = 'source-over'
    
            var grd = ctx2.createRadialGradient(this.maxRadius, this.maxRadius, this.innerRadius, this.maxRadius, this.maxRadius, this.outerRadius)
    
            this.gradient.forEach((ele) => {
                grd.addColorStop(ele.relativePosition, ele.color)
            });
            
            ctx2.fillStyle = grd
            ctx2.beginPath()
            ctx2.arc(this.maxRadius, this.maxRadius, this.outerRadius, 0, Math.PI * 2)
            ctx2.closePath()
            ctx2.fill()
            
            ctx2.globalCompositeOperation = 'destination-in'
    
            ctx2.fillStyle = 'rgba(0,0,0,1)'
            
            ctx2.beginPath()
            ctx2.arc(this.maxRadius, this.maxRadius, this.maxRadius, 0, Math.PI * 2)
            ctx2.closePath()
            ctx2.fill()

            if (this.cacheable) this.scene.blastCache.addCanvas(this.blastType, this.outerRadius, canvas)
        }
        else {
            ctx2.drawImage(this.scene.blastCache.getCanvas(this.blastType, this.outerRadius), 0, 0)
        }
        // WebGL keeps its own copy of canvas textures: upload after drawing.
        this.refreshTexture()
    }





    updateType2 = () => {
        this.outerRadius++
        if (this.maxRadius > this.innerRadius) {
            this.animateHole2()
        }
        else {
            this.finish()
        }
    }


    animateHole2 = () => {
        var ctx = this.terrain.canvas.getContext('2d')
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.globalAlpha = 1

        ctx.fillStyle = 'rgba(0,0,0,1)'
        
        ctx.beginPath()
        ctx.arc(this.x, this.y, Math.min(this.outerRadius, this.maxRadius), 0, Math.PI * 2)
        ctx.closePath()
        ctx.fill()
        ctx.restore()

        if (this.modernPresentation || !this.canvas || this.skipGradientFrame()) {
            if (this.circles.length) this.innerRadius = Math.max(this.outerRadius - this.thickness * this.circles.length, 0)
            return
        }

        var canvas = this.canvas
        var ctx2 = canvas.getContext('2d')

        ctx2.clearRect(0, 0, canvas.width, canvas.height)
        
        if (!this.cacheable || this.scene.blastCache.exists(this.blastType, this.outerRadius) === false) {
            ctx2.globalCompositeOperation = 'source-over'
            
            for (var i = 0; i < this.circles.length; i++) {
                this.innerRadius = Math.max(this.outerRadius - this.thickness * (i + 1), 0)
                var grd = ctx2.createRadialGradient(this.maxRadius, this.maxRadius, this.innerRadius, this.maxRadius, this.maxRadius, Math.min(this.outerRadius, this.innerRadius + this.thickness))
                var gradient = this.circles[i]
                
                gradient.forEach((ele) => {
                    grd.addColorStop(ele.relativePosition, ele.color)
                });
                
                ctx2.fillStyle = grd
                ctx2.beginPath()
                ctx2.arc(this.maxRadius, this.maxRadius, Math.min(this.maxRadius, this.outerRadius, this.innerRadius + this.thickness), 0, Math.PI * 2)
                ctx2.closePath()
                ctx2.fill()
                
                if (this.innerRadius === 0) {
                    break
                }
            }
    
            ctx2.globalCompositeOperation = 'destination-in'
            ctx2.fillStyle = 'rgba(0,0,0,1)'
            
            ctx2.beginPath()
            ctx2.arc(this.maxRadius, this.maxRadius, this.maxRadius, 0, Math.PI * 2)
            ctx2.closePath()
            ctx2.fill()

            ctx2.globalCompositeOperation = 'destination-out'
            ctx2.fillStyle = 'rgba(0,0,0,1)'
            
            ctx2.beginPath()
            ctx2.arc(this.maxRadius, this.maxRadius, Math.max(this.innerRadius + 1, 0), 0, Math.PI * 2)
            ctx2.closePath()
            ctx2.fill()

            if (this.cacheable) this.scene.blastCache.addCanvas(this.blastType, this.outerRadius, canvas)
        }
        else { 
            ctx2.drawImage(this.scene.blastCache.getCanvas(this.blastType, this.outerRadius), 0, 0)
        }
        // WebGL keeps its own copy of canvas textures: upload after drawing.
        this.refreshTexture()

    }


    updateType3 = () => {
        this.outerRadius++
        if (this.outerRadius < 2*this.maxRadius) {
            this.animateHole3()
        }

        else {
            this.finish()
        }
    }


    animateHole3 = () => {
        var ctx = this.terrain.canvas.getContext('2d')
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.globalAlpha = 1

        ctx.fillStyle = 'rgba(0,0,0,1)'
        
        ctx.beginPath()
        ctx.arc(this.x, this.y, Math.min(this.outerRadius, this.maxRadius), 0, Math.PI * 2)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
        //this.terrain.update()

        if (this.modernPresentation || !this.canvas || this.skipGradientFrame()) {
            if (this.circles.length) this.innerRadius = Math.max(this.outerRadius - this.thickness * this.circles.length, 0)
            if (this.outerRadius >= this.maxRadius) this.variableRadius--
            return
        }

        var canvas = this.canvas
        var ctx2 = canvas.getContext('2d')

        ctx2.clearRect(0, 0 , canvas.width, canvas.height)
        
        if (!this.cacheable || this.scene.blastCache.exists(this.blastType, this.outerRadius) === false) {
            ctx2.globalCompositeOperation = 'source-over'
    
            for (var i = 0; i < this.circles.length; i++) {
                this.innerRadius = Math.max(this.outerRadius - this.thickness * (i + 1), 0)
        
                var grd = ctx2.createRadialGradient(this.maxRadius, this.maxRadius, this.innerRadius, this.maxRadius, this.maxRadius, Math.min(this.outerRadius, this.innerRadius + this.thickness))
                var gradient = this.circles[i]
    
                gradient.forEach((ele) => {
                    grd.addColorStop(ele.relativePosition, ele.color)
                });
          
                ctx2.fillStyle = grd
                ctx2.beginPath()
                ctx2.arc(this.maxRadius, this.maxRadius, Math.min(this.maxRadius, this.outerRadius, this.innerRadius + this.thickness), 0, Math.PI * 2)
                ctx2.closePath()
                ctx2.fill()
    
                if (this.innerRadius === 0) {
                    break
                }
            }
       
            ctx2.globalCompositeOperation = 'destination-in'
    
            ctx2.fillStyle = 'rgba(0,0,0,1)'
            
            ctx2.beginPath()
            ctx2.arc(this.maxRadius, this.maxRadius, Math.max(this.variableRadius, 0), 0, Math.PI * 2)
            ctx2.closePath()
            ctx2.fill()
    
            ctx2.globalCompositeOperation = 'destination-out'
    
            ctx2.fillStyle = 'rgba(0,0,0,1)'
            
            ctx2.beginPath()
            ctx2.arc(this.maxRadius, this.maxRadius, Math.max(this.innerRadius + 1, 0), 0, Math.PI * 2)
            ctx2.closePath()
            ctx2.fill()

            if (this.cacheable) this.scene.blastCache.addCanvas(this.blastType, this.outerRadius, canvas)
        }
        else {
            ctx2.drawImage(this.scene.blastCache.getCanvas(this.blastType, this.outerRadius), 0, 0)
        }
        // WebGL keeps its own copy of canvas textures: upload after drawing.
        this.refreshTexture()

        if (this.outerRadius >= this.maxRadius) {
            this.variableRadius--
        }
    }
}
