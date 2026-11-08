import { WeaponFX, profileFor, emitWeaponImpact, createWeaponProjectile, emitWeaponMuzzle, resetTransientWeaponFX } from './weapon-fx';
import { impactStyle, impactStyleKey, shakeFor } from './impact-style';
import { weaponArt, impactArtSize, WEAPON_ART } from './weapon-art';
import { ParticleSprites } from './particle-sprites';
import designs from './weapon-art/designs.json';

jest.mock('../audio/weapon-audio', () => {
    // Plain functions: CRA's resetMocks would wipe jest.fn implementations.
    const recent = new Set(), calls = [];
    return {playWeaponSound: (scene, kind, options) => { calls.push([kind, options.weaponId]); if (kind === 'launch') recent.add(Number(options.weaponId)); return true; },
        weaponAudio: () => ({recentlyLaunched: id => recent.has(id)}), __recent: recent, __calls: calls};
});
const audio = require('../audio/weapon-audio');

const bareFX = (extra = {}) => Object.assign(Object.create(WeaponFX.prototype), {
    scene: {}, particles: [], stories: [], bursts: [], beams: [], projectiles: new Map(), zones: new Map(),
    particleLimit: 650, storyLimit: 24, beamLimit: 24, time: 0, lastShake: -1, owned: {get: design => ({id: design.id, design})}, ...extra});

test('impact style descriptors for all 770 weapons are pairwise distinct and deterministic', () => {
    const keys = new Set();
    for (const design of WEAPON_ART) {
        const options = {weaponId: design.id};
        const a = impactStyle(options, design), b = impactStyle({...options}, design);
        expect(b).toBe(a);keys.add(impactStyleKey(a));
        expect(a.accent).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(keys.size).toBe(770);
});

test('every weapon id resolves its own design in projectile, trail and impact profiles', () => {
    for (const design of designs) {
        const profile = profileFor({weaponId: design.id, payload: design.material});
        expect(profile.art.id).toBe(design.id);expect(profile.style.weaponId).toBe(design.id);
    }
});

test('owned impact art is scaled to the actual blast radius', () => {
    for (const id of [0, 77, 400, 769]) {
        const design = weaponArt({weaponId: id}), fx = bareFX();
        fx.impact(100, 100, 40, {weaponId: id});
        const impact = fx.particles.find(p => p.channel === 'impact');
        expect(impact.size).toBeCloseTo(impactArtSize(design, 40), 6);
        expect(impact.size).toBeGreaterThan(40 * 2.2);expect(impact.size).toBeLessThan(40 * 5.6);
    }
    expect(impactArtSize(null, 10)).toBe(32);
});

test('a full texture cache falls back to the material burst instead of drawing nothing', () => {
    const fx = bareFX({owned: {get: () => null}});
    expect(fx.impact(100, 100, 50, {weaponId: 40, payload: 'fire'})).toBe(true);
    expect(fx.particles.length).toBeGreaterThan(10);
    expect(fx.particles.some(p => p.kind === 'owned')).toBe(false);
    expect(fx.bursts.at(-1)).toMatchObject({identity: true, accent: profileFor({weaponId: 40, payload: 'fire'}).style.accent});
});

test('large blasts shake proportionally to radius, never under reduced motion', () => {
    expect(shakeFor(20)).toBeNull();expect(shakeFor(200, true)).toBeNull();
    expect(shakeFor(160).intensity).toBeGreaterThan(shakeFor(60).intensity);
    const shake = jest.fn(), fx = bareFX({scene: {cameras: {main: {shake}}}});
    fx.impact(100, 100, 120, {weaponId: 3});expect(shake).toHaveBeenCalledTimes(1);
});

test('a build event pushes exactly one story', () => {
    const fx = bareFX({owned: {get: () => null}});
    fx.build(100, 100, 'wall', {weaponId: 12});
    expect(fx.stories).toHaveLength(1);
});

test('transient reset clears projectiles/particles/beams but keeps zones; idle projectiles are pruned', () => {
    const fx = bareFX({gpuParticles: null, reducedMotion: false});
    fx.zone({kind: 'fire', x: 1, y: 1, radius: 20, weaponId: 31});
    const visual = fx.projectile(10, 10, {weaponId: 31});fx.particle('spark', 0, 0);fx.beams.push({});
    fx.resetTransient();
    expect(fx.projectiles.size).toBe(0);expect(fx.particles).toHaveLength(0);expect(fx.beams).toHaveLength(0);expect(fx.zones.size).toBe(1);
    resetTransientWeaponFX({weaponFX: fx});
    const stale = fx.projectile(10, 10, {weaponId: 31});
    expect(fx.projectiles.size).toBe(1);
    const p = [...fx.projectiles.values()][0];p.idle = 9;
    fx.time = 0;fx.disposed = false;fx.canvas = {width: 1, height: 1};fx.ctx = {clearRect() {}};fx.texture = {refresh: jest.fn()};
    fx.drawMs = 0;fx.zones.clear();fx.scene = {};
    fx.update(16);
    expect(fx.projectiles.size).toBe(0);
    expect(visual).toBeTruthy();expect(stale).toBeTruthy();
});

test('zone-only frames redraw at ~15fps and not at all when static under reduced motion', () => {
    const refresh = jest.fn(), ctx = new Proxy({}, {get: (t, k) => k in t ? t[k] : () => ({addColorStop() {}}), set: (t, k, v) => { t[k] = v; return true; }});
    const fx = bareFX({gpuParticles: null, reducedMotion: false, disposed: false, canvas: {width: 10, height: 10}, ctx, texture: {refresh}, drawMs: 0, dirty: true, lastSlowDraw: -1, hadVisuals: false, fieldKey: ''});
    fx.zone({kind: 'mine', x: 1, y: 1, radius: 10});
    for (let i = 0; i < 60; i++) fx.update(1000 / 60);
    expect(refresh.mock.calls.length).toBeGreaterThan(10);expect(refresh.mock.calls.length).toBeLessThan(20);
    refresh.mockClear();fx.reducedMotion = true;fx.dirty = false;
    for (let i = 0; i < 60; i++) fx.update(1000 / 60);
    expect(refresh).not.toHaveBeenCalled();
    fx.zone({kind: 'acid', x: 1, y: 1, radius: 10});fx.update(16);expect(refresh).toHaveBeenCalledTimes(1);
});

test('profiles are cached per options object without re-serialising rules', () => {
    const options = {weaponId: 50, semanticRules: ['a'], mechanicOptions: {x: 1}};
    const spy = jest.spyOn(JSON, 'stringify');
    profileFor(options);spy.mockClear();
    for (let i = 0; i < 20; i++) profileFor(options);
    expect(spy).not.toHaveBeenCalled();spy.mockRestore();
});

test('sound is hooked centrally: muzzle launches once, children are silent, impacts sound', () => {
    audio.__calls.length = 0;audio.__recent.clear();
    const scene = {add: {circle: () => ({setDepth() { return this; }})}};
    emitWeaponMuzzle(scene, 0, 0, 0, {weaponId: 60});
    createWeaponProjectile(scene, 0, 0, {weaponId: 60});
    createWeaponProjectile(scene, 0, 0, {weaponId: 61, small: true});
    createWeaponProjectile(scene, 0, 0, {weaponId: 62});
    emitWeaponImpact(scene, 0, 0, 40, {weaponId: 60});
    emitWeaponImpact(scene, 0, 0, 40, {weaponId: 5, audio: 'layer'});
    emitWeaponImpact(scene, 0, 0, 40, {weaponId: 6, audio: false});
    expect(audio.__calls).toEqual([['launch', 60], ['launch', 62], ['impact', 60], ['layer', 5]]);
});

test('stale baked materials are tinted toward the live payload', () => {
    const design = designs.find(d => d.material === 'kinetic' && d.id >= 400);
    const fx = bareFX();fx.impact(10, 10, 30, {weaponId: design.id, payload: 'fire'});
    expect(fx.particles.find(p => p.channel === 'impact').artTint).toBe(0xff8b35);
    const fx2 = bareFX();fx2.impact(10, 10, 30, {weaponId: design.id, payload: 'kinetic'});
    expect(fx2.particles.find(p => p.channel === 'impact').artTint).toBeNull();
});

test('particle sprites only touch texture/blend/tint state when it changes and rebind a stale atlas', () => {
    const image = () => ({setTexture: jest.fn().mockReturnThis(), setPosition: jest.fn().mockReturnThis(), setRotation: jest.fn().mockReturnThis(), setAlpha: jest.fn().mockReturnThis(),
        setBlendMode: jest.fn().mockReturnThis(), setDepth: jest.fn().mockReturnThis(), setVisible: jest.fn().mockReturnThis(), setOrigin: jest.fn().mockReturnThis(),
        setTint: jest.fn().mockReturnThis(), clearTint: jest.fn().mockReturnThis(), setDisplaySize: jest.fn().mockReturnThis(), destroy() {}});
    const textures = new Map();
    const layer = () => ({setDepth() { return this; }, setMask() { return this; }, add(img) { img.parentContainer = this; }, destroy() {}});
    const scene = {renderer: {width: 100, height: 90}, make: {graphics: () => ({fillStyle() { return this; }, fillRect() { return this; }, createGeometryMask: () => ({destroy() {}}), destroy() {}})},
        add: {container: layer, image}, textures: {exists: k => textures.has(k), get: k => ({getSourceImage: () => textures.get(k)}), remove: k => textures.delete(k), addCanvas: (k, c) => { textures.set(k, c); return {add() {}}; }}};
    const source = {canvas: {id: 1}, frames: {spark: {x: 0, y: 0}}};
    const sprites = new ParticleSprites(scene, source, 10);
    const particle = {kind: 'spark', x: 1, y: 1, vx: 1, vy: 0, age: .1, life: 1, size: 1, growth: 0, rotation: 0, alpha: 1, color: '#ff0000'};
    sprites.render([particle]);sprites.render([particle]);sprites.render([particle]);
    const img = sprites.images[0];
    expect(img.setTexture).toHaveBeenCalledTimes(1);expect(img.setBlendMode).toHaveBeenCalledTimes(1);expect(img.setTint).toHaveBeenCalledTimes(1);
    sprites.bind({canvas: {id: 2}, frames: source.frames});
    expect(textures.get('weapon-particle-atlas')).toEqual({id: 2});
    sprites.render([particle]);expect(img.setTexture).toHaveBeenCalledTimes(2);
});
