import fs from 'fs';
import path from 'path';
import reference from './classic-reference.json';
import { expansionCatalog } from './catalog';
import { classicAdaptations, earlyClassicAdaptations } from './classics';
import { laterClassicAdaptations, laterClassicUnmapped, modernClassicAdaptations } from './later-classics';

const source = fs.readFileSync(path.join(__dirname, '../packs/Standard/Standard.js'), 'utf8');
const baseNames = [...source.matchAll(/this\.name\s*=\s*'([^']+)'/g)].map(match => match[1]);
const classics = [...classicAdaptations, ...earlyClassicAdaptations, ...laterClassicAdaptations, ...modernClassicAdaptations];
const names = new Set([...baseNames, ...classics.map(weapon => weapon.name)]);

test('all 320 names in the archived classic roster are represented', () => {
    expect(baseNames).toHaveLength(30);
    expect(reference).toHaveLength(320);
    expect(laterClassicUnmapped).toEqual([]);
    expect(reference.filter(weapon => !names.has(weapon.name)).map(weapon => weapon.name)).toEqual([]);
});

test('80 later expansion names extend the classic roster to 400', () => {
    // Five of them (Evac, Rampart, Bridge, Strip Mine, Displacer Beam) are
    // supplied by the first classic pack, so the modern pack holds 75.
    const archived = new Set(reference.map(weapon => weapon.name));
    expect(modernClassicAdaptations).toHaveLength(75);
    expect(new Set(modernClassicAdaptations.map(weapon => weapon.name)).size).toBe(75);
    expect(modernClassicAdaptations.filter(weapon => archived.has(weapon.name)).map(weapon => weapon.name)).toEqual([]);
    expect(names.size).toBe(400);
    expect(laterClassicAdaptations).toHaveLength(179);
    expect(classics).toHaveLength(370);
});

test('new designs are separate from named classics and metadata distinguishes adaptations', () => {
    expect(expansionCatalog).toHaveLength(370);
    expect(expansionCatalog.filter(weapon => names.has(weapon.name))).toEqual([]);
    classics.forEach(weapon => {
        expect(weapon.origin).toMatch(/adaptation/);
        expect(weapon.source).toMatch(/^https:\/\//);
        expect(weapon.payload).toBeDefined();
        expect(Number.isFinite(weapon.radius)).toBe(true);
        expect(Number.isFinite(weapon.strength)).toBe(true);
    });
});
