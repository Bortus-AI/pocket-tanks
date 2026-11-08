import { drawVehicle } from './vehicle';
import { clamp, damp, dampAngle, frameSeconds, reducedMotion, spring } from './motion';

const SCALE = 4, TRACK_FRAMES = 8;

// The original 36x24 sprite and 6x32 turret remain the physics/aim anchors.
// These images never change a body, hit polygon, firing angle or saved position.
export class TankPresentation {
    constructor(tank) {
        this.tank = tank;
        this.scene = tank.scene;
        this.reducedMotion = reducedMotion();
        this.phase = 0;
        this.recoil = 0;
        this.bounce = 0;
        this.velocity = 0;
        this.rock = 0;
        this.rockVelocity = 0;
        this.rotation = tank.rotation;
        this.aim = tank.turret.rotation;
        this.lastX = tank.x;
        this.lastY = tank.y;
        this.wasSettled = tank.settled;
        this.dustClock = 0;
        this.keys = [];
        const color = typeof tank.color === 'number' ? `#${tank.color.toString(16).padStart(6, '0')}` : tank.color;
        const atlas = document.createElement('canvas');
        atlas.width = 36 * SCALE * (TRACK_FRAMES + 1); atlas.height = 24 * SCALE;
        const ctx = atlas.getContext('2d');
        for (let i = 0; i <= TRACK_FRAMES; i++) {
            ctx.save(); ctx.translate(i * 36 * SCALE, 0); ctx.scale(SCALE, SCALE);
            ctx.translate(0, -1.2); ctx.scale(1, .6);
            drawVehicle(ctx, color, false, {part:i === TRACK_FRAMES ? 'hull' : 'tracks', phase:i / TRACK_FRAMES});
            ctx.restore();
        }
        const key = `vehicle-detail-${tank.id}`;
        if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
        const texture = this.scene.textures.addCanvas(key, atlas);
        for (let i = 0; i <= TRACK_FRAMES; i++) texture.add(i, 0, i * 36 * SCALE, 0, 36 * SCALE, 24 * SCALE);
        this.keys.push(key);
        this.tracks = this.scene.add.image(tank.x, tank.y, key, 0).setScale(1 / SCALE).setDepth(-2);
        this.hull = this.scene.add.image(tank.x, tank.y, key, TRACK_FRAMES).setScale(1 / SCALE).setDepth(-2);
        const barrel = document.createElement('canvas'); barrel.width = 6 * SCALE; barrel.height = 32 * SCALE;
        const c = barrel.getContext('2d'); c.scale(SCALE, SCALE);
        const steel = c.createLinearGradient(1, 0, 5, 0);
        steel.addColorStop(0, '#1b343c'); steel.addColorStop(.38, '#d2dec3'); steel.addColorStop(.65, '#789a92'); steel.addColorStop(1, '#2a4850');
        c.fillStyle = steel; c.fillRect(1.5, .5, 3, 16);
        c.fillStyle = '#233e46'; c.fillRect(.5, 0, 5, 3.5);
        c.fillStyle = '#d4d9ba'; c.fillRect(1, 3.2, 4, .7);
        c.fillStyle = '#10252c'; c.fillRect(1.2, .3, 3.6, .7);
        c.fillStyle = '#e7e5ca'; c.fillRect(2, 4, .5, 10);
        const barrelKey = `barrel-detail-${tank.id}`;
        if (this.scene.textures.exists(barrelKey)) this.scene.textures.remove(barrelKey);
        this.scene.textures.addCanvas(barrelKey, barrel); this.keys.push(barrelKey);
        this.barrel = this.scene.add.image(tank.x, tank.y, barrelKey).setScale(1 / SCALE).setDepth(-3);
        tank.setAlpha(0); tank.turret.setAlpha(0);
        this.onUpdate = (_, delta) => this.update(delta);
        this.onDispose = () => this.dispose();
        this.scene.events.on('postupdate', this.onUpdate);
        this.scene.events.once('shutdown', this.onDispose);
        tank.once('destroy', this.onDispose);
        this.update(0);
    }

    fire() {
        if (this.disposed || this.reducedMotion) return;
        this.recoil = 3.5;
        this.velocity += 16;
        this.rockVelocity += Math.sin(this.tank.turret.rotation) * .85;
    }

    impact(strength, direction = 1) {
        if (this.disposed || this.reducedMotion) return;
        this.velocity += clamp(strength, 0, 1) * 35;
        this.rockVelocity += direction * clamp(strength, 0, 1) * 1.2;
    }

    update(delta) {
        if (this.disposed) return;
        const t = this.tank, dt = frameSeconds(delta), distance = t.x - this.lastX;
        const teleport = Math.hypot(distance, t.y - this.lastY) > 25;
        if (!this.reducedMotion && !teleport) {
            if (t.moving) this.phase += distance / 8;
            if (t.settled && !this.wasSettled) this.impact(.45);
            if (t.moving) this.velocity += Math.sin(this.phase * Math.PI * 4) * Math.min(Math.abs(distance), 2) * 3;
        }
        [this.bounce, this.velocity] = spring(this.bounce, this.velocity, 16, dt);
        [this.rock, this.rockVelocity] = spring(this.rock, this.rockVelocity, 13, dt);
        this.recoil = damp(this.recoil, 0, 17, dt);
        this.rotation = teleport || this.reducedMotion ? t.rotation : dampAngle(this.rotation, t.rotation, 24, dt);
        this.aim = teleport || this.reducedMotion ? t.turret.rotation : dampAngle(this.aim, t.turret.rotation, 32, dt);
        const visible = t.visible;
        const bounce = clamp(this.bounce, -1.2, 1.2), rotation = this.rotation + clamp(this.rock, -.065, .065);
        this.tracks.setPosition(t.x, t.y).setRotation(this.rotation).setFrame(((Math.floor(this.phase * TRACK_FRAMES) % TRACK_FRAMES) + TRACK_FRAMES) % TRACK_FRAMES).setVisible(visible);
        this.hull.setPosition(t.x, t.y + bounce).setRotation(rotation).setVisible(visible);
        // Reconstruct the mount from the anchor; never ease logical turret aiming.
        const x = t.x + t.height / 2 * Math.sin(rotation), y = t.y - t.height / 2 * Math.cos(rotation) + bounce;
        this.barrel.setPosition(x - Math.sin(this.aim) * this.recoil, y + Math.cos(this.aim) * this.recoil).setRotation(this.aim).setVisible(visible && t.turret.visible);
        this.dustClock += dt;
        if (t.moving && t.settled && !teleport && !this.reducedMotion && this.dustClock > .09) {
            this.dustClock = 0;
            this.scene.weaponFX?.particle('dust', t.x - Math.sign(distance || 1) * 15, t.y, {vx:-Math.sign(distance || 1) * 15,vy:-8,life:.55,size:5,growth:12,alpha:.23});
        }
        this.lastX = t.x; this.lastY = t.y; this.wasSettled = t.settled;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.scene.events.off('postupdate', this.onUpdate);
        this.scene.events.off('shutdown', this.onDispose);
        this.tank.off('destroy', this.onDispose);
        for (const image of [this.tracks, this.hull, this.barrel]) image.destroy();
        for (const key of this.keys) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
}
