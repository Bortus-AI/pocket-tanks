import { saveOnlineMatch, getOnlinePresenceText, parkOnlineMatch, processOnlineSession, leaveOnlineMatch } from '../../socket/session';
import { terrainProfile } from '../../graphics/terrain-layouts';
import { installArsenal } from '../../weapons/expansion/browser';
import { addBattlefield } from '../../graphics/battlefield';
import Phaser ,{ Scene, GameObjects, BlendModes, Textures, Display } from 'phaser';
import { HUD } from '../../classes/HUD';
import { Tank } from '../../classes/Tank';
import { Terrain } from '../../classes/Terrain';
import { type1 } from './types/type1';
import { type2 } from './types/type2';
import { type3 } from './types/type3';
import { type4 } from './types/type4';
import { drawBackBtn } from '../../graphics/back-btn';
import { BlastCache } from '../../classes/BlastCache';

export class MainScene extends Scene {
    constructor() {
        super('main-scene');
        this.tank1 = null
        this.tank2 = null
        this.terrain = null
        this.HUD = null
        this.x = 0;
        this.y = 0;
        this.fps = null
        this.activeTank = 0
        this.background = null
        this.blastLayer = null
        this.pointsLayer = null
        this.cpuHandler = null
        this.sceneData = null
        this.turnPointer = null
        this.winnerBlastTween = null
        this.gameOver = false
        this.exitMenuContent = null
        this.blastCache = new BlastCache(this)
    }



    init = (data) => {
        this.HUD = null
        this.sceneData = data
        this.activeTank = 0
        this.gameOver = false
        this.exitMenuContent = null
        this.onlineTurnStatus = null
    }



    preload = () => {
        if (window.sdk === 'crazygames') {
            window.CrazyGames.SDK.game.gameplayStart();
        }
        if (window.sdk === 'gdsdk') {
            if (window.gdsdk !== undefined && window.gdsdk.preloadAd !== undefined) {
                window.gdsdk.preloadAd('rewarded')
            }
        }
        //this.sound.add('click')
        // this.load.audio('background', ['assets/sounds/background.mp3'])
        // this.load.image('wall', 'assets/images/wall.png');
    }


    create = () => {
        if (this.winnerBlastTween !== null) {
            this.winnerBlastTween.stop()
            this.winnerBlastTween = null
        }
        this.events.once('terrain-finished', () => {
            if (this.activeTank === 2) {
                this.terrain.save()
            }
        })

        this.pendingOnlineTurn = null
        this.turnRequestPending = false
        this.tacticalWorld = null
        this.createBackground()
        this.createBlastLayer()
        this.createPointsLayer()
        this.createTerrain()
        this.createBoundWalls()
        this.createTank1()
        this.createTank2()
        this.createAutoAdjust()
       
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

        this.showTurnPointer()

        this.terrainLabel=this.add.text(this.renderer.width/2,50,terrainProfile(this.terrain.layoutKind).name.toUpperCase(),{fontFamily:'Arial',fontSize:12,color:'#ced8c1',letterSpacing:3}).setOrigin(.5).setDepth(6)
        this.createHUD()
        installArsenal(this)
        if(this.sceneData.gameType===3)this.onlineTurnStatus=this.add.text(this.renderer.width/2,124,'',{fontFamily:'Arial',fontSize:13,color:'#d3d9bf',backgroundColor:'#17333c',padding:{x:10,y:5},wordWrap:{width:620}}).setOrigin(.5,0).setDepth(8)
        if(this.sceneData.resumeSnapshot?.state?.gameOver)this.events.once('postupdate',()=>this.showGameOver())

        this.sound.stopAll()
       
        this.sound.play('background', {loop: true})

        this.terrain.multiplayerPoints = []

        var socket = window.socket
        
        this.input.keyboard.on('keydown', (e) => {
            if (e.keyCode === 27) {
                this.sound.play('click', {volume: 0.3})
                e.preventDefault()
                if (this.exitMenuContent === null)
                    this.showExitMenu()
                else
                    this.hideExitMenu()
            }
        })
        
        var canvas = document.createElement('canvas')
        var ctx = canvas.getContext('2d')
        canvas.width = 150
        canvas.height = 100
        drawBackBtn(ctx, canvas.width, canvas.height)
        var backtexture = this.textures.addCanvas('back-btn', canvas, true)
        var backbtn = this.add.image(100, this.game.renderer.height - 100, backtexture)
        backbtn.setDepth(10)
        
        backbtn.setInteractive()
        if (this.HUD.mobileAim) backbtn.setVisible(false).disableInteractive()

        backbtn.on('pointerdown', () => {
            this.sound.play('click', {volume: 0.3})
            if (this.HUD.mouseLocked === false) {
                this.showExitMenu()
            }
        })
    }



    update = (time, delta) => {
        processOnlineSession(this)
        this.onlineTurnStatus?.setText(getOnlinePresenceText(this))
        this.terrainLabel?.setText(terrainProfile(this.terrain.layoutKind).name.toUpperCase())
        this.HUD.refresh()
        saveOnlineMatch(this)
        this.checkSwitchTurn()

        this.input.mousePointer.prev = {x: this.input.mousePointer.x, y: this.input.mousePointer.y}
        this.input.activePointer.prev = {x: this.input.activePointer.x, y: this.input.activePointer.y}
    }



    createBoundWalls = () => {
        this.rightWall = this.physics.add.image(this.renderer.width + 50, this.renderer.height, 'wall')
        this.leftWall = this.physics.add.image(-50, this.renderer.height, 'wall')
        this.rightWall.setSize(100, this.renderer.height * 4)
        this.leftWall.setSize(100, this.renderer.height * 4)
        this.leftWall.setImmovable(true).setAlpha(0)
        this.rightWall.setImmovable(true).setAlpha(0)
        this.leftWall.setOrigin(1, 0)
        this.rightWall.setOrigin(0, 0)
    }



    createBackground = () => {
        this.background = addBattlefield(this, 'background')
    }




    createBlastLayer = () => {
        var canvas = document.createElement('canvas')
        
        canvas.height = this.renderer.height
        canvas.width = this.renderer.width

        if (this.textures.exists('blast-layer')) this.textures.remove('blast-layer')
        this.textures.addCanvas('blast-layer', canvas)
        this.blastLayer = this.add.image(canvas.width/2, canvas.height/2, 'blast-layer').setDepth(3)
    }



    createPointsLayer = () => {
        var canvas = document.createElement('canvas')
        
        canvas.height = this.renderer.height
        canvas.width = this.renderer.width

        if (this.textures.exists('points-layer')) this.textures.remove('points-layer')
        this.blastLayer = this.textures.addCanvas('points-layer', canvas)
        this.add.image(canvas.width/2, canvas.height/2, 'points-layer').setDepth(4)
    }



    createTerrain = () => {
        this.terrain = new Terrain(this);
    }



    createTank1 = () => {
        this.tank1 = new Tank(this, 1);
        //this.tank1.setBlendMode(Phaser.BlendModes.SOFT_LIGHT)
        this.tank1.setDepth(-2)
    }



    createTank2 = () => {
        this.tank2 = new Tank(this, 2)
        //this.tank2.setBlendMode(Phaser.BlendModes.SOFT_LIGHT)
        this.tank2.setDepth(-2)
    }



    createHUD = () => {
        this.HUD = new HUD(this)
        this.HUD.reset()
    }



    createAutoAdjust = () => {
        if (this.sceneData.gameType === 3) return
        var h = 60
        var w = 180

        var adBtnContainer = this.add.container(this.renderer.width/2, this.renderer.height * 8/9)
        
        var adBtnText = this.add.text(0, 0, "ASSIST AIM").setFontSize(18).setFontFamily('Verdana').setFontStyle('bold')
        
        if (!this.game.device.os.desktop){
            adBtnText.setFontSize(26)
            h = h * 1.3
            w = w * 1.3
        }
        adBtnText.setOrigin(0.5, 0.5).setColor("#d5e0cf")

        var clapperBoard = this.add.image(0, 0, 'clapperboard')
        clapperBoard.displayHeight = 40
        clapperBoard.displayWidth = 40

        var averageWidth = (adBtnText.displayWidth + clapperBoard.displayWidth + 10) / 2
        adBtnText.setX(adBtnText.displayWidth/2 - averageWidth)
        clapperBoard.setX(averageWidth - clapperBoard.displayWidth/2)
        clapperBoard.setVisible(false)
        adBtnText.setX(0)
        
        var adBtnBackground = this.add.rectangle(0, 0, w, h, 0x34535b)
        adBtnBackground.setOrigin(0.5,0.5)
        
        adBtnContainer.add(adBtnBackground)
        adBtnContainer.add(clapperBoard)
        adBtnContainer.add(adBtnText)

        adBtnContainer.setDepth(100)

        const autoAdjust = () => {
            var tank = null;
            if (this.activeTank === 1) tank = this.tank1
            if (this.activeTank === 2) tank = this.tank2
            if (tank !== null) {
                tank.autoAdjust()
            }
            adBtnText.setText("ASSIST AIM")
            adBtnBackground.setInteractive()
            //adBtnContainer.setInteractive()
        }

        const clickHandler = () => {
            if (this.HUD.mouseLocked === true) return
            if (this.sceneData.gameType === 3) return
            this.sound.play('click', {volume: 0.3})

            //adBtn.disableInteractive()
            //adImg.disableInteractive()
            adBtnBackground.disableInteractive()
            //adBtnContainer.disableInteractive()
            adBtnText.setText("Loading")
            
            if (window.sdk === 'gdsdk') {
                var gdsdk = window.gdsdk
                if (typeof gdsdk !== undefined && gdsdk.showAd !== undefined) {
                    gdsdk.showAd("rewarded")
                    autoAdjust()
                }
            }

            if (window.sdk === 'crazygames') {
                const callbacks = {
                    adFinished: () => {this.game.sound.mute = false; autoAdjust()},
                    adError: () => {this.game.sound.mute = false; autoAdjust()},
                    adStarted: () => {this.game.sound.mute = true},
                };
                window.CrazyGames.SDK.ad.requestAd("rewarded", callbacks);
            }

            else {
                autoAdjust()
            }
        }

        //adBtnText.setInteractive()
        //adImg.setInteractive()
        adBtnBackground.setInteractive()

        ///adBtn.on('pointerdown', clickHandler)
        //adImg.on('pointerdown', clickHandler)
        adBtnBackground.on('pointerdown', clickHandler)
    }



    checkSwitchTurn = () => {
        if (this.terrain.animate === true) return
        if (this.terrain.blastArray.length !== 0) return
        if (this.tank1.settled === false) return
        if (this.tank2.settled === false) return
        if (this.gameOver === true) return
        if (this.tank1.weapons.length === 0 && this.tank2.weapons.length === 0) {
            if (this.sceneData.gameType === 3 && this.activeTank !== 1) return
            if (this.tank1.turret.activeWeapon === null && this.tank2.turret.activeWeapon === null) {
                this.showGameOver()
                this.tank1.active = false
                this.tank2.active = false
                this.activeTank = 0
                saveOnlineMatch(this,{force:true})
            }
        }

        else if (this.activeTank === 1 && this.tank1.active === false && this.tank1.turret.activeWeapon === null) {
            //this.terrain.restore()
            this.terrain.frameCount = -1
            this.turnRequestPending = false
            this.activeTank = 2
            this.tank2.active = true
            this.HUD.reset()
            if (this.sceneData.gameType === 3) {
                this.terrain.save()
                saveOnlineMatch(this,{force:true})
            }
            //console.log('turn 2')
            this.showTurnPointer()
            if (this.sceneData.gameType === 1) {
                this.cpuHandler.play()
            }
        }
        else if (this.activeTank === 2 && this.tank2.active === false && this.tank2.turret.activeWeapon === null){
            //this.terrain.restore()
            this.terrain.frameCount = -1
            if (this.sceneData.gameType !== 3) {
                this.activeTank = 1
                this.tank1.active = true
                this.HUD.reset()
                //console.log('turn 1')
                this.showTurnPointer()
            }
            // Online control changes only when the completed server checkpoint arrives.

        }
    }



    showTurnPointer = () => {
        var tank = null
        if (this.activeTank === 1) tank = this.tank1
        if (this.activeTank === 2) tank = this.tank2

        if (tank !== null) {
            this.hideTurnPointer()
            var canvas = document.createElement('canvas')
            canvas.width = 18
            canvas.height = 20
            var w = 18
            var h = 20
            var ctx = canvas.getContext('2d')

            ctx.fillStyle = tank.color
            ctx.moveTo(w/3, 0)
            ctx.lineTo(w * (2/3), 0)
            ctx.lineTo(w * (2/3), h * (1/2))
            ctx.lineTo(w, h * (1/2))
            ctx.lineTo(w/2, h)
            ctx.lineTo(0, h * (1/2))
            ctx.lineTo(w * (1/3), h * (1/2))
            ctx.lineTo(w/3, 0)
            ctx.closePath()
            ctx.fill()
            
            if (this.textures.exists('turn-pointer')) this.textures.remove('turn-pointer')
            this.textures.addCanvas('turn-pointer', canvas)
            this.turnPointer = this.add.image(tank.x, tank.y - 45, 'turn-pointer')
            this.turnPointer.setDepth(10)

            this.tweens.add({
                targets: this.turnPointer,
                y: this.turnPointer.y - 10,
                repeat: -1,
                yoyo: true,
                duration: 300,
            })

            this.turnPointer.setVisible(true)
        }
    }



    hideTurnPointer = () => {
        if (this.turnPointer !== null) {
            this.turnPointer.setVisible(false)
            this.turnPointer = null
        }
    }




    showGameOver = () => {
        this.showWinner()
        const socket = window.socket
        this.gameOver = true

        const screenCenterX = this.terrain.width/2
        const screenCenterY = this.terrain.height/2

        this.tank1.active = false
        this.tank2.active = false
        this.activeTank = 0

        var x = this.add.text(screenCenterX, screenCenterY, 'PLAY AGAIN ?')
        var a = this.add.text(screenCenterX - 80, screenCenterY + 50, 'YES')
        var y = this.add.text(screenCenterX, screenCenterY + 50, '/')
        var b = this.add.text(screenCenterX + 80, screenCenterY + 50, 'NO')

        x.setFontSize(50).setOrigin(0.5).setVisible(false).setFontFamily('"Days One"').setColor('rgba(240,240,240,1)').setDepth(100)
        a.setFontSize(40).setOrigin(0.5).setVisible(false).setFontFamily('"Days One"').setColor('rgba(240,240,240,1)').setDepth(100)
        b.setFontSize(40).setOrigin(0.5).setVisible(false).setFontFamily('"Days One"').setColor('rgba(240,240,240,1)').setDepth(100)
        y.setFontSize(40).setOrigin(0.5).setVisible(false).setFontFamily('"Days One"').setColor('rgba(240,240,240,1)').setDepth(100)

        strokeText(x, 4)
        strokeText(a, 4)
        strokeText(b, 4)
        strokeText(y, 4)

        a.setInteractive()
        b.setInteractive()

        if (window.sdk === 'kongregate' && !window.kongregate.services.isGuest()) {
            if (this.sceneData.gameType === 1) {
                window.kongregate.stats.submit('Highscore (CPU)', this.tank1.score);
                window.kongregate.stats.submit('Lifetime (CPU)', this.tank1.score);
            }
            else if (this.sceneData.gameType === 3) {
                window.kongregate.stats.submit('Highscore (Online)', this.tank1.score);
                window.kongregate.stats.submit('Lifetime (Online)', this.tank1.score);
            }
        }

        //var gdsdk = window.gdsdk
        
        a.once('pointerdown', () => {
            this.sound.play('click', {volume: 0.3})

            const restartGame = () => {
                if (this.sceneData.gameType === 3) {
                    socket.emit('playAgainRequest', {})
                    a.disableInteractive()
                    a.setText('')
                    b.setText('')
                    y.setText('')
                    x.setText('Waiting for opponent...')
                }
                else {
                    if (this.winnerBlastTween !== null) {
                        this.winnerBlastTween.stop()
                        this.winnerBlastTween = null
                    }
                    this.sound.stopByKey('winner')
                    this.scene.start('scene-5', this.sceneData)
                }
            }

            if (window.sdk === 'crazygames') {
                const callbacks = {
                    adFinished: () => {this.game.sound.mute = false; restartGame()},
                    adError: () => {this.game.sound.mute = false; restartGame(); window.CrazyGames.SDK.game.gameplayStop()},
                    adStarted: () => {this.game.sound.mute = true; window.CrazyGames.SDK.game.gameplayStop()},
                };
                window.CrazyGames.SDK.ad.requestAd("midgame", callbacks);
                
            }
            if (window.sdk === 'gdsdk') {
                var gdsdk = window.gdsdk
                if (typeof gdsdk !== undefined && gdsdk.showAd !== undefined) {
                    gdsdk.showAd()
                    restartGame()
                }
            }
            else {
                restartGame()
            }
        })

        b.once('pointerdown', () => {
            this.sound.play('click', {volume: 0.3})

            const endGame = () => {
                this.sound.stopByKey('winner')
                if (this.sceneData.gameType === 3) parkOnlineMatch()
                else this.scene.start('scene-1')
            }

            if (window.sdk === 'crazygames') {
                const callbacks = {
                    adFinished: () => {this.game.sound.mute = false; endGame()},
                    adError: () => {this.game.sound.mute = false; endGame(); window.CrazyGames.SDK.game.gameplayStop()},
                    adStarted: () => {this.game.sound.mute = true; window.CrazyGames.SDK.game.gameplayStop()},
                };
    
                window.CrazyGames.SDK.ad.requestAd("midgame", callbacks);
            }
            if (window.sdk === 'gdsdk') {
                var gdsdk = window.gdsdk
                if (typeof gdsdk !== undefined && gdsdk.showAd !== undefined) {
                    gdsdk.showAd()
                    endGame()
                }
            }
            else {
                endGame()
            }

        })
        
        setTimeout(() => {
            x.setVisible(true)
            a.setVisible(true)
            b.setVisible(true)
            y.setVisible(true)
        }, 2000);
    }



    showExitMenu = () => {
        if (this.gameOver) return

        const screenCenterX = this.terrain.width/2
        const screenCenterY = this.terrain.height/2
        
        var x = this.add.text(screenCenterX, screenCenterY, this.sceneData.gameType===3?'SAVE & RETURN TO MENU ?':'EXIT GAME ?')
        var a = this.add.text(screenCenterX - 80, screenCenterY + 50, 'YES')
        var y = this.add.text(screenCenterX, screenCenterY + 50, '/')
        var b = this.add.text(screenCenterX + 80, screenCenterY + 50, 'NO')

        x.setFontSize(50).setOrigin(0.5).setFontFamily('"Days One"').setColor('rgba(240,240,240,1)').setDepth(130)
        a.setFontSize(40).setOrigin(0.5).setFontFamily('"Days One"').setColor('rgba(240,240,240,1)').setDepth(130)
        b.setFontSize(40).setOrigin(0.5).setFontFamily('"Days One"').setColor('rgba(240,240,240,1)').setDepth(130)
        y.setFontSize(40).setOrigin(0.5).setFontFamily('"Days One"').setColor('rgba(240,240,240,1)').setDepth(130)

        strokeText(x, 4)
        strokeText(a, 4)
        strokeText(b, 4)
        strokeText(y, 4)

        a.setInteractive()
        b.setInteractive()

        this.exitMenuContent = this.add.group([x, y, a, b])

        if (this.sceneData.gameType === 3) {
            const end = this.add.text(screenCenterX, screenCenterY + 125, 'END MATCH & RETURN TO MENU', {
                fontFamily: 'Arial', fontSize: 26, fontStyle: 'bold', color: '#f0c3ad',
                backgroundColor: '#26343c', padding: {x: 20, y: 14},
            }).setOrigin(.5).setDepth(130).setInteractive({useHandCursor: true})
            end.on('pointerdown', () => leaveOnlineMatch())
            this.exitMenuContent.add(end)
        }

        a.once('pointerdown', () => {
            this.sound.play('click', {volume: 0.3})

            const exitGame = () => {
                if (this.sceneData.gameType === 3) {
                    parkOnlineMatch()
                    return
                }
                this.scene.start('scene-1')                
            }

            if (window.sdk === 'crazygames') {
                const callbacks = {
                    adFinished: () => {this.game.sound.mute = false; exitGame()},
                    adError: () => {this.game.sound.mute = false; exitGame(); window.CrazyGames.SDK.game.gameplayStop()},
                    adStarted: () => {this.game.sound.mute = true; window.CrazyGames.SDK.game.gameplayStop()},
                };
                window.CrazyGames.SDK.ad.requestAd("midgame", callbacks);
            }
            if (window.sdk === 'gdsdk') {
                var gdsdk = window.gdsdk
                if (typeof gdsdk !== undefined && gdsdk.showAd !== undefined) {
                    gdsdk.showAd()
                    exitGame()
                }
            }
            else {
                exitGame()
            }
            
        })

        b.once('pointerdown', () => {
            this.sound.play('click', {volume: 0.3})
            
            const resumeGame = () => {
                this.hideExitMenu()
            }
            resumeGame()
        })
    }




    hideExitMenu = () => {
        if (this.exitMenuContent !== null) {
            this.exitMenuContent.destroy(true)
            this.exitMenuContent = null
        }
    }




    showWinner = () => {
        var tank = null

        if (this.tank1.score > this.tank2.score) {
            tank = this.tank1
        }
        else if (this.tank1.score < this.tank2.score) {
            tank = this.tank2
        }
        else return

        this.sound.play('winner', {loop: true})

        if (window.sdk === 'crazygames') {
            window.CrazyGames.SDK.game.happytime();
        }

        var height = 60
        var w1 = this.add.text(tank.x - 38, tank.y - height - 11, 'W')
        var i1 = this.add.text(tank.x - 19, tank.y - height - 7, 'i')
        var n1 = this.add.text(tank.x - 6, tank.y - height - 1, 'n')
        var n2 = this.add.text(tank.x + 11, tank.y - height + 7, 'n')
        var e1 = this.add.text(tank.x + 28, tank.y - height + 11, 'e')
        var r1 = this.add.text(tank.x + 42, tank.y - height + 7, 'r')

        var letters = [w1, i1, n1, n2, e1, r1]

        letters.forEach((l, i) => {
            l.setFontSize(30).setOrigin(0.5).setColor('rgba(240,240,240,1)').setFontFamily('Arial').setDepth(10)
            if (i < 4) l.movement = 1
            else l.movement = -1

            this.tweens.add({
                targets: l,
                loop: -1,
                onLoop: () => {
                    if (l.movement === 1 && l.y > tank.y - height + 12) {
                        l.movement = -1
                    }
                    else if (l.movement === - 1 && l.y < tank.y - height - 12) {
                        l.movement = 1
                    }
                    l.y = l.y + 0.8 * l.movement
                }
            })
        })

        this.winnerBlastTween = this.tweens.add({
            targets: letters,
            duration: 100,
            t: 1,
            loop: -1,
            onLoop: () => {
                var fillColor = Math.floor(Math.random() * 0xffffff)
                var vec = new Phaser.Math.Vector2(1,1)
                var posX = tank.x + (0.5 - Math.random()) * 120
                var posY = tank.y + (0.5 - Math.random()) * 60 - height
    
                for (let index = 0; index < 100; index++) {
                    var particle = this.add.circle(posX, posY, 1, fillColor, 255) 
    
                    vec.setAngle(Math.PI * 2 * Math.random())
                    vec.setLength(Math.pow(Math.random(), 2) * 60)
    
                    var t = Math.random() * 1000 + 800
                    this.tweens.add({
                        targets: particle,
                        duration: t,
                        ease: 'Quad.easeOut',
                        x: particle.x + vec.x,
                        y: particle.y + vec.y
                    })    
                    this.tweens.add({
                        targets: particle,
                        duration: t,
                        ease: 'Quad.easeOut',
                        alpha: 0,
                        onComplete: () => { particle.destroy(true) }
                    })
                }
            }
        });
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

const int2rgba = (colorInt) => {
    var rgba = new Display.Color.IntegerToRGB(colorInt)
    var rgbaString = 'rgba(' + rgba.r + ',' + rgba.g + ',' + rgba.b + ',' + rgba.a + ')'
    return rgbaString
}
