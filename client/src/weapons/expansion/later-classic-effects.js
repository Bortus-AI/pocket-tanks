import { deployWeaponDevice } from "./deployables";
import { enemyOf, scoreHit } from "./tactics";
import { emitTerrainBuild, emitWeaponImpact } from "../../graphics/weapon-fx";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const effect = (runtime) => runtime.definition.laterEffect;
const foeOf = (runtime) => enemyOf(runtime.scene, runtime.weapon.tank);
const remove = (projectile) => {
  projectile.removed = true;
  projectile.visual?.destroy();
};

function launch(
  runtime,
  angle = runtime.weapon.turret.rotation - Math.PI / 2,
  options = {},
) {
  const { turret, tank } = runtime.weapon,
    speed = options.speed ?? tank.power * 8;
  runtime.spawn(
    turret.x + Math.cos(angle) * 16,
    turret.y + Math.sin(angle) * 16,
    Math.cos(angle) * speed,
    Math.sin(angle) * speed,
    {
      gravity: 300,
      reflectBounds: [
        "time-bomb",
        "mirror-ball",
        "jump-rope",
        "six-shooter",
      ].includes(effect(runtime)),
      ...options,
    },
  );
  return runtime.projectiles.at(-1);
}

// A hold belongs to the weapon's bounded event queue, so its tank actor cannot
// hand control to the next turn while a jump, dive, or final attack is pending.
function hold(runtime, state) {
  const event = { at: runtime.tick + 900, fn: () => end(runtime) };
  state.hold = event;
  runtime.events.push(event);
  runtime.laterState = state;
  return state;
}

function end(runtime) {
  const state = runtime.laterState;
  if (!state) return;
  runtime.events = runtime.events.filter((event) => event !== state.hold);
  state.label?.destroy();
  if (state.tank) {
    // Release the actor to ordinary physics: early ends (side clamp, age or
    // hold timeout) may leave it airborne, and the settler must drop it.
    state.tank.body?.stop();
    state.tank.body?.setGravityY(300);
    state.tank.settled = false;
    if (Number.isFinite(state.initialRotation))
      state.tank.rotation = state.initialRotation;
  }
  runtime.laterState = null;
}

// The weapon event queue is bounded; never drop a launch or detonation.
function defer(runtime, delay, fn) {
  const before = runtime.events.length;
  runtime.schedule(delay, fn);
  if (runtime.events.length === before) fn();
}

function positionTank(tank, x, y) {
  tank.setPosition(x, y);
  tank.body.updateFromGameObject();
  tank.body.stop();
  tank.body.setGravityY(0);
  // Reset Arcade's frame delta after a kinematic position change; otherwise
  // its postUpdate adds the same movement to the sprite a second time.
  tank.body.preUpdate?.(false, 0);
  tank.settled = false;
  const rotation = tank.rotation || 0;
  tank.centre = {
    x: tank.body.x + (Math.sin(rotation) * tank.height) / 4,
    y: tank.body.y - (Math.cos(rotation) * tank.height) / 4,
  };
  tank.top = {
    x: tank.body.x + (Math.sin(rotation) * tank.height) / 2,
    y: tank.body.y - (Math.cos(rotation) * tank.height) / 2,
  };
}

function actor(runtime, kind, tank, vx, vy, extra = {}) {
  tank.body.stop();
  tank.body.setGravityY(0);
  tank.settled = false;
  return hold(runtime, {
    kind,
    tank,
    x: tank.x,
    y: tank.y,
    vx,
    vy,
    age: 0,
    initialRotation: tank.rotation || 0,
    ...extra,
  });
}

function laserAtFoe(runtime, tank, strength = 32, reflections = 0) {
  const foe = foeOf(runtime),
    angle = Math.atan2(
      foe.centre.y - tank.centre.y,
      foe.centre.x - tank.centre.x,
    );
  // Clear the firing tank's hull even when shooting down from a jump.
  const x = tank.centre.x + Math.cos(angle) * 22,
    y = tank.centre.y + Math.sin(angle) * 22;
  if (runtime.ray)
    runtime.ray(
      x,
      y,
      angle,
      runtime.terrain.width,
      false,
      strength,
      reflections,
    );
  else runtime.beam({ x, y }, angle, true);
}

function paint(runtime, draw, x, y, kind = "rubber") {
  const context = runtime.terrain.context;
  context.save();
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
  context.fillStyle = context.strokeStyle = "rgb(230,0,230)";
  draw(context);
  context.restore();
  runtime.terrain.update();
  emitTerrainBuild(runtime.scene, x, y, kind, runtime.fxOptions());
}

function boundaryWalls(runtime) {
  const { width, height } = runtime.terrain;
  paint(
    runtime,
    (ctx) => {
      ctx.fillRect(0, 14, 18, height - 14);
      ctx.fillRect(width - 18, 14, 18, height - 14);
    },
    width / 2,
    height / 2,
  );
}

function lockBox(runtime, tank, x, y) {
  const cx = tank ? tank.x : x,
    cy = tank ? tank.centre.y : y - 10;
  // Clear construction space without scheduling collapse through the new roof.
  const ctx = runtime.terrain.context;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 31, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  paint(
    runtime,
    (ctx) => {
      ctx.lineWidth = 7;
      ctx.strokeRect(cx - 28, cy - 24, 56, 48);
    },
    cx,
    cy,
  );
  if (tank) positionTank(tank, cx, cy + 18);
}

function foamFill(runtime) {
  const tank = runtime.weapon.tank,
    left = clamp(tank.x - 75, 1, runtime.terrain.width - 2),
    right = clamp(tank.x + 75, 1, runtime.terrain.width - 2);
  const lip = Math.min(
    ...[-150, -100, 100, 150].map((offset) =>
      runtime.ground(clamp(tank.x + offset, 1, runtime.terrain.width - 2)),
    ),
  );
  const top = Math.max(4, Math.min(lip, tank.y - 24));
  paint(
    runtime,
    (ctx) => {
      for (let x = left; x <= right; x += 2) {
        const bottom = runtime.ground(x);
        if (bottom >= top) ctx.fillRect(x, top, 2, bottom - top + 5);
      }
    },
    tank.x,
    top,
  );
  positionTank(tank, tank.x, top - 1);
  tank.settled = true;
}

function fuel(runtime, radius) {
  const tank = runtime.weapon.tank,
    terrain = runtime.terrain;
  const x = clamp(Math.floor(tank.x - radius), 0, terrain.width - 1),
    y = clamp(Math.floor(tank.y - radius), 0, terrain.height - 1),
    w = Math.min(radius * 2, terrain.width - x),
    h = Math.min(radius * 2, terrain.height - y);
  const bytes = terrain.context.getImageData(x, y, w, h).data;
  let solid = 0,
    samples = 0;
  for (let row = 0; row < h; row++)
    for (let column = 0; column < w; column++) {
      if ((x + column - tank.x) ** 2 + (y + row - tank.y) ** 2 > radius ** 2)
        continue;
      samples++;
      if (bytes[(row * w + column) * 4 + 3]) solid++;
    }
  return samples ? solid / samples : 0;
}

function rebound(runtime, projectile, damping = 0.75) {
  const slope = runtime.terrain.getSlope(
    Math.round(projectile.x),
    Math.round(projectile.y),
  );
  const incoming = Math.atan2(projectile.vy, projectile.vx);
  const angle =
    projectile.boundaryAxis === "x"
      ? Math.PI - incoming
      : projectile.boundaryAxis === "y"
        ? -incoming
        : Number.isFinite(slope)
          ? 2 * slope - incoming
          : -incoming;
  const speed = Math.max(
    80,
    Math.hypot(projectile.vx, projectile.vy) * damping,
  );
  remove(projectile);
  runtime.spawn(
    clamp(projectile.x + Math.cos(angle) * 7, 3, runtime.terrain.width - 3),
    clamp(projectile.y + Math.sin(angle) * 7, 1, runtime.terrain.height - 2),
    Math.cos(angle) * speed,
    projectile.boundaryAxis
      ? Math.sin(angle) * speed
      : -Math.max(55, Math.abs(Math.sin(angle) * speed)),
    {
      gravity: projectile.gravity ?? 300,
      reflectBounds: true,
      laterBounces: (projectile.laterBounces || 0) + 1,
      ruleFuseReady: projectile.ruleFuseReady,
      ruleBanked: projectile.ruleBanked,
      ruleBurrowed: projectile.ruleBurrowed,
    },
  );
}

function connectingTunnel(runtime) {
  const a = runtime.weapon.tank,
    b = foeOf(runtime),
    steps = Math.max(8, Math.ceil(Math.abs(b.x - a.x) / 10));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    runtime.carve(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t + 12 + Math.sin(t * Math.PI * 4) * 12,
      18,
    );
  }
}

function protectiveDome(runtime, tank) {
  paint(
    runtime,
    (ctx) => {
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(tank.x, tank.y - 10, 42, Math.PI, 0);
      ctx.stroke();
    },
    tank.x,
    tank.y - 10,
  );
}

function foundation(runtime) {
  const y = runtime.terrain.height - 34;
  paint(
    runtime,
    (ctx) => {
      ctx.fillStyle = "#77846d";
      ctx.fillRect(0, y, runtime.terrain.width, 34);
      ctx.fillStyle = "#53634e";
      for (let row = 0; row < 3; row++)
        for (let x = (row % 2) * 14; x < runtime.terrain.width; x += 28)
          ctx.fillRect(x, y + row * 11, 2, 11);
    },
    runtime.terrain.width / 2,
    y,
    "foundation",
  );
  [runtime.scene.tank1, runtime.scene.tank2]
    .filter((tank) => tank.y >= y)
    .forEach((tank) => {
      positionTank(tank, tank.x, y - 1);
      tank.settled = true;
    });
}

function compressedSphere(runtime, x, y) {
  const radius = 105,
    context = runtime.terrain.context;
  context.save();
  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
  const cy = clamp(y - 65, 55, runtime.terrain.height - 60),
    r = 48;
  paint(
    runtime,
    (ctx) => {
      ctx.fillStyle = "#687160";
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a3ad91";
      for (let i = 0; i < 24; i++) {
        const a = i * 2.399,
          rr = Math.sqrt(i / 24) * 40;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    x,
    cy,
    "rubble",
  );
  [runtime.scene.tank1, runtime.scene.tank2]
    .filter(
      (tank) => Math.hypot(tank.centre.x - x, tank.centre.y - y) < radius + 25,
    )
    .forEach((tank, index) => {
      positionTank(tank, x + (index ? 12 : -12), cy + 5);
      tank.settled = true;
    });
}

function returnPunch(runtime, projectile) {
  const tank = runtime.weapon.tank,
    dx = tank.centre.x - projectile.x,
    dy = tank.centre.y - projectile.y,
    mag = Math.max(1, Math.hypot(dx, dy));
  projectile.punchReturning = true;
  projectile.gravity = 0;
  projectile.vx = (dx / mag) * 260;
  projectile.vy = (dy / mag) * 260;
}

export function shootLaterEffect(runtime) {
  const key = effect(runtime),
    { tank, turret } = runtime.weapon,
    foe = foeOf(runtime);
  const direction = Math.sign(foe.x - tank.x) || runtime.direction || 1;
  if (key === "auto-turrets") {
    deployWeaponDevice(runtime.weapon, "autoturrets", {
      point: { x: tank.x, y: tank.y },
      heading: direction,
    });
    return true;
  }
  if (key === "bungee-punch") {
    launch(runtime);
    return true;
  }
  if (key === "neutron-beam") {
    const angle = Math.atan2(foe.centre.y - turret.y, foe.centre.x - turret.x);
    runtime.beam(
      {
        x: turret.x + Math.cos(angle) * 16,
        y: turret.y + Math.sin(angle) * 16,
      },
      angle,
      true,
    );
    return true;
  }
  if (key === "mirror-ball" || key === "bumper-bowling") {
    launch(runtime);
    return true;
  }
  if (key === "time-bomb") {
    const projectile = launch(runtime);
    const label = runtime.scene.add
      .text(projectile.x, projectile.y - 17, "10", {
        fontFamily: "Arial",
        fontSize: 16,
        fontStyle: "bold",
        color: "#fff1c6",
        stroke: "#172b33",
        strokeThickness: 3,
      })
      .setDepth(6);
    hold(runtime, { kind: key, projectile, label, fuseAt: runtime.tick + 600 });
    return true;
  }
  if (key === "backtrack" || key === "puddle-jumper") {
    launch(runtime);
    return true;
  }
  if (key === "leap-frog") {
    runtime.carve(tank.x, tank.y - 6, 22);
    actor(runtime, key, tank, direction * 150, -210, { hops: 0, fired: false });
    return true;
  }
  if (key === "fix-it-foam") {
    foamFill(runtime);
    return true;
  }
  if (key === "crash-dive") {
    actor(runtime, key, tank, direction * 95, 100, {
      targetY: Math.min(runtime.terrain.height - 18, tank.y + 90),
    });
    return true;
  }
  if (key === "upheaval") {
    runtime.carve(tank.x, tank.y - 12, 24);
    actor(runtime, key, tank, direction * 45, -310, { fired: false });
    return true;
  }
  if (key === "matter-blaster") {
    const energy = fuel(runtime, 75);
    runtime.carve(tank.x, tank.y - 6, 75);
    launch(runtime, undefined, {
      gravity: 180,
      speed: tank.power * 8 * (0.8 + energy * 0.6),
      laterEnergy: energy,
    });
    return true;
  }
  if (key === "stomper") {
    const angle = turret.rotation - Math.PI / 2;
    runtime.carve(tank.x, tank.y - 4, 22);
    actor(
      runtime,
      key,
      tank,
      Math.cos(angle) * 390,
      Math.min(-150, Math.sin(angle) * 390),
      { hit: false },
    );
    return true;
  }
  if (key === "breakout") {
    actor(
      runtime,
      key,
      tank,
      Math.sin(turret.rotation) * 300,
      -Math.max(0.35, Math.cos(turret.rotation)) * 300,
    );
    return true;
  }
  if (key === "bunker") {
    protectiveDome(runtime, tank);
    actor(runtime, key, tank, direction * 55, 90, {
      targetY: Math.min(runtime.terrain.height - 20, tank.y + 65),
    });
    return true;
  }
  if (key === "cavern") {
    connectingTunnel(runtime);
    return true;
  }
  if (key === "retreat" || key === "super-retreat") {
    const targetX = tank.x < foe.x ? 22 : runtime.terrain.width - 22;
    actor(runtime, key, tank, 0, 0, {
      startX: tank.x,
      startY: tank.y,
      targetX,
      targetY: runtime.ground(targetX) - 1,
    });
    return true;
  }
  if (key === "dash") {
    actor(runtime, key, tank, direction * 4, 0, {
      surface: { x: Math.round(tank.body.x), y: Math.round(tank.body.y) },
      hits: 0,
      lastHit: -30,
    });
    return true;
  }
  if (key === "foundation") {
    foundation(runtime);
    return true;
  }
  if (key === "jump-rope" || key === "six-shooter") {
    const shots = key === "six-shooter" ? 6 : 16;
    for (let i = 0; i < shots; i++)
      defer(runtime, i * 0.07, () =>
        launch(
          runtime,
          turret.rotation -
            Math.PI / 2 +
            (key === "jump-rope"
              ? (i % 2 ? 1 : -1) * (0.16 + Math.sin(i * 0.45) * 0.08)
              : 0),
        ),
      );
    return true;
  }
  return false;
}

export function impactLaterEffect(runtime, projectile) {
  const key = effect(runtime);
  if (!key || projectile.removed) return false;
  if (projectile.returnFire) {
    // Firefight design: the provoked countershot is the opponent's gun being
    // set off by your round, so it belongs to you. It craters terrain wherever
    // it lands but scores only against the provoked tank and never against
    // its owner, so firing Firefight can never be net negative.
    remove(projectile);
    const shooter = runtime.weapon.tank,
      provoked = projectile.owner || foeOf(runtime),
      r = 35,
      cx = clamp(projectile.x, 0, runtime.terrain.width - 1),
      cy = clamp(projectile.y, 0, runtime.terrain.height - 1);
    runtime.carve(cx, cy, r);
    emitWeaponImpact(runtime.scene, cx, cy, r, runtime.fxOptions());
    if (provoked !== shooter) {
      const d = provoked.isPointInside?.(cx, cy)
        ? 0
        : Math.hypot(provoked.centre.x - cx, provoked.centre.y - cy);
      const amount =
        Math.max(0, r + 12 - d) *
        0.7 *
        (runtime.definition.payload?.damage ?? 1);
      if (amount > 0) scoreHit(shooter, provoked, amount);
    }
    return true;
  }
  if (projectile.child) return false;
  const { x, y } = projectile;
  if (key === "time-bomb") {
    if (projectile.laterStuck) return true;
    const speed = Math.hypot(projectile.vx, projectile.vy);
    if (speed > 65 && (projectile.laterBounces || 0) < 7) {
      const slope = runtime.terrain.getSlope(Math.round(x), Math.round(y));
      const incoming = Math.atan2(projectile.vy, projectile.vx);
      const angle =
        projectile.boundaryAxis === "x"
          ? Math.PI - incoming
          : projectile.boundaryAxis === "y"
            ? -incoming
            : Number.isFinite(slope)
              ? 2 * slope - incoming
              : -incoming;
      projectile.vx = Math.cos(angle) * speed * 0.55;
      projectile.vy = projectile.boundaryAxis
        ? Math.sin(angle) * speed * 0.55
        : -Math.max(28, Math.abs(Math.sin(angle) * speed * 0.55));
      projectile.x = clamp(
        projectile.x + Math.cos(angle) * 7,
        3,
        runtime.terrain.width - 3,
      );
      projectile.y = clamp(
        projectile.y + Math.sin(angle) * 7,
        1,
        runtime.terrain.height - 2,
      );
      delete projectile.boundaryAxis;
      projectile.laterBounces = (projectile.laterBounces || 0) + 1;
    } else {
      projectile.vx = projectile.vy = projectile.gravity = 0;
      projectile.y -= 3;
      projectile.laterStuck = true;
    }
    return true;
  }
  if (key === "bumpers") {
    remove(projectile);
    boundaryWalls(runtime);
    return true;
  }
  if (key === "puddle-jumper") {
    const hops = projectile.laterHops || 0;
    runtime.burst(x, y, hops >= 3 ? 35 : 21, runtime.definition.strength * 0.7);
    if (hops >= 3) remove(projectile);
    else {
      projectile.laterHops = hops + 1;
      projectile.y = y - 9;
      projectile.vx = (runtime.direction || 1) * (170 - hops * 25);
      projectile.vy = -165 + hops * 20;
      projectile.gravity = 300;
    }
    return true;
  }
  if (key === "backtrack") {
    remove(projectile);
    runtime.burst(x, y);
    const tank = runtime.weapon.tank,
      direction = Math.sign(tank.x - foeOf(runtime).x) || -1;
    actor(runtime, key, tank, direction * 180, -165);
    return true;
  }
  if (key === "lock-box") {
    remove(projectile);
    const target = [runtime.scene.tank1, runtime.scene.tank2]
      .filter((tank) => Math.hypot(tank.centre.x - x, tank.centre.y - y) < 85)
      .sort(
        (a, b) =>
          Math.hypot(a.centre.x - x, a.centre.y - y) -
          Math.hypot(b.centre.x - x, b.centre.y - y),
      )[0];
    if (target) actor(runtime, key, target, 0, -185);
    else lockBox(runtime, null, x, y);
    return true;
  }
  if (key === "matter-blaster") {
    remove(projectile);
    const energy = projectile.laterEnergy || 0;
    runtime.burst(x, y, 28 + energy * 70, 0.25 + energy * 1.2);
    return true;
  }
  if (key === "rebound-lasers") {
    remove(projectile);
    const count = runtime.options.shots || 7;
    for (let i = 0; i < count; i++)
      defer(runtime, i * 0.06, () => {
        runtime.ray(
          x,
          y - 12,
          (i * Math.PI * 2) / count,
          runtime.options.range || 700,
          false,
          runtime.definition.strength * 24,
          runtime.options.bounces || 4,
        );
      });
    return true;
  }
  if (key === "jump-rope" || key === "six-shooter") {
    const limit = key === "six-shooter" ? 1 : 4;
    if ((projectile.laterBounces || 0) < limit) rebound(runtime, projectile);
    else {
      remove(projectile);
      runtime.burst(
        x,
        y,
        key === "six-shooter" ? 22 : 15,
        runtime.definition.strength,
      );
    }
    return true;
  }
  if (key === "mirror-ball") {
    laserAtFoe(runtime, { centre: { x, y } }, 18);
    if ((projectile.laterBounces || 0) < 4) rebound(runtime, projectile, 0.8);
    else {
      remove(projectile);
      for (let i = 0; i < 6; i++)
        runtime.ray(x, y - 10, (i * Math.PI) / 3, 220, false, 15);
    }
    return true;
  }
  if (key === "gravity-grenade") {
    remove(projectile);
    compressedSphere(runtime, x, y);
    return true;
  }
  if (key === "coin-toss") {
    remove(projectile);
    const golden = runtime.random() < 0.5;
    runtime.burst(
      x,
      y,
      runtime.definition.radius,
      runtime.definition.strength * (golden ? 3 : 1),
    );
    const label = runtime.scene.add
      .text(x, y - 18, golden ? "GOLD ×3" : "SILVER", {
        fontFamily: "Arial",
        fontSize: 16,
        color: golden ? "#ffd27a" : "#c7d2d9",
      })
      .setDepth(6);
    hold(runtime, { kind: "coin-result", label, expires: runtime.tick + 45 });
    return true;
  }
  if (key === "bumper-bowling") {
    if (runtime.laterState?.kind === "bowling") return true;
    const speed = clamp(Math.hypot(projectile.vx, projectile.vy), 100, 650),
      sign = Math.sign(projectile.vx) || 1;
    projectile.vx = projectile.vy = projectile.gravity = 0;
    projectile.y = runtime.ground(x) - 7;
    hold(runtime, {
      kind: "bowling",
      projectile,
      speed: sign * speed,
      age: 0,
      lastHit: -30,
    });
    return true;
  }
  if (key === "firefight") {
    remove(projectile);
    runtime.burst(x, y);
    const foe = foeOf(runtime);
    if (Math.hypot(foe.centre.x - x, foe.centre.y - y) < 180) {
      const angle = foe.turret.rotation - Math.PI / 2;
      runtime.spawn(
        foe.turret.x + Math.cos(angle) * 18,
        foe.turret.y + Math.sin(angle) * 18,
        Math.cos(angle) * foe.power * 8,
        Math.sin(angle) * foe.power * 8,
        { gravity: 300, child: true, owner: foe, returnFire: true },
      );
    }
    return true;
  }
  if (key === "bungee-punch") {
    if (
      !projectile.punchReturning &&
      Math.hypot(foeOf(runtime).centre.x - x, foeOf(runtime).centre.y - y) >
        (runtime.definition.options?.range || 65)
    ) {
      projectile.y = Math.min(projectile.y, runtime.ground(projectile.x) - 10);
      returnPunch(runtime, projectile);
    } else {
      remove(projectile);
      runtime.burst(x, y);
    }
    return true;
  }
  if (key === "bombardment") {
    remove(projectile);
    const count =
      runtime.definition.options?.shots || runtime.definition.count || 8;
    for (let i = 0; i < count; i++)
      defer(runtime, i * 0.09, () => {
        const sx = i % 2 ? runtime.terrain.width - 4 : 3,
          sy = i % 4 < 2 ? -6 : Math.max(16, y * 0.35),
          dx = x - sx,
          dy = y - sy,
          mag = Math.max(1, Math.hypot(dx, dy));
        runtime.spawn(sx, sy, (dx / mag) * 330, (dy / mag) * 330, {
          gravity: 0,
          child: true,
          childRadius: runtime.definition.radius,
          childStrength: runtime.definition.strength,
        });
      });
    return true;
  }
  return false;
}

export function updateLaterEffect(runtime) {
  if (effect(runtime) === "bungee-punch")
    for (const p of runtime.projectiles) {
      if (p.removed || p.child) continue;
      const foe = foeOf(runtime),
        direction = Math.sign(p.vx) || runtime.direction || 1;
      if (p.punchReturning) returnPunch(runtime, p);
      else if (
        p.age > 12 &&
        (direction * (p.x - foe.centre.x) > 35 ||
          p.x + p.vx / 60 < 3 ||
          p.x + p.vx / 60 > runtime.terrain.width - 4 ||
          p.y + p.vy / 60 >= runtime.terrain.height - 3)
      )
        returnPunch(runtime, p);
    }
  const state = runtime.laterState;
  if (!state) return;
  if (state.kind === "coin-result") {
    if (runtime.tick >= state.expires) end(runtime);
    return;
  }
  if (state.kind === "bowling") {
    const p = state.projectile;
    state.age++;
    if (p.removed) {
      end(runtime);
      return;
    }
    p.x += state.speed / 60;
    p.y = runtime.ground(p.x) - 7;
    p.visual?.setPosition(p.x, p.y);
    state.speed *= 0.992;
    const foe = foeOf(runtime);
    if (
      state.age - state.lastHit > 20 &&
      Math.hypot(p.x - foe.centre.x, p.y - foe.centre.y) < 30
    ) {
      scoreHit(
        runtime.weapon.tank,
        foe,
        clamp(Math.abs(state.speed) * 0.18, 5, 90),
      );
      state.lastHit = state.age;
    }
    const ground = runtime.terrain.getPixel(p.x, runtime.ground(p.x));
    if (
      Math.abs(state.speed) < 25 ||
      state.age >= 240 ||
      p.x < 3 ||
      p.x >= runtime.terrain.width - 3 ||
      (ground.red === 135 && ground.green === 155 && ground.blue === 82)
    ) {
      remove(p);
      end(runtime);
    }
    return;
  }
  if (state.kind === "retreat" || state.kind === "super-retreat") {
    state.age++;
    const t = Math.min(1, state.age / 90);
    state.x = state.startX + (state.targetX - state.startX) * t;
    state.y =
      state.startY +
      (state.targetY - state.startY) * t -
      Math.sin(t * Math.PI) * 125;
    if (runtime.terrain.getPixel(state.x, state.y - 6).alpha)
      runtime.carve(state.x, state.y - 6, 20);
    positionTank(state.tank, state.x, state.y);
    if (t === 1) {
      if (state.kind === "super-retreat") {
        laserAtFoe(runtime, state.tank, 30);
        protectiveDome(runtime, state.tank);
      }
      end(runtime);
    }
    return;
  }
  if (state.kind === "dash") {
    state.age++;
    const direction = Math.sign(state.vx) || 1;
    for (let i = 0; i < 4; i++) {
      const next = (
        direction > 0
          ? runtime.terrain.getRightGround
          : runtime.terrain.getLeftGround
      )(state.surface.x, state.surface.y);
      if (next) state.surface = next;
      else
        state.surface = {
          x: clamp(state.surface.x + direction, 2, runtime.terrain.width - 3),
          y: runtime.ground(state.surface.x + direction),
        };
    }
    state.x = state.surface.x;
    state.y = state.surface.y - 1;
    state.tank.rotation =
      runtime.terrain.getSlope(state.surface.x, state.surface.y) || 0;
    positionTank(state.tank, state.x, state.y);
    const foe = foeOf(runtime);
    if (
      state.age - state.lastHit >= 24 &&
      Math.hypot(foe.centre.x - state.x, foe.centre.y - state.y) < 36
    ) {
      scoreHit(runtime.weapon.tank, foe, 32);
      state.hits++;
      state.lastHit = state.age;
      foe.body.setVelocity?.(direction * 130, -80);
      foe.body.setGravityY(300);
      foe.settled = false;
    }
    if (
      state.age >= 240 ||
      state.x <= 3 ||
      state.x >= runtime.terrain.width - 3
    )
      end(runtime);
    return;
  }
  if (state.kind === "time-bomb") {
    const projectile = state.projectile;
    if (projectile.removed) {
      end(runtime);
      return;
    }
    const remaining = state.fuseAt - runtime.tick;
    state.label?.setText(String(Math.max(1, Math.ceil(remaining / 60))));
    state.label?.setPosition(projectile.x, projectile.y - 18);
    if (remaining <= 0) {
      runtime.burst(
        projectile.x,
        projectile.y,
        runtime.definition.radius,
        runtime.definition.strength,
      );
      remove(projectile);
      end(runtime);
    }
    return;
  }
  state.age++;
  const previousVy = state.vy;
  const rising = state.vy < 0;
  state.vy += 300 / 60;
  state.x = clamp(state.x + state.vx / 60, 20, runtime.terrain.width - 20);
  state.y += state.vy / 60;
  if (state.kind === "crash-dive" || state.kind === "bunker") {
    runtime.carve(state.x, state.y - 6, 21);
    if (state.kind === "crash-dive" && state.age % 12 === 1) {
      const foe = foeOf(runtime),
        dx = foe.centre.x - state.x;
      runtime.spawn(state.x, state.y - 22, Math.sign(dx) * 230, -280, {
        gravity: 300,
        child: true,
        childRadius: 24,
      });
    }
    positionTank(state.tank, state.x, Math.min(state.y, state.targetY));
    if (state.y >= state.targetY) end(runtime);
    return;
  }
  // Sample the landing surface before this frame's excavation. Escape carving
  // below the hull only happens while rising; on the way down a carve that
  // reaches under the tank would keep lowering the ground and bore to the
  // bottom of the map instead of landing.
  const landing = runtime.ground(state.x) - 1;
  if (state.kind === "breakout" && rising)
    runtime.carve(state.x, state.y - 6, 24);
  if (state.kind === "upheaval" && state.vy < 0)
    runtime.carve(state.x, state.y - 10, 22);
  if (state.kind === "stomper") {
    state.tank.rotation = state.initialRotation + state.age * 0.18;
    // Descending, clear only the hull-height path ahead (never below it).
    if (rising) runtime.carve(state.x, state.y + 2, 22);
    else runtime.carve(state.x, state.y - 14, 12);
    const foe = foeOf(runtime);
    if (
      !state.hit &&
      Math.hypot(foe.centre.x - state.x, foe.centre.y - state.y) < 35
    ) {
      scoreHit(runtime.weapon.tank, foe, 45);
      emitWeaponImpact(
        runtime.scene,
        state.x,
        state.y,
        35,
        runtime.fxOptions(),
      );
      state.hit = true;
    }
  }
  state.y = clamp(state.y, 1, runtime.terrain.height - 2);
  positionTank(state.tank, state.x, state.y);
  if (previousVy < 0 && state.vy >= 0) {
    if (state.kind === "lock-box") {
      lockBox(runtime, state.tank, state.x, state.y);
      end(runtime);
      return;
    }
    if (state.kind === "upheaval") {
      laserAtFoe(runtime, state.tank, 70);
      state.fired = true;
    }
    if (state.kind === "leap-frog") {
      laserAtFoe(runtime, state.tank, 11);
      state.fired = true;
    }
  }
  const ground = landing;
  if (state.vy >= 0 && state.y >= ground) {
    positionTank(state.tank, state.x, ground);
    if (
      state.kind === "leap-frog" &&
      state.hops++ < 2 &&
      state.x > 22 &&
      state.x < runtime.terrain.width - 22
    ) {
      laserAtFoe(runtime, state.tank, 8);
      state.y = ground - 2;
      state.vy = -200;
      state.fired = false;
    } else end(runtime);
  }
  if (
    state.age >= 720 ||
    state.y >= runtime.terrain.height - 1 ||
    state.x <= 20 ||
    state.x >= runtime.terrain.width - 20
  )
    end(runtime);
}

export function disposeLaterEffect(runtime) {
  end(runtime);
}
