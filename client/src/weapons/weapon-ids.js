import manifest from './weapon-ids.json';

// Stable weapon IDs. Saved loadouts, online picks (socket/session.js), weapon
// art (graphics/weapon-art/designs.json) and deployable literals all refer to
// these numbers, so an ID must never change once it is published. Adding,
// removing, reordering or rebalancing pack entries does not affect them.
// A new weapon must be appended to weapon-ids.json with the next free number.
export const WEAPON_IDS = Object.freeze({...manifest});
export const MAX_PINNED_WEAPON_ID = Math.max(...Object.values(WEAPON_IDS));
export const stableWeaponId = name => (Object.prototype.hasOwnProperty.call(WEAPON_IDS, name) ? WEAPON_IDS[name] : undefined);
