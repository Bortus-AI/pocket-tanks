import { Textures } from "phaser";
import { drawTerrain, setTerrain } from "../graphics/terrain";
import { Blast } from "./Blast";
import { Tank } from "./Tank";
import Phaser from "phaser";
import { weaponArray } from "../weapons/array";

export class Terrain extends Textures.CanvasTexture {
    /**
    * @param {Phaser.Scene} scene
    */
    constructor (scene) { 
        var width = scene.game.renderer.width
        var height = scene.game.renderer.height
        
        var canvas = document.createElement('canvas');
        canvas.height = height * 2/3
        canvas.width = width
        if (scene.textures.exists('terrain')) scene.textures.remove('terrain')
        super(scene.textures, 'terrain', canvas, canvas.width, canvas.height)

        // Register this CanvasTexture subclass itself, matching addCanvas's
        // registration. A second CanvasTexture would upload a different GPU
        // source from the one the battlefield image displays.
        scene.textures.list.terrain = this
        scene.textures.emit('addtexture', 'terrain', this)
        this.image = scene.add.image(width/2, height/3, 'terrain')

        this.canvas = canvas
        this.scene = scene
        this.background = this.scene.background
        this.width = canvas.width;
        this.height = canvas.height;
        this.matrix = [];
        this.animate = false
        this.blastArray = [];
        this.path = []
        this.previousSaved = null
        this.soundEffects = ['rocks_1', 'rocks_2', 'rocks_3', 'rocks_4', 'rocks_5', 'rocks_6']
        this.soundEffectIndex = 0
        this.gpuDirty = false
        this.uploadCount = 0
        this.flushTexture = () => {
            if (!this.gpuDirty) return
            Textures.CanvasTexture.prototype.refresh.call(this)
            this.gpuDirty = false
            this.uploadCount++
        }
        scene.events.on('postupdate', this.flushTexture)
        const physicsWorld = scene.physics.world
        scene.events.once('shutdown', () => {
            scene.events.off('postupdate', this.flushTexture)
            physicsWorld.off('worldstep', this.updateTerrain, this)
        })

        this.scene.physics.world.on('worldstep', this.updateTerrain, this)
    }

    // Collision buffers still update synchronously. Coalesce GPU uploads until
    // the scene finishes its frame, even if several weapons edit the mask.
    refresh() {
        if (!this.scene) return Textures.CanvasTexture.prototype.refresh.call(this)
        this.gpuDirty = true
        this.revision = (this.revision || 0) + 1
        return this
    }



    create = () => {
        var width = this.width
        var height = this.height
        var ctx = this.canvas.getContext('2d')

        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
        this.path = drawTerrain(ctx, width, height, this)
        ctx.restore()
        this.update()
    }



    setPath = (path) => {
        this.path = path
        var width = this.width
        var height = this.height
        var ctx = this.canvas.getContext('2d')

        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
        setTerrain(ctx, width, height, path, this)
        ctx.restore()
        this.update()
    }



    // Run-length encode gameplay material as well as solidity: rubber and glue
    // must agree on both clients for later bounces and coating counters to work.
    exportMask = () => {
        const pixels=this.context.getImageData(0,0,this.width,this.height).data;
        const material=i=>!pixels[i+3]?0:pixels[i]===230&&pixels[i+1]===0&&pixels[i+2]===230?2:pixels[i]===135&&pixels[i+1]===155&&pixels[i+2]===82?3:1;
        const runs=[],values=[],tar=[];let value=material(0),count=0,tarStart=null;
        for(let i=0;i<pixels.length;i+=4){
            const state=material(i);if(state===value)count++;else{runs.push(count);values.push(value);count=1;value=state;}
            const black=pixels[i+3]>0&&pixels[i]<=8&&pixels[i+1]<=8&&pixels[i+2]<=12;
            if(black&&tarStart===null)tarStart=i/4;
            if(!black&&tarStart!==null){tar.push(tarStart,i/4-tarStart);tarStart=null;}
        }
        if(tarStart!==null)tar.push(tarStart,pixels.length/4-tarStart);
        runs.push(count);values.push(value);
        // Optional visual material layer keeps the existing solidity/material
        // protocol readable by clients that predate black tar terrain.
        return {version:2,runs,values,...(tar.length?{tar}:{})};
    }

    multiplayerCorrection = data => {
        if(!data || !Array.isArray(data.runs)) return;
        if(data.values && (!Array.isArray(data.values)||data.values.length!==data.runs.length))return;
        if(data.tar){
            if(!Array.isArray(data.tar)||data.tar.length%2)return;
            let end=0;
            for(let i=0;i<data.tar.length;i+=2){const start=data.tar[i],count=data.tar[i+1];if(!Number.isInteger(start)||!Number.isInteger(count)||start<end||count<1||start+count>this.width*this.height)return;end=start+count;}
        }
        const image=this.context.getImageData(0,0,this.width,this.height);
        let offset=0,legacy=data.first?1:0;
        for(let run=0;run<data.runs.length;run++){
            const count=data.runs[run],value=data.values?data.values[run]:legacy;
            if(!Number.isInteger(count)||count<0||offset+count>this.width*this.height||![0,1,2,3].includes(value))return;
            for(let n=0;n<count;n++,offset++){
                const i=offset*4;
                if(value===2){image.data[i]=230;image.data[i+1]=0;image.data[i+2]=230;}
                else if(value===3){image.data[i]=135;image.data[i+1]=155;image.data[i+2]=82;}
                else if(value===1){
                    const wasRubber=image.data[i]===230&&image.data[i+1]===0&&image.data[i+2]===230;
                    const wasGlue=image.data[i]===135&&image.data[i+1]===155&&image.data[i+2]===82;
                    const wasTar=image.data[i]<=8&&image.data[i+1]<=8&&image.data[i+2]<=12;
                    if(!image.data[i+3]||wasRubber||wasGlue||wasTar){image.data[i]=99;image.data[i+1]=112;image.data[i+2]=85;}
                }
                image.data[i+3]=value?255:0;
            }
            legacy=1-legacy;
        }
        if(offset!==this.width*this.height)return;
        for(let run=0;run<(data.tar?.length||0);run+=2)for(let n=data.tar[run],end=n+data.tar[run+1];n<end;n++){
            const i=n*4;if(!image.data[i+3])continue;image.data[i]=5;image.data[i+1]=5;image.data[i+2]=8;
        }
        this.context.putImageData(image,0,0);this.update();
    }

    save = () => {
        //this.update()
        this.previousSaved = this.context.getImageData(0, 0, this.width, this.height)
    }



    restore = () => {
        this.context.putImageData(this.previousSaved, 0, 0)
        this.update()
    }

    


    updateTerrain = () => {
        if (this.blastArray.length !== 0) {
            this.blastArray.forEach((hole) => {
                hole.update()
            })
    
            this.blastArray = this.blastArray.filter((hole) => {
                return (hole.toRemove === false)
            })
            this.refresh()
        }
        
        if (this.matrix.length === 0) {
            this.animate = false
            return
        }
        else {
            for (let i = 0; i < this.soundEffects.length; i++) {
                const e = this.soundEffects[i];
                var res = this.scene.sound.get(e)
                if (res !== null) break
                if (i === this.soundEffects.length - 1) {
                    this.scene.sound.play(this.soundEffects[this.soundEffectIndex])
                    this.soundEffectIndex++
                    if (this.soundEffectIndex >= this.soundEffects.length) {
                        this.soundEffectIndex = 0
                    }
                }
            }
        
            this.matrix = this.matrix.filter((ele) => {
                return (ele.base < ele.ground)
            })

            //this.update()
            var toDelete = []
        
            this.matrix.forEach((ele, i) => {
                //try {
                    var data = this.context.getImageData(ele.x, ele.top, 1, ele.base - ele.top)
                    this.context.putImageData(data, ele.x, ele.top + 1)
                    this.setPixel(ele.x, ele.top, 0, 0, 0, 0)
                    ele.top = ele.top + 1
                    ele.base = ele.base + 1
            })

            this.update()
        }
    }



    blast = (type, x, y, radius, data, blowTank, blastType) => {
        this.animate = true
        var hole = new Blast(this.scene, type, x, y, radius, data, blowTank, blastType)
        this.blastArray.push(hole)
    }



    fixTerrain = (x, y, r) => {
        if (y > this.height) return;
        
        var radius = r
        this.update()
    
        var left = x - radius
        var right = x + radius
        var do_break = false
        var duplicate = false
        var base, top, ground, duplicateIndex, i, j;

        for (i = left; i <= right; i++) {
            duplicate = false
            do_break = false
        
            // find base
            for (j = y; j >= 1; j--) {
                if (this.getPixel(i, j).alpha > 100) {
                    do_break = true;
                }
                if (do_break) {
                    break;
                }
            }
            base = j;
            do_break = false;
        
            // find top
            for (; j >= 0; j--) {
                if (this.getPixel(i, j).alpha === 0) {
                    do_break = true;
                }
                if (do_break) {
                    break;
                }
            }
            top = j;
            do_break = false

            // find ground
            for (j = y; j <= this.height; j++) {
                if (this.getPixel(i, j).alpha > 100) {
                    do_break = true;
                }
                if (do_break) {
                    break;
                }
            }
            ground = j;
            do_break = false;
            
            if (base !== 0 && top !== 0) {
                this.matrix.forEach((ele, index) => {
                    if (ele.x === i) {
                        duplicate = true
                        duplicateIndex = index
                    } 
                })

                if (duplicate) {
                    this.matrix[duplicateIndex].x = i
                    this.matrix[duplicateIndex].base = base
                    this.matrix[duplicateIndex].top = top
                    this.matrix[duplicateIndex].ground = ground
                }
                else
                    this.matrix.push({x: i, base, top, ground})
            }
        }
        //console.log(this.matrix)
        this.animate = true
    }



    fixTerrainShape = (points) => {
        this.update()
        
        var r, x, y, angle;
        var ax, ay, do_break = false, base, top, ground, j, duplicateIndex, duplicate = false;
        
        for (let i = 0; i < points.length - 2; i++) {
            x = points[i].x
            y = points[i].y
            r = Phaser.Math.Distance.BetweenPoints(points[i], points[i + 2]) + 2
            angle = Phaser.Math.Angle.Between(points[i].x, points[i].y, points[i + 2].x, points[i + 2].y)

            for (let i = 0; i <= r; i = i + 1) { 
                ax = Math.floor(x + i * Math.cos(angle))
                ay = Math.floor(y + i * Math.sin(angle))
    
                duplicate = false
                do_break = false
    
                // find base
                for (j = ay; j >= 1; j--) {
                    if (this.getPixel(ax, j).alpha > 100) {
                        do_break = true;
                    }
                    if (do_break) {
                        break;
                    }
                }   
                base = j;
                do_break = false;
            
                // find top
                for (; j >= -200; j--) {
                    if (this.getPixel(ax, j).alpha === 0) {
                        do_break = true;
                    }
                    if (do_break) {
                        break;
                    }
                }
                top = j;
                do_break = false
    
                // find ground
                for (j = ay; j <= this.height; j++) {
                    if (this.getPixel(ax, j).alpha > 100) {
                        do_break = true;
                    }
                    if (do_break) {
                        break;
                    }
                }
                ground = j;
                do_break = false;
                
                if (base !== 0 && top !== 0 && base !== top && base !== ground) {
                    this.matrix.forEach((ele, index) => {
                        if (ele.x === ax) {
                            duplicate = true
                            duplicateIndex = index
                        } 
                    })
    
                    if (duplicate) {
                        this.matrix[duplicateIndex].x = ax
                        this.matrix[duplicateIndex].base = base
                        this.matrix[duplicateIndex].top = top
                        this.matrix[duplicateIndex].ground = ground
                    }
                    else {
                        this.matrix.push({x: ax, base, top, ground})
                    }
                }
            }
    
            //console.log(this.matrix)
            this.animate = true
        }
    }



    getNeighbouringPoints = (x, y, count = 5) => {
        return this.getSlope(x, y, count, true)
    }



    getSlope = (x, y, pointsCount = 5, returnPoints = false) => {
        var points = []
        var maxPoints = pointsCount
        var left = {x: x, y: y}, right = {x: x, y: y}, counter = Math.floor(maxPoints/2 - 1);
        points[Math.floor(maxPoints/2)] = {x: x, y: y}

        left = this.getLeftGround(x, y) ?? left

        while (left !== null && counter !== -1) {
            left = this.getLeftGround(left.x, left.y) ?? left
            points[counter] = {...left}
            counter--
        }
        
        right = this.getRightGround(x, y) ?? right
        counter = Math.ceil(maxPoints/2)
        
        while (right !== null && counter !== maxPoints) {
            right = this.getRightGround(right.x, right.y) ?? right
            points[counter] = {...right}
            counter++
        }

        if (right.x - left.x !== 0) {
            var slope = (right.y - left.y) / (right.x - left.x)
            var angle = Math.atan(slope) + ((right.x - left.x) > 0 ? 0 : Math.PI)
        }
        else {
            var angle = undefined
        }

        if (returnPoints === true)
            return points
        else
            return angle
   }



    getRightGround = (x, y) => {
        var pos = [{x: x, y: y + 1}, {x: x + 1, y: y + 1}, {x: x + 1, y: y}, {x: x + 1, y: y - 1}, {x: x, y: y - 1}, {x: x - 1, y: y + 1}, {x: x - 1, y: y}, {x: x - 1, y: y - 1}]
        var checkPos = [{x: x + 1, y: y + 1}, {x: x + 1, y: y}, {x: x + 1, y: y - 1}, {x: x, y: y - 1}, {x: x - 1, y: y - 1}, {x: x, y: y + 1}, {x: x - 1, y: y + 1}, {x: x - 1, y: y}]
        var k = null

        for (let index = 0; index < pos.length; index++) {
            if (this.getPixel(pos[index].x, pos[index].y).alpha > 0) {
                if (this.getPixel(checkPos[index].x, checkPos[index].y).alpha === 0) {
                    k = pos[index]
                }
            }
        }
        if (x >= this.width)
            k = null
        
        return k;
    }



    getLeftGround = (x, y) => {
        var pos = [{x: x, y: y + 1}, {x: x - 1, y: y + 1}, {x: x - 1, y: y}, {x: x - 1, y: y - 1}, {x: x, y: y - 1}, {x: x + 1, y: y + 1}, {x: x + 1, y: y}, {x: x + 1, y: y - 1}]
        var checkPos = [{x: x - 1, y: y + 1}, {x: x - 1, y: y}, {x: x - 1, y: y - 1}, {x: x, y: y - 1}, {x: x + 1, y: y - 1}, {x: x, y: y + 1}, {x: x + 1, y: y + 1}, {x: x + 1, y: y}]
        var k = null
        
        for (let index = 0; index < pos.length; index++) {
            if (this.getPixel(pos[index].x, pos[index].y).alpha > 0) {
                if (this.getPixel(checkPos[index].x, checkPos[index].y).alpha === 0) {
                    k = pos[index]
                }
            }
        }
        if (x <= 0)
            k = null

        return k;
    }



    getSurface = (x, y, angle) => {
        //if (this.getPixel(x - 1 * Math.sin(angle), y + 1 * Math.cos(angle)).alpha === 0) return null

        var newX = x, newY = y, prevX = x, prevY = y
        for (let i = 0; i < 60; i++) {
            prevX = newX
            prevY = newY
            newX = x + i * Math.cos(angle)
            newY = y + i * Math.sin(angle)
            if (this.getPixel(newX, newY).alpha === 0) {
                //this.scene.blastLayer.setPixel(newX, newY, 0, 0, 0, 255)
                return {x: prevX, y: prevY}
            }
            //this.setPixel(newX, newY, 255,0,0,255)
            //this.scene.blastLayer.setPixel(newX, newY, 255, 0, 0, 255)
        }

        return null
    }



    getBase = (x, y) => {
        var newX = x, newY = y, prevX = x, prevY = y
        for (let i = 0; i < 1000; i++) {
            prevX = newX
            prevY = newY
            newX = prevX
            newY = prevY + 1
            if (this.getPixel(newX, newY).alpha > 0) {
                //this.scene.blastLayer.setPixel(newX, newY, 0, 0, 0, 255)
                return {x: prevX, y: prevY}
            }
            //this.scene.blastLayer.setPixel(newX, newY, 255, 0, 0, 255)
        }

        return null
    }



    getSurfaceUp = (x, y) => {
        //if (this.getPixel(x - 1 * Math.sin(angle), y + 1 * Math.cos(angle)).alpha === 0) return null

        var newX = x, newY = y, prevX = x, prevY = y
        for (let i = 0; i < 60; i++) {
            prevY = newY
            newY = prevY - 1
            if (this.getPixel(newX, newY).alpha === 0) {
                //this.scene.blastLayer.setPixel(newX, newY, 0, 0, 0, 255)
                return {x: prevX, y: prevY}
            }
            //this.scene.blastLayer.setPixel(newX, newY, 255, 0, 0, 255)
        }

        return null
    }

    


    retractPoint = (x, y, velocity, accelaration, gravity) => {
        if (velocity === undefined) return
        if (accelaration === undefined) accelaration = new Phaser.Math.Vector2(0, 0)
        if (gravity === undefined) gravity = new Phaser.Math.Vector2(0, 0)

        if (velocity.length() === 0 && accelaration.length() === 0 && gravity.length() === 0) return [x, y, x, y]
        
        var prevX = x, prevY = y;
        var initX = x, initY = y;
        var maxCount = 100000
        var theta = velocity.angle()
        var sin = Math.sin(theta)
        var cos = Math.cos(theta)

        var accelarationX = accelaration.x + gravity.x
        var accelarationY = accelaration.y + gravity.y

        var t = 0.0001
        var v = velocity.length()

        while (this.getPixel(x, y).alpha !== 0) {
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
}
