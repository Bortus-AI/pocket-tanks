import { classicAdaptations, earlyClassicAdaptations } from './expansion/classics';
import { laterClassicAdaptations, modernClassicAdaptations } from './expansion/later-classics';
import { makeClassicWeapon } from './expansion/classic-runtime';
import { expansionCatalog } from './expansion/catalog';
import { makeExpansionWeapon } from './expansion/runtime';
import * as Allweapons from './packs/Standard/Standard'
import { MAX_PINNED_WEAPON_ID, stableWeaponId } from './weapon-ids';

export const weaponArray = []

const singleshot = new Allweapons.singleshot()
weaponArray[singleshot.id] = singleshot

const bigshot = new Allweapons.bigshot()
weaponArray[bigshot.id] = bigshot

const threeshot = new Allweapons.threeshot()
weaponArray[threeshot.id] = threeshot

const fiveshot = new Allweapons.fiveshot()
weaponArray[fiveshot.id] = fiveshot

const jackhammer = new Allweapons.jackhammer()
weaponArray[jackhammer.id] = jackhammer

const heatseeker = new Allweapons.heatseeker()
weaponArray[heatseeker.id] = heatseeker

const tracer = new Allweapons.tracer()
weaponArray[tracer.id] = tracer

const piledriver = new Allweapons.piledriver()
weaponArray[piledriver.id] = piledriver

const dirtmover = new Allweapons.dirtmover()
weaponArray[dirtmover.id] = dirtmover

const crazyivan = new Allweapons.crazyivan()
weaponArray[crazyivan.id] = crazyivan

const spider = new Allweapons.spider()
weaponArray[spider.id] = spider

const sniperrifle = new Allweapons.sniperrifle()
weaponArray[sniperrifle.id] = sniperrifle

const magicwall = new Allweapons.magicwall()
weaponArray[magicwall.id] = magicwall

const dirtslinger = new Allweapons.dirtslinger()
weaponArray[dirtslinger.id] = dirtslinger

const zapper = new Allweapons.zapper()
weaponArray[zapper.id] = zapper

const napalm = new Allweapons.napalm()
weaponArray[napalm.id] = napalm

const hailstorm = new Allweapons.hailstorm()
weaponArray[hailstorm.id] = hailstorm

const groundhog = new Allweapons.groundhog()
weaponArray[groundhog.id] = groundhog

const worm = new Allweapons.worm()
weaponArray[worm.id] = worm

const homingworm = new Allweapons.homingworm()
weaponArray[homingworm.id] = homingworm

const skipper = new Allweapons.skipper()
weaponArray[skipper.id] = skipper

const chainreaction = new Allweapons.chainreaction()
weaponArray[chainreaction.id] = chainreaction

const pineapple = new Allweapons.pineapple()
weaponArray[pineapple.id] = pineapple

const firecracker = new Allweapons.firecracker()
weaponArray[firecracker.id] = firecracker

const homingmissile = new Allweapons.homingmissile()
weaponArray[homingmissile.id] = homingmissile

const dirtball = new Allweapons.dirtball()
weaponArray[dirtball.id] = dirtball

const tommygun = new Allweapons.tommygun()
weaponArray[tommygun.id] = tommygun

const mountainmover = new Allweapons.mountainmover()
weaponArray[mountainmover.id] = mountainmover

const scattershot = new Allweapons.scattershot()
weaponArray[scattershot.id] = scattershot

const cruiser = new Allweapons.cruiser()
weaponArray[cruiser.id] = cruiser

expansionCatalog.forEach(definition => { weaponArray[definition.id] = makeExpansionWeapon(definition); });

// Classic adaptations take their ID from the committed manifest, never from
// their position in a pack. Unknown (newly authored) names are appended after
// the highest pinned ID in pack order; ids.test.js fails until they are pinned.
const normalizeName = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const returningNames = new Set(weaponArray.map(weapon => normalizeName(weapon.name)));
export const unpinnedWeaponNames = [];
let nextUnpinnedId = MAX_PINNED_WEAPON_ID + 1;
[classicAdaptations, earlyClassicAdaptations, laterClassicAdaptations, modernClassicAdaptations].forEach(pack => {
    pack.forEach(definition => {
        const key = normalizeName(definition.name);
        if (returningNames.has(key)) return;
        returningNames.add(key);
        let id = stableWeaponId(definition.name);
        if (id === undefined) { id = nextUnpinnedId++; unpinnedWeaponNames.push(definition.name); }
        if (weaponArray[id]) throw new Error(`Weapon ID ${id} is assigned to both ${weaponArray[id].name} and ${definition.name}`);
        weaponArray[id] = makeClassicWeapon({...definition, id});
    });
});
