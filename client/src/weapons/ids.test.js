import fs from 'fs';
import path from 'path';
import { weaponArray, unpinnedWeaponNames } from './array';
import { WEAPON_IDS, stableWeaponId } from './weapon-ids';
import reference from './expansion/classic-reference.json';
import designs from '../graphics/weapon-art/designs.json';
import { expansionCatalog } from './expansion/catalog';
import { classicAdaptations, earlyClassicAdaptations } from './expansion/classics';
import { laterClassicAdaptations, modernClassicAdaptations } from './expansion/later-classics';
jest.mock('phaser',()=>({__esModule:true,default:{Math:{Vector2:class{constructor(x,y){this.x=x;this.y=y;}setAngle(){return this;}setLength(){return this;}}}},Physics:{},Scene:{}}));
jest.mock('../classes/Weapon',()=>({Weapon:class {}}));
jest.mock('./packs/Standard/logos',()=>({}));

const packs = {classicAdaptations, earlyClassicAdaptations, laterClassicAdaptations, modernClassicAdaptations};
const normalize = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
    : value && typeof value === 'object' ? `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${key}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);

test('weapon IDs are contiguous and equal to their array index', () => {
    expect(weaponArray).toHaveLength(770);
    weaponArray.forEach((weapon, index) => expect(weapon && weapon.id).toBe(index));
});

test('every weapon is pinned in weapon-ids.json with its current ID', () => {
    // A failure here means a weapon was added without pinning it. Append its
    // name to weapon-ids.json with the next free ID; never renumber old ones.
    expect(unpinnedWeaponNames).toEqual([]);
    expect(Object.keys(WEAPON_IDS)).toHaveLength(weaponArray.length);
    expect(weaponArray.filter(weapon => WEAPON_IDS[weapon.name] !== weapon.id).map(weapon => weapon.name)).toEqual([]);
    expect(new Set(Object.values(WEAPON_IDS)).size).toBe(weaponArray.length);
});

test('pack definitions declare their pinned IDs and contain no shadowed alternate specs', () => {
    Object.entries(packs).forEach(([pack, definitions]) => definitions.forEach(definition =>
        expect(`${pack}:${definition.name}:${definition.id}`).toBe(`${pack}:${definition.name}:${stableWeaponId(definition.name)}`)));
    expect(expansionCatalog.filter(definition => WEAPON_IDS[definition.name] !== definition.id)).toEqual([]);
    const names = [...weaponArray.slice(0, 400).map(weapon => weapon.name), ...Object.values(packs).flat().map(definition => definition.name)].map(normalize);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
});

test('classic reference and weapon art resolve to the same weapon names', () => {
    expect(reference.filter(entry => weaponArray[entry.weaponId]?.name !== entry.name).map(entry => entry.name)).toEqual([]);
    expect(designs).toHaveLength(weaponArray.length);
    expect(designs.filter(design => weaponArray[design.id]?.name !== design.name).map(design => `${design.id}:${design.name}`)).toEqual([]);
});

test('deployable fallback ID literals point at the deployable weapons', () => {
    const expected = {autoturrets: 'Auto Turrets', missileturret: 'Missile Turret', runngun: "Run 'n' Gun", sentry: 'Auto Turrets', silo: 'Missile Turret', runner: "Run 'n' Gun"};
    const literals = ['deployables.js', 'deployable-fx.js'].flatMap(file => {
        const source = fs.readFileSync(path.join(__dirname, 'expansion', file), 'utf8');
        return [...source.matchAll(/\{((?:\w+:\d+,?)+)\}\[/g)].flatMap(match => [...match[1].matchAll(/(\w+):(\d+)/g)].map(([, kind, id]) => [kind, Number(id)]));
    });
    expect(literals.length).toBe(6);
    literals.forEach(([kind, id]) => expect(`${kind}:${weaponArray[id].name}`).toBe(`${kind}:${expected[kind]}`));
});

test('no two weapons share an identical stat signature', () => {
    const signature = weapon => stable([weapon.behavior, weapon.classicMechanic, weapon.payload?.key, weapon.radius, weapon.strength, weapon.count, weapon.options || {}]);
    const groups = new Map();
    weaponArray.slice(400).forEach(weapon => groups.set(signature(weapon), [...(groups.get(signature(weapon)) || []), weapon.name]));
    expect([...groups.values()].filter(names => names.length > 1)).toEqual([]);
    // Generated designs 30-399 are one behavior per payload by construction.
    const generated = weaponArray.slice(30, 400).map(weapon => `${weapon.behavior}:${weapon.payload.key}`);
    expect(new Set(generated).size).toBe(370);
});
