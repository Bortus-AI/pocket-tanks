// Per-weapon tuning for the later and modern classic packs.
//
// Several later classics were first ported as members of a shared recipe
// (one `group(...)` call in later-classics.js), which left them with identical
// mechanic, payload, radius, strength, count and options. Each entry here gives
// one weapon its own numbers, payload and description, using only options the
// classic runtime actually reads (see classic-runtime.js). `null` removes a
// shared option that the mechanic ignores. Names and IDs never change here.
//
// key: payload override. options: merged over the shared recipe.
// description: replaces the mechanic sentence (the payload detail is appended).
export const classicTuning = {
    // Bouncers (kinetic).
    'Hot Potato': {key: 'fire', options: {bounces: 4, radius: 32, strength: .75}, description: 'A scorching potato hops four times; every bounce heats it and the final blast burns.'},
    'Bouncy Ball': {options: {bounces: 8, radius: 24, strength: .55}, description: 'A small rubber ball keeps bouncing eight times before a modest final blast.'},
    'Toy Hammer': {options: {bounces: 2, radius: 38, strength: .8, rubber: null, pop: true}, description: 'A heavy toy hammer thumps the ground on each of its two bounces before a solid final strike.'},
    'Beach Ball': {options: {bounces: 6, radius: 44, strength: .45, gravity: 200}, description: 'A floaty, low-gravity beach ball drifts between six bounces and pops with a wide, soft blast.'},
    // Pillars.
    'Crazy Wall': {key: 'seismic', options: {shots: 5, range: 150}, description: 'Raises an uneven row of five earth walls of different heights.'},
    'Great Wall': {key: 'kinetic', options: {radius: 40}},
    'Glue Stick': {key: 'frost', options: {shots: 3, range: 60, radius: 34}, description: 'Plants three sticky posts close together.'},
    'Fire Wall': {options: {shots: 4, range: 90}, description: 'Raises four burning posts across the landing area.'},
    // Burning bouncers. Their former shared shot count had no effect.
    'Burnt Popcorn': {options: {bounces: 3, splitMode: 'blast', pop: true, shots: 10, radius: 16}, description: 'A charred kernel pops on each bounce, then bursts into ten burning fragments.'},
    'Hot Coals': {options: {bounces: 2, shots: 1, radius: 22, strength: .7}, description: 'A dense coal skips twice and settles into a hot blast.'},
    Firefly: {options: {bounces: 6, shots: 1, gravity: 120, radius: 12, strength: .6}, description: 'A drifting low-gravity spark wanders through six bounces before igniting.'},
    // Splitting fireworks.
    Fireworks: {key: 'volatile', options: {shots: 12, bounces: 2, radius: 16, strength: .5, spread: null}, description: 'Bursts into twelve bouncing sparks that pop again after landing.'},
    'Star Dust': {key: 'ion', options: {shots: 20, splitMode: 'blast', radius: 12, strength: .75, spread: null}, description: 'Scatters twenty tiny charged motes over a wide area.'},
    'Glitter Gun': {key: 'magnet', options: {shots: 14, bounces: 4, radius: 13, spread: null}, description: 'Sprays fourteen clinging glitter fragments that bounce four times and mark armor.'},
    // Snow and sand builders.
    Snowblower: {options: {shots: 16, fragmentRadius: 9, radius: 16, spread: null}, description: 'Blows sixteen small snow clumps that pile into low drifts.'},
    'Sand Storm': {key: 'seismic', options: {shots: 10, fragmentRadius: 14, radius: 20, spread: null}, description: 'Whips up ten sand clumps that bury nearby ground.'},
    'Snow Drift': {options: {shots: 6, fragmentRadius: 22, radius: 24, spread: null}, description: 'Drops six heavy snow drifts that can bury a tank.'},
    'Paintball Gun': {key: 'kinetic', options: {shots: 8, fragmentRadius: 10, radius: 14, rubber: true, spread: null}, description: 'Splatters eight blobs of reflective rubber paint.'},
    // Burning ground waves. Ground waves never read `pierce`.
    'Lava Cannon': {options: {shots: 6, range: 120, radius: 24, strength: .75, pierce: null}, description: 'Six lava blasts spread along the surface around the impact.'},
    Blowtorch: {options: {shots: 5, range: 60, radius: 15, strength: 1, pierce: null}, description: 'A tight, intense row of five flame cuts.'},
    Blaze: {options: {shots: 12, range: 300, radius: 15, strength: .5, pierce: null}, description: 'Twelve light fires race across a wide stretch of ground.'},
    // Falling strikes.
    'Solar Flare': {key: 'fire', options: {shots: 10, radius: 26, strength: .55}, description: 'Ten burning solar fragments rain over the impact area.'},
    'Lightning Rod': {options: {shots: 3, radius: 30, strength: 1}, description: 'Three concentrated lightning bolts strike the impact column.'},
    'Laser Strike': {options: {shots: 6, radius: 20, strength: .9}, description: 'Six narrow orbital laser pulses strike in a tight line.'},
    'Space Laser': {options: {shots: 1, radius: 40, strength: 1.3}, description: 'A single heavy orbital lance hits the impact point.'},
    'Space Cannon': {key: 'kinetic', options: {shots: 5, radius: 36, strength: .7}, description: 'Five orbital cannon shells fall over the impact area.'},
    // Volatile ground waves.
    'Mega Reaction': {options: {shots: 14, range: 260, radius: 24, strength: .5}, description: 'A long chain of fourteen unstable blasts sweeps the surface.'},
    'Explode-a-Tron': {options: {shots: 6, range: 90, radius: 30, strength: .55}, description: 'Six heavy unstable blasts in a tight cluster.'},
    // Burrowers.
    'Ant Farm': {options: {shots: 10, fragmentRadius: 10}, description: 'Burrows toward the opponent and throws up ten small dirt mounds.'},
    Badger: {options: {shots: 5, splitMode: 'blast', dirt: null, radius: 22}, description: 'Digs toward the opponent and erupts with five biting blasts.'},
    // Ion rings. Rings read `orbit` and `shots`, not `range`.
    'Sonic Blast': {options: {shots: 6, orbit: 30, radius: 50, strength: .45, force: 200, noCrater: true, range: null}, description: 'A wide ring of six sound blasts shoves tanks without digging.'},
    'Shock Wave': {key: 'seismic', options: {shots: 10, orbit: 30, radius: 30, strength: .55, force: 120, range: null}, description: 'A tight ring of ten ground shocks.'},
    // Water weapons. Foam does little damage, so strength is higher to compensate.
    'Water Balloons': {options: {shots: 4, range: 90, radius: 26, strength: 1.8}, description: 'Lobs four water balloons that splash in a tight cluster.'},
    'Aqua Bomb': {options: {shots: 1, range: null, radius: 40, strength: 1.5, force: 140}, description: 'One big splash that soaks and shoves tanks at the impact.'},
    'Power Washer': {options: {shots: 8, range: 140, radius: 14, strength: 1.2, force: 160, noCrater: true}, category: 'Utility', description: 'Utility: a high-pressure spray that strips coatings and hazards, shoves tanks, and leaves the ground intact. Light damage.'},
    'Fire Hose': {options: {shots: 6, range: 60, radius: 16, strength: 1.5, force: 240}, description: 'A narrow, high-force jet that hammers one spot and knocks tanks back hard.'},
    'Tidal Wave': {options: {shots: 14, range: 520, radius: 30, strength: 1.6, force: 120}, description: 'A wide, slow wave of fourteen surges rolls across the battlefield.'},
    Rapids: {options: {shots: 18, range: 300, radius: 12, strength: 1.4, force: 60}, description: 'Eighteen fast, light splashes rush along the surface.'},
    // Pit drivers.
    Sledgehammer: {options: {shots: 1, radius: 36, strength: .9}, description: 'One heavy blow drives a deep pit and throws a single chunk.'},
    Pounder: {options: {shots: 8, splitMode: 'bounce', radius: 18, strength: .55}, description: 'Pounds a pit and scatters eight bouncing pieces of debris.'},
    Slammer: {options: {shots: 3, radius: 28, strength: .75}, description: 'Slams a pit into the ground and throws three heavy chunks.'},
    // Magnetic splitters.
    'Collide-o-scope': {options: {shots: 12, bounces: 4, radius: 14}, description: 'Twelve kaleidoscope shards ricochet four times each.'},
    Streamers: {key: 'kinetic', options: {shots: 16, splitMode: 'blast', radius: 10, strength: .55}, description: 'Sixteen party streamers burst over a wide area.'},
    'Fuzz Ball': {key: 'foam', options: {shots: 8, bounces: 2, radius: 20, strength: 1.5}, description: 'Eight soft fuzz balls bounce and coat the area in foam.'},
    'Chroma Blaster': {key: 'ion', options: {shots: 7, splitMode: 'homing', radius: 22, strength: .8}, description: 'Seven colored charges seek the opponent after the split.'},
    Pulsar: {options: {shots: 5, splitMode: 'laser', radius: 16}, description: 'Splits into five emitters that each fire a laser pulse at the opponent.'},
    // Light rings.
    'Neon Blast': {options: {shots: 8, orbit: 32, radius: 46, strength: .5, noCrater: true, range: null}, description: 'A wide neon ring of eight flashes that scorch without digging.'},
    Dazzler: {options: {shots: 12, orbit: 25, radius: 20, strength: .45, range: null}, description: 'A tight, dazzling ring of twelve small flashes.'},
    // Burning pits. Pit depth and blast size are fixed; strength sets the heat.
    'Melt Down': {options: {radius: 40, strength: .85, shots: null}, description: 'A deep, very hot pit that keeps burning.'},
    Lava: {options: {shots: null}, description: 'Opens a lava pit, lights its floor and crusts it over.'},
    'Hot Spring': {key: 'foam', options: {strength: 1.4, shots: null}, description: 'A boiling spring digs a shaft, leaves scalding foam and caps the vent.'},
    // Coatings.
    'Molten Plastic': {options: {crater: 30, radius: 70}, description: 'Melts a small crater and lines the area with burning reflective plastic.'},
    'Burning Rubber': {options: {radius: 95}, description: 'Lays a very wide sheet of burning rubber.'},
    'Rubber Paint': {key: 'foam', options: {radius: 60}, description: 'Paints nearby ground with reflective rubber without burning it.'},
    // Orbiting emitters. They ignore `dwell`; orbit, shots and range set the pattern.
    Spinner: {options: {shots: 8, orbit: 25, range: 160, strength: .35, dwell: null}, description: 'Eight quick laser shots from a tight spinning orbit.'},
    'Flying Discs': {options: {shots: 4, orbit: 70, range: 220, strength: .6, dwell: null}, description: 'Four wide-orbit discs each fire a laser at the opponent.'},
    Orbiter: {options: {shots: 6, orbit: 95, range: 300, strength: .45, dwell: null}, description: 'Six emitters on a very wide orbit fire long-range lasers.'},
    'Robot Blimps': {options: {shots: 3, orbit: 60, range: 360, strength: .85, dwell: null}, description: 'Three slow blimps fire heavy long-range lasers.'},
    // Beams.
    Phaser: {options: {range: 600, radius: 18, strength: .8}, description: 'A heavy penetrating phaser beam with medium reach.'},
    'Tachyon Beam': {options: {range: 1100, radius: 10, strength: .5}, description: 'A thin tachyon beam that crosses the whole battlefield.'},
    // Trench cutters.
    Shredder: {options: {shots: 9, radius: 16, strength: .8}, description: 'Shreds a short, deep channel.'},
    Mower: {options: {shots: 16, radius: 12, strength: .45}, description: 'Mows a long, shallow channel across the surface.'},
    Excavator: {key: 'seismic', options: {shots: 7, radius: 26, strength: .5}, description: 'Scoops a short, very wide channel.'},
    // Returning proximity rounds.
    'Yo-yo': {options: {range: 110, radius: 32, strength: .8, shots: 3}, description: 'A yo-yo swings out and releases three blasts near a tank.'},
    // Magnetic rollers. They never read `followGround: true`.
    Tornado: {options: {speed: 3.6, dwell: 200, force: 260, radius: 34, erase: true, followGround: null}, description: 'A fast twister rips through terrain and hurls tanks it reaches.'},
    Graviton: {options: {speed: 2, dwell: 140, force: 180, radius: 42, followGround: null}, description: 'A slow, dense gravity ball rolls along the ground and pulls armor in.'},
    // Ion proximity weapons.
    "Thor's Hammer": {options: {range: 90, shots: 4, splitMode: 'blast', radius: 26, strength: .8}, description: 'Near a tank, the hammer splits into four heavy lightning blasts.'},
    'Tesla Coil': {options: {range: 160, shots: 7, splitMode: 'laser', radius: 14, strength: .5}, description: 'A long-range coil discharges seven weak arcs at the opponent.'},
    'Energy Spike': {options: {range: 70, shots: 6, splitMode: 'blast', radius: 20, strength: .7}, description: 'Close to a tank, the spike bursts into six energy blasts.'},
    'Sticker Shock': {key: 'magnet', options: {splitMode: 'bounce', bounces: 2, radius: 16}, description: 'Near a tank, it scatters seven clinging charges that bounce twice.'},
    // Acid splitters.
    'Fizz Bombs': {options: {shots: 10, bounces: 4, radius: 18, strength: .55}, description: 'Ten fizzing acid bombs bounce four times each.'},
    'Gamma Goo': {options: {shots: 6, splitMode: 'blast', radius: 28, strength: .85}, description: 'Six heavy blobs of goo burst on landing.'},
    // Glue coatings.
    'Glue Gun': {options: {radius: 70}},
    'Gyro Glue': {options: {radius: 120}},
    // Guided fire.
    Scorcher: {options: {radius: 48, strength: .7, gravity: 200}, description: 'A heavy guided firebomb with a wide burn.'},
    Phoenix: {options: {radius: 40, strength: .6, shots: 2, spread: .2}, description: 'Two guided firebirds sweep in on the opponent.'},
    // Bots.
    Gyrobots: {options: {shots: 6, radius: 24, strength: .9}, description: 'Six heavier spinning bots seek the opponent.'},
    Buzzbots: {key: 'kinetic', options: {shots: 14, radius: 12, strength: .5}, description: 'A swarm of fourteen small buzz-saw bots seeks the opponent.'},
    // Guided magnetic rounds.
    'Sneak Attack': {options: {pierce: null, radius: 30, strength: .75}, description: 'A guided round that drops onto the opponent from above.'},
    // Random outcomes.
    'Warp Gate': {key: 'magnet', options: {radius: 36}, description: 'A warp gate opens with an unpredictable result.'},
    'Grab Bag': {key: 'volatile', options: {radius: 44}, description: 'An unpredictable grab bag of ordnance.'},
    'Quantum Cube': {options: {rubber: true}, description: 'An unpredictable quantum outcome; any earth it makes is reflective rubber.'},
    // Garden pillars.
    'Magic Beans': {options: {shots: 5, range: 100}, description: 'Five beanstalks sprout around the impact.'},
    Bushwhack: {options: {shots: 9, range: 200}, description: 'A wide hedge of nine posts.'},
    'Carbon Crawler': {key: 'seismic', options: {shots: 12, range: 260, radius: 22}, description: 'A long, low line of twelve carbon spires.'},
    Lollipop: {options: {shots: 3, range: 40, rubber: true, radius: 34}, description: 'Three reflective candy posts close together.'},
    // Acid burrowers.
    Cauldron: {options: {shots: 6, splitMode: 'blast', radius: 28}, description: 'Bubbles underground and erupts with six heavy acid blasts.'},
    Pipeline: {options: {shots: 9, splitMode: 'homing', radius: 22, strength: .7}, description: 'Pipes acid underground and releases nine seeking droplets.'},
    // Fire streams.
    Trailblazer: {options: {shots: 10, radius: 16, strength: .55, spread: null}, description: 'Ten quick fireballs follow one firing path.'},
    Char: {options: {shots: 6, radius: 22, strength: .8, gravity: 220, spread: null}, description: 'Six heavy, flatter-flying fireballs follow one firing path.'},
    // Falling kinetic.
    'Dive Bomb': {options: {shots: 4, radius: 34, strength: .85}, description: 'Four dive bombers drop heavy shells on the impact area.'},
    // Ground-preserving heat.
    Toaster: {options: {radius: 60, strength: .9}, description: 'A compact, intense toast that scores without removing ground.'},
    'Heat Lamp': {options: {radius: 100, strength: .45}, description: 'A wide, gentle heat that scores without removing ground.'},
    // Volatile splitters.
    Repeater: {options: {shots: 6, splitMode: 'blast', radius: 22, strength: .6}, description: 'Six unstable shells burst again after landing.'},
    'Party Popper': {key: 'kinetic', options: {shots: 18, bounces: 2, radius: 12, strength: .45}, description: 'Eighteen confetti fragments bounce twice each.'},
    // Self movement with signature effects. These numbers feed their effect hooks.
    'Puddle Jumper': {options: {radius: 28, shots: 5}},
    'Leap Frog': {options: {radius: 22, shots: 3, strength: .4}},
    Elevator: {options: {radius: 40, rubber: null}},
    Breakout: {options: {force: 300, radius: 32}},
    Bunker: {options: {radius: 44, rubber: true}},
    'Crash Dive': {options: {shots: 5}},
    Retreat: {options: {shots: 1, radius: 20, rubber: null}},
    'Bombs Away': {options: {force: 230, erase: true, radius: 32, shots: null}, description: 'Clears the ground and launches tanks through the air.'},
    // Kinetic splitters.
    Barrage: {options: {shots: 8, radius: 22, strength: .6}, description: 'Eight guided warheads seek the opponent after the split.'},
    'Cluster Bombs': {options: {shots: 12, splitMode: 'blast', radius: 18, strength: .55, range: null}, description: 'A classic unguided cluster of twelve bomblets.'},
    // Frost and wire rings.
    Web: {options: {shots: 6, orbit: 26, radius: 44, strength: .55, noCrater: true, range: null}, description: 'A wide web of six freezing strands that does not dig.'},
    'Barbed Wire': {key: 'kinetic', options: {shots: 10, orbit: 30, radius: 40, strength: .3, noCrater: true, range: null}, description: 'A ring of ten barbed snags that does not dig.'},
    // Builders.
    Mudslide: {options: {shots: 10, fragmentRadius: 16, radius: 24}, description: 'Ten heavy mud clumps slide into place.'},
    'Electric Putty': {options: {shots: 6, fragmentRadius: 11, radius: 20}, description: 'Six charged putty blobs stick where they land.'},
    // Radial lasers.
    'Spectra Laser': {options: {shots: 12, orbit: 20, range: 260, strength: .45}, description: 'Twelve long spectral rays fan out from a small ring.'},
    'Laser Grenade': {options: {shots: 8, orbit: 10, range: 160, strength: .7}, description: 'A compact grenade fires eight strong, short rays.'},
    'Laser Net': {options: {shots: 16, orbit: 45, range: 120, strength: .35}, description: 'A wide net of sixteen short, weak rays.'},
    // Rocket launches.
    'Booster Rocket': {options: {force: 380}, description: 'A strong rocket boost throws your tank a long way.'},
    'Rocket Launch': {options: {force: 280, erase: true, radius: 28}, description: 'Clears the launch pad, then lifts your tank on a moderate burn.'},
    // Frost splitters.
    'Ice Crush': {options: {shots: 10, splitMode: 'blast', radius: 20, strength: .85, spread: null}, description: 'Ten heavy ice chunks burst on landing.'},
    'Flash Freeze': {options: {shots: 18, bounces: 2, radius: 12, strength: .45, spread: null}, description: 'Eighteen small frost shards bounce twice each.'},
    // Fires.
    Bonfire: {options: {radius: 70, strength: .9}, description: 'A wide bonfire that scores without removing ground.'},
    'Hot Seat': {options: {radius: 45, strength: 1.2}, description: 'A small, very hot seat of fire that scores without removing ground.'},
    // Guided fire variants.
    Zinger: {key: 'ion', options: {radius: 28, strength: .8, gravity: 220}, description: 'A fast guided ion dart.'},
    Scrambler: {key: 'kinetic', options: {radius: 34, strength: .6}, description: 'A guided round that scrambles nearby aim.'},
    Wildfire: {options: {shots: 3, spread: .25, radius: 24, strength: .5}, description: 'Three guided firebombs spread out toward the opponent.'},
    // Ice pillars.
    Glacier: {options: {shots: 6, range: 200, radius: 36}, description: 'Six tall ice pillars spread wide.'},
    Frostbite: {options: {shots: 5, range: 90, radius: 24, splitMode: 'blast'}, description: 'Five ice spires that shed frost shards.'},
    // Tethers.
    'Paddle Ball': {key: 'kinetic', options: {radius: 30}},
    // Vortices.
    Cyclone: {options: {force: 300, radius: 70, strength: .55}, description: 'A tight cyclone that pulls tanks in hard.'},
    Whirlwind: {key: 'kinetic', options: {force: 180, radius: 110, strength: .4}, description: 'A broad whirlwind that gently drags tanks in.'},
    'Super Magnet': {options: {force: 340, radius: 120, strength: .3}, description: 'A huge, very strong magnetic pull.'},
    // Ion bouncers.
    Battery: {options: {bounces: 4, radius: 36, strength: .8}, description: 'A heavy battery bounces four times and discharges.'},
    Sparkatron: {options: {bounces: 9, radius: 22, strength: .5, zap: true, range: 140}, description: 'A sparking ball bounces nine times and zaps a nearby opponent in flight.'},
    // Push spreads.
    Knockback: {options: {shots: 5, spread: .2, force: 240, radius: 26}, description: 'Five heavy shells that knock tanks back hard.'},
    'Bump Rockets': {options: {shots: 12, spread: .5, force: 110, radius: 18, strength: .55}, description: 'Twelve light rockets that bump tanks around.'},
    // Laser bouncers.
    'Zap Stix': {options: {shots: 4, bounces: 3, range: 170}, description: 'A stick bounces three times and splits into four laser emitters.'},
    'Spin Lasers': {options: {shots: 9, bounces: 5, range: 110, radius: 16, strength: .55}, description: 'A spinning carrier bounces five times and splits into nine laser emitters.'},
    // Wrecking.
    Wrecker: {key: 'kinetic', options: {radius: 40, strength: .75, shots: 3, splitMode: 'blast'}, description: 'Near a tank, a wrecking ball breaks into three heavy blasts.'},
    // Worms.
    'Wiggle Worm': {options: {shots: 5, radius: 26, strength: .7}, description: 'Wiggles underground, then releases five seeking blasts.'},
    'Booster Worm': {key: 'fire', options: {shots: 9, radius: 20, strength: .75}, description: 'A rocket-boosted worm surfaces with nine seeking embers.'},
    // Guided kinetic.
    Howitzer: {options: {radius: 42, strength: .8, gravity: 260}, description: 'A heavy, slow guided howitzer shell.'},
    'Reflex Missile': {options: {radius: 30, shots: 2, spread: .15}, description: 'Two guided missiles that turn back at the apex.'},
    'Turbo Cannon': {options: {radius: 26, strength: .9, gravity: 100}, description: 'A fast, flat-flying guided cannon shell.'},
    // Masonry builders.
    Sandstone: {options: {shots: 14, fragmentRadius: 11}, description: 'Fourteen small sandstone blocks scatter into cover.'},
    Concrete: {key: 'kinetic', options: {shots: 6, fragmentRadius: 20, radius: 28}, description: 'Six large concrete blocks drop into solid cover.'},
    // Repulsors.
    Backflip: {options: {force: 220, radius: 60, strength: .55}, description: 'A compact push that flips nearby tanks away.'},
    Fling: {options: {force: 360, radius: 95, strength: .4}, description: 'A wide, very strong push that flings tanks away.'},
    // Seismic burrowers.
    Mineshaft: {options: {shots: 5, splitMode: 'bounce', bounces: 2, radius: 32}, description: 'Sinks a shaft toward the opponent and erupts with five wide, bouncing rock blasts.'},
    'Boring Missiles': {options: {radius: 24, strength: .7}, description: 'Bores underground, then releases seven seeking missiles.'},
    Mudrunner: {options: {shots: 8, splitMode: 'dirt', fragmentRadius: 14, dirt: true, radius: 22}, description: 'Runs underground and throws up eight mud mounds.'},
    // Quakes.
    Earthquake: {options: {shots: 22, range: 900, radius: 26, strength: .55}, description: 'A long quake of twenty-two shocks crosses most of the battlefield.'},
    Rumbler: {options: {shots: 10, range: 360, radius: 22, strength: .75, force: 160}, description: 'A shorter, stronger rumble of ten shocks that bounces tanks.'},

    // Balance outliers.
    Blender: {options: {shots: 8, orbit: 35, radius: 44, strength: .8, range: null}, description: 'Eight spinning blade blasts orbit the impact point.'},
    Bulldozer: {options: {force: 90}, category: 'Utility', description: 'Utility: bulldozes a long strip of terrain and shoves tanks along it. Very light damage.'},
    'Flash Flood': {options: {shots: 15, range: 900, strength: 1.7}, description: 'A flood of fifteen surges washes across the battlefield and shoves tanks.'},
    Quicksand: {options: {strength: .35}, description: 'Opens a sinking shaft that swallows the target.'},
    Island: {category: 'Utility', description: 'Utility: carves an isolated shelf of earth around the target. Very light damage.'},
    'Bubble Blast': {options: {strength: 1}, description: 'A big foam bubble bursts and pushes nearby tanks away.'},
    Firefight: {warning: 'Only works if the opponent is close to the impact. The countershot uses the opponent’s current aim, so it can miss.'},
};
