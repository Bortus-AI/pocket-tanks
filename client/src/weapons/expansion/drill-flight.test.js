import { advanceDrill } from './drill-flight';

const fixture = (isSolid = (x, y) => x >= 100 && x < 550) => {
    const width = 600, height = 400, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[(y * width + x) * 4 + 3] = isSolid(x, y) ? 255 : 0;
    const terrain = {width, height, data, context: {getImageData: jest.fn(() => ({data}))}, getPixel(x, y) {
        x = Math.round(x); y = Math.round(y);
        return {alpha: x >= 0 && y >= 0 && x < width && y < height ? data[(y * width + x) * 4 + 3] : 0};
    }};
    const runtime = {terrain, carve: jest.fn((cx, cy, radius) => {
        for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(height - 1, Math.ceil(cy + radius)); y++) {
            for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(width - 1, Math.ceil(cx + radius)); x++) {
                if (Math.hypot(x - cx, y - cy) <= radius) data[(y * width + x) * 4 + 3] = 0;
            }
        }
    })};
    return runtime;
};
const fly = (runtime, start, velocity, limit = 2000) => {
    const p = {...start};
    let outcome;
    for (let step = 0; step < limit; step++) {
        const previous = {x: p.x, y: p.y}, next = {x: p.x + velocity.x, y: p.y + velocity.y};
        Object.assign(p, next); outcome = advanceDrill(runtime, p, previous, next);
        if (outcome.impact || p.x < 1 || p.x >= runtime.terrain.width - 1 || p.y >= runtime.terrain.height) break;
    }
    return {p, outcome};
};

test.each([.5, 1, 2, 13 / 7])('penetrates exactly150 pixels at step length %s despite excavating its own future samples', step => {
    const runtime = fixture();
    const {p, outcome} = fly(runtime, {x: 50, y: 200}, {x: step, y: 0});
    expect(outcome.impact).toBe(true); expect(p.drilled).toBe(150); expect(p.x).toBeCloseTo(249.5, 7);
    expect(runtime.carve.mock.calls.length).toBeGreaterThan(10);
});

test('does not charge an actual air gap against the solid-ground budget', () => {
    const runtime = fixture(x => (x >= 100 && x < 150) || x >= 200);
    const {p, outcome} = fly(runtime, {x: 50, y: 200}, {x: 2, y: 0});
    expect(outcome.impact).toBe(true); expect(p.x).toBeCloseTo(299.5, 7); expect(p.drilled).toBe(150);
});

test('uses geometric length for diagonal penetration rather than sample count', () => {
    const runtime = fixture(() => true);
    const {p, outcome} = fly(runtime, {x: 100, y: 100}, {x: 1.5, y: 1.5});
    expect(outcome.impact).toBe(true); expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(150, 7);
});

test('resolves an engaged drill at the basement before a short remaining layer can discard its payload', () => {
    const runtime = fixture((x, y) => y >= 350);
    const {p, outcome} = fly(runtime, {x: 300, y: 348}, {x: 0, y: 4});
    expect(outcome.impact).toBe(true); expect(p.y).toBe(399); expect(p.drilled).toBeCloseTo(49.5, 7);
});

test('an open-air miss at the basement remains an ordinary out-of-bounds projectile', () => {
    const runtime = fixture(() => false);
    const {p, outcome} = fly(runtime, {x: 300, y: 390}, {x: 0, y: 4});
    expect(outcome).toEqual({digging: false, impact: false}); expect(p.drillTerrain).toBeUndefined();
});

test('private preview terrain without a public data buffer snapshots its context once', () => {
    const runtime = fixture(); delete runtime.terrain.data;
    const {outcome} = fly(runtime, {x: 50, y: 200}, {x: 2, y: 0});
    expect(outcome.impact).toBe(true); expect(runtime.terrain.context.getImageData).toHaveBeenCalledTimes(1);
});

test('a digging drill reaching a side wall detonates at the edge (not the basement), and child projectiles do not become drills', () => {
    const runtime = fixture(() => true);
    const {p, outcome} = fly(runtime, {x: 590, y: 200}, {x: 2, y: 0});
    expect(outcome.impact).toBe(true); expect(p.x).toBeCloseTo(599, 7); expect(p.y).toBe(200);
    const left = fly(fixture(() => true), {x: 10, y: 200}, {x: -2, y: 0});
    expect(left.outcome.impact).toBe(true); expect(left.p.x).toBeCloseTo(1, 7);
    // A drill flying through open air off the map is not detonated.
    const air = fly(fixture(() => false), {x: 590, y: 200}, {x: 2, y: 0});
    expect(air.outcome.impact).toBe(false);
    expect(advanceDrill(runtime, {x: 100, y: 100, child: true}, {x: 98, y: 100}, {x: 100, y: 100})).toEqual({digging: false, impact: false});
});


test('a thin solid cell between clear endpoints is excavated and charged exactly once', () => {
    const runtime = fixture(x => x === 100);
    const p = {x: 101, y: 200};
    expect(advanceDrill(runtime, p, {x: 99, y: 200}, p)).toEqual({digging: true, impact: false});
    expect(p.drilled).toBe(1); expect(runtime.terrain.getPixel(100, 200).alpha).toBe(0);
});

test('a drill starting in the last terrain row resolves immediately at the basement', () => {
    const runtime = fixture(() => true), p = {x: 300, y: 401};
    expect(advanceDrill(runtime, p, {x: 300, y: 399}, {x: 300, y: 401}).impact).toBe(true);
    expect(p.y).toBe(399);
});

test('leftward entry measures the same material budget and stops at the correct mirrored position', () => {
    const runtime = fixture();
    const {p, outcome} = fly(runtime, {x: 590, y: 200}, {x: -2, y: 0});
    expect(outcome.impact).toBe(true); expect(p.drilled).toBe(150); expect(p.x).toBeCloseTo(399.5, 7);
});
