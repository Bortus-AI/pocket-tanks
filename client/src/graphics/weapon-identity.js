import { expandedGeometry } from './weapon-identity-geometry';
export const ORIGINAL_WEAPON_NAMES=['Single Shot','Big Shot','3 Shot','5 Shot','Jackhammer','Heatseeker','Tracer','Pile Driver','Dirt Mover','Crazy Ivan','Spider','Sniper Rifle','Magic Wall','Dirt Slinger','Zapper','Napalm','Hail Storm','Ground Hog','Worm','Homing Worm','Skipper','Chain Reaction','Pineapple','Firecracker','Homing Missile','Dirtball','Tommy Gun','Mountain Mover','Scatter Shot','Cruiser'];
// Authored visual storyboards. Palette, damage, radius, numerical weapon IDs and
// random seeds deliberately do not participate in an animation signature.
// A shared drawing primitive is useful; a renamed or recolored story is not a
// new identity. auditWeaponIdentities reports those collisions explicitly.
const recipe = (body, trail, warning, action, aftermath, rhythm = 'strike') =>
    ({body, trail, warning, action:action.split('|'), aftermath, rhythm});

export const MECHANIC_STORIES = {
    shell:recipe('shell','streak','sight','pressure|shrapnel','scuff'),
    cluster:recipe('pod','beads','petals','petals|branches','husks','split'),
    mortar:recipe('cage','dashes','plumb','compress|crown','rim','drop'),
    barrage:recipe('cartridge','ladder','rack','rake|casings','perforations','stagger'),
    drill:recipe('auger','helix','bore','teeth|swarf','bore','travel'),
    tunnel:recipe('crawler','tracks','route','segments|teeth','struts','travel'),
    fault:recipe('stone','cracks','fault','cracks|slabs','fault','propagate'),
    trench:recipe('plow','rake','comb','rake|furrow','berms','sweep'),
    excavator:recipe('bucket','chips','scoop','scoop|slabs','scoop','collapse'),
    crater:recipe('plumb','dashes','shaft','shaft|collapse','shaft','drop'),
    wall:recipe('brick','joints','footings','courses|braces','joints','build'),
    dome:recipe('arch','ribs','arch','ribs|shellplates','arch','build'),
    berm:recipe('shovel','chips','mound','mound|contours','contours','build'),
    platform:recipe('pallet','rungs','footings','lift|braces','pallet','build'),
    bridge:recipe('girder','ties','span','span|cables','truss','build'),
    selfbridge:recipe('girder','rungs','footings','lift|span|cables','truss','span'),
    seed:recipe('seed','leaves','roots','roots|branches','roots','grow'),
    shield:recipe('plate','links','hex','hex|plates','hex','assemble'),
    repair:recipe('cross','stitches','patch','stitches|bolts','patch','assemble'),
    cleanse:recipe('fan','spray','sweep','wiper|spray','clean','sweep'),
    mine:recipe('disk','dots','tripod','legs|armed','mine','arm'),
    oil:recipe('drum','ribbon','spill','ribbon|ripples','slick','flow'),
    acidpool:recipe('vial','drops','spill','splash|etch','etch','flow'),
    emp:recipe('coil','zigzag','antenna','antenna|brokenhex|arcs','brokenhex','pulse'),
    vortex:recipe('lens','inward','focus','inward|curl','well','reel'),
    repulsor:recipe('piston','chevrons','brace','piston|chevrons','brace','thrust'),
    blink:recipe('gate','shutters','gate','shutters|fold','gate','fold'),
    swap:recipe('doublegate','crossed','doublegate','crossed|shutters','doublegate','exchange'),
    boomerang:recipe('crescent','curve','hook','hook|return','hook','return'),
    ricochet:recipe('puck','angles','facet','facet|bounce','angles','bounce'),
    skyfall:recipe('scrap','rails','column','slabs|downfall','wreck','drop'),
    carpet:recipe('rack','stitches','rake','stitches|strikes','perforations','stagger'),
    laser:recipe('prism','wire','lens','line|prism','scorch','flash'),
    rail:recipe('dart','rails','rails','rails|puncture','slots','pierce'),
    siphon:recipe('clamp','tether','clamp','tether|returnbeads','drained','reel'),
    dud:recipe('paper','sputter','fuse','sputter|confetti','paper','fizzle'),
    kamikaze:recipe('charge','fuse','cage','cage|splinters','hull','collapse'),
    roulette:recipe('cube','tiles','shutters','shutters|tiles','cube','shuffle'),
    rubber:recipe('tube','springs','coat','springs|film','springs','bounce'),
    rubberwall:recipe('block','springs','footings','courses|springs','joints','build'),
    glue:recipe('nozzle','strings','strings','strings|web','strings','stretch'),
    jump:recipe('jet','exhaust','jets','jets|chevrons','scorch','thrust'),
    selfdome:recipe('arch','ribs','footings','ribs|arch','braces','build'),
    selfrubberdome:recipe('bubble','springs','arch','springs|ribs','bubbles','build'),
    well:recipe('auger','ladder','plumb','shaft|swarf','ladder','rise'),
    pedestal:recipe('column','joints','footings','lift|courses','column','build'),
    randomblink:recipe('gate','shutters','compass','compass|fold','gate','fold'),
    longtunnel:recipe('crawler','tracks','route','segments|rungs','struts','travel'),
    cheapshot:recipe('parcel','stamps','stamp','stamp|shutters','parcel','deliver'),
    golden:recipe('ingot','glints','coin','coin|facets','coin','reveal'),
    spread:recipe('fork','fork','fan','fan|stitches','rake','fan'),
    stream:recipe('belt','ladder','rack','rack|casings','belt','stagger'),
    tracer:recipe('probe','dots','crosshair','crosshair|ticks','ticks','mark'),
    split:recipe('pod','branches','fork','branches|petals','husks','split'),
    proximity:recipe('sensor','dots','radar','radar|needles','sensor','arm'),
    roller:recipe('wheel','tracks','tangent','wheel|tracks','tracks','roll'),
    bouncer:recipe('spring','angles','facet','spring|bounce','angles','bounce'),
    drillburst:recipe('worm','helix','bore','segments|eruption','exit','burrow'),
    scatterbuild:recipe('brickpod','tiles','scatter','tiles|courses','rubble','scatter'),
    radiallaser:recipe('star','spokes','star','spokes|prisms','emitters','orbit'),
    orbitlaser:recipe('array','orbits','orbit','orbits|targetrays','emitters','orbit'),
    pitfall:recipe('anvil','dashes','shaft','shaft|downfall','shaft','drop'),
    pitfirebury:recipe('cauldron','embers','shaft','shaft|eruption','plug','erupt'),
    terraincoat:recipe('brush','ribbon','coat','wiper|film','film','sweep'),
    groundwave:recipe('plate','cracks','fault','slabs|ripples','fault','propagate'),
    selflaunch:recipe('jet','exhaust','jets','jets|launch','scorch','thrust'),
    selfescape:recipe('sled','tracks','escape','escape|wake','tracks','dash'),
    guided:recipe('rocket','fins','reticle','reticle|fins','fins','seek'),
    nonexcavate:recipe('flare','ribbon','shutters','shutters|rays','scorch','flash'),
    random:recipe('box','tiles','shutters','tiles|fork','box','shuffle'),
    ring:recipe('blade','teeth','teeth','teeth|blades','cuts','spin'),
    pillars:recipe('stake','roots','footings','stakes|courses','stakes','build'),
    selfshelter:recipe('canopy','ribs','arch','arch|loophole','braces','build'),
    wavecoat:recipe('brush','ribbon','contours','contours|film','film','flow'),
    groundfan:recipe('forkauger','helix','fan','fan|eruption','exits','burrow'),
    scramble:recipe('gyroscope','orbits','compass','compass|crossed','dial','shuffle'),
    sweep:recipe('comb','rails','fan','fan|line','slots','sweep'),
    projectilelaser:recipe('emitter','wire','reticle','reticle|targetrays','emitter','lock'),
    sideways:recipe('elbow','angles','elbow','elbow|rake','angles','turn'),
    force:recipe('ram','chevrons','brace','ram|chevrons','brace','thrust'),
    fuse:recipe('clock','dots','fuse','ticks|strikes','clock','countdown'),
    island:recipe('island','contours','island','scoop|island','island','separate'),
    autoturrets:recipe('capsule','bolts','tripods','legs|barrels','tripods','deploy'),
    missileturret:recipe('silo','rails','hatch','hatch|launch','silo','deploy'),
    runngun:recipe('drone','exhaust','wings','wings|strafe','casings','deploy'),
    net:recipe('spindle','strings','web','web|knots','net','stretch'),
    portal:recipe('gate','shutters','gate','gate|fold','gate','fold'),
    foam:recipe('nozzle','bubbles','beads','beads|cure','foam','inflate'),
    saw:recipe('saw','teeth','seam','blades|cuts','cuts','slice'),
    landslide:recipe('stone','chips','cracks','slabs|downfall','talus','collapse'),
};

// Each payload changes secondary geometry and its sequence, not merely hue.
export const MATERIAL_STORIES = {
    kinetic:{accent:'splinters',motion:'scatter',residue:'chips',primary:'ballistic',mass:'hotshards',hull:'metaljacket',wake:'shardwake',start:.04,spacing:.12,duration:.39},
    fire:{accent:'tongues',motion:'climb',residue:'embers',primary:'thermal',mass:'flamemass',hull:'burnerbody',wake:'flamewake',start:.1,spacing:.1,duration:.53},
    frost:{accent:'crystals',motion:'branch',residue:'facets',primary:'crystalline',mass:'icecluster',hull:'icejacket',wake:'crystalwake',start:.14,spacing:.15,duration:.6},
    acid:{accent:'drips',motion:'fall',residue:'etch',primary:'solvent',mass:'wetblob',hull:'acidampoule',wake:'wetwake',start:.21,spacing:.11,duration:.65},
    ion:{accent:'arcs',motion:'jump',residue:'contacts',primary:'staccato',mass:'ionsegments',hull:'forkelectrode',wake:'pulsewake',start:.02,spacing:.2,duration:.23},
    seismic:{accent:'strata',motion:'stagger',residue:'cracks',primary:'stratified',mass:'earthslabs',hull:'stonejacket',wake:'gravelwake',start:.12,spacing:.17,duration:.61},
    leech:{accent:'returnbeads',motion:'retract',residue:'drained',primary:'returnflow',mass:'siphonribbons',hull:'barbednose',wake:'returnwake',start:.2,spacing:.1,duration:.54},
    foam:{accent:'bubbles',motion:'inflate',residue:'foam',primary:'pneumatic',mass:'foampillows',hull:'foamcapsule',wake:'foamwake',start:.23,spacing:.12,duration:.67},
    magnet:{accent:'filings',motion:'align',residue:'poles',primary:'ferrous',mass:'ferricshards',hull:'horseshoebody',wake:'ferricwake',start:.16,spacing:.16,duration:.56},
    volatile:{accent:'fusechain',motion:'chase',residue:'casings',primary:'unstable',mass:'burstcage',hull:'twincharge',wake:'fusewake',start:.22,spacing:.08,duration:.32},
};

const named = (mechanic, body, action, aftermath, rhythm) => ({mechanic,body,action:action.split('|'),aftermath,rhythm});
export const NAMED_STORIES = {
    'Funnel':named('berm','shovel','scoop|rake|berms','struts','collapse'),
    'Blockade':named('dome','canopy','arch|ribs|shellplates','braces','build'),
    'Cavern':named('longtunnel','crawler','route|segments|pairedshafts','struts','travel'),
    'Firefight':named('proximity','duelpistols','reticle|duelshots|targetrays|casings','crossfire','duel'),
    'Puddle Jumper':named('bouncer','wheel','watersplash|bounce|ripples','wetpuddles','bounce'),
    'Leap Frog':named('selflaunch','jet','launch|targetrays|bounce','scorch','bounce'),
    'Breakout':named('selfescape','forkauger','bore|exit|jets|launch','shaft','burrow'),
    'Bunker':named('selfshelter','canopy','arch|shaft|loophole','braces','burrow'),
    'Crash Dive':named('selfescape','sled','escape|downfall|casings|shaft','shaft','drop'),
    'Jump Rope':named('stream','spindle','strings|rake|bounce','knots','stretch'),
    'Six Shooter':named('stream','cartridge','casings|bounce|puncture','casings','stagger'),
    'Coin Toss':named('random','coin','coin|shutters|facets','coin','reveal'),
    'Mirror Ball':named('orbitlaser','prism','prisms|bounce|targetrays','emitter','bounce'),
    'Rebound Lasers':named('radiallaser','lens','angles|spokes|line','slots','bounce'),
    'Backtrack':named('selfescape','rocket','puncture|escape|fins','tracks','dash'),
    'Dash':named('roller','wheel','tracks|tangent|ram','tracks','travel'),
    'Foundation':named('pillars','brick','footings|courses|braces','pallet','build'),
    'Matter Blaster':named('selfescape','atomiccage','inward|slabs|launch|pressure','scoop','compress'),
    'Upheaval':named('selflaunch','jet','shaft|jets|targetrays','groundforks','rise'),
    'Paddle Ball':named('net','wheel','tether|bounce|knots','contacts','bounce'),
    'Bungee Bomb':named('net','clamp','tether|orbits|impactanvil','anvilprint','reel'),
    'Danger Rope':named('net','spool','strings|arcs|tether|contacts','barbs','reel'),
    'Single Shot':named('shell','slug','puncture|splinters','scuff','strike'),
    'Big Shot':named('shell','ogive','compress|pressure|slabs','rim','compress'),
    '3 Shot':named('spread','trident','fork|threeprongs','threecuts','fan'),
    '5 Shot':named('spread','hand','fan|fiveprongs','fivecuts','fan'),
    'Jackhammer':named('drill','piston','piston|teeth|shaft','shaft','hammer'),
    'Heatseeker':named('guided','sensorrocket','reticle|fins|tongues','fins','lock'),
    'Tracer':named('tracer','probe','probeecho|tickfan|measuringrails','probegrid','mark'),
    'Pile Driver':named('crater','pile','ram|shaft|collapse','column','hammer'),
    'Dirt Mover':named('trench','plow','rake|slabs|berms','berms','sweep'),
    'Crazy Ivan':named('random','gyroscope','compass|hook|crossed','dial','swerve'),
    'Spider':named('net','spider','legs|web|needles','web','crawl'),
    'Sniper Rifle':named('rail','needle','line|puncture','pinhole','flash'),
    'Magic Wall':named('wall','wand','footings|courses|braces','joints','assemble'),
    'Dirt Slinger':named('scatterbuild','shovel','scoop|tiles|mound','rubble','scatter'),
    'Zapper':named('laser','fork','contacts|arcs|line','contacts','jump'),
    'Napalm':named('oil','canister','ribbon|tongues|drips','embers','flow'),
    'Hail Storm':named('skyfall','crystal','cloud|downfall|crystals','facets','rain'),
    'Ground Hog':named('tunnel','badger','claws|segments|exit','exit','burrow'),
    'Worm':named('drillburst','worm','segments|curl|eruption','bore','burrow'),
    'Homing Worm':named('drillburst','sensorworm','reticle|segments|eruption','exit','seek'),
    'Skipper':named('bouncer','puck','tangent|bounce|facet','angles','skip'),
    'Chain Reaction':named('groundwave','beadchain','fusechain|strikes|fork','perforations','chain'),
    'Pineapple':named('cluster','pineapple','scales|petals|shrapnel','husks','split'),
    'Firecracker':named('carpet','fusebundle','fusechain|sputter|stitches','paper','stutter'),
    'Homing Missile':named('guided','finrocket','reticle|fins|puncture','fins','seek'),
    'Dirtball':named('berm','clod','clod|mound|contours','mound','grow'),
    'Tommy Gun':named('stream','drummag','belt|casings|rake','casings','rattle'),
    'Mountain Mover':named('excavator','bucket','scoop|slabs|collapse','talus','collapse'),
    'Scatter Shot':named('cluster','perforatedpod','shutters|fan|splinters','husks','scatter'),
    'Cruiser':named('roller','crawler','tracks|wheel|strikes','tracks','cruise'),
    'Auto Turrets':named('autoturrets','capsule','hatch|legs|barrels','tripods','deploy'),
    'Missile Turret':named('missileturret','silo','hatch|antenna|launch','silo','deploy'),
    "Run 'n' Gun":named('runngun','drone','wings|strafe|casings','casings','deploy'),
    'Laser Bots':named('drillburst','robotpod','hatch|legs|targetrays','emitters','deploy'),
    'Fix-it Foam':named('foam','nozzle','beads|cure|patch','foam','inflate'),
    'Warp Missiles':named('portal','finrocket','gate|shutters|fins','gate','fold'),
    'Warp Gate':named('portal','doublegate','doublegate|fold|return','doublegate','exchange'),
    'Blender':named('saw','bladecage','teeth|blades|cuts','cuts','spin'),
    'Buzzsaw':named('saw','saw','teeth|wheel|furrow','swarf','roll'),
    'Rockslide':named('landslide','boulder','cracks|slabs|downfall','talus','collapse'),
    'Avalanche':named('landslide','snowcap','cracks|crown|downfall','drift','avalanche'),
    'Earthquake':named('fault','faultstone','cracks|slabs|fault','fault','propagate'),
    'Rumbler':named('groundwave','plate','strata|ram|ripples','strata','rumble'),
    'Flash Flood':named('groundwave','waterpod','crest|ribbon|wake','waterline','surge'),
    'Laser Net':named('net','prismspindle','spokes|web|contacts','net','weave'),
    'Web':named('net','spindle','legs|strings|knots','web','stretch'),
    'Barbed Wire':named('net','spool','strings|barbs|knots','barbs','stretch'),
    'Nuke':named('shell','atomic','compress|stem|cap','scorch','mushroom'),
    'Mega Nuke':named('shell','atomiccage','shutters|stem|cap|pressure','rim','doublefront'),
    'Gravity Well':named('vortex','lens','inward|lens|curl','well','reel'),
    'Gravity Grenade':named('vortex','gyrogrenade','orbits|inward|slabs','well','collapse'),
    'Tractor Beam':named('vortex','clamp','tether|arcs|returnbeads','contacts','reel'),
    'Bubble Wrap':named('selfrubberdome','bubblepack','beads|ribs|bubbles','bubbles','inflate'),
    'Lemon':named('dud','lemon','sputter|drips','rind','fizzle'),
    'Golden Bullet':named('golden','ingot','coin|facets|glints','coin','reveal'),
    'Showdown':named('selflaunch','duelpistols','crosshair|duelshots|casings','crossfire','duel'),
    'Stomper':named('selflaunch','stompboot','launch|ram|downfall','footprint','stomp'),
    'Excavator':named('excavator','excavatorbucket','scoop|bucketjaws|talus','quarryface','collapse'),
    'Magnet':named('vortex','horseshoebody','magneticpoles|filings|pullanchors','poles','reel'),
    'Laser':named('laser','opticbarrel','opticaperture|line|heatseam','scorch','flash'),
    'Laser Battery':named('radiallaser','emitterrack','batteryfan|barrels|spokes','batteryfeet','stagger'),
    'Lightning Strike':named('radiallaser','stormcell','stormcloud|forkbolt|groundforks','fulgurite','jump'),
    'Potholes':named('groundwave','potholepod','pitmarkers|pitmouths|rim','pittedground','stagger'),
    'Fracture':named('groundwave','faultstone','splitseam|slabs|crosscut','brokenstrata','propagate'),
    'Anvil':named('pitfall','anvil','anvil|downfall|impactanvil','anvilprint','stomp'),
    'Sinker':named('pitfall','anchorhead','pairedshafts|anchorlines|downfall','sunkenanchors','drop'),
    'Crazy Wall':named('scatterbuild','crookedbrick','crookedcourses|foldwall|rubble','crookedcourses','shuffle'),
    'Glue Stick':named('pillars','gluestick','stickycolumns|strings|drips','gluepillars','stretch'),
    'Water Balloons':named('groundwave','tiedballoon','balloontear|watersplash|drips','wetpuddles','split'),
    'Rapids':named('groundwave','wavecrest','wavecrest|breakingwaves|wake','waterline','surge'),
    'Spinner':named('orbitlaser','rotorhub','rotorblades|orbits|targetrays','rotorhub','spin'),
    'Plasma Orb':named('orbitlaser','plasmacell','plasmacell|plasmaloops|targetrays','plasmaloops','pulse'),
    'Stun Gun':named('spread','tazernose','electrodeprongs|arcs|contacts','electrodeprongs','pulse'),
    'Twist Rockets':named('spread','twinrocket','twistflight|fins|helix','twisttails','swerve'),
    'Nanobots':named('split','nanopod','nanocloud|nanodive|needles','nanorelicts','assemble'),
    'Gyrobots':named('split','gyrobody','gyroformation|orbits|arcs','gyrowrecks','orbit'),
    'Magic Beans':named('pillars','beanpod','beanroots|beanstalks|leaves','beanstalks','grow'),
    'Lollipop':named('pillars','lolly','candystalks|candycaps|courses','candystalks','build'),
    'Glacier':named('pillars','iceberg','iceface|icecluster|slabs','iceface','build'),
    'Frostbite':named('pillars','icefang','fangs|crystals|stakes','fangs','grow'),
    'Battery':named('bouncer','batterycell','terminals|chargepack|bounce','batterycell','countdown'),
    'Sparkatron':named('bouncer','sparkbug','sparklegs|arcs|electrodeprongs','sparklegs','rattle'),
    'Flying Wall':named('spread','barricadepod','flyingbarricade|courses|slabs','rubble','travel'),
    'Nail Gun':named('spread','nailcartridge','nailfan|needles|slots','embeddednails','pierce'),
    'Pin Cushion':named('proximity','pincushion','pinbed|needlehedge|targetrays','bentpins','inflate'),
    "Thor's Hammer":named('proximity','stormhammer','hammerhead|forkbolt|hammerarcs','hammerprint','hammer'),
    'Bunker Buster':named('drill','penetrator','armorpeel|deepbreach|bunkerplates','brokenbunker','pierce'),
    'Chaos Grenade':named('random','fracturedgrenade','hingedgrenade|errantfan|splinters','grenadepetals','shuffle'),
    'Toaster':named('nonexcavate','toasterbody','ovenbars|heatrays|toastshards','coilrack','rise'),
    'Hot Seat':named('nonexcavate','hotchair','chairframe|seatflames|ashlegs','ashlegs','climb'),
    'Lava Cannon':named('groundwave','lavanozzle','lavajet|moltenstream|firevent','moltenseam','thrust'),
    'Lava Flow':named('groundwave','lavablock','lavafront|lavablocks|moltencrust','moltencrust','flow'),
    'Mega Reaction':named('groundwave','linkedcharges','reactionnodes|fusechain|secondaryfan','reactionnodes','chain'),
    'Sledgehammer':named('pitfall','sledge','sledgearc|hammerhead|shaft','sledgeprint','hammer'),
    'Porcupine':named('sweep','quilledshell','quillback|quillfan|slots','quillfan','fan'),
    'Bazooka':named('sweep','launchertube','rocketcone|heavyjet|puncture','rocketfins','pierce'),
    'Burnt Popcorn':named('bouncer','charredkernel','charredpops|kernelhops|embers','charredpops','bounce'),
    'Firefly':named('bouncer','firebug','firewings|firebugs|tongues','firewings','weave'),
    'Time Bomb':named('bouncer','clockbomb','clockface|fuseclock|blastshutter','clockface','countdown'),
    'Bombardment':named('skyfall','bombbay','bombdoors|bombrows|downfall','bombfins','drop'),
    'Magic Forest':named('seed','branchpod','treebranches|forestcanopy|roots','treebranches','grow'),
    'Sink and Swim':named('pitfall','fountainpod','shaft|icefountain|poolrim','poolrim','erupt'),
    'Scorcher':named('guided','burningwarhead','backdraft|flamecone|heatrays','burningfins','thrust'),
    'Wildfire':named('guided','emberseed','firebranches|firebuds|flamemass','charredroots','grow'),
};

const normalized = name => String(name||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const names = new Map(Object.entries(NAMED_STORIES).map(([name,value])=>[normalized(name),value]));
const modifiers = [
    [/^super\b/i,{pre:'splitprism',post:'star',rhythm:'cascade'}],
    [/^mega\b/i,{pre:'compressioncage',post:'pressure',rhythm:'doublefront'}],
    [/^heavy\b/i,{pre:'counterweight',post:'slabs',rhythm:'compress'}],
    [/^big\b/i,{pre:'shellplates',post:'crown',rhythm:'swell'}],
    [/^black\b|shadow|phantom/i,{pre:'shutters',post:'negativecuts',rhythm:'eclipse'}],
    [/^neon|spectra|chroma|rainbow|color/i,{pre:'facets',post:'prisms',rhythm:'prismatic'}],
    [/^mirror|rebound|reflex/i,{pre:'facet',post:'return',rhythm:'reflect'}],
];

export const RULE_STORIES = {
    'apex-dive':{stage:'flight',geometry:'apexdive',motion:'drop'},
    'apex-return':{stage:'flight',geometry:'apexreturn',motion:'return'},
    chute:{stage:'flight',geometry:'parachute',motion:'float'},
    'low-skimmer':{stage:'flight',geometry:'skimmer',motion:'travel'},
    'sine-flight':{stage:'flight',geometry:'sinewave',motion:'weave'},
    'zigzag-flight':{stage:'flight',geometry:'zigzagjets',motion:'alternate'},
    'gravity-flip':{stage:'flight',geometry:'gravityflip',motion:'flip'},
    'ceiling-drop':{stage:'flight',geometry:'ceilinggate',motion:'drop'},
    'proximity-brake':{stage:'flight',geometry:'airbrakes',motion:'brake'},
    'border-wrap':{stage:'flight',geometry:'edgegates',motion:'fold'},
    'pulse-thrust':{stage:'flight',geometry:'pulsejets',motion:'pulse'},
    'contact-fuse':{stage:'contact',geometry:'fuseclock',motion:'countdown'},
    'contact-bank':{stage:'contact',geometry:'bankfacet',motion:'bounce'},
    'burrow-step':{stage:'contact',geometry:'burrowstep',motion:'travel'},
    crosscut:{stage:'resolve',geometry:'crosscut',motion:'slice'},
    'annular-moat':{stage:'resolve',geometry:'moat',motion:'separate'},
    'stair-cut':{stage:'resolve',geometry:'stairs',motion:'step'},
    'roof-slot':{stage:'resolve',geometry:'roofslot',motion:'rise'},
    'earth-plug':{stage:'resolve',geometry:'plug',motion:'drop'},
    'arch-cover':{stage:'resolve',geometry:'archcover',motion:'assemble'},
    'bridge-span':{stage:'resolve',geometry:'bridgefeet',motion:'span'},
    'rubber-bed':{stage:'aftermath',geometry:'rubberbed',motion:'bounce'},
    'glue-bed':{stage:'aftermath',geometry:'gluebed',motion:'stretch'},
    'mine-trap':{stage:'aftermath',geometry:'minetrip',motion:'arm'},
    'oil-trail':{stage:'aftermath',geometry:'oiltrail',motion:'flow'},
    'fire-vent':{stage:'aftermath',geometry:'firevent',motion:'climb'},
    'acid-reservoir':{stage:'aftermath',geometry:'acidreservoir',motion:'drip'},
    'cleanse-pulse':{stage:'aftermath',geometry:'cleansefan',motion:'sweep'},
    'shield-flip':{stage:'aftermath',geometry:'shieldtransfer',motion:'retract'},
    'inward-pull':{stage:'aftermath',geometry:'pullanchors',motion:'reel'},
    'upward-kick':{stage:'aftermath',geometry:'updraft',motion:'rise'},
    'aim-scramble':{stage:'aftermath',geometry:'scrambledial',motion:'turn'},
    'reverse-fan':{stage:'aftermath',geometry:'reversefan',motion:'return'},
    'sky-echo':{stage:'aftermath',geometry:'skyrail',motion:'drop'},
    'twin-flanks':{stage:'resolve',geometry:'flanks',motion:'separate'},
    'support-cut':{stage:'resolve',geometry:'undercut',motion:'slice'},
    'dirt-shower':{stage:'aftermath',geometry:'dirtshower',motion:'fall'},
    'wake-cut':{stage:'flight',geometry:'wakecut',motion:'travel'},
    'survey-charge':{stage:'aftermath',geometry:'surveygrid',motion:'mark'},
};

const optionStories = options => {
    const result=[];
    const add=(geometry,motion,stage='resolve')=>result.push({geometry,motion,stage});
    if(options.downhill)add('downhill','roll','flight');
    if(options.returnToShooter)add('return','return','flight');
    if(options.dirt)add('mound','grow');
    if(options.rubber)add('springs','bounce','aftermath');
    if(options.noCrater)add('nonexcavate','flash','aftermath');
    if(options.pop)add('sputter','stutter','flight');
    if(options.erase)add('wakecut','travel','flight');
    if(options.zap)add('arcs','jump','flight');
    if(options.splitMode==='homing')add('reticle','seek');
    if(options.splitMode==='laser')add('targetrays','flash');
    if(options.splitMode==='bounce')add('angles','bounce');
    if(options.splitMode==='dirt')add('tiles','fall');
    if(options.alternateFire)add('fireice','alternate');
    if(options.side)add('elbow','turn');
    if(options.gravity===0)add('rails','pierce','flight');
    if(options.pierce)add('slots','pierce');
    if(options.enemyTurret)add('enemyturret','lock');
    if(options.force)add('chevrons','thrust');
    if(options.wrap)add('edgegates','fold','flight');
    if(options.closed)add('closedarch','assemble');
    if(options.tunnel)add('loophole','slice');
    if(options.fire)add('tongues','climb','aftermath');
    if(options.scramble)add('scrambledial','turn');
    if(options.decay)add('decay','erode','flight');
    if(options.both)add('pairedshafts','drop');
    if(options.crater)add('scoop','collapse');
    return result;
};

export const weaponIdentity = (definition={}) => {
    const name=definition.weaponName||definition.name||ORIGINAL_WEAPON_NAMES[definition.weaponId??definition.id]||'',authored=names.get(normalized(name));
    const mechanic=authored?.mechanic||definition.classicMechanic||definition.behavior||'shell';
    const base=MECHANIC_STORIES[mechanic]||MECHANIC_STORIES.shell;
    const material=MATERIAL_STORIES[typeof definition.payload==='string'?definition.payload:definition.payload?.key]||MATERIAL_STORIES.kinetic;
    const modifier=authored?null:modifiers.find(([pattern])=>pattern.test(name))?.[1];
    const action=authored?.action||base.action;
    const semanticRules=definition.semanticRules||definition.mechanicalRules||[];
    const rules=semanticRules.map(rule=>RULE_STORIES[rule]&&({...RULE_STORIES[rule]})).filter(Boolean);
    const presentation=mechanic==='tracer'?'probe':['autoturrets','missileturret','runngun'].includes(mechanic)?'device':
        ['emp','shield','repair','cleanse','vortex','repulsor','siphon','blink','swap','randomblink','portal'].includes(mechanic)?'field':'physical';
    const profile={mechanic,presentation,body:authored?.body||base.body,trail:base.trail,warning:base.warning,
        action:modifier?[modifier.pre,...action,modifier.post]:[...action],aftermath:authored?.aftermath||base.aftermath,
        rhythm:authored?.rhythm||modifier?.rhythm||base.rhythm,material:{...material},rules:[...rules,...optionStories(definition.mechanicOptions||definition.options||{})],unsupportedRules:semanticRules.filter(rule=>!RULE_STORIES[rule]),authored:!!authored,
        source:authored?'named-storyboard':modifier?'mechanic-with-semantic-modifier':'mechanic-storyboard'};
    return profile;
};

export const identityTokens = profile => [profile.body,profile.trail,profile.warning,...profile.action,profile.aftermath,profile.material.accent,profile.material.residue,profile.material.mass,profile.material.hull,profile.material.wake,...profile.rules.map(rule=>rule.geometry)];
export const identitySignature = (profile,{reducedMotion=false}={}) => JSON.stringify({presentation:profile.presentation,body:expandedGeometry(profile.body),trail:expandedGeometry(profile.trail),warning:expandedGeometry(profile.warning),
    action:profile.action.map(name=>expandedGeometry(name)),aftermath:expandedGeometry(profile.aftermath),rhythm:reducedMotion?undefined:profile.rhythm,
    material:profile.presentation==='probe'?undefined:{accent:expandedGeometry(profile.material.accent),motion:reducedMotion?undefined:profile.material.motion,residue:expandedGeometry(profile.material.residue),mass:profile.presentation==='physical'?expandedGeometry(profile.material.mass):undefined,hull:expandedGeometry(profile.material.hull),wake:expandedGeometry(profile.material.wake),primary:profile.material.primary,timing:profile.presentation==='field'?undefined:{start:profile.material.start,spacing:profile.material.spacing,duration:profile.material.duration}},
    rules:profile.rules.map(rule=>({...rule,motion:reducedMotion?undefined:rule.motion,geometry:expandedGeometry(rule.geometry)}))});

export const auditWeaponIdentities = (definitions,options={}) => {
    const exact=new Map(),families=new Map(),unsupported=[];
    definitions.filter(Boolean).forEach(definition=>{
        const profile=weaponIdentity(definition),signature=identitySignature(profile,options),entry={id:definition.weaponId??definition.id,name:definition.weaponName||definition.name,source:profile.source};
        const missing=identityTokens(profile).filter(token=>!expandedGeometry(token));if(missing.length||profile.unsupportedRules.length)unsupported.push({...entry,missing:[...new Set(missing)],rules:profile.unsupportedRules});
        if(!exact.has(signature))exact.set(signature,[]);exact.get(signature).push(entry);
        const family=JSON.stringify({body:profile.body,action:profile.action,rhythm:profile.rhythm});
        if(!families.has(family))families.set(family,[]);families.get(family).push(entry);
    });
    const duplicates=[...exact.values()].filter(group=>group.length>1),nearDuplicates=[...families.values()].filter(group=>group.length>1);
    return {total:definitions.filter(Boolean).length,unique:exact.size,complete:duplicates.length===0&&unsupported.length===0,duplicates,nearDuplicates,unsupported};
};

export const assertUniqueWeaponIdentities = definitions => {
    const report=auditWeaponIdentities(definitions);
    if(!report.complete){const error=new Error(`${report.duplicates.length} repeated visual storyboards: ${report.duplicates.map(group=>group.map(entry=>entry.name).join(' / ')).join('; ')}`);error.report=report;throw error;}
    return report;
};
