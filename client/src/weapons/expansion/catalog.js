// Stable IDs 30–399. Each family changes delivery/geometry; each payload changes
// tactical interactions. Saved loadouts and network picks use these IDs.
export const payloads = [
    { key:'kinetic', name:'Impact', color:0xf2c38b, radius:1, damage:1, detail:'Focused blast damage.', risk:'No lingering protection or area denial.' },
    { key:'fire', name:'Ember', color:0xff834f, radius:.85, damage:.8, detail:'Leaves a burning patch for three shots; ignites nearby oil and gas.', risk:'Fire burns either tank, including you.' },
    { key:'frost', name:'Rime', color:0x92e9ff, radius:.8, damage:.65, detail:'Freezes nearby tanks, limiting movement on their next two shots; extinguishes fire.', risk:'Low immediate damage. Heat clears the freeze.' },
    { key:'acid', name:'Caustic', color:0xade46f, radius:.75, damage:.7, detail:'Corrodes armor for two shots; subsequent hits deal 35% more damage.', risk:'Corrodes your armor too if you are nearby.' },
    { key:'ion', name:'Ion', color:0xbe9eff, radius:.7, damage:.75, detail:'Discharges shields and arcs to nearby metal-marked tanks.', risk:'Small crater. Arcs can jump back to you.' },
    { key:'seismic', name:'Tremor', color:0xd8b89b, radius:1.3, damage:.5, detail:'Wide excavation with reduced scoring damage; detonates buried mines.', risk:'Can remove the ground supporting your tank.' },
    { key:'leech', name:'Leech', color:0xec89b5, radius:.75, damage:.65, detail:'Converts successful enemy damage into temporary shield charge.', risk:'Short reach; friendly hits still cost points.' },
    { key:'foam', name:'Foam', color:0xc6f3cd, radius:.7, damage:.3, detail:'Sprays a sticky foam mound that can bury the target, gums enemy treads to one move next turn, and extinguishes fire and acid.', risk:'Light blast damage. The mound can also block your own line of fire.' },
    { key:'magnet', name:'Ferric', color:0x7ecdc2, radius:.85, damage:.65, detail:'Marks nearby armor for two shots, attracting guided ordnance and ion arcs.', risk:'Does not bypass terrain; can mark you as well.' },
    { key:'volatile', name:'Unstable', color:0xffdf75, radius:1.15, damage:1.2, detail:'A delayed second explosion follows the first, with a small breech backblast.', risk:'Always risks self damage. Keep distance from the impact.' },
];

// name, behavior, category, radius, strength, count, description, tactical caveat
export const families = [
 ['Howitzer','shell','Offense',44,1.05,1,'A precise ballistic shell.','Requires a clear ballistic arc.'],
 ['Starburst','cluster','Offense',20,.65,7,'Splits into a fan of live bomblets at the apex.','Wide spread makes close shots dangerous.'],
 ['Lobber','mortar','Offense',52,1,1,'A slow high-arc mortar with a heavy impact.','Low velocity and long hang time.'],
 ['Salvo','barrage','Offense',25,.5,5,'Five rounds in a staggered fan.','Each round scores modestly.'],
 ['Bore Lance','drill','Terrain',25,.6,1,'Bores straight through 150 pixels of solid ground before exploding.','Can overshoot a shallow target.'],
 ['Mole Train','tunnel','Terrain',18,.4,9,'After landing, carves a horizontal underground passage toward the firing direction.','Little damage above the tunnel.'],
 ['Fault Line','fault','Terrain',23,.4,7,'Opens a slanted descending chain of seismic cavities.','Drops tanks into difficult pits.'],
 ['Trench Cutter','trench','Terrain',18,.3,11,'Excavates a wide shallow trench along the landing surface.','May open an approach for your enemy.'],
 ['Quarry Charge','excavator','Terrain',88,.12,1,'Removes a broad pocket of earth with minimal scoring damage.','Creates room, but rarely wins points.'],
 ['Sinkhole','crater','Terrain',38,.45,5,'Progressively bores a deep vertical shaft under the impact.','A tank can become trapped below your firing line.'],
 ['Rampart','wall','Defense',30,.15,1,'Builds a tall earthen wall at the landing point.','Can obstruct your own next shot.'],
 ['Shell Shelter','dome','Defense',44,.1,1,'Builds a hollow protective arch above the landing point.','Leaves a roof that can bury whoever is inside.'],
 ['Earthworks','berm','Defense',45,.1,1,'Piles up a compact mound of protective soil.','Can entomb a nearby tank.'],
 ['Lift Pad','platform','Utility',36,.1,1,'Builds a solid platform below the landing point.','Elevation changes your aiming solution.'],
 ['Span Kit','bridge','Utility',30,.1,1,'Builds a narrow horizontal bridge across a gap.','A bridge also helps the other tank cross.'],
 ['Aegis','shield','Defense',34,0,1,'Charges your shield with 70 points of blast absorption.','Consumes a shot without attacking. Ion weapons strip it.'],
 ['Field Medic','repair','Defense',30,0,1,'Cleanses your tank and restores 20 shield points and one movement charge.','Does not restore points already lost.'],
 ['Scrubber','cleanse','Defense',65,0,1,'Erases nearby hazards and harmful tank statuses.','Also removes useful marks and oil setups.'],
 ['Buried Gift','mine','Hazard',42,.85,1,'Plants a proximity charge; either tank can trigger it after the next shot.','Mine remains dangerous to its owner.'],
 ['Oil Slick','oil','Hazard',54,.1,1,'Leaves flammable oil that magnifies the next nearby fire impact.','The enemy can ignite your setup against you.'],
 ['Etching Pool','acidpool','Hazard',46,.2,1,'Leaves a corrosive pool that punishes tanks staying nearby for three shots.','Area denial is temporary and affects both players.'],
 ['Blackout','emp','Control',58,.2,1,'Strips nearby shields and freezes movement for two shots.','Deals little direct damage.'],
 ['Gravity Well','vortex','Control',65,.25,1,'Pulls nearby tanks toward the landing point.','Can rescue an opponent from a bad position.'],
 ['Shock Piston','repulsor','Control',64,.25,1,'Pushes nearby tanks away from the impact.','May fling a target into a stronger firing position.'],
 ['Phase Anchor','blink','Utility',30,0,1,'Relocates your tank to the landing column above its highest solid surface.','Bad aim can move you beside an armed mine.'],
 ['Exchange','swap','Control',35,0,1,'Swaps both tanks when the impact lands within 75 pixels of the enemy.','You inherit their terrain predicament.'],
 ['Return Receipt','boomerang','Wildcard',38,.85,1,'A shell that reverses horizontal flight after half a second.','Predict its return or hit yourself.'],
 ['Bank Shot','ricochet','Wildcard',34,.9,1,'Bounces twice against the terrain before detonating.','Slopes can reflect the shell toward you.'],
 ['Orbital Parcel','skyfall','Offense',31,.6,4,'Impact marks a column for four descending orbital rounds.','A roof can intercept the follow-up.'],
 ['Carpet Stitch','carpet','Offense',22,.4,9,'Rakes a broad surface strip with sequential impacts.','Each explosion is weak and can catch you.'],
 ['Prism Beam','laser','Offense',13,.7,1,'A straight beam ends at the first terrain or tank contact.','Terrain cover blocks the beam.'],
 ['Rail Spike','rail','Offense',18,.85,1,'A piercing straight shot tunnels through terrain along a limited range.','No ballistic arc and a narrow scoring corridor.'],
 ['Briar Pod','seed','Terrain',34,.1,5,'Grows five jagged soil pillars across the landing area.','Growth can block both tanks.'],
 ['Tax Collector','siphon','Control',50,.5,1,'A close impact steals up to 25 points of the enemy shield and adds it to yours.','No shield to steal means a weak blast.'],
 ['Party Favor','dud','Wildcard',12,.08,1,'Mostly confetti, with a tiny blast and a useful payload.','Intentionally poor scoring; use its payload creatively.'],
 ['Last Laugh','kamikaze','Wildcard',88,1.4,1,'Explodes at your own tank rather than the target.','Usually hurts you more. Only useful at close quarters.'],
 ['Mystery Box','roulette','Wildcard',45,.8,1,'A deterministic fuse opens as a jackpot, a dud, or a return-to-sender explosion.','The outcome is unknown until impact.'],
];

const supportPayloads = {
    frost:['Freezes other tanks in the support field and extinguishes fire.','The firing tank is excluded from this freeze.'],
    acid:['Corrodes other nearby tanks for two shots; later hits deal 35% more damage.','The firing tank is excluded from this corrosion.'],
    ion:['Preserves your shield while discharging other tanks and arcing to other marked armor.','Small blast area; the firing tank is excluded from the support discharge.'],
    foam:['Cleanses your tank and adds 30 shield points.','Other nearby tanks are coated and slowed, never shielded.'],
    magnet:['Marks other nearby armor for two shots, attracting guided ordnance and ion arcs.','Does not bypass terrain; the firing tank is excluded from this mark.'],
};
const supportText = (family,payload,index) => ['shield','repair','cleanse'].includes(family[1])&&supportPayloads[payload.key]
    ? supportPayloads[payload.key][index] : index===0?payload.detail:payload.risk;

export const expansionCatalog = families.flatMap((f, familyIndex) => payloads.map((payload, payloadIndex) => ({
    id:30 + familyIndex * payloads.length + payloadIndex,
    name:`${payload.name} ${f[0]}`, behavior:f[1], category:f[2], radius:f[3], strength:f[4], count:f[5],
    description:`${f[6]} ${supportText(f,payload,0)}`, warning:`${f[7]} ${supportText(f,payload,1)}${f[1]==='cleanse'&&payload.key==='fire'?' Existing hazards are cleared first, then fresh flames remain; move away before the next shot.':''}`,
    type:['shield','repair','cleanse','kamikaze'].includes(f[1]) ? 2 : 0,
    payload,
})));
