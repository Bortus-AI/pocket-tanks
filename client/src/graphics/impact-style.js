// Deterministic per-weapon presentation accents. The baked weapon art already
// gives every weapon its own frames; these descriptors make the procedural
// fallback paths (art still loading, texture slots exhausted, canvas renderer)
// distinguishable per weapon instead of per payload colour.
const frac = v => v - Math.floor(v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const PHI = [0.6180339887, 0.7548776662, 0.5698402910, 0.4142135624, 0.3247179572];
export const RING_STYLES = ['single', 'double', 'dashed', 'spokes', 'shockwave', 'rim'];
export const TRAIL_SHAPES = ['puff', 'ribbon', 'sparks', 'beads', 'helix'];
export const PARTICLE_SHAPES = ['shard', 'chip', 'pellet', 'sliver', 'flake'];

const toRgb = color => {
    if (Array.isArray(color)) return color.map(v => clamp(v, 0, 1));
    if (typeof color === 'number') return [(color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255];
    if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) return toRgb(parseInt(color.slice(1), 16));
    return [1, .82, .55];
};
const rgbToHsl = ([r, g, b]) => {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
};
const hslToHex = (h, s, l) => {
    const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255); };
    return `#${[f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
};

const cache = new Map();
/**
 * @param {{weaponId?:number,payload?:string,color?:number|string}} options
 * @param {{color?:number[]}|null} design weapon art design when available
 */
export const impactStyle = (options = {}, design = null) => {
    const id = Number.isInteger(options.weaponId) ? options.weaponId : -1;
    const key = `${id}|${options.payload || ''}|${design?.id ?? ''}`;
    if (cache.has(key)) return cache.get(key);
    const seq = k => frac((id + 1) * PHI[k]);
    const [h, s, l] = rgbToHsl(toRgb(design?.color || options.color));
    // Accent hue stays within +/-28 degrees of the weapon's own colour, so the
    // family remains readable while neighbouring weapons differ.
    const hue = frac(h + (seq(0) - .5) * .155);
    const style = Object.freeze({
        weaponId: id,
        accentHue: round(hue * 360, 2),
        accent: hslToHex(hue, clamp(s * .8 + .25, .35, 1), clamp(l * .6 + .35, .45, .8)),
        ring: RING_STYLES[Math.floor(seq(1) * RING_STYLES.length)],
        ringWidth: round(1 + seq(2) * 2.2, 2),
        trail: TRAIL_SHAPES[Math.floor(seq(3) * TRAIL_SHAPES.length)],
        shape: PARTICLE_SHAPES[Math.floor(seq(4) * PARTICLE_SHAPES.length)],
        countScale: round(.75 + seq(2) * .6, 3),
        spread: round(.8 + seq(3) * .5, 3),
    });
    if (cache.size > 2048) cache.delete(cache.keys().next().value);
    cache.set(key, style);
    return style;
};
// Camera shake proportional to the actual damage radius (not a fixed threshold).
export const shakeFor = (radius, reducedMotion = false) => {
    if (reducedMotion || !(radius > 30)) return null;
    const t = clamp((radius - 30) / 150, 0, 1);
    return {duration: Math.round(70 + t * 110), intensity: round(.0008 + t * .0032, 5)};
};
export const impactStyleKey = style => `${style.accentHue}|${style.accent}|${style.ring}|${style.ringWidth}|${style.trail}|${style.shape}|${style.countScale}|${style.spread}`;
