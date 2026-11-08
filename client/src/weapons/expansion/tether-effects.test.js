import {
    shootTetherEffect,
    impactTetherEffect,
    updateTetherEffect,
    disposeTetherEffect,
} from './tether-effects';
import { createWeaponProjectile } from '../../graphics/weapon-fx';
jest.mock('../../graphics/weapon-fx', () => ({
    emitWeaponImpact: jest.fn(),
    emitWeaponMuzzle: jest.fn(),
    createWeaponProjectile: jest.fn((scene, x, y) => ({
        x,
        y,
        setPosition(x, y) {
            this.x = x;
            this.y = y;
            return this;
        },
        destroy: jest.fn(),
    })),
}));

const shape = () => ({
    setDepth() {
        return this;
    },
    setStrokeStyle() {
        return this;
    },
    setPosition() {
        return this;
    },
    setVisible() {
        return this;
    },
    destroy: jest.fn(),
    clear: jest.fn(),
    lineStyle: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    strokePath: jest.fn(),
});
const setup = (name) => {
    const floor = new Map();
    const tank = (x) => {
        const t = {
            x,
            y: 349,
            width: 36,
            height: 24,
            rotation: 0,
            centre: { x, y: 343 },
            top: { x, y: 337 },
            settled: true,
            score: 0,
            tactics: { shield: 0, frost: 0, frostMoves: 0, acid: 0, marked: 0 },
            setPosition(x, y) {
                this.x = x;
                this.y = y;
                return this;
            },
            isPointInside(px, py) {
                return Math.abs(px - this.x) < 9 && py > this.y - 12 && py < this.y;
            },
            updateScore(n) {
                this.score += n;
            },
        };
        t.body = {
            x,
            y: 349,
            updateFromGameObject() {
                this.x = t.x;
                this.y = t.y;
            },
            stop: jest.fn(),
            setGravityY: jest.fn(),
            preUpdate: jest.fn(),
        };
        return t;
    };
    const scene = {
        tank1: tank(300),
        tank2: tank(720),
        add: { graphics: jest.fn(shape), circle: jest.fn(shape) },
        tacticalWorld: { shot: 0, zones: [], devices: [], nextZone: 1, nextDevice: 1 },
    };
    const runtime = {
        scene,
        definition: { name, id: 648, strength: 1, payload: { key: 'magnet', color: 0x7ecdc2 } },
        options: { range: 150 },
        tick: 0,
        projectiles: [],
        events: [],
        direction: 1,
        fxOptions: (options) => ({ weaponId: 648, weaponName: name, ...options }),
        terrain: {
            width: 1200,
            height: 533,
            getPixel(x, y) {
                return { alpha: y >= (floor.get(Math.round(x)) ?? 350) ? 255 : 0 };
            },
        },
        ground: (x) => floor.get(Math.round(x)) ?? 350,
        carve: jest.fn((x, y, r) => {
            for (let cx = Math.floor(x - r); cx <= x + r; cx++)
                floor.set(cx, Math.max(floor.get(cx) ?? 350, y + r));
        }),
        spawn(x, y, vx, vy, options) {
            this.projectiles.push({ x, y, vx, vy, age: 30, visual: shape(), ...options });
        },
    };
    runtime.weapon = {
        scene,
        tank: scene.tank1,
        turret: { x: 300, y: 337, rotation: Math.PI / 4 },
        weaponHandler: runtime,
    };
    scene.tank1.power = 45;
    return runtime;
};
const contact = (runtime, x = 700, y = 349) => {
    shootTetherEffect(runtime);
    const p = runtime.projectiles[0];
    Object.assign(p, { x, y, vx: 230, vy: 120 });
    expect(impactTetherEffect(runtime, p)).toBe(true);
    return p;
};
const finish = (runtime) => {
    const path = [];
    for (let tick = 0; tick < 400 && runtime.tetherState; tick++) {
        runtime.tick++;
        updateTetherEffect(runtime);
        path.push({
            x: runtime.scene.tank2.x,
            y: runtime.scene.tank2.y,
            ballX: runtime.tetherState?.x,
            ballY: runtime.tetherState?.y,
        });
    }
    return path;
};
beforeEach(() =>
    createWeaponProjectile.mockImplementation((scene, x, y) => ({
        x,
        y,
        setPosition(x, y) {
            this.x = x;
            this.y = y;
            return this;
        },
        destroy: jest.fn(),
    })),
);
afterEach(() => jest.clearAllMocks());

test.each(['Paddle Ball', 'Bungee Bomb', 'Danger Rope'])(
    '%s launches one aimed projectile with its own weapon identity',
    (name) => {
        const r = setup(name);
        expect(shootTetherEffect(r)).toBe(true);
        expect(r.projectiles).toHaveLength(1);
        expect(r.projectiles[0].gravity).toBe(300);
        expect(r.projectiles[0].vx).toBeGreaterThan(0);
    },
);

test('Paddle Ball uses a red physical ball, bounces and damages its nearby tethered target', () => {
    const r = setup('Paddle Ball');
    contact(r);
    const state = r.tetherState,
        rope = state.rope,
        visual = state.visual,
        path = finish(r);
    expect(r.scene.add.circle.mock.calls.some((args) => args[3] === 0xd82c3e)).toBe(true);
    expect(
        new Set(path.filter((p) => Number.isFinite(p.ballX)).map((p) => p.ballX.toFixed(1))).size,
    ).toBeGreaterThan(30);
    expect(r.lastTetherResult.attached).toBe(true);
    expect(r.lastTetherResult.collisions).toBeGreaterThan(0);
    expect(r.scene.tank1.score).toBeGreaterThan(0);
    expect(rope.destroy).toHaveBeenCalled();
    expect(r.events).toHaveLength(0);
    expect(r.tetherState).toBeNull();
    expect(visual).toBeTruthy();
});

test('Bungee Bomb carries the real tank around an arc and smashes it into excavated ground', () => {
    const r = setup('Bungee Bomb');
    contact(r);
    const path = finish(r);
    expect(Math.max(...path.map((p) => p.x)) - Math.min(...path.map((p) => p.x))).toBeGreaterThan(100);
    expect(Math.min(...path.map((p) => p.y))).toBeLessThan(230);
    expect(r.carve).toHaveBeenCalled();
    expect(r.lastTetherResult.collisions).toBeGreaterThanOrEqual(2);
    expect(r.scene.tank1.score).toBeGreaterThan(0);
    expect(r.tetherState).toBeNull();
    expect(r.events).toHaveLength(0);
});

test('Danger Rope pulls the target toward its owner and applies repeated electrical damage', () => {
    const r = setup('Danger Rope'),
        initial = Math.abs(r.scene.tank2.x - r.scene.tank1.x);
    contact(r);
    const path = finish(r);
    expect(Math.abs(r.scene.tank2.x - r.scene.tank1.x)).toBeLessThan(initial - 150);
    expect(new Set(path.map((p) => p.y.toFixed(1))).size).toBeGreaterThan(10);
    expect(r.lastTetherResult.collisions).toBeGreaterThan(3);
    expect(r.scene.tank1.score).toBeGreaterThan(0);
});

test.each(['Bungee Bomb', 'Danger Rope'])('%s cannot remotely attach on a distant missed shot', (name) => {
    const r = setup(name);
    contact(r, 100, 349);
    expect(r.tetherState).toBeUndefined();
    expect(r.scene.tank2.x).toBe(720);
    expect(r.scene.tank1.score).toBe(0);
    expect(r.events).toHaveLength(0);
});

test('a missed Paddle Ball can bounce freely without claiming a distant tank', () => {
    const r = setup('Paddle Ball');
    contact(r, 100, 349);
    expect(r.tetherState.tank).toBeUndefined();
    finish(r);
    expect(r.lastTetherResult.attached).toBe(false);
    expect(r.scene.tank2.x).toBe(720);
    expect(r.scene.tank1.score).toBe(0);
});

test('intervening cover blocks proximity attachment and cleanup releases tank gravity', () => {
    const r = setup('Danger Rope');
    r.terrain.getPixel = (x, y) => ({ alpha: x > 650 && x < 690 && y < 350 ? 255 : 0 });
    contact(r, 640, 343);
    expect(r.tetherState).toBeUndefined();
    const attached = setup('Bungee Bomb');
    contact(attached);
    const state = attached.tetherState;
    disposeTetherEffect(attached);
    expect(state.rope.destroy).toHaveBeenCalled();
    expect(attached.scene.tank2.body.setGravityY).toHaveBeenLastCalledWith(300);
    expect(attached.events).toHaveLength(0);
    expect(attached.tetherState).toBeNull();
});

test('child fragments and unrelated weapons retain their own behavior', () => {
    const r = setup('Single Shot');
    expect(shootTetherEffect(r)).toBe(false);
    expect(impactTetherEffect(r, { x: 720, y: 343 })).toBe(false);
    r.definition.name = 'Danger Rope';
    expect(impactTetherEffect(r, { x: 720, y: 343, child: true })).toBe(false);
    expect(createWeaponProjectile).not.toHaveBeenCalled();
});

test('a free Paddle Ball reflects from intervening terrain instead of passing through it to acquire a tank', () => {
    const r = setup('Paddle Ball');
    r.terrain.getPixel = (x,y) => ({alpha:((x>=640&&x<=670)||y>=350)?255:0});
    r.ground = x => x>=640&&x<=670?0:350;
    contact(r,620,349);expect(r.tetherState.tank).toBeUndefined();finish(r);
    expect(r.lastTetherResult.attached).toBe(false);expect(r.scene.tank2.x).toBe(720);expect(r.scene.tank1.score).toBe(0);
});

test('tetherEffect metadata drives deterministic replay without relying on a weapon display name', () => {
    const paths=[];
    for(let attempt=0;attempt<2;attempt++){
        const r=setup('Display alias');r.definition.tetherEffect='rope';contact(r);paths.push(finish(r));
        expect(r.lastTetherResult.kind).toBe('rope');
    }
    expect(paths[0]).toEqual(paths[1]);
});


test('Bungee Bomb acquired while the missile is high above the victim still reaches the ground repeatedly', () => {
    const r=setup('Bungee Bomb');contact(r,630,265);const path=finish(r);
    expect(Math.min(...path.map(p=>p.y))).toBeLessThan(260);
    expect(r.lastTetherResult.collisions).toBeGreaterThanOrEqual(2);
    expect(r.scene.tank1.score).toBeGreaterThan(0);
});
