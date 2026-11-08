import {
  shootLaterEffect,
  impactLaterEffect,
  updateLaterEffect,
  disposeLaterEffect,
} from "./later-classic-effects";
import { deployWeaponDevice } from "./deployables";
jest.mock("./deployables", () => ({ deployWeaponDevice: jest.fn() }));

jest.mock("../../graphics/weapon-fx", () => ({
  emitTerrainBuild: jest.fn(),
  emitWeaponImpact: jest.fn(),
}));
jest.mock("./tactics", () => ({
  enemyOf: (scene, tank) => (tank === scene.tank1 ? scene.tank2 : scene.tank1),
  scoreHit: (attacker, target, amount) => {
    target.hits = (target.hits || 0) + amount;
  },
}));

function fixture(key, filled = true) {
  const visual = () => ({
    destroy: jest.fn(),
    setDepth() {
      return this;
    },
    setPosition: jest.fn(),
    setText: jest.fn(),
  });
  const tank = (x) => {
    const t = {
      x,
      y: 349,
      width: 36,
      height: 24,
      rotation: 0,
      power: 35,
      centre: { x, y: 343 },
      top: { x, y: 337 },
      settled: true,
      turret: { x, y: 337, rotation: Math.PI / 3 },
    };
    t.setPosition = (x, y) => {
      t.x = x;
      t.y = y;
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
    };
    return t;
  };
  const context = {
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    getImageData: (x, y, w, h) => {
      const data = new Uint8ClampedArray(w * h * 4);
      if (filled) for (let i = 3; i < data.length; i += 4) data[i] = 255;
      return { data };
    },
  };
  const scene = {
    tank1: tank(300),
    tank2: tank(720),
    add: { text: jest.fn(visual) },
  };
  const runtime = {
    definition: { laterEffect: key, radius: 50, strength: 1 },
    options: { shots: 7, bounces: 4 },
    scene,
    terrain: {
      width: 1200,
      height: 533,
      context,
      update: jest.fn(),
      getSlope: () => 0,
      getPixel: () => ({ alpha: 255, red: 100, green: 110, blue: 90 }),
      getRightGround: (x, y) => ({ x: x + 1, y }),
      getLeftGround: (x, y) => ({ x: x - 1, y }),
    },
    events: [],
    projectiles: [],
    tick: 0,
    direction: 1,
    random: () => 0.25,
    burst: jest.fn(),
    ray: jest.fn(),
    beam: jest.fn(),
    carve: jest.fn(),
    ground: () => 350,
    fxOptions: () => ({}),
  };
  runtime.weapon = { tank: scene.tank1, turret: scene.tank1.turret };
  runtime.spawn = (x, y, vx, vy, options) => {
    runtime.projectiles.push({ x, y, vx, vy, visual: visual(), ...options });
  };
  runtime.schedule = (seconds, fn) =>
    runtime.events.push({
      at: runtime.tick + Math.max(1, Math.round(seconds * 60)),
      fn,
    });
  runtime.step = (count) => {
    for (let i = 0; i < count; i++) {
      updateLaterEffect(runtime);
      runtime.tick++;
      const due = runtime.events.filter((e) => e.at <= runtime.tick);
      runtime.events = runtime.events.filter((e) => e.at > runtime.tick);
      due.forEach((e) => e.fn());
    }
  };
  return runtime;
}
const projectile = (x = 720, y = 350) => ({
  x,
  y,
  vx: 180,
  vy: 100,
  visual: { destroy: jest.fn(), setPosition: jest.fn() },
});

test("Time Bomb remains alive for ten seconds, updates its countdown and resolves once", () => {
  const r = fixture("time-bomb");
  expect(shootLaterEffect(r)).toBe(true);
  const p = r.projectiles[0];
  impactLaterEffect(r, p);
  p.vx = p.vy = 0;
  p.laterStuck = true;
  r.step(599);
  expect(r.burst).not.toHaveBeenCalled();
  expect(r.events).toHaveLength(1);
  r.step(2);
  expect(r.burst).toHaveBeenCalledTimes(1);
  expect(p.removed).toBe(true);
  expect(r.events).toHaveLength(0);
  expect(r.scene.add.text.mock.results[0].value.destroy).toHaveBeenCalledTimes(
    1,
  );
});

test("Bumpers place reflective full-height boundaries, independent of impact position", () => {
  const r = fixture("bumpers"),
    p = projectile(600, 350);
  expect(impactLaterEffect(r, p)).toBe(true);
  expect(r.terrain.context.fillRect.mock.calls).toEqual([
    [0, 14, 18, 519],
    [1182, 14, 18, 519],
  ]);
  expect(r.terrain.context.fillStyle).toBe("rgb(230,0,230)");
  expect(p.removed).toBe(true);
});

test("Puddle Jumper attacks its landing point without launching its owner", () => {
  const r = fixture("puddle-jumper");
  shootLaterEffect(r);
  const p = r.projectiles[0];
  for (let i = 0; i < 4; i++) impactLaterEffect(r, p);
  expect(r.burst).toHaveBeenCalledTimes(4);
  expect(p.removed).toBe(true);
  expect(r.laterState).toBeUndefined();
  expect(r.scene.tank1.x).toBe(300);
  expect(r.scene.tank1.y).toBe(349);
});

test("Leap Frog keeps its actor alive across hops and fires at the opposing tank", () => {
  const r = fixture("leap-frog");
  shootLaterEffect(r);
  r.step(60);
  expect(r.ray).toHaveBeenCalled();
  expect(r.events.length).toBeGreaterThan(0);
  r.step(400);
  expect(r.laterState).toBeNull();
  expect(r.events).toHaveLength(0);
  expect(r.scene.tank1.x).toBeGreaterThan(300);
});

test("Backtrack waits for the incoming shell and then moves away from the enemy", () => {
  const r = fixture("backtrack");
  shootLaterEffect(r);
  expect(r.laterState).toBeUndefined();
  impactLaterEffect(r, r.projectiles[0]);
  expect(r.burst).toHaveBeenCalled();
  r.step(15);
  expect(r.scene.tank1.x).toBeLessThan(300);
  expect(r.laterState).not.toBeNull();
});

test("Lock Box launches the hit tank before drawing a hollow reflective enclosure", () => {
  const r = fixture("lock-box");
  impactLaterEffect(r, projectile());
  r.step(25);
  expect(r.scene.tank2.y).toBeLessThan(349);
  expect(r.terrain.context.strokeRect).not.toHaveBeenCalled();
  r.step(20);
  expect(r.terrain.context.strokeRect).toHaveBeenCalled();
  expect(r.laterState).toBeNull();
  expect(r.scene.tank1.y).toBe(349);
  expect(r.terrain.context.strokeStyle).toBe("rgb(230,0,230)");
  expect(r.terrain.context.arc).toHaveBeenCalledWith(720, expect.any(Number), 31, 0, Math.PI * 2);
  expect(r.carve).not.toHaveBeenCalled();
});

test("Neutron Beam aims at the foe regardless of the manual turret angle", () => {
  const r = fixture("neutron-beam");
  r.weapon.turret.rotation = -Math.PI / 2;
  shootLaterEffect(r);
  const [origin, angle, pierce] = r.beam.mock.calls[0];
  expect(origin.x).toBeGreaterThan(300);
  expect(Math.abs(angle)).toBeLessThan(0.05);
  expect(pierce).toBe(true);
});

test("Fix-it Foam fills to the crater rim with reflective material and lifts its owner", () => {
  const r = fixture("fix-it-foam");
  r.scene.tank1.y = 440;
  r.ground = (x) =>
    Math.abs(x - 300) < 90
      ? Math.ceil(350 + Math.sqrt(90 ** 2 - (x - 300) ** 2))
      : 350;
  shootLaterEffect(r);
  expect(r.scene.tank1.y).toBe(349);
  expect(r.terrain.context.fillStyle).toBe("rgb(230,0,230)");
  expect(
    r.terrain.context.fillRect.mock.calls.some(
      ([, y, , height]) => y === 350 && height > 80,
    ),
  ).toBe(true);
});

test("Crash Dive descends through earth while firing artillery and holds the turn until safe", () => {
  const r = fixture("crash-dive");
  shootLaterEffect(r);
  r.step(20);
  expect(r.scene.tank1.y).toBeGreaterThan(349);
  expect(r.projectiles.length).toBeGreaterThan(0);
  expect(r.events.length).toBeGreaterThan(0);
  r.step(60);
  expect(r.laterState).toBeNull();
  expect(r.scene.tank1.y).toBe(439);
});

test("Upheaval fires its aimed beam after rising and stays alive until landing", () => {
  const r = fixture("upheaval");
  shootLaterEffect(r);
  r.step(20);
  expect(r.ray).not.toHaveBeenCalled();
  r.step(50);
  expect(r.ray).toHaveBeenCalledTimes(1);
  expect(r.scene.tank1.y).toBeLessThan(349);
  expect(r.events.length).toBeGreaterThan(0);
  r.step(100);
  expect(r.laterState).toBeNull();
  expect(r.scene.tank1.y).toBe(349);
});

test("Matter Blaster converts earth into an outgoing bomb with terrain-dependent energy", () => {
  const full = fixture("matter-blaster", true),
    empty = fixture("matter-blaster", false);
  for (const r of [full, empty]) {
    shootLaterEffect(r);
    expect(r.burst).not.toHaveBeenCalled();
    impactLaterEffect(r, r.projectiles[0]);
  }
  expect(full.burst.mock.calls[0][2]).toBeGreaterThan(
    empty.burst.mock.calls[0][2],
  );
  expect(full.burst.mock.calls[0][3]).toBeGreaterThan(
    empty.burst.mock.calls[0][3],
  );
  expect(full.scene.tank1.y).toBe(349);
});

test("Stomper owns its destruction path until landing and cleanup releases its hold", () => {
  const r = fixture("stomper");
  shootLaterEffect(r);
  r.step(20);
  expect(r.carve.mock.calls.length).toBeGreaterThan(10);
  expect(r.laterState).not.toBeNull();
  expect(r.scene.tank1.x).toBeGreaterThan(300);
  disposeLaterEffect(r);
  expect(r.laterState).toBeNull();
  expect(r.events).toHaveLength(0);
});

test("Rebound Lasers pass a bounded reflection count to each real ray", () => {
  const r = fixture("rebound-lasers");
  impactLaterEffect(r, projectile());
  r.step(40);
  expect(r.ray).toHaveBeenCalledTimes(7);
  expect(r.ray.mock.calls.every((args) => args[6] === 4)).toBe(true);
});

test("Breakout and Bunker retain their tank actors until tunnel travel completes", () => {
  const escape = fixture("breakout");
  shootLaterEffect(escape);
  escape.step(40);
  expect(escape.carve.mock.calls.length).toBeGreaterThan(20);
  expect(escape.scene.tank1.x).toBeGreaterThan(400);
  const bunker = fixture("bunker");
  shootLaterEffect(bunker);
  expect(bunker.terrain.context.strokeStyle).toBe("rgb(230,0,230)");
  bunker.step(60);
  expect(bunker.scene.tank1.y).toBeGreaterThan(400);
  expect(bunker.laterState).toBeNull();
  expect(bunker.projectiles).toHaveLength(0);
});

test("Cavern connects the actual heights of both tanks instead of spanning the world", () => {
  const r = fixture("cavern");
  r.scene.tank2.y = 240;
  shootLaterEffect(r);
  const calls = r.carve.mock.calls;
  expect(calls[0].slice(0, 2)).toEqual([300, 361]);
  expect(calls.at(-1)[0]).toBe(720);
  expect(calls.at(-1)[1]).toBeCloseTo(252);
  expect(calls.every(([x]) => x >= 300 && x <= 720)).toBe(true);
});

test("Jump Rope has two firing streams and Six Shooter resolves exactly on second contact", () => {
  const rope = fixture("jump-rope");
  shootLaterEffect(rope);
  rope.step(120);
  expect(rope.projectiles).toHaveLength(16);
  expect(rope.projectiles[0].vy).not.toBe(rope.projectiles[1].vy);
  const six = fixture("six-shooter");
  shootLaterEffect(six);
  six.step(60);
  const p = six.projectiles[0];
  impactLaterEffect(six, p);
  expect(six.burst).not.toHaveBeenCalled();
  impactLaterEffect(six, six.projectiles.at(-1));
  expect(six.burst).toHaveBeenCalledTimes(1);
});

test("Mirror Ball keeps a bouncing carrier rather than resolving to one static burst", () => {
  const r = fixture("mirror-ball");
  let p = projectile();
  for (let i = 0; i < 4; i++) {
    impactLaterEffect(r, p);
    p = r.projectiles.at(-1);
    expect(p.removed).not.toBe(true);
  }
  impactLaterEffect(r, p);
  expect(p.removed).toBe(true);
  expect(r.ray.mock.calls.length).toBeGreaterThan(6);
});

test("Gravity Grenade creates solid rubble and relocates nearby armor into its sphere", () => {
  const r = fixture("gravity-grenade");
  impactLaterEffect(r, projectile());
  expect(r.scene.tank2.y).toBeLessThan(320);
  expect(r.scene.tank1.x).toBe(300);
  expect(r.terrain.context.fillRect).not.toHaveBeenCalled();
  expect(r.terrain.update).toHaveBeenCalled();
  expect(r.burst).not.toHaveBeenCalled();
});

test("Retreat chooses the far side independently of turret aim and Super Retreat also attacks", () => {
  const r = fixture("retreat");
  r.weapon.turret.rotation = Math.PI / 2;
  shootLaterEffect(r);
  r.step(90);
  expect(r.scene.tank1.x).toBe(22);
  expect(r.scene.tank1.y).toBe(349);
  expect(r.laterState).toBeNull();
  const superRetreat = fixture("super-retreat");
  shootLaterEffect(superRetreat);
  superRetreat.step(90);
  expect(superRetreat.terrain.context.strokeStyle).toBe("rgb(230,0,230)");
  expect(superRetreat.ray).toHaveBeenCalled();
});

test("Dash traverses ground surfaces while preserving a bounded weapon lifetime", () => {
  const r = fixture("dash");
  shootLaterEffect(r);
  r.step(50);
  expect(r.scene.tank1.x).toBeGreaterThan(450);
  expect(r.events.length).toBeGreaterThan(0);
  r.step(300);
  expect(r.laterState).toBeNull();
});

test("Coin Toss keeps blast geometry fixed and triples only golden damage", () => {
  const gold = fixture("coin-toss"),
    silver = fixture("coin-toss");
  silver.random = () => 0.75;
  impactLaterEffect(gold, projectile());
  impactLaterEffect(silver, projectile());
  expect(gold.burst.mock.calls[0][2]).toBe(silver.burst.mock.calls[0][2]);
  expect(gold.burst.mock.calls[0][3]).toBe(silver.burst.mock.calls[0][3] * 3);
});

test("Bumper Bowling uses impact speed for contact points and does not substitute an explosion", () => {
  const fast = fixture("bumper-bowling"),
    slow = fixture("bumper-bowling");
  for (const [r, speed] of [
    [fast, 600],
    [slow, 120],
  ]) {
    const p = projectile(710, 350);
    p.vx = speed;
    p.vy = 0;
    r.projectiles.push(p);
    impactLaterEffect(r, p);
    r.step(1);
  }
  expect(fast.scene.tank2.hits).toBeGreaterThan(slow.scene.tank2.hits);
  expect(fast.burst).not.toHaveBeenCalled();
});

test("Foundation builds only the bottom of the playfield", () => {
  const r = fixture("foundation");
  shootLaterEffect(r);
  expect(r.terrain.context.fillRect.mock.calls[0]).toEqual([0, 499, 1200, 34]);
  expect(r.scene.tank1.y).toBe(349);
});

test("Firefight provokes the opponent current aim without changing inventory or turn state", () => {
  const r = fixture("firefight");
  r.scene.tank2.turret.rotation = -Math.PI / 2;
  impactLaterEffect(r, projectile());
  const counter = r.projectiles[0];
  expect(counter.owner).toBe(r.scene.tank2);
  expect(counter.returnFire).toBe(true);
  expect(counter.vx).toBeLessThan(0);
  expect(r.weapon.tank).toBe(r.scene.tank1);
  impactLaterEffect(r, counter);
  expect(counter.removed).toBe(true);
  expect(r.weapon.tank).toBe(r.scene.tank1);
});

test("Bungee Punch sends a missed glove back toward its firing tank", () => {
  const r = fixture("bungee-punch");
  shootLaterEffect(r);
  const p = r.projectiles[0];
  Object.assign(p, { x: 800, y: 200, vx: 200, vy: 0, age: 20 });
  updateLaterEffect(r);
  expect(p.punchReturning).toBe(true);
  expect(p.vx).toBeLessThan(0);
  p.x = 300;
  p.y = 343;
  impactLaterEffect(r, p);
  expect(p.removed).toBe(true);
  expect(r.burst.mock.calls[0].slice(0, 2)).toEqual([300, 343]);
});

test("Bombardment approaches its marked point from all four sky entries", () => {
  const r = fixture("bombardment");
  impactLaterEffect(r, projectile());
  r.step(80);
  expect(r.projectiles).toHaveLength(8);
  expect(new Set(r.projectiles.map((p) => `${p.x}:${p.y}`)).size).toBe(4);
  expect(r.projectiles.some((p) => p.vx < 0)).toBe(true);
  expect(r.projectiles.some((p) => p.vx > 0)).toBe(true);
  expect(r.projectiles.every((p) => p.child && p.gravity === 0)).toBe(true);
});

test("Auto Turrets deploy beside their owner without an outgoing capsule", () => {
  const r = fixture("auto-turrets");
  expect(shootLaterEffect(r)).toBe(true);
  expect(deployWeaponDevice).toHaveBeenCalledWith(r.weapon, "autoturrets", {
    point: { x: 300, y: 349 },
    heading: 1,
  });
  expect(r.projectiles).toHaveLength(0);
});

// A small solid-mask terrain: real carving lowers the real ground sample.
function realTerrain(r, surface = 350) {
  const { width, height } = r.terrain,
    solid = new Uint8Array(width * height);
  for (let y = surface; y < height; y++) solid.fill(1, y * width, (y + 1) * width);
  const at = (x, y) => {
    x = Math.round(x);
    y = Math.round(y);
    return x >= 0 && x < width && y >= 0 && y < height && solid[y * width + x];
  };
  r.terrain.getPixel = (x, y) => ({ alpha: at(x, y) ? 255 : 0, red: 100, green: 110, blue: 90 });
  r.ground = (x) => {
    x = clamp(Math.round(x), 0, width - 1);
    for (let y = 0; y < height; y++) if (solid[y * width + x]) return y;
    return height - 1;
  };
  r.carve = jest.fn((cx, cy, radius) => {
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(height - 1, cy + radius); y++)
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(width - 1, cx + radius); x++)
        if (Math.hypot(x - cx, y - cy) <= radius) solid[y * width + x] = 0;
  });
  return r;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

test.each(["stomper", "breakout"])(
  "%s lands on real terrain instead of boring to the map bottom",
  (key) => {
    const r = realTerrain(fixture(key));
    // A steep launch drifts slowly sideways, the worst case for boring.
    r.scene.tank1.turret.rotation = 0.15;
    shootLaterEffect(r);
    let frames = 0,
      deepest = 0;
    while (r.laterState && frames < 400) {
      r.step(1);
      frames++;
      deepest = Math.max(deepest, r.scene.tank1.y);
    }
    expect(deepest).toBeLessThan(360);
    expect(r.laterState).toBeNull();
    expect(frames).toBeLessThan(200);
    const tank = r.scene.tank1;
    expect(tank.y).toBeGreaterThan(330);
    expect(tank.y).toBeLessThan(355);
    expect(tank.x).toBeGreaterThan(305);
    expect(tank.x).toBeLessThan(1170);
    expect(r.ground(tank.x)).toBeLessThan(360);
  },
);

test("an actor ended early is released to gravity instead of frozen mid-air", () => {
  const r = fixture("stomper");
  shootLaterEffect(r);
  r.step(10);
  disposeLaterEffect(r);
  const tank = r.scene.tank1;
  expect(tank.body.setGravityY).toHaveBeenLastCalledWith(300);
  expect(tank.settled).toBe(false);
});

test("Firefight countershots are credited to the shooter and never cost the shooter points", () => {
  const r = fixture("firefight");
  r.scene.tank2.turret.rotation = -Math.PI / 2;
  impactLaterEffect(r, projectile());
  const counter = r.projectiles[0];
  impactLaterEffect(r, { ...counter, x: 300, y: 343 });
  expect(r.scene.tank1.hits).toBeUndefined();
  impactLaterEffect(r, { ...counter, x: 720, y: 343, removed: false });
  expect(r.scene.tank2.hits).toBeGreaterThan(0);
  expect(r.weapon.tank).toBe(r.scene.tank1);
});

test("launches that the bounded queue cannot hold fire immediately rather than vanish", () => {
  const r = fixture("six-shooter");
  const schedule = r.schedule;
  r.schedule = (s, fn) => {
    if (r.events.length < 80) schedule(s, fn);
  };
  r.events = Array.from({ length: 80 }, () => ({ at: 1e9, fn() {} }));
  shootLaterEffect(r);
  expect(r.projectiles).toHaveLength(6);
});
