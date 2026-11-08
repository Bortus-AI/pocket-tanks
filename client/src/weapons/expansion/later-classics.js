import { payloads } from './catalog';
import reference from './classic-reference.json';
import { withMechanicalRules } from './unique-mechanics';

// Later classic expansions. These are authored ports onto the remaster's
// primitives, with new timing/balance; their original names remain searchable.
const specs = new Map();
const group = (names, mechanic, key='kinetic', options={}) => names.split('|').forEach(name=>specs.set(name,{mechanic,key,options:{...options}}));
// Gravity, Fireworks, Snowball and Gold packs.
group('Gravity Well|Magnet|Super Magnet|Cyclone|Whirlwind','vortex','magnet',{radius:90,force:220});
group('Hot Potato|Bouncy Ball|Toy Hammer|Beach Ball','bouncer','kinetic',{bounces:5,rubber:true,radius:34});
group('Funnel|Super Funnel','scatterbuild','foam',{dirt:true,shots:8,spread:1.2,radius:18});
group('Crazy Wall|Great Wall|Glue Stick|Fire Wall','pillars','fire',{shots:1,range:70,radius:38});
group('Burnt Popcorn|Hot Coals|Firefly','bouncer','fire',{bounces:5,shots:8,radius:13});
group('Fireworks|Star Dust|Glitter Gun','split','kinetic',{shots:16,spread:2.6,splitMode:'bounce',radius:15});
group('Super Nova','radiallaser','ion',{shots:16,pierce:true,range:240,radius:12});
group('Snowblower|Snow Drift|Sand Storm|Paintball Gun','scatterbuild','frost',{shots:12,spread:1,dirt:true,radius:18});
group('Lava Cannon|Blaze|Blowtorch','groundwave','fire',{shots:8,pierce:true,radius:17,range:160});
group('Solar Flare|Lightning Rod|Laser Strike|Space Laser|Space Cannon','skyfall','ion',{shots:8,radius:33});
group('10 Shot|Stinger','spread','kinetic',{shots:10,spread:.8,radius:22});
group('Mega Reaction|Explode-a-Tron','groundwave','volatile',{shots:12,range:190,radius:27});
group('Ant Farm|Flower Power|Badger','drillburst','kinetic',{shots:8,splitMode:'dirt',dirt:true,radius:18});
group('Sonic Blast|Shock Wave','ring','ion',{range:105,radius:44,force:170});
group('Rockslide|Snowballs|Avalanche','roller','frost',{shots:8,bounces:3,followGround:true,radius:20});
group('Water Balloons|Aqua Bomb|Power Washer|Fire Hose|Tidal Wave|Rapids','groundwave','foam',{shots:10,range:240,radius:24,force:90});
group('Sledgehammer|Anvil|Pounder|Slammer','pitfall','kinetic',{shots:5,radius:32});
group('Collide-o-scope|Streamers|Chroma Blaster|Fuzz Ball|Pulsar','split','magnet',{shots:10,splitMode:'bounce',radius:16});
group('Neon Blast|Dazzler','ring','ion',{range:90,radius:45});
group('Island','island','seismic',{radius:55,strength:.1});
group('Golden Bullet|Pot o\' Gold','random','kinetic',{radius:16,strength:.1});
group('Melt Down|Lava|Hot Spring','pitfirebury','fire',{shots:5,radius:35});
group('Mass Driver','skyfall','seismic',{shots:1,radius:110,strength:1.6});
group('Molten Plastic|Burning Rubber|Rubber Paint','terraincoat','fire',{rubber:true,radius:80});
group('Spinner|Flying Discs|Orbiter|Saucer Attack|Robot Blimps','orbitlaser','ion',{shots:6,dwell:120,range:150});
group('Phaser|Railgun|Tachyon Beam','rail','ion',{pierce:true,range:700,radius:14});
group('Shredder|Excavator|Mower','trench','kinetic',{shots:12,radius:18});
group('Tunnel|Cavern','longtunnel','seismic',{radius:16});
group('Whiplash|Yo-yo','proximity','kinetic',{returnToShooter:true,range:75,radius:35});
// Fuzz, Tornado, Nano, Magic and Acid packs.
group('Side Kick','sideways','kinetic',{shots:6,spread:.3,side:true,radius:25});
group('Blockade|Lock Box|Bubble Wrap|Bounce House','scatterbuild','foam',{dirt:true,rubber:true,shots:12,radius:20,spread:Math.PI*2});
group('Stun Gun|Twist Rockets','spread','ion',{shots:3,spread:.18,radius:26});
group('Tornado|Graviton','roller','magnet',{followGround:true,force:230,dwell:150,radius:38});
group("Thor's Hammer|Tesla Coil|Energy Spike|Sticker Shock",'proximity','ion',{range:120,shots:7,radius:18});
group('Stampede','roller','kinetic',{shots:7,followGround:true,force:120,radius:26});
group('Fizz Bombs|Smoke Bomb|Gamma Goo','split','acid',{shots:8,splitMode:'bounce',radius:22});
group('Shield','selfrubberdome','foam',{self:true,radius:50});
group('Glue Storm|Glue Gun|Gyro Glue','terraincoat','frost',{erase:true,rubber:false,radius:105});
group("Run 'n' Gun",'runngun','kinetic',{radius:17});
group('Missile Turret','missileturret','kinetic',{radius:17});
group('Auto Turrets','autoturrets','kinetic',{radius:17});
group('Scorcher|Phoenix','guided','fire',{range:180,radius:58});
group('Tractor Beam|Vacuum Cannon','vortex','ion',{radius:115,force:280});
group('Nanobots|Buzzbots|Gyrobots','split','ion',{shots:10,splitMode:'homing',range:190,radius:16});
group('Phase Missile|Gamma Blaster|Sneak Attack','guided','magnet',{pierce:true,range:650,radius:25});
group('Warp Gate|Quantum Cube|Grab Bag','random','ion',{shots:7,radius:40});
group('Crackdown','fault','seismic',{shots:9,radius:26});
group('Magic Beans|Bushwhack|Black Forest|Lollipop|Carbon Crawler','pillars','kinetic',{shots:7,range:130,dirt:true,radius:30});
group('Lemon','dud','kinetic',{radius:5,strength:.01});
group('Acid Bombs|Slime Ball','split','acid',{shots:8,splitMode:'bounce',radius:23});
group('Cauldron|Pipeline','drillburst','acid',{shots:8,radius:25});
group('Zipper','guided','kinetic',{range:150,radius:26});
group('Chalk Dust','split','foam',{shots:14,spread:1.8,dirt:true,radius:15});
group('Trailblazer|Char','stream','fire',{shots:14,spread:.35,radius:14});
group('Bulldozer|Strip Mine','groundwave','seismic',{shots:24,range:1000,radius:20,strength:.1});
group('Lead Balloon','mortar','volatile',{radius:80,strength:1.1});
group('Dive Bomb|Bombardment','skyfall','kinetic',{shots:8,radius:32});
group('Toaster|Heat Lamp','nonexcavate','fire',{radius:85,strength:.65});
group('Time Bomb','bouncer','volatile',{bounces:5,dwell:180,radius:55});
group('Burn Barrel','roller','fire',{followGround:true,bounces:3,radius:43});
// Rocket, Laser, Party and Blast packs.
group('Pop Rocket','drillburst','kinetic',{shots:3,force:250,radius:26});
group('Sky Strike','guided','kinetic',{shots:5,range:170,radius:27,force:170});
group('Cheap Shot','cheapshot','kinetic',{radius:26,strength:.65});
group('Blackout','nonexcavate','acid',{radius:70,strength:.35});
group('Bunker Buster|Torpedo','drill','kinetic',{pierce:true,range:250,radius:40});
group('Repeater|Party Popper','split','volatile',{shots:12,splitMode:'bounce',radius:18});
group('Puddle Jumper|Leap Frog','selfescape','foam',{force:200,shots:4,radius:25});
group('Elevator|Fix-it Foam','pedestal','foam',{self:true,radius:45,rubber:true});
group('Breakout|Bunker|Crash Dive','selfescape','seismic',{self:true,force:240,shots:4,radius:36,pierce:true});
group('Bouncy Tunnel','longtunnel','foam',{rubber:true,radius:20});
group('Barrage|Cluster Bombs','split','kinetic',{shots:10,splitMode:'homing',range:180,radius:19});
group('Bumpers','pillars','foam',{shots:2,range:500,rubber:true,radius:44});
group('Web|Barbed Wire','ring','frost',{radius:65,range:90});
group('Mudslide|Electric Putty','scatterbuild','ion',{shots:8,dirt:true,radius:23});
group('Trick Shot','guided','kinetic',{bounces:4,range:150,radius:18});
group('Bubble Blast','repulsor','foam',{radius:75,force:190});
group('Spectra Laser|Laser Grenade|Laser Net','radiallaser','ion',{shots:10,range:180,radius:14});
group('Showdown','selflaunch','kinetic',{self:false,force:260,shots:2,radius:18});
group('Corkscrew','pitfall','foam',{shots:8,rubber:true,radius:30});
group('Booster Rocket|Rocket Launch','selflaunch','fire',{self:true,force:330,radius:24});
group('Hedge','pillars','kinetic',{shots:9,range:190,radius:22});
group('Quicksand','crater','seismic',{shots:7,radius:30,strength:.1});
group('Laser Tracer','tracer','ion',{shots:5,spread:.3,pierce:false,gravity:0,radius:5});
group('Gummy Worms','drillburst','frost',{shots:7,rubber:true,radius:21});
group('Jump Rope','stream','kinetic',{shots:16,spread:1.1,bounces:4,radius:15});
// Ice, Fire, Space, Plasma, Energy, Toy, Cyclone and Quantum packs.
group('Ice Crush|Flash Freeze','split','frost',{shots:14,spread:2,splitMode:'bounce',radius:17});
group('Liquid Nitrogen','roller','frost',{shots:8,followGround:true,radius:17});
group('Bonfire|Hot Seat','nonexcavate','fire',{radius:60,strength:1});
group('Eruption','pitfall','fire',{shots:6,force:220,radius:28});
group('Zinger|Scrambler|Wildfire','guided','fire',{range:220,radius:37});
group('Laser Bots','drillburst','ion',{shots:6,pierce:true,splitMode:'laser',radius:20});
group('Glacier|Frostbite','pillars','frost',{shots:8,range:145,radius:32});
group('Paddle Ball|Bungee Bomb','proximity','magnet',{returnToShooter:true,range:150,force:210,radius:34});
group('Plasma Orb','orbitlaser','ion',{shots:5,range:115,dwell:150,radius:28});
group('Bubble Gun','spread','foam',{shots:12,spread:.65,radius:18});
group('Star Cruiser','roller','ion',{followGround:true,shots:7,dwell:130,radius:20});
group('Freeze Ray','laser','frost',{radius:15});
group('Robotic Worm','drillburst','ion',{shots:5,splitMode:'laser',range:160,radius:23});
group('Mirror Ball','radiallaser','ion',{bounces:4,shots:10,range:150,radius:14});
group('Slingshot','spread','kinetic',{shots:10,spread:.65,force:-120,radius:18});
group('Blender','ring','kinetic',{range:90,radius:65,strength:1.2});
group('Backtrack','selfescape','kinetic',{self:true,shots:3,force:170,radius:27});
group('Ion Cannon','skyfall','ion',{shots:5,radius:37});
group('Oil Slick','oil','fire',{radius:55});

const descriptions = {
 vortex:'Pulls nearby tanks toward the impact point.',repulsor:'Pushes nearby tanks away from the impact.',
 rail:'Fires a narrow beam that penetrates and excavates terrain.',laser:'Fires a straight energy beam stopped by solid cover.',
 skyfall:'Calls down a timed rain of falling ordnance over the impact area.',trench:'Excavates a broad channel across the landing surface.',
 longtunnel:'Cuts a horizontal underground corridor across the battlefield.',dud:'Produces an intentionally weak pop with little scoring damage.',
 mortar:'Lobs a slow heavy shell along a high arc.',selfrubberdome:'Builds a hollow reflective shelter around your tank.',
 cheapshot:'Places an explosive parcel directly at the opposing tank.',drill:'Penetrates solid earth before detonating.',
 pedestal:'Raises your tank on a protective column.',crater:'Excavates a descending shaft beneath the impact.',
 oil:'Deposits a flammable slick at the landing point.',fault:'Opens a descending chain of cavities in the terrain.',
 randomblink:'Moves your tank to an unpredictable surface position.',bridge:'Builds a horizontal earth span across a gap.',
 sideways:'Launches an attack inward from the sides of the battlefield.',island:'Carves out an isolated shelf of earth from surrounding terrain.',
 bouncer:'Bounces repeatedly before its final blast.',roller:'Follows the terrain, rolling toward nearby tanks.',split:'Breaks into multiple independently flying warheads.',
 guided:'Steers toward nearby armor while in flight.',drillburst:'Bores through earth, then releases a secondary attack.',radiallaser:'Projects energy beams around the impact point.',
 orbitlaser:'An orbiting emitter delivers several timed laser attacks.',pitfall:'Excavates a descending sequence of cavities.',pitfirebury:'Digs a pit, ignites it, then adds a layer of earth.',
 terraincoat:'Applies a tactical coating to solid ground.',groundwave:'Sweeps a sequence of impacts along the terrain.',selflaunch:'Launches tanks through the air.',selfescape:'Combines an escape impulse with supporting ordnance.',
 nonexcavate:'Scores and applies its payload without removing the ground.',random:'Uses a seeded unpredictable outcome.',ring:'Expands a radial attack around the impact.',pillars:'Raises a pattern of terrain pillars.',
 proximity:'Activates a secondary attack when near a tank.',scatterbuild:'Scatters earth-building fragments.',stream:'Fires a repeated stream of projectiles.',tracer:'Marks a spread of aiming probes.',spread:'Fans out multiple shells.'
};
const classify = (mechanic, options) => {
    if(['random','dud'].includes(mechanic))return 'Wildcard';
    if(options.self&&['selflaunch','selfescape','randomblink'].includes(mechanic))return 'Utility';
    if(options.self||['selfrubberdome','scatterbuild','pillars'].includes(mechanic))return 'Defense';
    if(['vortex','repulsor','force'].includes(mechanic))return 'Control';
    if(options.dirt||['terraincoat','drillburst','drill','rail','trench','longtunnel','crater','fault','island'].includes(mechanic))return 'Terrain';
    return 'Offense';
};
const caveat = (mechanic, options, payload) => {
    const delivery = ['selflaunch','selfescape','randomblink'].includes(mechanic)
        ? 'Your new position may be exposed, buried, or close to a mine.'
        : ['terraincoat','scatterbuild','pillars','bridge','selfrubberdome','pedestal'].includes(mechanic)
            ? 'Terrain and cover you create can also help or trap the opponent.'
            : ['guided','proximity','roller','bouncer','split','stream','spread','sideways'].includes(mechanic)
                ? 'Returning rounds and fragments can hit the shooter; cover can intercept the attack.'
                : 'Nearby blasts and exposed firing lanes can endanger either tank.';
    return `${delivery} ${payload.risk}`;
};
const baseBehaviors=new Set(['vortex','repulsor','rail','laser','skyfall','trench','longtunnel','dud','mortar','selfrubberdome','cheapshot','drill','pedestal','crater','oil','fault']);
export const laterClassicAdaptations = reference.slice(125).flatMap((entry,index)=>{
    const spec=specs.get(entry.name);if(!spec)return [];
    const o=spec.options;
    return [{id:700+index,name:entry.name,behavior:baseBehaviors.has(spec.mechanic)?spec.mechanic:'shell',
        classicMechanic:baseBehaviors.has(spec.mechanic)?undefined:spec.mechanic,options:o,
        radius:o.radius||32,strength:o.strength??.65,count:o.shots||5,type:o.self?2:0,payload:payloads.find(p=>p.key===spec.key),
        category:classify(spec.mechanic,o),origin:'Classic expansion · adaptation',
        description:`${descriptions[spec.mechanic]||'Delivers its payload at the landing point.'} ${payloads.find(p=>p.key===spec.key).detail}`,
        warning:caveat(spec.mechanic,o,payloads.find(p=>p.key===spec.key)),fidelity:'adaptation',source:entry.source}];
});
export const laterClassicUnmapped = reference.slice(125).filter(entry=>!specs.has(entry.name)).map(entry=>entry.name);

// Later official packs, 2020–2025. Source is the publisher's news archive;
// duplicated names in that archive are represented only once.
group('Puzzle Box','random','ion',{shots:8,radius:38});
group('Bouncy Blocker','scatterbuild','foam',{shots:1,dirt:true,rubber:true,enemyTurret:true,radius:24});
group('Evac','randomblink','foam',{self:true,radius:30});
group('Battery|Sparkatron','bouncer','ion',{shots:1,bounces:7,radius:32});
group('Knockback|Bump Rockets','spread','kinetic',{shots:9,spread:.3,force:160,radius:24});
group('Rampart','pedestal','foam',{self:true,radius:40});
group('Neutron Beam','rail','ion',{range:950,pierce:true,radius:26});
group('Zap Stix|Spin Lasers','bouncer','ion',{shots:6,bounces:4,splitMode:'laser',zap:true,range:130,radius:20});
group('Wrecker|Danger Rope','proximity','magnet',{range:160,force:260,radius:35});
group('Wiggle Worm|Booster Worm','drillburst','kinetic',{shots:7,splitMode:'homing',range:190,radius:23});
group('Six Shooter','stream','kinetic',{shots:6,bounces:1,radius:22});
group('Howitzer|Reflex Missile|Turbo Cannon','guided','kinetic',{range:230,radius:35});
group('Sandstone|Concrete','scatterbuild','seismic',{shots:11,dirt:true,radius:23});
group('Flying Wall','spread','kinetic',{shots:12,spread:.7,radius:18});
group('Airburst','proximity','volatile',{range:80,radius:58});
group('Flywheel','roller','kinetic',{followGround:true,erase:true,dwell:180,force:140,radius:30});
group('Backflip|Fling','repulsor','kinetic',{force:280,radius:80});
group('Snow Cone','scatterbuild','frost',{shots:9,dirt:true,radius:24});
group('Icicles','spread','frost',{shots:8,spread:.4,pierce:true,radius:19});
group('Bridge','bridge','kinetic',{self:true,radius:35});
group('Steamroller','selfescape','seismic',{self:true,force:240,shots:7,dirt:true,radius:35});
group('Bungee Punch','proximity','kinetic',{returnToShooter:true,range:65,force:200,radius:42});
group('Sticks & Stones','split','volatile',{shots:12,splitMode:'bounce',radius:24});
group('Coin Toss','random','kinetic',{radius:44,strength:1.2});
group('Trench','trench','seismic',{shots:14,radius:24});
group('Rebound Lasers','radiallaser','ion',{shots:7,bounces:4,range:300,radius:17});
group('Ricochet Rifle','bouncer','kinetic',{bounces:7,gravity:0,radius:12,strength:1.4});
group('Bumper Bowling','roller','kinetic',{bounces:8,force:130,radius:32});
group('Magnablobs','scatterbuild','magnet',{shots:8,dirt:true,radius:20});
group('Retreat|Super Retreat','selfescape','foam',{self:true,force:300,shots:5,rubber:true,radius:30});
group('Firefight','proximity','fire',{range:100,shots:8,radius:24});
group('Sinker','pitfall','kinetic',{shots:9,both:true,radius:27});
group('Spike Pit','pitfall','kinetic',{shots:9,radius:27});
group('Flash Flood','groundwave','foam',{shots:24,range:1050,force:130,radius:28});
group('Foundation','scatterbuild','seismic',{shots:16,dirt:true,radius:25});
group('Stomper|Bombs Away','selflaunch','kinetic',{self:true,force:270,shots:6,radius:28});
group('Dash','selfescape','kinetic',{self:true,force:210,shots:5,radius:22});
group('Mineshaft|Boring Missiles|Mudrunner','drillburst','seismic',{shots:7,splitMode:'homing',range:220,radius:27});
group('Warp Missiles','guided','ion',{shots:5,range:260,wrap:true,radius:27});
group('Matter Blaster','selfescape','ion',{self:true,force:120,shots:1,radius:75});
group('Spark Storm','split','magnet',{shots:16,splitMode:'bounce',radius:20});
group('Lava Flow','groundwave','fire',{shots:17,range:360,dirt:true,radius:26});
group('Gravity Grenade','vortex','magnet',{radius:110,force:280});
group('Chasm','drillburst','magnet',{shots:8,range:170,radius:38,force:170});
group('Nail Gun','spread','kinetic',{shots:8,spread:.3,pierce:true,radius:17});
group('Hover Blocks','scatterbuild','foam',{shots:8,dirt:true,rubber:true,radius:25});
group('Grenade Towers','pillars','kinetic',{shots:2,range:80,splitMode:'bounce',radius:32});
group('Barrier-Be-Gone','terraincoat','fire',{erase:true,rubber:false,radius:110});
group('Sand Blast','groundwave','seismic',{shots:14,range:400,radius:22});
group('Upheaval','selfescape','ion',{self:true,force:200,shots:8,radius:31});
group('Topsy-Turvy','scatterbuild','seismic',{shots:10,dirt:true,spread:2.4,radius:30});
group('Displacer Beam','rail','magnet',{pierce:true,range:850,force:240,radius:27});
group('Earthquake|Rumbler','groundwave','seismic',{shots:18,range:700,force:120,radius:24});
const modernNames = `Puzzle Box|Bouncy Blocker|Evac|Sticker Shock|Barbed Wire|Battery|Knockback|Electric Putty|Sparkatron|Rampart|Neutron Beam|Zap Stix|Wrecker|Wiggle Worm|Six Shooter|Howitzer|Sandstone|Flying Wall|Airburst|Flywheel|Backflip|Snow Cone|Icicles|Bridge|Steamroller|Bungee Punch|Sticks & Stones|Coin Toss|Bombardment|Trench|Rebound Lasers|Ricochet Rifle|Bumper Bowling|Reflex Missile|Magnablobs|Retreat|Super Retreat|Rocket Launch|Firefight|Auto Turrets|Sinker|Spike Pit|Flash Flood|Vacuum Cannon|Foundation|Stomper|Dash|Mineshaft|Warp Missiles|Bump Rockets|Turbo Cannon|Bombs Away|Boring Missiles|Crash Dive|Matter Blaster|Spark Storm|Laser Bots|Lava Flow|Fix-it Foam|Gravity Grenade|Chasm|Bungee Bomb|Nail Gun|Fling|Hover Blocks|Booster Worm|Concrete|Spin Lasers|Mudrunner|Grenade Towers|Gamma Goo|Barrier-Be-Gone|Strip Mine|Sand Blast|Danger Rope|Upheaval|Topsy-Turvy|Displacer Beam|Earthquake|Rumbler`.split('|');
baseBehaviors.add('randomblink');
export const modernClassicAdaptations = modernNames.map((name,index)=>{
    const spec=specs.get(name),o=spec.options;
    return {id:1000+index,name,behavior:baseBehaviors.has(spec.mechanic)?spec.mechanic:'shell',classicMechanic:baseBehaviors.has(spec.mechanic)?undefined:spec.mechanic,options:o,
        radius:o.radius||32,strength:o.strength??.65,count:o.shots||5,type:o.self?2:0,payload:payloads.find(p=>p.key===spec.key),category:classify(spec.mechanic,o),origin:'Classic expansion · adaptation',
        description:`${descriptions[spec.mechanic]||'Delivers its payload at the landing point.'} ${payloads.find(p=>p.key===spec.key).detail}`,
        warning:caveat(spec.mechanic,o,payloads.find(p=>p.key===spec.key)),fidelity:'adaptation',
        source:name==='Rumbler'?'https://community.blitwise.com/post/beta-test-3-rumble-chasm-packs-1-week-to-rumble-release-13388365':'https://www.blitwise.com/mikes-dev-blog/category/News'};
});

// IDs and names remain unchanged. Each recipe adds rules to the actual runtime,
// and exposes the same rules to descriptions, previews and the effects renderer.
const deviceStories={
    'Auto Turrets':{
        description:'A ballistic capsule unfolds into two grounded sentries. Each fires limited-ammo bursts through a clear forward firing lane at shot boundaries, then pauses to vent accumulated heat.',
        shortDescription:'Deploys two sentries with limited ammo, forward sight and overheating. They keep firing at shot boundaries while their bases survive.',
        warning:'Bury their barrels, break their supporting ground or jam them with ion. Friendly armor can intercept their fire. A new deployment replaces your old sentries.'},
    'Missile Turret':{
        description:'A ballistic capsule erects a two-round silo. At a shot boundary it marks the enemy position; a later accepted shot launches an arcing missile at that fixed point. Terrain along the arc intercepts it.',
        shortDescription:'Deploys a two-missile silo. It marks a fixed target, then launches on a later accepted shot; cover can catch the missile.',
        warning:'Keep solid cover over its launch or flight path, jam it with ion, or remove supporting ground. The missile does not track a moving target after locking.'},
    "Run 'n' Gun":{
        description:'A ballistic capsule releases a ground-following gun drone. It advances along the terrain and strafes visible armor, alternates movement with cooling, and stops when its ammunition runs out.',
        shortDescription:'Deploys a ground-following drone that strafes, then cools. Broken slopes and cliffs can wreck it before it reaches its target.',
        warning:'Broken terrain can wreck the drone. Walls interrupt its line of fire; friendly armor can intercept its rounds. A new drone replaces your old one.'},
};
[laterClassicAdaptations,modernClassicAdaptations].forEach(pack=>pack.forEach((definition,index)=>{pack[index]=withMechanicalRules({...definition,...deviceStories[definition.name]});}));
