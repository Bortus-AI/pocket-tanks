// Procedural per-weapon audio. Every weapon (ids 0-769) owns a deterministic
// signature derived from its id, payload family and delivery behaviour. Sound is
// synthesised with WebAudio and routed through Phaser's sound manager master
// chain (mute + volume); NoAudio/HTML5 managers get the sample layer only.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const frac = v => v - Math.floor(v);
const round = (v, digits = 4) => Math.round(v * 10 ** digits) / 10 ** digits;

export const hashString = text => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
};
export const seededRandom = seed => () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Payload timbre families. `texture` selects the characteristic layer; the
// sample lists are layered quietly with per-weapon rate/detune.
export const FAMILY_TIMBRES = Object.freeze({
    kinetic:{wave:['triangle','square'],base:118,noise:'brown',filter:'lowpass',cutoff:[2400,260],q:.9,texture:'thump',impact:['expshort','expmedium','explong','exphuge'],launch:['launch']},
    fire:{wave:['sawtooth','triangle'],base:150,noise:'pink',filter:'bandpass',cutoff:[3200,620],q:1.4,texture:'crackle',impact:['napalm','expmedium2'],launch:['split','launch']},
    frost:{wave:['sine','triangle'],base:880,noise:'white',filter:'highpass',cutoff:[5200,2100],q:3,texture:'shimmer',impact:['hailstorm','aquabomb_splash'],launch:['tracer']},
    acid:{wave:['square','sawtooth'],base:330,noise:'white',filter:'bandpass',cutoff:[4600,2300],q:2.4,texture:'fizz',impact:['aquabomb_splash','napalm'],launch:['skipperbounce']},
    ion:{wave:['square','sawtooth'],base:540,noise:'white',filter:'bandpass',cutoff:[2600,6400],q:5,texture:'zap',impact:['zapper','tracer'],launch:['zapper']},
    seismic:{wave:['sine','triangle'],base:46,noise:'brown',filter:'lowpass',cutoff:[700,90],q:.7,texture:'rumble',impact:['rockslide','rock','explong'],launch:['rock']},
    leech:{wave:['sine','triangle'],base:262,noise:'pink',filter:'bandpass',cutoff:[1100,420],q:2,texture:'warble',impact:['homing','expshort2'],launch:['homing']},
    foam:{wave:['sine','triangle'],base:300,noise:'pink',filter:'lowpass',cutoff:[1500,480],q:4,texture:'squelch',impact:['aquabomb_splash','skipperbounce'],launch:['skipperbounce']},
    magnet:{wave:['sawtooth','square'],base:72,noise:'pink',filter:'lowpass',cutoff:[950,280],q:6,texture:'hum',impact:['magicwall','expshort'],launch:['homing']},
    volatile:{wave:['sawtooth','square'],base:96,noise:'white',filter:'lowpass',cutoff:[5600,320],q:1.1,texture:'doublecrack',impact:['firecracker','clusterbombs_exp','exphuge'],launch:['firecracker']},
});
export const FAMILIES = Object.keys(FAMILY_TIMBRES);
const FAMILY_ALIASES = {earth:'seismic',tar:'acid',mixed:'volatile',field:'ion',warp:'ion'};

// Original 30 weapons (Standard pack) have no payload; mirror their art family.
const LEGACY_FAMILY = {7:'seismic',8:'seismic',12:'seismic',13:'seismic',14:'ion',15:'fire',16:'frost',17:'seismic',18:'seismic',19:'seismic',23:'fire',25:'seismic',27:'seismic'};
const LEGACY_MECHANIC = ['shell','shell','spread','spread','drill','guided','tracer','crater','trench','random','net','rail','wall','scatterbuild','laser','oil','skyfall','tunnel','drillburst','drillburst','bouncer','groundwave','cluster','carpet','guided','berm','stream','excavator','cluster','roller'];

const group = words => new Set(words.split(' '));
const RHYTHMS = [
    ['scatter', group('cluster split spread stream skyfall proximity ring barrage carpet scatterbuild random')],
    ['bore', group('drill tunnel excavator crater well longtunnel drillburst groundfan saw trench fault groundwave landslide')],
    ['beam', group('laser rail tracer probe net emp')],
    ['build', group('wall dome berm platform bridge selfbridge seed selfdome selfrubberdome pedestal pillars selfshelter island rubberwall glue rubber')],
    ['chime', group('shield repair cleanse')],
    ['warp', group('blink swap randomblink selfescape vortex repulsor siphon')],
    ['whoosh', group('guided homing selflaunch jump boomerang kamikaze')],
    ['bounce', group('bouncer roller ricochet skip mine')],
];
export const rhythmOf = mechanic => {
    for (const [name, set] of RHYTHMS) if (set.has(mechanic)) return name;
    return mechanic ? ['strike','strike','scatter','bounce'][hashString(mechanic) % 4] : 'strike';
};

export const resolveFamily = (options = {}) => {
    const raw = options.payload?.key || options.payload || options.material;
    if (typeof raw === 'string') {
        if (FAMILY_TIMBRES[raw]) return raw;
        if (FAMILY_ALIASES[raw]) return FAMILY_ALIASES[raw];
    }
    const id = Number(options.weaponId);
    if (Number.isInteger(id) && id >= 0 && id < 30) return LEGACY_FAMILY[id] || 'kinetic';
    if (Number.isInteger(id) && id >= 30 && id < 400) return FAMILIES[(id - 30) % 10];
    return 'kinetic';
};
const resolveMechanic = (options = {}) => {
    const id = Number(options.weaponId);
    return options.classicMechanic || options.behavior || options.mechanic || (Number.isInteger(id) && id < 30 ? LEGACY_MECHANIC[id] : '') || '';
};

// Low-discrepancy sequences spread neighbouring ids across the parameter
// space, so consecutive weapons never sound alike even within one family.
const PHI = [0.6180339887, 0.7548776662, 0.5698402910, 0.4142135624, 0.3247179572, 0.2207440846];
const signatureCache = new Map();

export const weaponSoundSignature = (options = {}) => {
    const weaponId = Number.isInteger(Number(options.weaponId)) ? Number(options.weaponId) : -1;
    const family = resolveFamily(options), mechanic = resolveMechanic(options), name = String(options.weaponName || options.name || '');
    const cacheKey = `${weaponId}|${family}|${mechanic}|${name}`;
    if (signatureCache.has(cacheKey)) return signatureCache.get(cacheKey);
    const timbre = FAMILY_TIMBRES[family], rhythm = rhythmOf(mechanic);
    const seq = k => frac((weaponId + 1) * PHI[k]);
    const rng = seededRandom(hashString(cacheKey));
    const semis = (seq(0) - .5) * 14 + (rng() - .5) * .4;
    const pitch = timbre.base * 2 ** (semis / 12);
    const filterMul = 2 ** ((seq(1) - .5) * 1.6);
    const duration = .75 + seq(2) * .6;
    const grains = rhythm === 'scatter' ? 3 + Math.floor(seq(3) * 4) : rhythm === 'bounce' ? 2 + Math.floor(seq(3) * 2) : rhythm === 'bore' ? 5 + Math.floor(seq(3) * 4) : 1;
    const textureTimes = Array.from({length: 6}, () => round(rng(), 3)).sort((a, b) => a - b);
    const build = (kind, length) => ({
        wave: timbre.wave[Math.floor(seq(4) * timbre.wave.length)],
        pitch: round(kind === 'launch' ? pitch * (rhythm === 'whoosh' ? 1.6 : 1.25) : pitch, 3),
        sweep: round(kind === 'launch' ? (rhythm === 'beam' ? 1.15 : 1.8 + seq(5)) : rhythm === 'warp' || rhythm === 'chime' ? 1.6 + seq(5) : .28 + seq(5) * .4, 3),
        noise: timbre.noise,
        noiseMix: round(clamp((kind === 'launch' ? .35 : .55) + (seq(3) - .5) * .4, .1, .9), 3),
        filter: timbre.filter,
        cutoff: [round(timbre.cutoff[0] * filterMul, 1), round(timbre.cutoff[1] * filterMul, 1)],
        q: round(timbre.q * (.7 + seq(2) * .6), 3),
        attack: round(rhythm === 'chime' || rhythm === 'build' ? .02 + seq(4) * .03 : .002 + seq(4) * .006, 4),
        duration: round(length * duration, 3),
        grains, grainGap: round(.035 + seq(5) * .05, 4),
        texture: timbre.texture,
        textureTimes,
        lfo: round(rhythm === 'bore' ? 14 + seq(1) * 18 : timbre.texture === 'warble' ? 5 + seq(1) * 6 : timbre.texture === 'hum' ? 3 + seq(1) * 4 : 0, 3),
        detune: Math.round((rng() - .5) * 600),
        sample: (kind === 'launch' ? timbre.launch : timbre.impact)[(weaponId + 7 * Math.floor(seq(4) * 3)) % (kind === 'launch' ? timbre.launch.length : timbre.impact.length)],
        sampleRate: round(.78 + seq(kind === 'launch' ? 5 : 3) * .5, 3),
    });
    const signature = Object.freeze({
        weaponId, family, mechanic, rhythm, texture: timbre.texture,
        launch: build('launch', rhythm === 'beam' ? .32 : .22),
        impact: build('impact', rhythm === 'bore' ? .9 : rhythm === 'build' ? .7 : family === 'seismic' ? .85 : .55),
    });
    const hash = signatureHash(signature);
    const result = Object.freeze({...signature, hash});
    if (signatureCache.size > 2048) signatureCache.delete(signatureCache.keys().next().value);
    signatureCache.set(cacheKey, result);
    return result;
};
export const signatureHash = signature => hashString(JSON.stringify({f:signature.family,r:signature.rhythm,l:signature.launch,i:signature.impact})).toString(16);

// ---- WebAudio rendering ----------------------------------------------------
const noiseBuffers = new WeakMap();
const noiseBuffer = (context, color) => {
    let cache = noiseBuffers.get(context);
    if (!cache) { cache = {}; noiseBuffers.set(context, cache); }
    if (cache[color]) return cache[color];
    const length = Math.floor((context.sampleRate || 44100) * 1.2), buffer = context.createBuffer(1, length, context.sampleRate || 44100), data = buffer.getChannelData(0);
    const rng = seededRandom(hashString(color));
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < length; i++) {
        const white = rng() * 2 - 1;
        if (color === 'pink') { b0 = .99765 * b0 + white * .099046; b1 = .963 * b1 + white * .2965164; b2 = .57 * b2 + white * 1.0526913; data[i] = (b0 + b1 + b2 + white * .1848) * .2; }
        else if (color === 'brown') { last = (last + .02 * white) / 1.02; data[i] = last * 3.2; }
        else data[i] = white * .7;
    }
    cache[color] = buffer; return buffer;
};
const envelope = (param, t, attack, peak, end) => {
    param.setValueAtTime(.0001, t);
    param.exponentialRampToValueAtTime(Math.max(.0002, peak), t + Math.max(.001, attack));
    param.exponentialRampToValueAtTime(.0001, Math.max(t + attack + .005, end));
};

// Builds one sound event. Returns the latest stop time.
export const renderVoice = (context, output, spec, when, level) => {
    const nodes = [], track = n => { nodes.push(n); return n; };
    const end = when + spec.duration;
    // Tonal body with pitch sweep (and optional LFO for bore/warble/hum).
    const osc = track(context.createOscillator()), oscGain = track(context.createGain());
    osc.type = spec.wave; osc.detune?.setValueAtTime?.(spec.detune * .1, when);
    osc.frequency.setValueAtTime(spec.pitch, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.pitch * spec.sweep), end);
    envelope(oscGain.gain, when, spec.attack, level * (1 - spec.noiseMix) * .55, end);
    osc.connect(oscGain); oscGain.connect(output);
    if (spec.lfo) {
        const lfo = track(context.createOscillator()), depth = track(context.createGain());
        lfo.frequency.setValueAtTime(spec.lfo, when); depth.gain.setValueAtTime(spec.pitch * (spec.texture === 'hum' ? .015 : .12), when);
        lfo.connect(depth); depth.connect(osc.frequency); lfo.start(when); lfo.stop(end + .02);
    }
    osc.start(when); osc.stop(end + .02);
    // Coloured noise through a sweeping filter, split into rhythm grains.
    const filter = track(context.createBiquadFilter());
    filter.type = spec.filter; filter.Q.setValueAtTime(spec.q, when);
    filter.frequency.setValueAtTime(spec.cutoff[0], when); filter.frequency.exponentialRampToValueAtTime(Math.max(30, spec.cutoff[1]), end);
    filter.connect(output);
    const grains = spec.grains, grainLength = grains > 1 ? Math.max(.03, spec.duration / grains * .8) : spec.duration;
    for (let g = 0; g < grains; g++) {
        const start = when + g * (grains > 1 ? Math.min(spec.grainGap, spec.duration / grains) : 0);
        const source = track(context.createBufferSource()), gain = track(context.createGain());
        source.buffer = noiseBuffer(context, spec.noise); source.loop = true;
        envelope(gain.gain, start, spec.attack, level * spec.noiseMix * (g ? .7 : 1), start + grainLength);
        source.connect(gain); gain.connect(filter); source.start(start, (g * .173) % 1); source.stop(start + grainLength + .02);
    }
    // Family texture layer.
    const blip = (t, freq, freq2, length, amount, type = 'sine') => {
        const o = track(context.createOscillator()), g = track(context.createGain());
        o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + length);
        envelope(g.gain, t, .002, amount, t + length); o.connect(g); g.connect(output); o.start(t); o.stop(t + length + .02);
    };
    const times = spec.textureTimes, span = spec.duration;
    switch (spec.texture) {
    case 'crackle': times.forEach(k => blip(when + k * span, 2400 + k * 1800, 900, .012, level * .35, 'square')); break;
    case 'shimmer': [1, 2.76, 5.4].forEach((m, i) => blip(when + times[i] * .05, spec.pitch * m, spec.pitch * m * .985, span * (.9 - i * .2), level * .18)); break;
    case 'fizz': times.forEach(k => blip(when + k * span, 5200 + k * 2600, 3800, .02, level * .12, 'sawtooth')); break;
    case 'zap': times.slice(0, 4).forEach((k, i) => blip(when + k * span * .6, spec.pitch * (2 + i), spec.pitch * .6, .03, level * .22, 'square')); break;
    case 'rumble': blip(when, 52 * (.8 + times[0] * .4), 28, span * 1.2, level * .55); break;
    case 'warble': blip(when + .01, spec.pitch * 1.5, spec.pitch * .75, span * .8, level * .22, 'triangle'); break;
    case 'squelch': times.slice(0, 5).forEach((k, i) => blip(when + k * span * .8, 180 + i * 70, 420 + i * 90, .05, level * .2)); break;
    case 'hum': blip(when, spec.pitch * 2.01, spec.pitch * 1.98, span, level * .2, 'sawtooth'); break;
    case 'doublecrack': [0, .09 + times[0] * .08].forEach(t => blip(when + t, 1800, 90, .07, level * .5, 'square')); break;
    default: blip(when, 95 * (.8 + times[0] * .4), 38, .16, level * .6); blip(when, 3000, 600, .008, level * .3, 'square');
    }
    return {end: end + .05, nodes};
};

export const MAX_VOICES = 12;
export const THROTTLE_WINDOW_MS = 80;
export const THROTTLE_PER_KEY = 3;

export class WeaponAudio {
    constructor(sound, {now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), width = 1200} = {}) {
        this.sound = sound; this.now = now; this.width = width; this.voices = []; this.history = new Map(); this.lastLaunch = new Map();
    }
    // Phaser WebAudioSoundManager: masterMuteNode -> masterVolumeNode -> destination.
    output() {
        const s = this.sound;
        if (!s?.context || typeof s.context.createOscillator !== 'function') return null;
        return s.destination || s.masterMuteNode || null;
    }
    // Per-key rate limit: cluster weapons fire many blasts per frame.
    allow(key) {
        const now = this.now(), list = (this.history.get(key) || []).filter(t => now - t < THROTTLE_WINDOW_MS);
        if (list.length >= THROTTLE_PER_KEY) { this.history.set(key, list); return false; }
        list.push(now); this.history.set(key, list);
        if (this.history.size > 256) this.history.delete(this.history.keys().next().value);
        return true;
    }
    activeVoices() {
        const t = this.now(); this.voices = this.voices.filter(v => v > t); return this.voices.length;
    }
    reserveVoice(seconds) {
        if (this.activeVoices() >= MAX_VOICES) return false;
        this.voices.push(this.now() + seconds * 1000); return true;
    }
    muted() { return !this.sound || this.sound.mute || this.sound.locked; }
    playSample(key, config = {}, throttleKey = key) {
        const s = this.sound;
        if (!s?.play || !key || this.muted()) return false;
        if (s.game?.cache?.audio && !s.game.cache.audio.exists(key)) return false;
        if (!this.allow(`sample:${throttleKey}`)) return false;
        if (!this.reserveVoice(.6)) return false;
        const volume = clamp(Number.isFinite(config.volume) ? config.volume : 1, 0, 1);
        try { s.play(key, {...config, volume}); return true; } catch { return false; }
    }
    synth(spec, {level = .3, x} = {}) {
        const out = this.output(), context = this.sound?.context;
        if (!out || this.muted() || context.state === 'suspended' || context.state === 'closed') return false;
        if (!this.reserveVoice(spec.duration + .1)) return false;
        try {
            const when = context.currentTime + .005;
            let target = out, panner = null;
            if (Number.isFinite(x) && typeof context.createStereoPanner === 'function') {
                panner = context.createStereoPanner(); panner.pan.setValueAtTime(clamp(x / this.width * 2 - 1, -1, 1) * .55, when); panner.connect(out); target = panner;
            }
            const bus = context.createGain(); bus.gain.setValueAtTime(clamp(level, 0, 1), when); bus.connect(target);
            const {end, nodes} = renderVoice(context, bus, spec, when, 1);
            // Disconnect the whole graph once every scheduled source has ended.
            const sources = nodes.filter(n => typeof n.stop === 'function');
            let pending = sources.length;
            const done = () => { if (--pending > 0) return; for (const n of [...nodes, bus, panner]) try { n?.disconnect(); } catch {} };
            sources.forEach(n => { n.onended = done; });
            return end > when;
        } catch { return false; }
    }
    // kind: launch | impact | beam | build | layer (legacy wav layer)
    play(kind, options = {}, {radius = 40, x, volume = 1} = {}) {
        const signature = weaponSoundSignature(options), id = signature.weaponId;
        if (!this.allow(`${kind}:${id}`)) return false;
        const size = clamp(radius / 70, .45, 1.6);
        if (kind === 'launch') {
            this.lastLaunch.set(id, this.now());
            const ok = this.synth(signature.launch, {level: .2 * volume, x});
            this.playSample(signature.launch.sample, {volume: .1 * volume, rate: signature.launch.sampleRate, detune: signature.launch.detune}, `launch:${signature.launch.sample}`);
            return ok;
        }
        const spec = kind === 'beam' ? {...signature.launch, duration: signature.launch.duration * 1.6, sweep: 1 / signature.launch.sweep} : signature.impact;
        if (kind === 'layer') return this.synth({...spec, duration: spec.duration * .8}, {level: .12 * volume, x});
        const scaled = kind === 'build' ? {...spec, pitch: spec.pitch * .7} : {...spec, duration: spec.duration * clamp(.7 + size * .35, .7, 1.3)};
        const ok = this.synth(scaled, {level: clamp(.22 * size * volume, .05, .4), x});
        this.playSample(signature.impact.sample, {volume: clamp(.28 * size * volume, .06, .5), rate: signature.impact.sampleRate, detune: signature.impact.detune}, `impact:${signature.impact.sample}`);
        return ok;
    }
    recentlyLaunched(id, windowMs = 700) { const t = this.lastLaunch.get(id); return t !== undefined && this.now() - t < windowMs; }
    // Small device cues (deployables) through the same master chain.
    device(kind) {
        const preset = {deploy:[150,420,.16],burst:[170,45,.07],lock:[680,920,.12],missile:[90,280,.3],run:[210,390,.14],vent:[440,100,.16],wreck:[95,25,.2]}[kind] || [200,100,.1];
        if (!this.allow(`device:${kind}`)) return false;
        return this.synth({wave: kind === 'lock' ? 'sine' : 'sawtooth', pitch: preset[0], sweep: preset[1] / preset[0], noise: 'pink', noiseMix: kind === 'wreck' || kind === 'burst' ? .5 : .15,
            filter: 'lowpass', cutoff: [2400, 600], q: 1, attack: .008, duration: preset[2], grains: 1, grainGap: .05, texture: 'none', textureTimes: [0, .2, .4, .6, .8, 1], lfo: 0, detune: 0},
        {level: kind === 'burst' ? .14 : .08});
    }
}

const instances = new WeakMap();
export const weaponAudio = scene => {
    const sound = scene?.sound;
    if (!sound || typeof sound !== 'object') return null;
    let audio = instances.get(sound);
    if (!audio) { audio = new WeaponAudio(sound, {width: scene.renderer?.width || 1200}); instances.set(sound, audio); }
    return audio;
};
export const playWeaponSound = (scene, kind, options, extra) => { try { return weaponAudio(scene)?.play(kind, options, extra) || false; } catch { return false; } };
export const playThrottledSample = (scene, key, config) => { try { return weaponAudio(scene)?.playSample(key, config) || false; } catch { return false; } };
export const playDeviceSound = (scene, kind) => { try { return weaponAudio(scene)?.device(kind) || false; } catch { return false; } };
