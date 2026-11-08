import { scoreHit, splashScore } from '../weapons/expansion/tactics';
import { createWeaponProjectile, emitWeaponMuzzle, getWeaponFX } from '../graphics/weapon-fx';
import { legacyWeaponStyle } from '../graphics/legacy-weapon-style';
import { legacyMechanicalRules } from '../weapons/expansion/unique-mechanics';
import Phaser from "phaser";
import { Turret } from "./Turret";
import { weaponArray } from "../weapons/array";

// Zero-gravity projectiles (spiderlings) never fall back once they leave the top.
export const SKY_LIMIT_Y = -200
let shotSerial = 0

export class Weapon {
    
    /**
    * @param {Phaser.Scene} scene
    */

    constructor (scene, tank, id, previewHandler = null) {
        if (id === null || id === undefined) id = 0

        this.scene = scene
        this.id = id
        this.mechanicalRules = id < 30 ? legacyMechanicalRules(id) : []
        this.tank = tank
        this.turret = this.tank.turret
        this.powerFactor = this.turret.powerFactor
        this.terrain = this.scene.terrain
        const entry = weaponArray[this.id] || weaponArray[0]
        this.weaponHandler = previewHandler || (entry.createInstance ? entry.createInstance() : entry)
        this.allowUpdate = false
        this.finished = false
        this.serial = ++shotSerial
        this.createdTextures = new Set()
        this.legacyVisuals = new Map()
        // One listener per shot: it is removed again in finish(), so a long
        // match does not accumulate shutdown handlers.
        this.handleShutdown = () => this.finish()
        this.scene.events?.once?.('shutdown', this.handleShutdown)

        this.runSafely('create', this.create)
        if (this.finished) return

        // Isolated aim previews advance their own clock and physics.
        if (previewHandler) return

        this.shotTimer = this.scene.time.delayedCall(500, () => {
            this.shotTimer = null
            if (this.finished) return
            this.runSafely('shoot', this.shoot)
            if (!this.finished) this.allowUpdate = true
        });
    }



    /**
     * Unique per-shot texture key. Legacy weapons used to share 'projectile',
     * so overlapping shots or previews removed each other's textures.
     */
    texKey = (base) => {
        const key = `${base}~w${this.id}~s${this.serial}`
        this.createdTextures.add(key)
        return key
    }



    runSafely = (phase, task) => {
        try {
            task()
        }
        catch (error) {
            console.error(`[Weapon] '${this.weaponHandler?.name ?? this.id}' failed during ${phase}; ending the shot.`, error)
            this.abort()
        }
    }



    handlerObjects = () => {
        const found = new Set()
        Object.values(this.weaponHandler || {}).forEach(value => {
            const objects = Array.isArray(value) ? value : [value]
            objects.forEach(object => {
                if (object?.scene === this.scene && object.active && object.body && typeof object.destroy === 'function' &&
                    object !== this.tank && object !== this.scene.tank1 && object !== this.scene.tank2 && object !== this.turret) found.add(object)
            })
        })
        return [...found]
    }



    // Force-finish a shot whose handler threw, so the turn can still advance.
    abort = () => {
        this.handlerObjects().forEach(object => {
            try { object.destroy(true) }
            catch (error) { console.error('[Weapon] could not destroy a projectile while aborting the shot', error) }
        })
        // Expansion runtimes own their projectiles, timers and shutdown hook.
        if (this.id >= 30) {
            // finish() disposes and also settles any terrain the runtime already dug,
            // so an aborted shot leaves the same collapsed terrain on every client.
            try {
                if (this.weaponHandler?.finish) this.weaponHandler.finish()
                else this.weaponHandler?.dispose?.()
            }
            catch (error) {
                console.error('[Weapon] expansion runtime finish failed while aborting the shot', error)
                try { this.weaponHandler?.dispose?.() } catch (disposeError) { console.error('[Weapon] expansion runtime dispose failed', disposeError) }
            }
        }
        if (this.turret && this.turret.activeWeapon === this) this.turret.activeWeapon = null
        this.finish()
    }



    /** Idempotent end-of-shot cleanup (called by Turret when activeWeapon is cleared). */
    finish = () => {
        if (this.finished) return
        this.finished = true
        this.allowUpdate = false
        this.shotTimer?.remove?.(false)
        this.shotTimer = null
        this.scene.events?.off?.('shutdown', this.handleShutdown)
        try {
            this.weaponHandler?.onShotFinished?.(this)
        }
        catch (error) {
            console.error(`[Weapon] '${this.weaponHandler?.name ?? this.id}' cleanup failed`, error)
        }
        // finish() runs from tween/timer callbacks via the activeWeapon setter, so it must never throw.
        this.legacyVisuals.forEach(visual => {
            try { visual.destroy() }
            catch (error) { console.error('[Weapon] could not destroy a shot visual', error) }
        })
        this.legacyVisuals.clear()
        try { this.releaseTextures() }
        catch (error) { console.error('[Weapon] could not release shot textures', error) }
    }



    texturesInUse = () => {
        const inUse = new Set()
        const visit = (list, depth) => {
            if (!Array.isArray(list) || depth > 8) return
            list.forEach(object => {
                if (!object || object.active === false) return
                if (object.texture?.key) inUse.add(object.texture.key)
                if (object.list) visit(object.list, depth + 1)
            })
        }
        visit(this.scene.sys?.displayList?.list || this.scene.children?.list || [], 0)
        return inUse
    }

    // Textures still displayed when the shot ends are retried a few times instead of leaking.
    releaseTextures = (attempt = 0) => {
        const textures = this.scene.textures
        if (!textures?.exists || !textures.remove) return
        const inUse = this.texturesInUse()
        this.createdTextures.forEach(key => {
            if (inUse.has(key)) return
            if (textures.exists(key)) textures.remove(key)
            this.createdTextures.delete(key)
        })
        if (this.createdTextures.size && attempt < 5 && this.scene.time?.delayedCall && this.scene.sys?.isActive?.() !== false) {
            this.scene.time.delayedCall(500, () => {
                try { this.releaseTextures(attempt + 1) }
                catch (error) { console.error('[Weapon] deferred texture release failed', error) }
            })
        }
    }



    create = () => {
        this.weaponHandler.create(this)
    }



    shoot = () => {
        this.tank.presentation?.fire()
        this.weaponHandler.shoot(this)
        this.update()
    }



    update = () => {
        if (this.allowUpdate && !this.finished) this.runSafely('update', this.step)
    }



    step = () => {
        this.weaponHandler.update(this)
        // The handler may have ended the shot during its own update.
        if (this.finished) return
        if (this.id < 30) {
            // Several originals create secondary physics sprites directly
            // instead of using defaultShoot (napalm, hail and fragment fans).
            Object.values(this.weaponHandler).forEach(value => {
                const objects = Array.isArray(value) ? value : [value]
                objects.forEach(object => {
                    if (object?.scene === this.scene && object.active && object.body?.velocity && object.canvas?.getContext &&
                        object !== this.scene.tank1 && object !== this.scene.tank2 && object !== this.turret &&
                        !/^(tank|turret|wall)/.test(object.texture?.key || '')) this.attachLegacyVisual(object, true)
                })
            })
        }
        this.legacyVisuals.forEach((visual, object) => {
            if (!object.scene || !object.active) {visual.destroy();this.legacyVisuals.delete(object);return}
            visual.setPosition(object.x, object.y)
            visual.setVisible?.(object.visible)
        })
    }


    defaultShoot = (obj, v, g = 300, p, r) => {
        var velocity = v === undefined ? this.tank.power * this.powerFactor : v
        var gravity = g
        var rotation = r === undefined ? this.turret.rotation - Math.PI/2 : r

        if (p !== null && p !== undefined) {
            obj.setPosition(p.x, p.y)
        }
        else {
            obj.setPosition(this.turret.x + (this.turret.height/2) * Math.sin(this.turret.rotation), this.turret.y - (this.turret.height/2) * Math.cos(this.turret.rotation))
        }

        obj.setRotation(rotation)
        obj.setVelocity(velocity * Math.cos(rotation), velocity * Math.sin(rotation)) 
        obj.body.setGravityY(gravity)
        obj.setDepth(2)        
        //obj.body.prevCenter = new Phaser.Math.Vector2(obj.body.center.x, obj.body.center.y)
        
        //console.log(obj.body.prevCenter.x, obj.body.prevCenter.y)
        //obj.updateFromGameObject()
        obj.body.setSize(1,1)
        obj.body.preUpdate(false, 0)
        if (this.attachLegacyVisual(obj)) emitWeaponMuzzle(this.scene,obj.x,obj.y,rotation,this.legacyVisualOptions(rotation))
        //obj.body.updateFromGameObject()
        //obj.body.center.x = obj.x
        //obj.body.center.y = obj.y
        //console.log(obj.body.center.x, obj.body.center.y)
    }

    legacyVisualOptions = (angle, small = false) => ({...legacyWeaponStyle(this.scene, this.id),
        weaponId:this.id,weaponName:this.weaponHandler.name,semanticRules:this.mechanicalRules,angle,small})

    attachLegacyVisual = (object, small = false) => {
        if (this.finished || this.id >= 30 || this.legacyVisuals.has(object)) return false
        const fx = getWeaponFX(this.scene)
        if (!fx || fx.projectiles?.size >= 128) return false
        const angle = object.body?.velocity ? Math.atan2(object.body.velocity.y,object.body.velocity.x) : object.rotation
        const visual = createWeaponProjectile(this.scene,object.x,object.y,this.legacyVisualOptions(angle,small))
        this.legacyVisuals.set(object,visual)
        // Keep the sprite's collision and logical visibility intact.
        object.setAlpha(0)
        object.once('destroy',()=>{visual.destroy();this.legacyVisuals.delete(object)})
        return true
    }



    defaultUpdate = (obj) => {
        if (!obj?.body) return
        var x = obj.body.x
        var y = obj.body.y

        //console.log('update pos', x, y, this.terrain.getPixel(x,y))
        //console.log('update vel', obj.body.velocity.x, obj.body.velocity.y)

        //this.terrain.setPixel(x,y, 255,255,255,255)
        
        var tank1 = this.tank
        var tank2 = (this.tank === this.scene.tank1) ? this.scene.tank2 : this.scene.tank1

        var hitTank1 = false
        var hitTank2 = false

        if (tank1.isPointInside(x, y)) {
            hitTank1 = true
        }
        if (tank2.isPointInside(x, y)) {
            hitTank2 = true
        }

        if (obj.body.velocity.x !== 0) {
            obj.setRotation(Math.atan(obj.body.velocity.y / obj.body.velocity.x))
    
            if (obj.body.velocity.x < 0) {
                obj.setRotation(obj.rotation + Math.PI)
            }
        }
        else {
            if (obj.body.velocity.y < 0) {
                obj.setRotation(-Math.PI/2)
            }
            if (obj.body.velocity.y > 0) {
                obj.setRotation(Math.PI/2)
            }
        }

        if (x <= 0 || x >= this.scene.terrain.width - 1) {
            this.weaponHandler.onOutOfBound(this, obj)
        }
        
        else if (y < SKY_LIMIT_Y && !(obj.body.gravity?.y > 0)) {
            this.weaponHandler.onOutOfBound(this, obj)
        }

        else if (y < 0) {
            // Above the screen: gravity brings ordinary shells back down.
        }
        
        else if (y >= this.terrain.height) {
            this.weaponHandler.onBaseHit(this, obj)
        }
        
        else if (this.terrain.getPixel(x, y).alpha > 0) {
            this.weaponHandler.onTerrainHit(this, obj)
        }

        else if (hitTank1 === true) {
            this.weaponHandler.onTankHit(this, obj, tank1)
        }

        else if (hitTank2 === true) {
            this.weaponHandler.onTankHit(this, obj, tank2)
        }

        // else if (point.r === 230 && point.g === 0 && point.b === 230) {
        //     this.weaponHandler.onBounceHit(this, obj)
        // }


        // if (obj.body !== undefined) {
        //     obj.body.prevCenter.set(obj.body.center.x, obj.body.center.y)
        // }
    }



    updateTail = (obj, factor, minimum, thickness, color, taper) => {
        if (!obj?.body || !obj.canvas || this.legacyVisuals.has(obj)) return
        var tailLength = obj.body.speed / factor + minimum
        //var tailLength = new Phaser.Math.Vector2(obj.velX, obj.velY).length() / factor + minimum
        tailLength = Math.floor(tailLength)
    
        var centreX = obj.canvas.width/2
        var centreY = obj.canvas.height/2

        var ctx = obj.canvas.getContext('2d')
        
        var grd = ctx.createLinearGradient(obj.canvas.width/2, obj.canvas.height/2, obj.canvas.width/2 - tailLength,  obj.canvas.height/2)
        grd.addColorStop(0, `rgba(${color.r},${color.g},${color.b},1)`)
        grd.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`)
        ctx.fillStyle = grd

        ctx.clearRect(0, 0, centreX, obj.canvas.height)

        if (taper === false) {
            ctx.fillRect(centreX - tailLength, centreY - thickness/2, tailLength, thickness)
        }
        else {
            ctx.beginPath()
            ctx.moveTo(centreX - tailLength, centreY - thickness/2 + thickness/8)
            ctx.lineTo(centreX, centreY - thickness/2)
            ctx.lineTo(centreX, centreY + thickness/2)
            ctx.lineTo(centreX - tailLength, centreY + thickness/2 - thickness/8)
            ctx.closePath()
            ctx.fill()
        }
        //ctx.fillRect(0, 0, tailLength, thickness)
    }



    defaultUpdateScore = (x, y, blastRadius, factor) => {
        if (!Number.isFinite(factor)) return
        return splashScore(this, x, y, blastRadius, factor)

    }

    
    
    constantUpdateScore = (points) => {
        if (isNaN(points)) return
            this.tank.updateScore(points)
    }



    // Direct points against one tank, honouring shields, acid and self-hit penalties.
    scoreTarget = (target, amount) => {
        if (!target || !Number.isFinite(amount) || amount <= 0) return 0
        return scoreHit(this.tank, target, amount)
    }



    defaultDigTerrain = (obj, thickness, intensity) => {
        if (obj.prevState !== null && obj.prevState !== undefined) {
            if (this.terrain.getPixel(obj.prevState.x, obj.prevState.y).alpha === 0 && this.terrain.getPixel(obj.body.x, obj.body.y).alpha === 0) {
                obj.prevState.x = obj.body.x
                obj.prevState.y = obj.body.y
                return
            }

            // Advance the previous point along the travelled segment until it
            // enters the terrain (bounded by the segment length).
            var dx = obj.body.x - obj.prevState.x
            var dy = obj.body.y - obj.prevState.y
            var steps = Math.ceil(Math.hypot(dx, dy))
            for (let i = 0; i < steps && this.terrain.getPixel(obj.prevState.x, obj.prevState.y).alpha === 0; i++) {
                obj.prevState.x += dx / steps
                obj.prevState.y += dy / steps
            }

            var ctx = this.terrain.getContext()

            ctx.save()
            ctx.globalCompositeOperation = 'source-atop'
            ctx.lineJoin = 'round'
            ctx.strokeStyle = `rgba(0,0,0,${intensity})`
            ctx.lineCap = 'round'
            ctx.globalAlpha = 1
            ctx.lineWidth = thickness

            ctx.beginPath()
            ctx.moveTo(obj.prevState.x, obj.prevState.y)
            ctx.lineTo(obj.body.x, obj.body.y)
            ctx.stroke()
            ctx.restore()

            // Digging only paints a track. Queue the terrain texture upload
            // without rebuilding collision data; refresh batches it per frame.
            this.terrain.refresh()

            obj.prevState.x = obj.body.x
            obj.prevState.y = obj.body.y
        }

        else {
            obj.prevState = {x: obj.body.x, y: obj.body.y}
        }
    }



    defaultBounce = (obj, factor = 0.6, speed) => {
        if (obj.body.speed === 0) {
            return false
        }

        if (this.terrain.getPixel(obj.body.prev.x, obj.body.prev.y).alpha > 0) {
            obj.setPosition(obj.body.prev.x, obj.body.prev.y)
            obj.body.updateFromGameObject()
            return false
        }

        // Callers only bounce a body that has entered terrain: retract it to
        // the surface and reflect its velocity about the local slope.
        var rotation = obj.body.velocity.angle()
        var [x, y, prevX, prevY] = this.retractInTerrain(obj)
        obj.body.x = x
        obj.body.y = y

        var slope = this.terrain.getSlope(prevX, prevY)
        if (isNaN(slope) === true) {
            slope = obj.body.velocity.x > 0 ? -Math.PI/2 : Math.PI/2
        }

        var diff = rotation - slope
        var reflect = slope - diff
        var newSpeed = speed ? speed : obj.body.speed * factor

        obj.body.velocity.setAngle(reflect)
        obj.body.velocity.setLength(newSpeed)
        obj.body.preUpdate(false, 0)
        return true
    }




    retractInTerrain = (obj) => {
        var x = obj.body.x
        var y = obj.body.y

        //console.log('retract pos', x, y)

        if (obj.body.speed === 0) {
            return [x, y, x, y]
        }

        if (this.terrain.getPixel(obj.body.prev.x, obj.body.prev.y).alpha > 0) {
            //console.log('prev inside terrain', obj.body.prev.x, obj.body.prev.y)
            return [obj.body.prev.x, obj.body.prev.y, obj.body.prev.x, obj.body.prev.y]
        }

        var prevX = x, prevY = y;
        var initX = x, initY = y;
        var maxCount = 100000
        var theta = obj.body.velocity.angle()
        // var theta = Phaser.Math.Angle.Wrap(new Phaser.Math.Vector2(obj.velX, obj.velY).angle() + Math.PI)
        var sin = Math.sin(theta)
        var cos = Math.cos(theta)

        var accelarationX = obj.body.gravity.x
        var accelarationY = obj.body.gravity.y

        var t = 0.0001
        var v = obj.body.speed
        // var v = new Phaser.Math.Vector2(obj.velX, obj.velY).length()

        while (this.terrain.getPixel(x, y).alpha !== 0) {
            prevX = x
            prevY = y

            x = initX - (v * cos + 1/2 * accelarationX * t) * t
            y = initY - (v * sin + 1/2 * accelarationY * t) * t

            t = t + 0.0001

            //this.terrain.setPixel(prevX,prevY,255,0,0,255)

            maxCount--
            if (maxCount <= 0) {
                x = initX
                y = initY
                break
            }
        }

        //console.log('retract----pos', x, y)
        //console.log('retract----', this.terrain.getPixel(x,y))

        return [x, y, prevX, prevY]
    }



    retractBase = (obj) => {
        var x = obj.body.x
        var y = obj.body.y

        if (obj.body.speed === 0) {
            return [x, y, x, y]
        }

        var prevX = x, prevY = y;
        var initX = x, initY = y;
        var maxCount = 100000
        var theta = obj.body.velocity.angle()
        // var theta = Phaser.Math.Angle.Wrap(new Phaser.Math.Vector2(obj.velX, obj.velY).angle() + Math.PI)
        var sin = Math.sin(theta)
        var cos = Math.cos(theta)

        var accelarationX = obj.body.gravity.x
        var accelarationY = obj.body.gravity.y

        var t = 0.0001
        var v = obj.body.speed

        while (y >= this.terrain.height - 1) {
            prevX = x
            prevY = y

            x = initX - (v * cos + 1/2 * accelarationX * t) * t
            y = initY - (v * sin + 1/2 * accelarationY * t) * t

            t = t + 0.0001

            maxCount--
            if (maxCount <= 0) {
                x = initX
                y = initY
                break
            }
        }

        return [x, y, prevX, prevY]
    }



    retractInAir = (obj) => {
        var x = obj.body.x
        var y = obj.body.y

        if (obj.body.speed === 0) {
            return [x, y, x, y]
        }

        if (obj.body.position.equals(obj.body.prev)) {
            return [x, y, x, y]
        }

        var prevX = x, prevY = y;
        var initX = x, initY = y;
        var maxCount = 100000
        var theta = obj.body.velocity.angle()
        // var theta = Phaser.Math.Angle.Wrap(new Phaser.Math.Vector2(obj.velX, obj.velY).angle() + Math.PI)
        var sin = Math.sin(theta)
        var cos = Math.cos(theta)

        var accelarationX = obj.body.gravity.x
        var accelarationY = obj.body.gravity.y

        var t = 0.0001
        var v = obj.body.speed
        // var v = new Phaser.Math.Vector2(obj.velX, obj.velY).length()

        while (this.terrain.getPixel(x, y).alpha === 0) {
            prevX = x
            prevY = y

            x = initX - (v * cos + 1/2 * accelarationX * t) * t
            y = initY - (v * sin + 1/2 * accelarationY * t) * t

            t = t + 0.0001

            maxCount--
            if (maxCount <= 0) {
                x = initX
                y = initY
                break
            }
        }

        return [x, y, prevX, prevY]
    }



    checkCloseToTerrain = (obj, distance) => {
        var x = obj.body.x
        var y = obj.body.y

        var prevX = x, prevY = y;
        var initX = x, initY = y;
        var maxCount = distance
        var theta = obj.body.velocity.angle()
        var sin = Math.sin(theta)
        var cos = Math.cos(theta)

        var accelarationX = obj.body.gravity.x
        var accelarationY = obj.body.gravity.y

        var t = 0.01
        var v = 100

        while (this.terrain.getPixel(x, y).alpha === 0) {
            prevX = x
            prevY = y

            x = initX + (v * cos + 1/2 * accelarationX * t) * t
            y = initY + (v * sin + 1/2 * accelarationY * t) * t

            t = t + 0.01

            maxCount--
            if (maxCount <= 0) {
                return false
            }
        }

        if (x >= this.terrain.width - 1 || x <= 0) {
            return false
        }

        if (y <= 0) return false

        return true
    }




    // Pull a projectile that overshot a proximity trigger back along its path
    // to the trigger radius (bounded; no-op when it is already outside).
    fixCloseToTank = (obj, data) => {
        var oppTank = (this.tank === this.scene.tank1) ? this.scene.tank2 : this.scene.tank1
        if (data?.oppTankDist === undefined || !oppTank?.centre || !obj?.body) return

        var x = obj.body.x
        var y = obj.body.y
        var prevX = x, prevY = y;
        var initX = x, initY = y;
        var maxCount = 10000
        var theta = obj.body.velocity.angle()
        var sin = Math.sin(theta)
        var cos = Math.cos(theta)
        var accelarationX = obj.body.gravity.x
        var accelarationY = obj.body.gravity.y
        var t = 0.0001
        var v = obj.body.speed
        const inside = (px, py) => Math.hypot(px - oppTank.centre.x, py - oppTank.centre.y) < data.oppTankDist

        while (v > 0 && inside(x, y)) {
            prevX = x
            prevY = y
            x = initX - (v * cos + 1/2 * accelarationX * t) * t
            y = initY - (v * sin + 1/2 * accelarationY * t) * t
            t = t + 0.0001

            maxCount--
            if (maxCount <= 0) {
                prevX = initX
                prevY = initY
                break
            }
        }

        obj.body.x = prevX
        obj.body.y = prevY
    }



    setBodyCenter = (obj, x, y) => {
        //this.center.set(this.position.x + this.halfWidth, this.position.y + this.halfHeight);
        obj.body.position.set(x - obj.body.halfWidth, y - obj.body.halfHeight)
    }
}
