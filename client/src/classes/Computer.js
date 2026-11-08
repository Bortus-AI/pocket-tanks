// type0 = normal
// type1 = ground
// type2 = clear
// type3 = ground straight
// type4 = dirt builder (Magic Wall, Dirt Slinger, Dirtball): raised as cover


const COVER_MIN_DISTANCE = 60
const COVER_MAX_DISTANCE = 160
const COVER_GAP_FRACTION = 0.3

export class Computer {
    /**
     * @param {Phaser.Scene} scene 
     */

    constructor(scene, tank, level) {
        this.scene = scene
        this.tank = tank
        this.playerTank = scene.tank1
        this.terrain = scene.terrain
        this.powerFactor = tank.powerFactor
        this.level = level
        this.maxLevel = 8;
        this.factor = this.maxLevel - this.level + 1
    }



    play = () => {
        var randomIndex = Math.floor(Math.random() * this.tank.weapons.length)
        var randomWeapon = this.tank.weapons[randomIndex]

        //console.log(randomWeapon.name)

        if (randomWeapon.type === undefined || randomWeapon.type === 0) {
            this.handleType0(randomWeapon, randomIndex)
        }
        else if (randomWeapon.type === 1) {
            this.handleType1(randomWeapon, randomIndex)
        }
        else if (randomWeapon.type === 2) {
            this.handleType2(randomWeapon, randomIndex)
        }
        else if (randomWeapon.type === 3) {
            this.handleType3(randomWeapon, randomIndex)
        }
        else if (randomWeapon.type === 4) {
            this.handleType4(randomWeapon, randomIndex)
        }

        this.scene.hideTurnPointer()
    }



    deviate = (config) => {
        var x = Math.random() > 0.5 ? 1 : -1
        var y = Math.random() > 0.5 ? 1 : -1

        config.v += x * config.v * (Math.random()*this.factor)/100
        config.angle += y * config.angle * (Math.random()*this.factor)/100
    }


    // normal
    handleType0 = (randomWeapon, randomIndex) => {
        var clearUp = false
        var diffX = this.playerTank.x - this.tank.x
        var diffY = -(this.playerTank.y - this.tank.y)

        var angle = Math.atan(diffY/diffX)
        
        if (diffX > 0) {
            var minAngle = angle
            var maxAngle = Math.PI/2
        }
        else {
            var minAngle = Math.PI/2
            var maxAngle = angle + Math.PI
        }

        var accelaration = 300
        var cos, sin;
        var newX, newY;
        var v, dist = 10000, temp;
        var k = {angle: 0, v: 0}
        
        const findBestShot = () => {
            for (let theta = minAngle; theta < maxAngle; theta += 0.1 * this.factor) {
                for (v = this.powerFactor; v < 100 * this.powerFactor; v += this.powerFactor * this.factor) {
                    sin = Math.sin(theta)
                    cos = Math.cos(theta)
                    for (let t = 0; t < 5; t += 0.01 * this.factor) {
                        newX = this.tank.turret.x + v * cos * t
                        newY = this.tank.turret.y - v * sin * t + 1/2 * accelaration * t * t
                        if (newX < 0 || newX > this.terrain.width) {
                            break
                        }
                        if (newY > 0 && newY < this.terrain.height) {
                            //this.terrain.setPixel(newX, newY, 255, 0,0,255)
                            if (this.terrain.getPixel(newX, newY).alpha > 0 || newY - this.terrain.height > -1 * this.factor) {
                                temp = Math.sqrt( Math.pow( newX - this.playerTank.x, 2 ) + Math.pow( newY - this.playerTank.y, 2 ) )
                                if (temp < dist) {
                                    dist = temp
                                    k.angle = Math.PI/2 - theta
                                    k.v = v
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }

        findBestShot()

        this.deviate(k)

        var distBetweenTank = Math.sqrt( Math.pow( this.tank.x - this.playerTank.x, 2 ) + Math.pow( this.tank.y - this.playerTank.y, 2 ) )

        //console.log(distBetweenTank, dist)
        var moveRight = false
        var moveLeft = false

        if (distBetweenTank < 10 * dist) {
            if (this.tank.x > this.playerTank.x && Math.random() > 0.5) {
                if (this.tank.groundRight(this.tank.x, this.tank.y) !== null) {
                    moveRight = true
                }
                else {
                    clearUp = true
                }
            }
            else if (Math.random() > 0.5) {
                if (this.tank.groundLeft(this.tank.x, this.tank.y) !== null) {
                    moveLeft = true
                }
                else {
                    clearUp = true
                }
            }
        }

        //console.log(clearUp, moveLeft, moveRight)
        if (clearUp) {
            var availableClearUp = []
            for (let i = 0; i < this.tank.weapons.length; i++) {
                if (this.tank.weapons[i].type === 2) {
                    availableClearUp.push(i)
                }
            }
            if (availableClearUp.length > 0) {
                var idx = Math.floor(Math.random() * availableClearUp.length)
                //console.log('clearup later')
                this.handleType2(this.tank.weapons[availableClearUp[idx]], availableClearUp[idx])
                return
            }
            else {
                if (diffX > 0) {
                    if (this.tank.groundLeft(this.tank.x, this.tank.y) !== null && Math.random() > 0.5) {
                        moveLeft = true
                    }
                }
                else if (diffX < 0) {
                    if (this.tank.groundRight(this.tank.x, this.tank.y) !== null && Math.random() > 0.5) {
                        moveRight = true
                    }
                }
                this.scene.HUD.weaponScrollDisplay.setActive(randomIndex)
                this.tank.selectedWeapon = randomIndex
            }
        }
        if (moveLeft === true && this.tank.movesRemaining > 0) {
            this.tank.stepLeft()
            setTimeout(() => {
                findBestShot()
                this.scene.HUD.weaponScrollDisplay.setActive(randomIndex)
                this.tank.selectedWeapon = randomIndex
                this.tank.turret.setRotation(k.angle)
                this.tank.turret.relativeRotation = k.angle - this.tank.rotation
                this.tank.setPower(k.v / this.powerFactor)
                this.tank.shoot()
            }, 2000);
        }
        else if (moveRight === true && this.tank.movesRemaining > 0) {
            this.tank.stepRight()
            setTimeout(() => {
                findBestShot()
                this.scene.HUD.weaponScrollDisplay.setActive(randomIndex)
                this.tank.selectedWeapon = randomIndex
                this.tank.turret.setRotation(k.angle)
                this.tank.turret.relativeRotation = k.angle - this.tank.rotation
                this.tank.setPower(k.v / this.powerFactor)
                this.tank.shoot()
            }, 2000);
        }
        else {
            this.scene.HUD.weaponScrollDisplay.setActive(randomIndex)
            this.tank.selectedWeapon = randomIndex
            this.tank.turret.setRotation(k.angle)
            this.tank.turret.relativeRotation = k.angle - this.tank.rotation
            this.tank.setPower(k.v / this.powerFactor)
            this.tank.shoot()
        }
    }


    // ground
    handleType1 = (randomWeapon, randomIndex) => {
        var diffX = this.playerTank.x - this.tank.x
        var diffY = -(this.playerTank.y - this.tank.y)

        var angle = Math.atan(diffY/diffX)
        
        if (diffX > 0) {
            var minAngle = -Math.PI/2
            var maxAngle = Math.PI/2
        }
        else {
            var minAngle = Math.PI * 0.5
            var maxAngle = Math.PI * 1.5
        }

        var accelaration = -300
        var cos, sin;
        var newX, newY, newV;
        var v, dist = 10000, temp;
        var k = {angle: 0, v: 0}
        
        const findBestShot = () => {
            for (let theta = minAngle; theta < maxAngle; theta += 0.1 * this.factor) {
                for (v = this.powerFactor; v < 100 * this.powerFactor; v += this.powerFactor * this.factor) {
                    sin = Math.sin(theta)
                    cos = Math.cos(theta)
                    var nx = 0, ny = 0, ntheta = 0;
                    for (let t = 0; t < 5; t += 0.01 * this.factor) {
                        newX = this.tank.turret.x + v * cos * t
                        newY = this.tank.turret.y - v * sin * t - 1/2 * accelaration * t * t
                        newV = Math.sqrt(Math.pow(v * cos, 2) + Math.pow(v * sin + accelaration * t, 2))
                        ntheta = (v * sin + accelaration * t) / (v * cos)
                        if (newX < 0 || newX > this.terrain.width) {
                            break
                        }
                        if (newY > 0 && newY < this.terrain.height) {
                            //this.terrain.setPixel(newX, newY, 255, 0,0,255)
                            if (this.terrain.getPixel(newX, newY).alpha > 0 || newY - this.terrain.height > -1 * this.factor) {
                                nx = newX
                                ny = newY
                                if (newY - this.terrain.height > -1 * this.factor) {
                                    temp = Math.sqrt( Math.pow( newX - this.playerTank.x, 2 ) + Math.pow( newY - this.playerTank.y, 2 ) )
                                    if (temp < dist) {
                                        dist = temp
                                        k.angle = Math.PI/2 - theta
                                        k.v = v
                                    }
                                }
                                break;
                            }
                        }
                    }
                    
                    if (nx === 0 && ny === 0) continue
                    var modifier = 0
                    if (diffX < 0) modifier = Math.PI
                    sin = Math.sin(Math.atan(ntheta) + modifier)
                    cos = Math.cos(Math.atan(ntheta) + modifier)
                    for (let t1 = 0; t1 < 5; t1 += 0.01 * this.factor) {
                        newX = nx + newV * cos * t1
                        newY = ny - newV * sin * t1 + 1/2 * accelaration * t1 * t1
                        if (newX < 0 || newX > this.terrain.width) {
                            break
                        }
                        if (newY > 0 && newY < this.terrain.height) {
                            //this.terrain.setPixel(newX, newY, 255, 0,0,255)
                            if (this.terrain.getPixel(newX, newY).alpha === 0 || newY - this.terrain.height > -1 * this.factor) {
                                temp = Math.sqrt( Math.pow( newX - this.playerTank.x, 2 ) + Math.pow( newY - this.playerTank.y, 2 ) )
                                if (temp < dist) {
                                    dist = temp
                                    k.angle = Math.PI/2 - theta
                                    k.v = v
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }

        findBestShot()

        this.deviate(k)

        this.scene.HUD.weaponScrollDisplay.setActive(randomIndex)
        this.tank.selectedWeapon = randomIndex
        this.tank.turret.setRotation(k.angle)
        this.tank.turret.relativeRotation = k.angle - this.tank.rotation
        this.tank.setPower(k.v / this.powerFactor)
        this.tank.shoot()
    }


    // clear
    handleType2 = (randomWeapon, randomIndex) => {
        var diffX = this.playerTank.x - this.tank.x
        var diffY = -(this.playerTank.y - this.tank.y)

        var angle = Math.atan(diffY/diffX)
        
        if (diffX > 0) {
            var minAngle = angle
            var maxAngle = Math.PI/2
        }
        else {
            var minAngle = Math.PI/2
            var maxAngle = angle + Math.PI
        }

        var accelaration = 300
        var cos, sin;
        var newX, newY;
        var v, dist = 10000, temp;
        var k = {angle: 0, v: 0}
        var prevGround = false;
        var currGround = false;

        if (this.terrain.getPixel(this.tank.turret.x, this.tank.turret.y).alpha > 0) {
            prevGround = true
            currGround = true
        }
        
        const findBestShot = () => {
            for (let theta = minAngle; theta < maxAngle; theta += 0.1 * this.factor) {
                for (v = this.powerFactor; v < 100 * this.powerFactor; v += this.powerFactor * this.factor) {
                    sin = Math.sin(theta)
                    cos = Math.cos(theta)
                    for (let t = 0; t < 5; t += 0.01 * this.factor) {
                        newX = this.tank.turret.x + v * cos * t
                        newY = this.tank.turret.y - v * sin * t + 1/2 * accelaration * t * t
                        if (newX < 0 || newX > this.terrain.width) {
                            break
                        }
                        if (newY > 0 && newY < this.terrain.height) {
                            if (currGround === false) prevGround = false
                            else if (currGround === true) prevGround = true
                            if (this.terrain.getPixel(newX, newY).alpha === 0) currGround = false
                            else if (this.terrain.getPixel(newX, newY).alpha > 0) currGround = true
                            
                            //this.terrain.setPixel(newX, newY, 255, 0,0,255)
                            if ((currGround === true && prevGround === false) || newY - this.terrain.height > -1 * this.factor) {
                                temp = Math.sqrt( Math.pow( newX - this.playerTank.x, 2 ) + Math.pow( newY - this.playerTank.y, 2 ) )
                                if (temp < dist) {
                                    dist = temp
                                    k.angle = Math.PI/2 - theta
                                    k.v = v
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }

        findBestShot()

        this.deviate(k)

        this.scene.HUD.weaponScrollDisplay.setActive(randomIndex)
        this.tank.selectedWeapon = randomIndex
        this.tank.turret.setRotation(k.angle)
        this.tank.turret.relativeRotation = k.angle - this.tank.rotation
        this.tank.setPower(k.v / this.powerFactor)
        this.tank.shoot()
    }


    // ground straight
    handleType3 = (randomWeapon, randomIndex) => {
        var diffX = this.playerTank.x - this.tank.x
        var diffY = -(this.playerTank.y - this.tank.y)

        var angle = Math.atan(diffY/diffX)
        
        if (diffX > 0) {
            var minAngle = -Math.PI/2
            var maxAngle = Math.PI/2
        }
        else {
            var minAngle = Math.PI * 0.5
            var maxAngle = Math.PI * 1.5
        }

        var accelaration = -300
        var cos, sin;
        var newX, newY, newV;
        var v, dist = 10000, temp;
        var k = {angle: 0, v: 0}
        
        const findBestShot = () => {
            for (let theta = minAngle; theta < maxAngle; theta += 0.1 * this.factor) {
                for (v = this.powerFactor; v < 100 * this.powerFactor; v += this.powerFactor * this.factor) {
                    sin = Math.sin(theta)
                    cos = Math.cos(theta)
                    var nx = 0, ny = 0, ntheta = 0;
                    for (let t = 0; t < 5; t += 0.01 * this.factor) {
                        newX = this.tank.turret.x + v * cos * t
                        newY = this.tank.turret.y - v * sin * t - 1/2 * accelaration * t * t
                        newV = Math.sqrt(Math.pow(v * cos, 2) + Math.pow(v * sin + accelaration * t, 2))
                        ntheta = (v * sin + accelaration * t) / (v * cos)
                        if (newX < 0 || newX > this.terrain.width) {
                            break
                        }
                        if (newY > 0 && newY < this.terrain.height) {
                            //this.terrain.setPixel(newX, newY, 255, 0,0,255)
                            if (this.terrain.getPixel(newX, newY).alpha > 0 || newY - this.terrain.height > -1 * this.factor) {
                                nx = newX
                                ny = newY
                                if (newY - this.terrain.height > -1 * this.factor) {
                                    temp = Math.sqrt( Math.pow( newX - this.playerTank.x, 2 ) + Math.pow( newY - this.playerTank.y, 2 ) )
                                    if (temp < dist) {
                                        dist = temp
                                        k.angle = Math.PI/2 - theta
                                        k.v = v
                                    }
                                }
                                break;
                            }
                        }
                    }
                    
                    if (nx === 0 && ny === 0) continue
                    var modifier = 0
                    if (diffX < 0) modifier = Math.PI
                    sin = Math.sin(Math.atan(ntheta) + modifier)
                    cos = Math.cos(Math.atan(ntheta) + modifier)
                    for (let t1 = 0; t1 < 5; t1 += 0.01 * this.factor) {
                        newX = nx + newV * cos * t1
                        newY = ny - newV * sin * t1
                        if (newX < 0 || newX > this.terrain.width) {
                            break
                        }
                        if (newY > 0 && newY < this.terrain.height) {
                            //this.terrain.setPixel(newX, newY, 255, 0,0,255)
                            if (this.terrain.getPixel(newX, newY).alpha === 0 || newY - this.terrain.height > -1 * this.factor) {
                                temp = Math.sqrt( Math.pow( newX - this.playerTank.x, 2 ) + Math.pow( newY - this.playerTank.y, 2 ) )
                                if (temp < dist) {
                                    dist = temp
                                    k.angle = Math.PI/2 - theta
                                    k.v = v
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }

        findBestShot()

        this.deviate(k)

        this.scene.HUD.weaponScrollDisplay.setActive(randomIndex)
        this.tank.selectedWeapon = randomIndex
        this.tank.turret.setRotation(k.angle)
        this.tank.turret.relativeRotation = k.angle - this.tank.rotation
        this.tank.setPower(k.v / this.powerFactor)
        this.tank.shoot()
    }


    // cover: land a dirt builder between this tank and the opponent, a short
    // way in front of the CPU, instead of aiming 0-damage dirt at the enemy.
    handleType4 = (randomWeapon, randomIndex) => {
        const direction = Math.sign(this.playerTank.x - this.tank.x) || 1
        const gap = Math.abs(this.playerTank.x - this.tank.x)
        const targetX = this.tank.x + direction * Math.max(COVER_MIN_DISTANCE, Math.min(COVER_MAX_DISTANCE, gap * COVER_GAP_FRACTION))
        const k = this.findLandingShot(targetX, direction)

        if (k === null) {
            this.handleType0(randomWeapon, randomIndex)
            return
        }

        this.deviate(k)

        this.scene.HUD.weaponScrollDisplay.setActive(randomIndex)
        this.tank.selectedWeapon = randomIndex
        this.tank.turret.setRotation(k.angle)
        this.tank.turret.relativeRotation = k.angle - this.tank.rotation
        this.tank.setPower(k.v / this.powerFactor)
        this.tank.shoot()
    }


    // Ballistic search (gravity 300) for the shot whose first ground contact is
    // closest to targetX. Returns {angle, v} in turret terms, or null.
    findLandingShot = (targetX, direction) => {
        const accelaration = 300
        const minAngle = direction > 0 ? 0.15 : Math.PI/2
        const maxAngle = direction > 0 ? Math.PI/2 : Math.PI - 0.15
        let best = null
        let bestDist = Infinity

        for (let theta = minAngle; theta < maxAngle; theta += 0.05 * this.factor) {
            const sin = Math.sin(theta)
            const cos = Math.cos(theta)
            for (let v = this.powerFactor; v < 100 * this.powerFactor; v += this.powerFactor * this.factor) {
                for (let t = 0.05; t < 5; t += 0.01 * this.factor) {
                    const newX = this.tank.turret.x + v * cos * t
                    const newY = this.tank.turret.y - v * sin * t + 1/2 * accelaration * t * t
                    if (newX < 0 || newX > this.terrain.width) break
                    if (newY >= this.terrain.height || (newY > 0 && this.terrain.getPixel(newX, newY).alpha > 0)) {
                        const dist = Math.abs(newX - targetX)
                        if (dist < bestDist) {
                            bestDist = dist
                            best = {angle: Math.PI/2 - theta, v}
                        }
                        break
                    }
                }
            }
        }

        return best
    }
}
