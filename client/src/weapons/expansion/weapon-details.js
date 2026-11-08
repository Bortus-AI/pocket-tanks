const legacyDescriptions = [
 'A reliable medium shell.','A broad blast leaves an earth plug inside its crater.','Three spread shells cut crossing slots after impact.','Five shells leave descending steps after impact.',
 'Repeated vertical bounces cut away the support below the landing point.','Steers toward a nearby opponent.','Spread of angle-finding tracer rounds.','Deep explosions open flanking cavities beside the shaft.',
 'Directional terrain removal.','Unpredictable proximity warheads.','Web-like bursts seek the closest tank.','A precise high-scoring direct hit.',
 'Grows a vertical dirt wall.','Creates a V-shaped dirt barrier.','Proximity laser attack.','Burning liquid spreads over the ground.',
 'Bouncing pellets pour along the terrain.','Tunnels through ground and emerges.','Digs upward through the ground.','Tunnels underneath the target before rising.',
 'Skips before exploding.','A chain of nearby explosions.','Proximity-triggered miniature explosions.','Spreads blasts horizontally.',
 'Drops vertically after passing over a tank.','Creates a ball of dirt.','Rapid automatic fire.','Clears earth, then throws up separated dirt mounds.',
 'Upward-spreading rounds leave reflective rubber behind.','Follows the terrain before exploding.'
];
export const weaponDetails = (weapon = {}) => ({
    category:weapon.category || 'Classic', origin:weapon.origin || (weapon.id<30?'Original base game':'New design'),
    description:weapon.description || legacyDescriptions[weapon.id] || 'Classic arsenal weapon.',
    warning:weapon.warning || 'Direct hits and splash can cost you points if you hit yourself.',
});

// Keep combat help short enough for the two-line HUD strip.
export const shortWeaponDescription = weapon => {
    if (!weapon) return 'No weapon selected.';
    const description = (weapon.shortDescription || weaponDetails(weapon).description).trim();
    if (description.length <= 180) return description;
    const firstSentence = description.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
    if (firstSentence && firstSentence.length <= 180) return firstSentence;
    return description.slice(0, 177).replace(/\s+\S*$/, '') + '…';
};
