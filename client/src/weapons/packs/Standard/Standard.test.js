import { singleshot, bigshot, jackhammer, spider, sniperrifle, magicwall, dirtslinger, napalm, hailstorm, chainreaction, firecracker, dirtball, cruiser, pineapple } from './Standard';

jest.mock('phaser', () => {
    class Vector2 { constructor(x, y) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } setAngle() { return this; } setLength() { return this; } length() { return Math.hypot(this.x, this.y); } angle() { return Math.atan2(this.y, this.x); } }
    const Distance = { Between: (a, b, c, d) => Math.hypot(a - c, b - d), BetweenPoints: (a, b) => Math.hypot(a.x - b.x, a.y - b.y) };
    return { __esModule: true, default: { Math: { Vector2, Distance, Angle: { Wrap: x => x, Between: (a, b, c, d) => Math.atan2(d - b, c - a) }, DegToRad: d => d * Math.PI / 180, RadToDeg: r => r * 180 / Math.PI } }, Physics: {}, Scene: {} };
});
jest.mock('../../../classes/Weapon', () => ({ Weapon: class {} }));
jest.mock('./logos', () => ({}));
jest.mock('../../expansion/tactics', () => ({ scoreHit: jest.fn() }));

const RUBBER = { r: 230, g: 0, b: 230, alpha: 255 };
const DIRT = { r: 120, g: 80, b: 40, alpha: 255 };

const makeWeapon = (pixel = DIRT) => {
    const tank = x => ({ x, y: 330, centre: { x, y: 343 }, hitRadius: 10, isPointInside: () => false });
    const tank1 = tank(300), tank2 = tank(720);
    const scene = {
        tank1, tank2,
        sound: { play: jest.fn(), stopByKey: jest.fn(), get: () => null },
        textures: { exists: jest.fn(() => true), remove: jest.fn(), addCanvas: jest.fn() },
        time: { addEvent: jest.fn(config => ({ ...config, remove: jest.fn() })), delayedCall: jest.fn(() => ({ remove: jest.fn() })) },
        add: { circle: () => ({ destroy: jest.fn() }), text: () => ({ setOrigin: () => ({ setFont: jest.fn() }) }) },
        tweens: { add: jest.fn() },
    };
    const weapon = {
        scene, tank: tank1, turret: { activeWeapon: {} },
        terrain: { width: 1000, height: 600, blast: jest.fn(), getPixel: () => pixel, save: jest.fn(), getContext: () => ({ createLinearGradient: () => ({ addColorStop: jest.fn() }) }),
            getRightGround: () => null, getLeftGround: () => null, getSurfaceUp: () => null, getSlope: () => 0 },
        defaultUpdateScore: jest.fn(), scoreTarget: jest.fn(), defaultBounce: jest.fn(), defaultUpdate: jest.fn(), updateTail: jest.fn(),
        retractInTerrain: o => [o.body.x, o.body.y, o.body.x, o.body.y],
    };
    scene.terrain = weapon.terrain;
    return weapon;
};
const sprite = (x = 500, y = 300, extra = {}) => ({ body: { x, y, velocity: { x: 100, y: 50 }, stop: jest.fn(), preUpdate: jest.fn(), updateFromGameObject: jest.fn() },
    x, y, texture: { key: 'projectile~test' }, destroy: jest.fn(), setPosition: jest.fn(), setGravity: jest.fn(), setVelocity: jest.fn(), bounceCount: 3, ...extra });

test('rubber bounces happen bounceCount times before the shell detonates', () => {
    const weapon = makeWeapon(RUBBER), handler = new singleshot(), obj = sprite();
    handler.projectile = obj; handler.blast = jest.fn();
    for (let hit = 0; hit < 3; hit++) handler.onTerrainHit(weapon, obj);
    expect(weapon.defaultBounce).toHaveBeenCalledTimes(3); expect(handler.blast).not.toHaveBeenCalled();
    handler.onTerrainHit(weapon, obj);
    expect(handler.blast).toHaveBeenCalledTimes(1); expect(weapon.defaultBounce).toHaveBeenCalledTimes(3);
});

test.each([['Dirt Slinger', dirtslinger], ['Dirtball', dirtball]])('%s keeps flying after a rubber bounce instead of updating a null build tween', (name, Handler) => {
    const weapon = makeWeapon(RUBBER), handler = new Handler(), obj = sprite();
    handler.projectile = obj; handler.blast = jest.fn();
    handler.onTerrainHit(weapon, obj);
    expect(handler.groundHit).toBe(false); expect(handler.blast).not.toHaveBeenCalled();
    expect(() => handler.update(weapon)).not.toThrow(); expect(weapon.defaultUpdate).toHaveBeenCalledWith(obj);
    weapon.terrain.getPixel = () => DIRT; handler.onTerrainHit(weapon, obj);
    expect(handler.groundHit).toBe(true); expect(handler.blast).toHaveBeenCalledTimes(1);
});

test('dirt builders are typed for the CPU cover routine', () => {
    [magicwall, dirtslinger, dirtball].forEach(Handler => expect(new Handler().type).toBe(4));
});

test('Napalm removes only the burnt-out flame and ends the turn with the last one', () => {
    const weapon = makeWeapon(), handler = new napalm(), turretWeapon = weapon.turret.activeWeapon;
    const smoke = () => ({ destroy: jest.fn(), tween: { remove: jest.fn() } });
    const a = sprite(1, 1, { smokeEmitter: smoke(), texture: { key: 'particle-0~s1' } }), b = sprite(2, 2, { smokeEmitter: null });
    handler.dissipated = true; handler.particles = [a, b];
    const aSmoke = a.smokeEmitter;
    handler.destroyParticle(weapon, a);
    expect(handler.particles).toEqual([b]); expect(weapon.turret.activeWeapon).toBe(turretWeapon);
    expect(aSmoke.tween.remove).toHaveBeenCalled(); expect(weapon.scene.textures.remove).toHaveBeenCalledWith('particle-0~s1');
    handler.onOutOfBound(weapon, b);
    expect(handler.particles).toEqual([]); expect(weapon.turret.activeWeapon).toBeNull();
});

test('Napalm scores each burn tick synchronously through scoreTarget', () => {
    const weapon = makeWeapon(), handler = new napalm();
    handler.projectile = sprite(); handler.createParticle = jest.fn();
    handler.blast(weapon, handler.projectile);
    handler.particles = [{ x: 720, y: 343 }, { x: 725, y: 343 }];
    handler.scoreTween.onLoop();
    expect(weapon.scene.time.delayedCall).not.toHaveBeenCalled();
    expect(weapon.scoreTarget).toHaveBeenCalledWith(weapon.scene.tank2, expect.any(Number));
    expect(weapon.scoreTarget.mock.calls.find(([target]) => target === weapon.scene.tank2)[1]).toBeGreaterThan(0);
});

test('Hail Storm scores synchronously, plays at volume 1 and cancels its delayed sound when the shot ends', () => {
    const weapon = makeWeapon(), handler = new hailstorm();
    handler.projectile = sprite(); handler.dissociate(weapon, 500, 300);
    const [delay, start] = weapon.scene.time.delayedCall.mock.calls[0];
    expect(delay).toBe(2000); start(); expect(weapon.scene.sound.play).toHaveBeenCalledWith('hailstorm', { volume: 1 });
    handler.soundTimer = { remove: jest.fn() }; const timer = handler.soundTimer;
    handler.onShotFinished(weapon);
    expect(timer.remove).toHaveBeenCalled(); expect(weapon.scene.sound.stopByKey).toHaveBeenCalledWith('hailstorm');
    weapon.scene.tank2.isPointInside = () => true; handler.ballsArray = [sprite(720, 343), sprite(721, 343)];
    weapon.scene.time.delayedCall.mockClear(); handler.scoreTween.onLoop();
    expect(weapon.scene.time.delayedCall).not.toHaveBeenCalled(); expect(weapon.scoreTarget).toHaveBeenCalledWith(weapon.scene.tank2, 1);
});

test('Spider keeps the turn while later waves are still due', () => {
    const weapon = makeWeapon(), handler = new spider(), turretWeapon = weapon.turret.activeWeapon;
    const spiderling = () => sprite(500, 300, { tween1: { destroy: jest.fn() }, tween2: { destroy: jest.fn() } });
    handler.dissipated = true; handler.frameCount = 10;
    const early = spiderling(); handler.particles = [early]; handler.blast(weapon, early, true);
    expect(handler.particles).toHaveLength(0); expect(weapon.turret.activeWeapon).toBe(turretWeapon);
    handler.frameCount = 26; const last = spiderling(); handler.particles = [last]; handler.onOutOfBound(weapon, last);
    expect(weapon.turret.activeWeapon).toBeNull();
});

test('Sniper direct hits go through scoreTarget at the rebalanced 70 points', () => {
    const weapon = makeWeapon(), handler = new sniperrifle(), obj = sprite();
    handler.projectile = obj; handler.blast = jest.fn();
    handler.onTankHit(weapon, obj, weapon.scene.tank2);
    expect(weapon.scoreTarget).toHaveBeenCalledWith(weapon.scene.tank2, 70);
    handler.onTankHit(weapon, obj, weapon.tank);
    expect(weapon.scoreTarget).toHaveBeenLastCalledWith(weapon.tank, 70);
});

test('Jackhammer detonates on a direct tank hit', () => {
    const weapon = makeWeapon(), handler = new jackhammer(), obj = sprite();
    handler.projectile = obj; handler.frameCount = 7;
    handler.onTankHit(weapon, obj, weapon.scene.tank2);
    expect(weapon.terrain.blast).toHaveBeenCalledTimes(1); expect(obj.destroy).toHaveBeenCalled(); expect(weapon.turret.activeWeapon).toBeNull();
});

test('Big Shot outscores Single Shot', () => {
    const big = makeWeapon(), single = makeWeapon();
    const b = new bigshot(); b.projectile = sprite(); b.blast(big);
    const s = new singleshot(); s.projectile = sprite(); s.blast(single, true);
    const peak = ([, , r, factor]) => r * factor;
    expect(peak(big.defaultUpdateScore.mock.calls[0])).toBeCloseTo(75);
    expect(peak(big.defaultUpdateScore.mock.calls[0])).toBeGreaterThan(peak(single.defaultUpdateScore.mock.calls[0]));
});

test.each([
    // Chain Reaction: 1 immediate + 14 timed links; Firecracker: 1 + 20 timed pairs.
    ['Chain Reaction', chainreaction, 15, weapon => weapon.scene.time.addEvent.mock.calls[0][0]],
    ['Firecracker', firecracker, 41, weapon => weapon.scene.time.addEvent.mock.calls[0][0]],
])('%s keeps the turn until its last delayed blast', (name, Handler, callbacks, timer) => {
    const weapon = makeWeapon(), handler = new Handler(), turretWeapon = weapon.turret.activeWeapon;
    // Destroyed projectiles lose their coordinates: the blasts must use stored ones.
    const obj = sprite(500, 300); obj.destroy = jest.fn(() => { obj.y = undefined; });
    handler.projectile = obj; handler.blast(weapon, true);
    expect(weapon.turret.activeWeapon).toBe(turretWeapon);
    const config = timer(weapon);
    for (let i = 0; i <= config.repeat; i++) {
        expect(weapon.turret.activeWeapon).toBe(turretWeapon);
        config.callback.call(handler);
    }
    expect(weapon.turret.activeWeapon).toBeNull();
    expect(weapon.terrain.blast).toHaveBeenCalledTimes(callbacks);
});

test('Cruiser proximity uses the tank centre, not tank.x/y', () => {
    const weapon = makeWeapon(), handler = new cruiser();
    weapon.scene.tank2.x = 900; weapon.scene.tank2.y = 100; weapon.scene.tank2.centre = { x: 600, y: 300 };
    handler.projectile = { ...sprite(603, 300), rotation: 0, setRotation: jest.fn() };
    handler.tail = { setPosition: jest.fn(), setRotation: jest.fn(), destroy: jest.fn() };
    handler.blast = jest.fn();
    handler.roll(weapon);
    expect(handler.blast).toHaveBeenCalledWith(weapon, true);
});

test('Pineapple fragments are trimmed about 15%', () => {
    const weapon = makeWeapon(), handler = new pineapple(), frag = sprite();
    handler.projectile = sprite(); handler.particles = [frag, sprite()];
    handler.blast(weapon, frag, true);
    const [, , r, factor] = weapon.defaultUpdateScore.mock.calls[0];
    expect(r * factor).toBeCloseTo(25.5);
});
