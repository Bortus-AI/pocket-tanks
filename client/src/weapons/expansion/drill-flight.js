const PENETRATION = 150;
const empty = () => ({digging: false, impact: false});

const inTerrain = (terrain, x, y) => x >= 0 && y >= 0 && x < terrain.width && y < terrain.height;
const solid = (terrain, x, y) => inTerrain(terrain, x, y) && terrain.getPixel(x, y).alpha > 0;

function snapshot(terrain) {
    const size = terrain.width * terrain.height;
    const rgba = terrain.data?.length === size * 4
        ? terrain.data : terrain.context.getImageData(0, 0, terrain.width, terrain.height).data;
    const alpha = new Uint8Array(size);
    for (let index = 0; index < size; index++) alpha[index] = rgba[index * 4 + 3];
    return {alpha, width: terrain.width, height: terrain.height};
}

function originalSolid(mask, x, y) {
    const column = Math.round(x), row = Math.round(y);
    return column >= 0 && row >= 0 && column < mask.width && row < mask.height
        && mask.alpha[row * mask.width + column] > 0;
}

// Pixel centers are integers in CanvasTexture.getPixel. Splitting at their
// half-integer boundaries measures the length inside each original solid cell,
// including thin walls and diagonal paths, independently of frame/substep size.
function intervals(from, to, end) {
    const cuts = [0, end];
    for (const key of ['x', 'y']) {
        const delta = to[key] - from[key];
        if (!delta) continue;
        const last = from[key] + delta * end;
        const lo = Math.min(from[key], last), hi = Math.max(from[key], last);
        for (let boundary = Math.floor(lo + .5) + .5; boundary < hi; boundary++) {
            const t = (boundary - from[key]) / delta;
            if (t > 0 && t < end) cuts.push(t);
        }
    }
    cuts.sort((a, b) => a - b);
    return cuts;
}

/**
 * Advance one primary drill substep before generic out-of-bounds/solid handling.
 * `digging` means ordinary terrain collision should be skipped; tank collision
 * must still resolve. `impact` means resolve now, at projectile.x/projectile.y.
 * The caller retains ownership of impact effects, gravity and visual updates.
 */
export function advanceDrill(runtime, projectile, from, to) {
    const terrain = runtime.terrain;
    if (projectile.child || ![from.x, from.y, to.x, to.y].every(Number.isFinite)) return empty();
    const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
    let side = Infinity, basement = Infinity;
    if (dx < 0 && to.x < 1) side = (1 - from.x) / dx;
    if (dx > 0 && to.x >= terrain.width - 1) side = (terrain.width - 1 - from.x) / dx;
    if (dy > 0 && to.y >= terrain.height - 1) basement = (terrain.height - 1 - from.y) / dy;
    const end = Math.max(0, Math.min(1, side, basement));
    const cuts = intervals(from, to, end);
    if (!projectile.drillTerrain && solid(terrain, from.x, from.y)) projectile.drillTerrain = snapshot(terrain);
    let impactAt = null, excavation = null;
    for (let index = 1; index < cuts.length; index++) {
        const start = cuts[index - 1], stop = cuts[index];
        if (stop <= start) continue;
        const middle = (start + stop) / 2, x = from.x + dx * middle, y = from.y + dy * middle;
        if (solid(terrain, x, y)) {
            if (!projectile.drillTerrain) projectile.drillTerrain = snapshot(terrain);
            excavation = {x, y};
        }
        if (!projectile.drillTerrain || !originalSolid(projectile.drillTerrain, x, y)) continue;
        const remaining = Math.max(0, PENETRATION - (projectile.drilled || 0));
        const distance = length * (stop - start);
        if (distance >= remaining) {
            projectile.drilled = PENETRATION;
            impactAt = start + (length ? remaining / length : 0);
            break;
        }
        projectile.drilled = (projectile.drilled || 0) + distance;
    }
    const digging = !!projectile.drillTerrain;
    if (!digging) return empty();
    if (impactAt === null && basement <= 1 && basement <= side && basement >= 0) impactAt = basement;
    // A digging drill that reaches a side wall detonates at the edge instead of vanishing.
    if (impactAt === null && side <= 1 && side < basement && side >= 0) impactAt = side;
    if (impactAt !== null) {
        projectile.x = from.x + dx * impactAt;
        projectile.y = from.y + dy * impactAt;
    }
    if (impactAt !== null || side > 1) {
        if (solid(terrain, projectile.x, projectile.y)) excavation = {x: projectile.x, y: projectile.y};
        if (excavation) runtime.carve(excavation.x, excavation.y, 5);
    }
    return {digging: true, impact: impactAt !== null};
}
