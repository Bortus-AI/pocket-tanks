import { frameSeconds, reducedMotion } from './motion';

// Small, reusable textures move independently. No full-screen canvas uploads.
export class BattlefieldAtmosphere {
    constructor(scene, drawBattlefield) {
        this.scene = scene;
        this.time = 0;
        this.reducedMotion = reducedMotion();
        this.width = scene.renderer.width;
        this.height = scene.renderer.height;
        this.images = [];
        this.keys = [];
        this.ridges = [];
        this.clouds = [];
        this.motes = [];
        const canvasTexture = (suffix, width, height, draw) => {
            const key = `atmosphere-${scene.sys.settings.key}-${suffix}`;
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            draw(canvas.getContext('2d'));
            if (scene.textures.exists(key)) scene.textures.remove(key);
            scene.textures.addCanvas(key, canvas); this.keys.push(key);
            return key;
        };
        const cloudKey = canvasTexture('cloud', 512, 128, c => {
            for (let i = 0; i < 11; i++) {
                const x = 46 + i * 40, y = 64 + Math.sin(i * 2.1) * 12;
                const glow = c.createRadialGradient(x, y, 0, x, y, 45);
                glow.addColorStop(0, 'rgba(250,232,198,.55)'); glow.addColorStop(.4, 'rgba(235,225,207,.24)'); glow.addColorStop(1, 'rgba(225,221,205,0)');
                c.fillStyle = glow; c.fillRect(x-45,y-45,90,90);
            }
        });
        for (let i = 0; i < 7; i++) {
            const image = scene.add.image((i * 293) % (this.width + 300) - 150, 64 + (i % 4) * 44, cloudKey)
                .setScale(1.1 + i % 3 * .38, .6 + i % 2 * .25).setAlpha(.13 + i % 3 * .04).setDepth(-9.8);
            this.clouds.push({image, speed:1.4 + i * .38}); this.images.push(image);
        }
        for (let layer = 0; layer < 4; layer++) {
            const key = canvasTexture(`ridge-${layer}`, this.width + 80, this.height, c => drawBattlefield(c, this.width + 80, this.height, {section:'ridges',ridge:layer}));
            const image = scene.add.image(this.width/2, this.height/2, key).setDepth(-9 + layer);
            this.ridges.push(image); this.images.push(image);
        }
        const moteKey = canvasTexture('mote', 32, 32, c => {
            const g = c.createRadialGradient(16,16,0,16,16,16);
            g.addColorStop(0,'rgba(255,223,170,.8)'); g.addColorStop(.15,'rgba(235,203,155,.28)'); g.addColorStop(1,'rgba(235,203,155,0)');
            c.fillStyle=g; c.fillRect(0,0,32,32);
        });
        for (let i = 0; i < (scene.game.device.os.desktop ? 20 : 9); i++) {
            const image = scene.add.image(i * 137 % this.width, 180 + i * 53 % 330, moteKey).setScale(.08 + i % 4 * .035).setAlpha(.16).setDepth(1.5);
            this.motes.push({image, speed:3+i%5, phase:i*2.3, baseY:image.y}); this.images.push(image);
        }
        this.onUpdate = (_, delta) => this.update(delta);
        this.onDispose = () => this.dispose();
        scene.events.on('update', this.onUpdate); scene.events.once('shutdown', this.onDispose);
    }

    update(delta) {
        if (this.disposed || this.reducedMotion) return;
        const dt = frameSeconds(delta); this.time += dt;
        for (const {image, speed} of this.clouds) {
            image.x += speed * dt;
            if (image.x > this.width + 420) image.x = -420;
        }
        this.ridges.forEach((image, i) => { image.x = this.width/2 + Math.sin(this.time * .035) * (i+1) * 1.5; });
        for (const mote of this.motes) {
            mote.image.x += mote.speed * dt;
            if (mote.image.x > this.width + 8) mote.image.x = -8;
            mote.image.y = mote.baseY + Math.sin(this.time * .24 + mote.phase) * 12;
            mote.image.setAlpha(.08 + .1 * (.5 + .5 * Math.sin(this.time * .7 + mote.phase)));
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.scene.events.off('update', this.onUpdate); this.scene.events.off('shutdown', this.onDispose);
        this.images.forEach(image => image.destroy());
        this.keys.forEach(key => { if (this.scene.textures.exists(key)) this.scene.textures.remove(key); });
        if (this.scene.atmosphere === this) this.scene.atmosphere = null;
    }
}
