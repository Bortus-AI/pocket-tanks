import { ownedFrame } from './weapon-art/frames';
// A single atlas for both renderers. All bitmap work happens once, then WebGL
// batches pooled images; animated flame/explosion frames need no texture upload.
const TILE = 128, COLUMNS = 8;
let atlas;

export const particleAtlas = (sprite, materialArt = null) => {
    if (atlas && atlas.materialArt === materialArt) return atlas;
    const names = ['smoke','dust','vapor','light','energy','spark','debris','ice','drop',
        ...Array.from({length:6}, (_, i) => `flame-${i}`), ...Array.from({length:12}, (_, i) => `explosion-${i}`),
        ...['smoke','frostburst','acidburst','foamburst'].flatMap(kind=>Array.from({length:8},(_,i)=>`${kind}-${i}`))];
    const canvas = document.createElement('canvas'); canvas.width = TILE * COLUMNS; canvas.height = TILE * Math.ceil(names.length / COLUMNS);
    const ctx = canvas.getContext('2d'), frames = {};
    names.forEach((name, index) => {
        const x = index % COLUMNS * TILE, y = Math.floor(index / COLUMNS) * TILE;
        frames[name] = {x, y}; ctx.save(); ctx.translate(x, y);
        const row = name.startsWith('explosion-')?0:name.startsWith('smoke-')||['smoke','dust','vapor'].includes(name)?1:name.startsWith('flame-')?2:
            name.startsWith('frostburst-')?3:name.startsWith('acidburst-')?4:name.startsWith('foamburst-')?5:null;
        if (materialArt && row !== null) {
            const count=name.startsWith('explosion-')?12:name.startsWith('flame-')?6:8;
            const number=Number(name.split('-')[1]||1),frame=Math.min(3,number/(count-1)*3),first=Math.floor(frame),mix=frame-first;
            const width=materialArt.width/4,height=materialArt.height/6;
            ctx.globalCompositeOperation='lighter';
            ctx.globalAlpha=1-mix;ctx.drawImage(materialArt,first*width,row*height,width,height,0,0,TILE,TILE);
            if(mix>0){ctx.globalAlpha=mix;ctx.drawImage(materialArt,Math.min(3,first+1)*width,row*height,width,height,0,0,TILE,TILE);}
            ctx.globalAlpha=1;
        }
        else if (['smoke','dust','vapor','light','energy'].includes(name)||name.startsWith('smoke-')) ctx.drawImage(sprite(name.startsWith('smoke-')?'smoke':name === 'energy' ? 'light' : name, '#ffffff'), 0, 0);
        else if (name.startsWith('flame')) {
            const i = Number(name.split('-')[1]);
            ctx.translate(64, 100); ctx.rotate(Math.sin(i * 2.1) * .12); ctx.scale(.9 + Math.cos(i * 2.3) * .1, .9 + Math.sin(i * 1.7) * .1);
            ctx.drawImage(sprite('flame', '#ff9b34'), -64, -100);
        } else if (name.startsWith('explosion')) {
            const t = Number(name.split('-')[1]) / 11;
            for (let i = 0; i < 14; i++) {
                const angle = i * 2.399, radius = (10 + (i % 5) * 6) * (1 - Math.exp(-t * 7));
                const px = 64 + Math.cos(angle) * radius, py = 70 + Math.sin(angle) * radius * .8 - t * 15;
                const r = (9 + i % 4 * 3) * (.55 + Math.sin(t * Math.PI) * .9);
                const g = ctx.createRadialGradient(px-r*.18,py-r*.25,0,px,py,r);
                const heat = Math.max(0, 1-t*1.4);
                g.addColorStop(0, `rgba(${Math.round(92+163*heat)},${Math.round(88+160*heat*heat)},${Math.round(80+110*heat*heat)},${(1-t)*.9})`);
                g.addColorStop(.5, `rgba(${Math.round(70+180*heat)},${Math.round(70+45*heat)},${Math.round(65-40*heat)},${(1-t)*.7})`);
                g.addColorStop(1,'rgba(35,36,39,0)'); ctx.fillStyle=g; ctx.fillRect(px-r,py-r,r*2,r*2);
            }
        } else if (/^(frostburst|acidburst|foamburst)-/.test(name)) {
            ctx.drawImage(sprite('vapor',name.startsWith('frost')?'#b8e8ff':name.startsWith('acid')?'#b3dd61':'#e5ffea'),0,0);
        } else {
            ctx.translate(64,64); ctx.fillStyle='#ffffff'; ctx.strokeStyle='#ffffff';
            ctx.beginPath();
            if (name === 'spark') { ctx.fillRect(-54,-3,108,6); }
            if (name === 'debris') { ctx.moveTo(-40,-16);ctx.lineTo(-12,-40);ctx.lineTo(30,-24);ctx.lineTo(40,16);ctx.lineTo(0,28);ctx.closePath();ctx.fill();ctx.strokeStyle='#c4bfae';ctx.lineWidth=3;ctx.stroke(); }
            if (name === 'ice') {
                ctx.moveTo(0,-57);ctx.lineTo(20,0);ctx.lineTo(0,40);ctx.lineTo(-20,0);ctx.closePath();ctx.fillStyle='#477b96';ctx.fill();
                ctx.beginPath();ctx.moveTo(0,-57);ctx.lineTo(0,40);ctx.lineTo(-20,0);ctx.closePath();ctx.fillStyle='#9ccad9';ctx.fill();
                ctx.beginPath();ctx.moveTo(0,-57);ctx.lineTo(6,-2);ctx.lineTo(-12,8);ctx.closePath();ctx.fillStyle='#dfedf0';ctx.fill();
            }
            if (name === 'drop') { ctx.moveTo(0,-50);ctx.bezierCurveTo(34,-3,34,34,-3,34);ctx.bezierCurveTo(-34,34,-34,0,0,-50);ctx.fill(); }
        }
        ctx.restore();
    });
    atlas = {canvas, frames, materialArt, tints:new Map()}; return atlas;
};

export const isMaterialBurst = kind => ['explosion','frostburst','acidburst','foamburst'].includes(kind);
export const animatedParticleFrame = particle => particle.kind === 'explosion' ? `explosion-${Math.min(11,Math.floor(particle.age/particle.life*12))}`
    : particle.kind === 'flame' ? `flame-${Math.min(5,Math.floor(particle.age/particle.life*6))}`
    : ['smoke','frostburst','acidburst','foamburst'].includes(particle.kind)?`${particle.kind}-${Math.min(7,Math.floor(particle.age/particle.life*8))}`:particle.kind;

export const drawParticleFrame = (ctx, source, name, x, y, width, height, color = null) => {
    const frame = source.frames[name];
    if(color){
        const key=name+color;
        if(!source.tints.has(key)){
            const tile=document.createElement('canvas');tile.width=tile.height=TILE;const c=tile.getContext('2d');
            c.drawImage(source.canvas,frame.x,frame.y,TILE,TILE,0,0,TILE,TILE);
            c.globalCompositeOperation='multiply';c.fillStyle=color;c.fillRect(0,0,TILE,TILE);
            c.globalCompositeOperation='destination-in';c.drawImage(source.canvas,frame.x,frame.y,TILE,TILE,0,0,TILE,TILE);
            if(source.tints.size>=128)source.tints.delete(source.tints.keys().next().value);
            source.tints.set(key,tile);
        }
        ctx.drawImage(source.tints.get(key),x,y,width,height);return;
    }
    ctx.drawImage(source.canvas, frame.x, frame.y, TILE, TILE, x, y, width, height);
};

export class ParticleSprites {
    constructor(scene, source, limit) {
        this.scene = scene; this.limit = limit; this.images = []; this.activeCount = 0;
        // Match the compositor's battlefield clip; debris must not spill over
        // the aiming controls. Mask three batches, rather than every particle.
        this.clip = scene.make.graphics({x:0,y:0,add:false});
        this.clip.fillStyle(0xffffff).fillRect(0,0,scene.renderer.width,Math.floor(scene.renderer.height*2/3));
        this.mask = this.clip.createGeometryMask();
        this.layers = {
            smoke:scene.add.container(0,0).setDepth(4.8).setMask(this.mask),
            explosion:scene.add.container(0,0).setDepth(4.9).setMask(this.mask),
            sparks:scene.add.container(0,0).setDepth(5.2).setMask(this.mask),
        };
        this.key = 'weapon-particle-atlas';
        if (!scene.textures.exists(this.key)) {
            const texture = scene.textures.addCanvas(this.key, source.canvas);
            Object.entries(source.frames).forEach(([name, {x,y}]) => texture.add(name,0,x,y,TILE,TILE));
        }
    }

    render(particles) {
        let index = 0;
        for (const p of particles) {
            if (p.age < 0 || index >= this.limit) continue;
            let image = this.images[index];
            if (!image) { image = this.scene.add.image(0,0,this.key); this.images.push(image); }
            index++;
            const t = p.age/p.life, size = Math.max(.1,p.size+p.growth*t);
            const fade = p.art?(p.channel==='impact'?1:Math.pow(Math.max(0,1-t),.5)):isMaterialBurst(p.kind)?Math.pow(Math.max(0,1-t),.35):Math.sin(Math.min(1,t*5)*Math.PI/2)*Math.pow(Math.max(0,1-t),p.kind==='smoke'?.55:1.2);
            const soft = p.art?['trail','residue'].includes(p.channel):['smoke','dust','vapor'].includes(p.kind);
            const additive = ['light','energy','spark'].includes(p.kind);
            const layer = soft ? this.layers.smoke : ((p.art&&p.channel==='impact')||isMaterialBurst(p.kind)) ? this.layers.explosion : this.layers.sparks;
            if (image.parentContainer !== layer) layer.add(image);
            image.setTexture(p.art?.key||this.key,p.art?ownedFrame(p):animatedParticleFrame(p)).setPosition(p.x,p.y).setRotation(p.rotation)
                .setAlpha(p.alpha * fade).setBlendMode(additive ? 1 : 0).setDepth(soft ? 4.8 : p.kind==='explosion' ? 4.9 : 5.2).setVisible(true).setOrigin(.5);
            image.clearTint();
            if (['dust','vapor','energy','light','spark','debris','drop'].includes(p.kind)) image.setTint(parseInt(p.color.replace('#',''),16));
            if(p.art){if(p.channel==='beam')image.setDisplaySize(size,p.beamWidth);else image.setDisplaySize(size,size).setOrigin(.5,['impact','residue'].includes(p.channel)?.85:.5);}
            else if (p.kind === 'flame') image.setDisplaySize(size*1.5,size*2).setOrigin(.5,.88);
            else if (p.kind === 'energy') image.setDisplaySize(size*8,size*8);
            else if (p.kind === 'spark') image.setDisplaySize(Math.min(18,Math.hypot(p.vx,p.vy)*.04)+1,p.size*2).setRotation(Math.atan2(p.vy,p.vx));
            else if (p.kind === 'debris') image.setDisplaySize(size*3.2,size*3.2);
            else if (p.kind === 'ice' || p.kind === 'drop') image.setDisplaySize(size*3.6,size*3.6);
            else if (isMaterialBurst(p.kind)) image.setDisplaySize(size*2,size*2).setOrigin(.5,.85);
            else image.setDisplaySize(size*2,size*2);
        }
        for (let i = index; i < this.activeCount; i++) this.images[i].setVisible(false);
        this.activeCount = index;
    }

    reset() { this.render([]); }
    dispose() { this.images.forEach(image => image.destroy());Object.values(this.layers).forEach(layer=>layer.destroy());this.mask.destroy();this.clip.destroy();this.images=[];this.activeCount=0; }
}
