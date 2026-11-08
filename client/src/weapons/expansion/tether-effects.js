import { applyPayload, enemyOf, scoreHit } from './tactics';
import { createWeaponProjectile, emitWeaponImpact } from '../../graphics/weapon-fx';

const DT = 1 / 60;
const kinds = { 'Paddle Ball': 'paddle', 'Bungee Bomb': 'bungee', 'Danger Rope': 'rope' };
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const kindOf = (runtime) => runtime.definition.tetherEffect || kinds[runtime.definition.name];
const centre = (tank) => tank.centre || { x: tank.x, y: tank.y - 6 };
const solid = (runtime, x, y) =>
    x >= 0 &&
    y >= 0 &&
    x < runtime.terrain.width &&
    y < runtime.terrain.height &&
    runtime.terrain.getPixel(x, y).alpha > 0;

function positionTank(tank, x, y, rotation = tank.rotation || 0) {
    tank.setPosition(x, y);
    tank.rotation = rotation;
    tank.body?.updateFromGameObject();
    tank.body?.stop();
    tank.body?.setGravityY(0);
    tank.body?.preUpdate?.(false, 0);
    const bx = tank.body?.x ?? x,
        by = tank.body?.y ?? y,
        h = tank.height || 24;
    tank.centre = { x: bx + (Math.sin(rotation) * h) / 4, y: by - (Math.cos(rotation) * h) / 4 };
    tank.top = { x: bx + (Math.sin(rotation) * h) / 2, y: by - (Math.cos(rotation) * h) / 2 };
    tank.settled = false;
}

function ballVisual(runtime, x, y, kind, existing) {
    const owned =
        existing ||
        createWeaponProjectile(
            runtime.scene,
            x,
            y,
            runtime.fxOptions({ phase: `${kind}-weight`, color: kind === 'paddle' ? 0xe42b3d : 0xa9bdc7 }),
        );
    // The physical toy ball is visibly red; its weapon-owned atlas still supplies
    // the individual projectile/trail identity around the weighted actor.
    const sphere =
        kind === 'paddle'
            ? runtime.scene.add.circle(x, y, 9, 0xd82c3e).setStrokeStyle(1, 0x6b1522).setDepth(5)
            : null;
    const glint =
        kind === 'paddle' ? runtime.scene.add.circle(x - 3, y - 3, 2.5, 0xffc8cd, 0.85).setDepth(6) : null;
    return {
        x,
        y,
        setPosition(nx, ny) {
            this.x = nx;
            this.y = ny;
            owned.setPosition(nx, ny);
            sphere?.setPosition(nx, ny);
            glint?.setPosition(nx - 3, ny - 3);
            return this;
        },
        setVisible(value) {
            owned.setVisible?.(value);
            sphere?.setVisible(value);
            glint?.setVisible(value);
            return this;
        },
        destroy() {
            owned.destroy();
            sphere?.destroy();
            glint?.destroy();
        },
    };
}

function hold(runtime, state, life) {
    state.life = life;
    state.age = 0;
    state.damage = 0;
    state.collisions = 0;
    state.lastCollision = -100;
    state.hold = { at: runtime.tick + life + 4, fn: () => end(runtime) };
    runtime.events.push(state.hold);
    runtime.tetherState = state;
    state.rope = runtime.scene.add.graphics().setDepth(4);
    return state;
}

function end(runtime) {
    const state = runtime.tetherState;
    if (!state) return;
    runtime.events = runtime.events.filter((event) => event !== state.hold);
    state.rope?.destroy();
    state.visual?.destroy();
    if (state.tank) {
        state.tank.rotation = state.initialRotation;
        state.tank.body?.stop();
        state.tank.body?.setGravityY(300);
        state.tank.settled = false;
    }
    runtime.lastTetherResult = {
        kind: state.kind,
        age: state.age,
        damage: state.damage,
        collisions: state.collisions,
        attached: !!state.tank,
    };
    runtime.tetherState = null;
}

function tetherTarget(runtime, projectile) {
    const target = enemyOf(runtime.scene, runtime.weapon.tank),
        p = centre(target);
    const reach = clamp(runtime.options?.range || runtime.definition.options?.range || 120, 24, 160);
    if (target.isPointInside(projectile.x, projectile.y)) return target;
    if (Math.hypot(projectile.x - p.x, projectile.y - p.y) > reach) return null;
    // Rope cannot acquire a tank hidden behind intervening dirt. The initial
    // contact point is lifted clear of the surface the projectile just struck.
    const from = { x: projectile.x, y: projectile.y - 10 },
        dx = p.x - from.x,
        dy = p.y - from.y,
        length = Math.hypot(dx, dy);
    for (let distance = 4; distance < length - 12; distance += 4)
        if (solid(runtime, from.x + (dx * distance) / length, from.y + (dy * distance) / length)) return null;
    return target;
}

function attach(runtime, state, tank) {
    state.tank = tank;
    state.initialRotation = tank.rotation || 0;
    state.targetX = tank.x;
    state.targetY = tank.y;
    state.targetVx = 0;
    state.targetVy = 0;
    state.age = 0;
    state.life = state.kind === 'bungee' ? 270 : 210;
    state.hold.at = runtime.tick + state.life + 4;
    const anchor = centre(tank);
    if (state.kind === 'paddle') {
        const dx = anchor.x - state.x,
            dy = anchor.y - state.y,
            distance = Math.max(1, Math.hypot(dx, dy));
        state.rest = clamp(distance * 0.6, 26, 65);
        state.vx = (dx / distance) * 210;
        state.vy = (dy / distance) * 210 - 90;
    } else if (state.kind === 'bungee') {
        state.pivot = {
            x: clamp((state.x + tank.x) / 2, 30, runtime.terrain.width - 30),
            y: tank.y - 90,
        };
        state.radius = clamp(Math.hypot(tank.x - state.pivot.x, tank.y - state.pivot.y), 75, 125);
        state.angle = Math.atan2(tank.x - state.pivot.x, tank.y - state.pivot.y);
        state.direction = Math.sign(state.vx || runtime.direction || 1);
        state.visual.setPosition(state.pivot.x, state.pivot.y);
    }
    tank.body?.stop();
    tank.body?.setGravityY(0);
    tank.settled = false;
    runtime.lastDeliveryPoint = { ...anchor };
    applyPayload(runtime.weapon, anchor.x, anchor.y, 18);
    emitWeaponImpact(
        runtime.scene,
        anchor.x,
        anchor.y,
        16,
        runtime.fxOptions({ phase: `${state.kind}-attach` }),
    );
}

function hit(runtime, state, amount, x, y) {
    state.damage += scoreHit(runtime.weapon.tank, state.tank, amount);
    state.collisions++;
    runtime.lastDeliveryPoint = { ...centre(state.tank) };
    emitWeaponImpact(
        runtime.scene,
        x,
        y,
        14,
        runtime.fxOptions({
            phase: `${state.kind}-contact`,
            color: state.kind === 'paddle' ? 0xef3448 : 0xbcd8ff,
        }),
    );
}

function drawRope(runtime, state, from, to) {
    const graphics = state.rope;
    graphics.clear();
    graphics.lineStyle(
        state.kind === 'rope' ? 2.5 : 1.5,
        state.kind === 'paddle' ? 0xf2b4ad : state.kind === 'rope' ? 0xb4d8ff : 0x9db5c9,
        0.9,
    );
    graphics.beginPath();
    graphics.moveTo(from.x, from.y);
    const count = state.kind === 'rope' ? 12 : 8;
    for (let index = 1; index <= count; index++) {
        const t = index / count,
            wave =
                state.kind === 'rope'
                    ? Math.sin(state.age * 0.8 + index * 1.9) * 3
                    : Math.sin(t * Math.PI) * 4;
        graphics.lineTo(
            from.x + (to.x - from.x) * t,
            from.y + (to.y - from.y) * t + (index === count ? 0 : wave),
        );
    }
    graphics.strokePath();
}

export function shootTetherEffect(runtime) {
    const kind = kindOf(runtime);
    if (!kind) return false;
    const { tank, turret } = runtime.weapon,
        angle = turret.rotation - Math.PI / 2,
        speed = tank.power * 8;
    runtime.direction = Math.sign(Math.cos(angle)) || 1;
    const x = turret.x + 16 * Math.cos(angle),
        y = turret.y + 16 * Math.sin(angle);
    runtime.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, {
        gravity: 300,
        tetherPrimary: true,
    });
    if (kind === 'paddle') {
        const p = runtime.projectiles.at(-1);
        if (p) p.visual = ballVisual(runtime, p.x, p.y, kind, p.visual);
    }
    return true;
}

export function impactTetherEffect(runtime, projectile) {
    const kind = kindOf(runtime);
    if (!kind || projectile.child || projectile.removed) return false;
    const target = tetherTarget(runtime, projectile);
    projectile.removed = true;
    projectile.visual?.destroy();
    if (!target && kind !== 'paddle') {
        emitWeaponImpact(
            runtime.scene,
            projectile.x,
            projectile.y,
            10,
            runtime.fxOptions({ phase: 'tether-miss' }),
        );
        return true;
    }
    if (runtime.tetherState) end(runtime);
    const state = hold(
        runtime,
        {
            kind,
            x: projectile.x,
            y: projectile.y - 12,
            vx: projectile.vx * 0.65,
            vy: -Math.max(80, Math.abs(projectile.vy) * 0.65),
            visual: ballVisual(runtime, projectile.x, projectile.y - 12, kind),
        },
        90,
    );
    if (target) attach(runtime, state, target);
    return true;
}

function paddle(runtime, state) {
    const target = state.tank,
        anchor = target ? centre(target) : null;
    if (anchor) {
        const dx = state.x - anchor.x,
            dy = state.y - anchor.y,
            distance = Math.max(1, Math.hypot(dx, dy)),
            stretch = Math.max(0, distance - state.rest),
            force = stretch * 13;
        state.vx -= (dx / distance) * force * DT;
        state.vy -= (dy / distance) * force * DT;
        if (stretch > 0) {
            state.targetVx = (state.targetVx + (dx / distance) * force * 0.1 * DT) * 0.88;
            state.targetX = clamp(state.targetX + state.targetVx * DT, 20, runtime.terrain.width - 20);
            positionTank(target, state.targetX, state.targetY);
        }
    }
    state.vy += 300 * DT;
    state.vx *= 0.996;
    const nx = state.x + state.vx * DT,
        ny = state.y + state.vy * DT;
    const blocked =
        solid(runtime, nx, ny) ||
        solid(runtime, nx + Math.sign(state.vx) * 8, ny) ||
        (state.vy > 0 && solid(runtime, nx, ny + 8));
    if (blocked) {
        const floor = runtime.ground(nx);
        if (state.vy > 0 && floor >= state.y - 10) {
            state.x = nx;
            state.y = floor - 10;
            state.vy = -Math.max(75, Math.abs(state.vy) * 0.78);
            state.vx *= 0.93;
        } else {
            state.vx *= -0.82;
            state.vy *= 0.9;
        }
    } else {
        state.x = nx;
        state.y = ny;
    }
    if (state.x < 10 || state.x > runtime.terrain.width - 10) {
        state.x = clamp(state.x, 10, runtime.terrain.width - 10);
        state.vx *= -0.8;
    }
    if (state.y < 8) {
        state.y = 8;
        state.vy = Math.abs(state.vy);
    }
    if (!target) {
        const foe = enemyOf(runtime.scene, runtime.weapon.tank);
        if (Math.hypot(state.x - centre(foe).x, state.y - centre(foe).y) < 65) {
            const candidate = tetherTarget(runtime, state);
            if (candidate) attach(runtime, state, candidate);
        }
    } else {
        const point = centre(target),
            dx = state.x - point.x,
            dy = state.y - point.y,
            distance = Math.max(1, Math.hypot(dx, dy));
        if (distance < 18 && state.age - state.lastCollision >= 18) {
            state.lastCollision = state.age;
            hit(
                runtime,
                state,
                8 + Math.min(6, Math.floor(Math.hypot(state.vx, state.vy) / 80)),
                point.x,
                point.y,
            );
            state.vx = (dx / distance) * 175;
            state.vy = -Math.max(145, Math.abs(state.vy));
            state.targetX = clamp(state.targetX - Math.sign(dx || 1) * 4, 20, runtime.terrain.width - 20);
            positionTank(target, state.targetX, state.targetY);
        }
        drawRope(runtime, state, centre(target), state);
    }
    state.visual.setPosition(state.x, state.y);
}

function bungee(runtime, state) {
    const angle = state.angle + state.direction * state.age * 0.075;
    const radius = state.radius + 12 * Math.min(1, state.age / 25);
    const desired = {
        x: clamp(state.pivot.x + Math.sin(angle) * radius, 22, runtime.terrain.width - 22),
        y: clamp(state.pivot.y + Math.cos(angle) * radius, 18, runtime.terrain.height - 10),
    };
    const contact = solid(runtime, desired.x, desired.y) || solid(runtime, desired.x, desired.y - 10);
    if (contact && state.age - state.lastCollision >= 20) {
        state.lastCollision = state.age;
        hit(runtime, state, 16, desired.x, desired.y);
        runtime.carve(desired.x, desired.y + 4, 22);
        state.pivot.y = Math.min(state.pivot.y + 12, runtime.terrain.height - state.radius - 15);
    }
    if (!contact || state.age === state.lastCollision) {
        state.targetX = desired.x;
        state.targetY = desired.y;
    }
    positionTank(state.tank, state.targetX, state.targetY, state.initialRotation + Math.sin(angle) * 0.55);
    state.visual.setPosition(state.pivot.x, state.pivot.y);
    drawRope(runtime, state, state.pivot, centre(state.tank));
}

function rope(runtime, state) {
    const owner = runtime.weapon.tank,
        dx = owner.x - state.targetX,
        gap = Math.abs(dx);
    const force = gap > 68 ? Math.sign(dx) * Math.min(520, (gap - 68) * 4) : 0;
    state.targetVx = clamp((state.targetVx + force * DT) * 0.985, -220, 220);
    state.targetVy = clamp(state.targetVy + 300 * DT, -160, 260);
    if (gap < 70) state.targetVx *= 0.75;
    let x = clamp(state.targetX + state.targetVx * DT, 20, runtime.terrain.width - 20),
        y = state.targetY + state.targetVy * DT;
    if (solid(runtime, x, y)) {
        const ground = runtime.ground(x);
        if (ground >= state.targetY - 12) {
            y = ground - 1;
            state.targetVy = -Math.max(45, Math.abs(state.targetVy) * 0.3);
        } else {
            runtime.carve(x, y - 5, 12);
            state.targetVx *= 0.7;
        }
        if (state.age - state.lastCollision >= 20) {
            state.lastCollision = state.age;
            hit(runtime, state, 3, x, y);
        }
    }
    state.targetX = x;
    state.targetY = clamp(y, 12, runtime.terrain.height - 5);
    positionTank(state.tank, state.targetX, state.targetY);
    if (state.age % 24 === 0) hit(runtime, state, 3, state.tank.centre.x, state.tank.centre.y);
    const from = centre(owner),
        to = centre(state.tank);
    state.visual.setPosition(to.x, to.y);
    drawRope(runtime, state, from, to);
}

export function updateTetherEffect(runtime) {
    const state = runtime.tetherState;
    if (!state) return;
    state.age++;
    if (state.kind === 'paddle') paddle(runtime, state);
    else if (state.kind === 'bungee') bungee(runtime, state);
    else rope(runtime, state);
    if (state.age >= state.life) end(runtime);
}

export function disposeTetherEffect(runtime) {
    end(runtime);
}
