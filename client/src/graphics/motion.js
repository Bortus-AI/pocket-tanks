export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const frameSeconds = delta => clamp((Number.isFinite(delta) ? delta : 16.67) / 1000, 0, .25);
export const damp = (current, target, rate, dt) => target + (current - target) * Math.exp(-rate * dt);
export const dampAngle = (current, target, rate, dt) => current + Math.atan2(Math.sin(target - current), Math.cos(target - current)) * (1 - Math.exp(-rate * dt));

// Exact critically damped spring: visual settling stays consistent at 30/60/120Hz.
export const spring = (position, velocity, frequency, dt) => {
    const decay = Math.exp(-frequency * dt), term = velocity + frequency * position;
    return [(position + term * dt) * decay, (velocity - frequency * term * dt) * decay];
};
