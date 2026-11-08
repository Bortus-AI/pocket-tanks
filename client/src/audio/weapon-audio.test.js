import fs from 'fs';
import path from 'path';
import { weaponSoundSignature, signatureHash, resolveFamily, FAMILY_TIMBRES, WeaponAudio, MAX_VOICES, THROTTLE_PER_KEY } from './weapon-audio';
import { expansionCatalog } from '../weapons/expansion/catalog';
import designs from '../graphics/weapon-art/designs.json';

// Runtime options as the FX layer receives them: expansion ids carry their
// payload/behaviour, classic adaptations their design material/mechanic, the
// 30 originals only their id/name (Blast.js legacy style).
const names = [...fs.readFileSync(path.join(__dirname, '../weapons/packs/Standard/Standard.js'), 'utf8').matchAll(/this\.name\s*=\s*'([^']+)'/g)].map(m => m[1]);
const expansion = new Map(expansionCatalog.map(w => [w.id, w]));
const optionsFor = id => {
    if (id < 30) return {weaponId: id, weaponName: names[id]};
    const w = expansion.get(id);
    if (w) return {weaponId: id, payload: w.payload.key, behavior: w.behavior, weaponName: w.name};
    const d = designs[id];
    return {weaponId: id, payload: d.material, classicMechanic: d.mechanic, weaponName: d.name};
};
const ids = Array.from({length: 770}, (_, i) => i);

test('every weapon 0..769 has a deterministic, pairwise distinct sound signature', () => {
    const hashes = new Set(), launchKeys = new Set(), impactKeys = new Set();
    for (const id of ids) {
        const a = weaponSoundSignature(optionsFor(id)), b = weaponSoundSignature({...optionsFor(id)});
        expect(b).toBe(a);
        expect(signatureHash(a)).toBe(a.hash);
        expect(a.weaponId).toBe(id);
        hashes.add(a.hash);
        launchKeys.add(JSON.stringify(a.launch));impactKeys.add(JSON.stringify(a.impact));
        for (const spec of [a.launch, a.impact]) {
            expect(spec.duration).toBeGreaterThan(.05);expect(spec.duration).toBeLessThan(2);
            expect(spec.pitch).toBeGreaterThan(20);expect(Number.isFinite(spec.sweep)).toBe(true);
        }
    }
    expect(hashes.size).toBe(770);expect(launchKeys.size).toBe(770);expect(impactKeys.size).toBe(770);
});

test('signatures are readable by payload family', () => {
    for (const id of ids) {
        const options = optionsFor(id), signature = weaponSoundSignature(options);
        expect(signature.texture).toBe(FAMILY_TIMBRES[signature.family].texture);
        const expectedFamily = options.payload && FAMILY_TIMBRES[options.payload] ? options.payload : signature.family;
        expect(signature.family).toBe(expectedFamily);
        expect(FAMILY_TIMBRES[signature.family].impact).toContain(signature.impact.sample);
    }
    expect(resolveFamily({weaponId: 15})).toBe('fire');expect(resolveFamily({weaponId: 16})).toBe('frost');
    expect(resolveFamily({weaponId: 14})).toBe('ion');expect(resolveFamily({payload: 'earth'})).toBe('seismic');
    const families = new Set(ids.map(id => weaponSoundSignature(optionsFor(id)).family));
    expect(families.size).toBe(10);
});

const param = () => ({setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn()});
const fakeSound = () => {
    const connections = [];
    const node = () => ({connect: jest.fn(t => connections.push(t)), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(), frequency: param(), gain: param(), Q: param(), pan: param(), detune: param()});
    const context = {state: 'running', currentTime: 0, sampleRate: 8000, destination: {id: 'raw'}, createOscillator: node, createGain: node, createBiquadFilter: node,
        createBufferSource: node, createStereoPanner: node, createBuffer: (c, length) => ({getChannelData: () => new Float32Array(length)})};
    const master = {id: 'master', connect: jest.fn()};
    return {sound: {context, destination: master, mute: false, play: jest.fn(), game: {cache: {audio: {exists: () => true}}}}, connections, master, context};
};

test('synth routes through the Phaser master chain and respects mute', () => {
    const {sound, connections, master, context} = fakeSound(), audio = new WeaponAudio(sound);
    expect(audio.play('impact', optionsFor(45), {radius: 60, x: 300})).toBe(true);
    expect(connections).not.toContain(context.destination);
    expect(connections.some(c => c === master)).toBe(true);
    expect(sound.play).toHaveBeenCalledTimes(1);
    const [, config] = sound.play.mock.calls[0];expect(config.volume).toBeLessThanOrEqual(1);expect(config.rate).toBeGreaterThan(.7);
    sound.mute = true;connections.length = 0;sound.play.mockClear();
    expect(audio.play('impact', optionsFor(46))).toBe(false);expect(connections).toHaveLength(0);expect(sound.play).not.toHaveBeenCalled();
});

test('NoAudio / HTML5 managers get no synth, only the sample layer through sound.play', () => {
    const sound = {mute: false, play: jest.fn()}, audio = new WeaponAudio(sound);
    expect(audio.output()).toBeNull();
    audio.play('impact', optionsFor(100));expect(sound.play).toHaveBeenCalledTimes(1);
    expect(new WeaponAudio(null).play('impact', optionsFor(1))).toBe(false);
});

test('per-key throttle and global voice cap bound cluster spam', () => {
    let now = 0;const {sound} = fakeSound(), audio = new WeaponAudio(sound, {now: () => now});
    const results = Array.from({length: 10}, () => audio.play('impact', optionsFor(22), {radius: 20}));
    expect(results.filter(Boolean)).toHaveLength(THROTTLE_PER_KEY);
    now = 200;expect(audio.play('impact', optionsFor(22))).toBe(true);
    for (let id = 30; id < 80; id++) audio.play('impact', optionsFor(id));
    expect(audio.activeVoices()).toBeLessThanOrEqual(MAX_VOICES);
    expect(audio.playSample('expshort', {volume: 3})).toBe(false);
    now = 10000;audio.playSample('expshort', {volume: 3});
    expect(sound.play.mock.calls.at(-1)[1].volume).toBe(1);
});

test('launch bookkeeping lets the FX layer skip duplicate projectile launches', () => {
    let now = 0;const {sound} = fakeSound(), audio = new WeaponAudio(sound, {now: () => now});
    audio.play('launch', optionsFor(120));expect(audio.recentlyLaunched(120)).toBe(true);
    now = 1000;expect(audio.recentlyLaunched(120)).toBe(false);expect(audio.recentlyLaunched(121)).toBe(false);
});
