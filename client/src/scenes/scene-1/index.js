import { resumableOnlineRoom, resumeLastOnlineMatch } from '../../socket/session';
import { Scene } from 'phaser';
import { addBattlefield } from '../../graphics/battlefield';
import { drawVehicle } from '../../graphics/vehicle';

export class Scene1 extends Scene {
    constructor() { super('scene-1'); }
    create = () => {
        const w = this.renderer.width, h = this.renderer.height;
        addBattlefield(this, 'menu-landscape');
        const shade = this.add.graphics();
        shade.fillStyle(0x081b25, .6); shade.fillRect(0, 0, w * .56, h);
        this.add.text(64, 62, 'P T  /  ARTILLERY DIVISION', {fontFamily:'Arial',fontSize:15,color:'#a2bfb9',letterSpacing:4});
        this.add.text(64, 174, 'POCKET\nTANKS', {fontFamily:'Arial Black, Arial',fontStyle:'bold',fontSize:100,color:'#f1ebd8',lineSpacing:-14});
        this.add.rectangle(68, 426, 8, 38, 0xe9ad70).setOrigin(0,.5);
        this.add.text(91, 407, 'Big terrain. Heavy firepower.', {fontFamily:'Arial',fontSize:24,color:'#e1e4d4'});
        this.add.text(91, 440, 'A new look for the art of artillery.', {fontFamily:'Arial',fontSize:17,color:'#9db5b1'});
        const canvas = document.createElement('canvas'); canvas.width=840; canvas.height=480;
        const ctx=canvas.getContext('2d'); ctx.translate(0,18); ctx.scale(19,19); drawVehicle(ctx,'#7b9e8e',true);
        if(this.textures.exists('hero-tank')) this.textures.remove('hero-tank');
        this.textures.addCanvas('hero-tank',canvas);
        this.add.image(902, 490, 'hero-tank').setScale(.74).setRotation(-.06);
        this.add.text(750, 680, 'M–07  /  RIDGELINE', {fontFamily:'Arial',fontSize:16,color:'#c6cfbb',letterSpacing:3});
        const button = this.add.rectangle(64, 527, 330, 66, 0xe7b17b).setOrigin(0).setInteractive({useHandCursor:true});
        this.add.text(90, 548, 'ENTER THE BATTLEFIELD   →', {fontFamily:'Arial',fontStyle:'bold',fontSize:18,color:'#152d35'});
        button.on('pointerover',()=>button.setFillStyle(0xffd6a0));
        button.on('pointerout',()=>button.setFillStyle(0xe7b17b));
        button.on('pointerdown',()=>{this.sound.play('click',{volume:.3});this.scene.start('scene-2');});
        [['Controls','controls-scene'],['Field guide','guide-scene'],['About','about-scene']].forEach(([label,scene],i)=>{
            const text=this.add.text(64+i*145,647,label,{fontFamily:'Arial',fontSize:17,color:'#bdd0c8'}).setInteractive({useHandCursor:true});
            text.on('pointerover',()=>text.setColor('#ffe2b6')); text.on('pointerout',()=>text.setColor('#bdd0c8'));
            text.on('pointerdown',()=>this.scene.start(scene));
        });
        this.add.text(64,h-48,'PRECISION. POWER. ONE MORE SHOT.',{fontFamily:'Arial',fontSize:12,color:'#779a9a',letterSpacing:3});
        const resumeNotice=this.registry.get('onlineResumeNotice');
        if(resumeNotice){this.add.text(64,605,resumeNotice,{fontFamily:'Arial',fontSize:15,color:'#f0c28d',wordWrap:{width:470}});this.registry.remove('onlineResumeNotice');}
        if(!resumeNotice && resumableOnlineRoom()){
            this.add.text(64,605,'RESUME ONLINE MATCH  →',{fontFamily:'Arial',fontSize:17,color:'#f0c28d'}).setInteractive({useHandCursor:true}).on('pointerdown',resumeLastOnlineMatch);
        }
        this.sound.stopAll(); this.sound.play('intro',{loop:true,volume:.45});
    }
}
