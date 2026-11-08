// Art direction is per registered weapon. Each cell is an independent physical
// composition: main volume / secondary material / residue. No ID/name seed or
// palette substitution can supply a missing weapon. The compiler resolves each
// into owned geometry, keyframes and a separate texture file.
const original=`
Single Shot=slug/shrapnel/scuff
Big Shot=cap/shoulder/slag
3 Shot=trident/pellet/cinder
5 Shot=hand/casing/grit
Jackhammer=piston/teeth/pitted
Heatseeker=comet/fin/char
Tracer=needle/bead/mist
Pile Driver=shaft/plates/talus
Dirt Mover=furrow/clod/berm
Crazy Ivan=whorl/casing/dust
Spider=branch/pellet/tar
Sniper Rifle=penetrator/nail/scuff
Magic Wall=pillar/clod/grit
Dirt Slinger=fan/clod/mound
Zapper=corona/electrode/filings
Napalm=sheet/tongue/smolder
Hail Storm=shower/spikes/frost
Ground Hog=burrow/slab/talus
Worm=twist/teeth/grit
Homing Worm=hook/ore/dust
Skipper=skip/puck/scuff
Chain Reaction=bead/vents/pitted
Pineapple=pineapple/petals/casing
Firecracker=staccato/cinder/char
Homing Missile=rocket/slag/ash
Dirtball=mound/clod/grit
Tommy Gun=belt/casing/scuff
Mountain Mover=quarry/slab/talus
Scatter Shot=rosette/pellet/dust
Cruiser=roller/plates/grit
`;
// The 37 rows follow the append-only 30–399 catalog. Ten individually authored
// compositions in payload order; these are data entries, not runtime templates.
const expansion=`
cap-shrapnel-scuff tongue-cinder-smolder crown-shards-frost splash-drop-etch corona-electrode-charge quarry-slabs-talus vein-beads-drained foam-bubbles-suds poles-filings-ore splitcap-slag-char
pod-petals-casing firebuds-cinder-ash crystalpetals-flakes-frost spray-droplets-pool star-electrode-filings clodfield-slab-grit inward-beads-gel bubblepod-suds-foam magnetite-needles-ore emberpod-casing-smolder
anvil-plates-scuff geyser-tongues-char icefountain-shards-frost cauldron-splash-etch column-electrode-charge shaft-boulder-talus siphon-droplets-drained canopy-foam-suds horseshoe-ore-filings mushroom-slag-ash
belt-pellets-scuff staccato-firebuds-char icebelt-spikes-frost gutter-drops-etch battery-electrode-charge furrows-clod-grit tendrils-beads-drained foamrows-bubbles-suds parallel-filings-ore firefront-casing-smolder
lance-teeth-swarf torch-lava-char auger-spikes-frost nozzle-splash-etch coil-electrode-charge bore-slabs-talus barb-droplets-drained pipe-foam-suds borecore-filings-ore lancefront-slag-char
burrow-segments-grit fireworm-tongues-smolder iceworm-shards-frost stream-drops-etch railcells-electrode-charge tunnel-slabs-talus veinsegments-beads-drained foamworm-bubbles-suds oretrain-filings-magnetite linkedcharges-casing-ash
fault-plates-talus lavafront-tongue-char fissure-shards-frost channels-drop-etch zigzag-electrode-charge strata-slabs-grit rootveins-beads-drained foamfault-suds-bubbles brokenpoles-filings-ore crackedcap-slag-smolder
furrow-nails-scuff lowfront-tongues-char icetrench-spikes-frost gutter-spray-etch comb-electrode-charge trench-clod-talus rootcut-beads-drained foamtrench-bubbles-suds rake-filings-ore trenches-casing-char
quarry-boulders-dust cauldron-lava-smolder iceberg-shards-frost basin-splash-etch discharge-electrode-charge scoop-slabs-talus sinkveins-beads-drained foamquarry-suds-bubbles orebed-filings-magnetite hollowcap-slag-ash
shaft-piston-scuff chimney-tongues-char icicle-shards-frost well-drops-etch rod-electrode-charge sinkhole-slabs-talus downvein-beads-drained wellfoam-bubbles-suds lodestone-filings-ore deepcap-casing-smolder
wall-plates-grit firewall-tongues-char icewall-spikes-frost curtain-drops-etch barrier-electrode-charge rampart-clod-talus veinwall-beads-drained foamwall-bubbles-suds orevert-filings-magnetite chargedwall-casing-ash
roof-shellplates-dust oven-tongue-char iceroof-flakes-frost rainroof-drops-etch shieldcells-electrode-charge arch-slabs-talus veincanopy-beads-drained foamroof-suds-bubbles ferroarch-filings-ore shellcap-casing-smolder
berm-clod-grit hearth-cinder-char iceberm-shards-frost mudbank-splash-etch bermcells-electrode-charge mound-slabs-talus rootmound-beads-drained foambank-bubbles-suds oremound-filings-magnetite rubblecap-slag-ash
pad-plates-scuff hotplate-lava-char icepad-flakes-frost puddle-splash-etch padcells-electrode-charge pedestal-clod-talus rootpad-beads-drained foampad-bubbles-suds orepad-filings-magnetite liftcap-casing-smolder
bridge-girder-grit firebridge-tongues-char icebridge-spikes-frost spillway-spray-etch bridgecells-electrode-charge span-slabs-talus veinspan-beads-drained foamspan-suds-bubbles ferrospan-filings-ore chargedspan-casing-ash
shield-plates-charge hearthcap-embers-char iceaegis-flakes-frost film-drops-etch cellshield-electrode-charge rockshield-slabs-dust veinshield-beads-drained pillow-foam-suds ferroshield-filings-ore splitshield-casing-smolder
patch-bolts-scuff warmcap-embers-char icepatch-flakes-frost wash-drops-etch chargepack-electrode-charge soilpatch-clod-grit returnvein-beads-drained foampatch-bubbles-suds armor-filings-ore hotpatch-slag-smolder
fan-grit-mist flamerake-cinder-ash frostfan-flakes-frost solvent-spray-etch ionfan-electrode-charge sandfan-clod-dust purgevein-beads-drained cleansingfoam-suds-bubbles polefan-filings-ore burstfan-casing-char
mine-pellet-grit buriedflame-tongues-char icemine-spikes-frost vialmine-splash-etch cellmine-electrode-charge stonemine-slab-talus barbmine-beads-drained foammine-bubbles-suds ferricmine-filings-ore fusedmine-casing-smolder
oil-puddle-tar slickflame-tongues-char icefilm-flakes-frost acidfilm-drops-etch chargefilm-electrode-charge gritfilm-clod-dust veinfilm-beads-drained sudsfilm-bubbles-foam ironfilm-filings-ore burningfilm-slag-char
pool-rind-scuff boilingpool-lava-char frostpool-spikes-frost etchpool-splash-etch cellpool-electrode-charge basinbed-slabs-talus leechpool-beads-drained foampool-suds-bubbles orepit-filings-magnetite volatilepool-casing-smolder
pulse-plates-charge heatpulse-cinder-char icepulse-flakes-frost solventpulse-spray-etch blackout-electrode-charge faultpulse-slabs-talus drainpulse-beads-drained foampulse-bubbles-suds polepulse-filings-ore fusepulse-slag-char
vortex-boulder-dust firewhorl-tongues-smolder icewhorl-shards-frost drain-splash-etch chargewhorl-electrode-charge rockwhorl-slabs-talus siphonwhorl-beads-drained foamwhorl-suds-bubbles lodestonewhorl-filings-ore blastwhorl-casing-ash
piston-plates-scuff firepiston-cinder-char icepiston-spikes-frost jetwash-spray-etch chargepiston-electrode-charge ram-slabs-talus veinram-beads-drained foampiston-bubbles-suds poleram-filings-ore splitpiston-slag-smolder
fold-plates-mist firefold-tongues-char icefold-flakes-frost liquidfold-drops-etch phasecells-electrode-charge rockfold-clod-dust veinfold-beads-drained foamfold-suds-bubbles ferrofold-filings-ore splitfold-casing-ash
paired-plates-mist pairedflame-cinder-char pairedice-shards-frost paireddrop-splash-etch exchanger-electrode-charge pairedrock-slabs-talus pairedvein-beads-drained pairedfoam-bubbles-suds pairedpole-filings-ore pairedcap-slag-smolder
hook-shrapnel-scuff firehook-tongues-char icehook-spikes-frost liquidhook-drops-etch chargehook-electrode-charge rockhook-clod-talus returnhook-beads-drained foamhook-suds-bubbles polehook-filings-ore fusedhook-casing-ash
puck-pellets-scuff firepuck-embers-char icepuck-shards-frost wetpuck-splash-etch chargepuck-electrode-charge rockpuck-slabs-grit veinpuck-beads-drained foampuck-bubbles-suds orepuck-filings-magnetite splitpuck-casing-smolder
asteroid-shrapnel-ash meteor-cinder-char hail-shards-frost rain-drops-etch skycells-electrode-charge rockfall-boulders-talus fallingvein-beads-drained foamfall-suds-bubbles skyore-filings-magnetite cometfall-casing-smolder
rake-casing-scuff carpetfire-tongues-char icecarpet-spikes-frost liquidcarpet-spray-etch chargecarpet-electrode-charge surfacefault-clod-talus veincarpet-beads-drained foamcarpet-bubbles-suds orecarpet-filings-magnetite fusedcarpet-slag-char
prism-nails-scuff heatray-cinder-char iceprism-shards-frost liquidprism-drops-etch laserfocus-electrode-charge rockprism-slab-talus drainprism-beads-drained foamprism-suds-bubbles ferroprism-filings-ore splitprism-casing-ash
penetrator-slivers-scuff hotrail-slag-char icerail-spikes-frost acidrail-spray-etch railfocus-electrode-charge orepenetrator-slab-talus drainrail-beads-drained foamrail-bubbles-suds ferrospike-filings-ore fusedrail-casing-smolder
roots-branch-grit emberseed-firebuds-char iceroot-spikes-frost acidroot-splash-etch ionroot-electrode-charge stoneroot-clod-talus rootheart-beads-drained foamroot-bubbles-suds oreroot-filings-magnetite fusedroot-slag-ash
clamp-beads-drained fireclamp-embers-char iceclamp-flakes-frost wetclamp-drops-etch chargeclamp-electrode-charge rockclamp-slabs-talus siphon-beads-gel foamclamp-suds-bubbles poleclamp-filings-ore fuseclamp-casing-smolder
confetti-pellets-paper sputter-cinder-char snowdust-flakes-frost fizz-drops-etch sparkdust-electrode-charge dustball-grit-talus jelly-beads-drained partyfoam-bubbles-suds metalconfetti-filings-ore popping-casing-ash
hull-plates-scuff firehull-tongues-char icehull-shards-frost wetwreck-splash-etch chargehull-electrode-charge rockhull-boulders-talus drainedhull-beads-gel foamhull-suds-bubbles ferrohull-filings-ore warhead-slag-smolder
box-tiles-scuff firebox-cinder-char icebox-spikes-frost wetbox-drops-etch chargebox-electrode-charge rockbox-clod-talus drainbox-beads-gel foambox-bubbles-suds orebox-filings-magnetite splitbox-casing-ash
`;
const returning=`
Jump Jets=jet/ash/landing
Digger=boring/nails/swarf
Bouncy Dirt=rubber/clod/rubberbed
Bouncy Wall=rubberwall/plates/rubberbed
Nuke=mushroom/stem/moat
Mega Nuke=doublecap/undercut/slag
Laser=needle/corona/scorch
Super Laser=railfocus/column/scorch
Railgun=penetrator/ore/swarf
Crater Maker=quarry/shoulder/talus
Big Dirtball=heaped/clod/mound
Dome Protect=arch/canopy/grit
Shield=shield/cellshield/charge
Glue Bomb=gel/strings/gluebed
Well Digger=well/roofslot/grit
Boomerang=hook/crescent/scuff
Minigun=belt/rounds/casings
10 Shot=fan/shells/scuff
Meteor Shower=asteroid/comet/shower
Magic Forest=roots/canopy/soil
Pedestal=pedestal/pillar/clod
Gravity Well=vortex/rocks/filings
Magnet=horseshoe/poles/magnetite
Lemon=rind/pip/paper
Golden Bullet=ingot/glints/coin
Acid Rain=rain/drops/etchpool
Acid Bombs=pod/droplets/etch
Fission Bomb=splitcap/linkedcharges/char
Flamethrower=flamecone/firebuds/smolder
Fireball=firecap/tongues/firevent
Earth Mover=quarry/scoop/boulders
Tunnel=tunnel/struts/talus
Backfire=backdraft/fold/ash
Black Forest=rootveins/canopy/etch
Bubble Wrap=bubblepack/canopy/suds
Cheap Shot=parcel/shutters/scuff
Tractor Beam=chargewhorl/clamp/filings
Freeze Ray=iceprism/needle/frost
Bunker Buster=lance/armorpeel/swarf
Oil Slick=oil/slickflame/tar
Evac=phasecells/veil/mist
Rampart=rampart/pedestal/foam
Bridge=span/girder/dust
Strip Mine=trench/quarry/talus
Displacer Beam=railfocus/polefan/filings
Mud Pie=clodfield/soil/mound
Pin Cushion=pincushion/needles/charge
Laser Battery=battery/corona/charge
Cannon Ball=ball/plates/scuff
Wacky Tank=whorl/hull/scrap
Late Bloomer=burrow/fountain/shrapnel
Fire Bolt=torch/comet/char
Color Bomb=rosette/pellets/casing
Potholes=pitmouths/furrows/pitted
Popcorn=kernel/popping/char
Sprinkler=fountain/pellets/scuff
Super Tracer=quill/beads/mist
Super Skipper=skip/puck/rubble
Super Zapper=electrode/corona/charge
Cruball=roller/clod/mound
Mega Cruiser=roller/shoulder/slag
Roller=ball/swarf/grit
Heavy Roller=boulder/plates/talus
Flash Blast=flare/shoulder/scorch
Pillow Fight=pillow/tufts/foam
Sink and Swim=shaft/splash/waterline
Hotfoot=lowfront/cinder/smolder
Ambush=buriedflame/quill/scuff
Beehive=hive/pellet/casing
Blast Off=jet/column/ash
Fire in the Hole=chimney/firevent/char
Lob-o-Matic=lobes/casing/slag
Rainbow Dirt=canopy/clod/soil
Ground Shocker=surfacefault/electrode/fulgurite
Lodestones=lodestone/ore/filings
Particle Bomb=cloud/pellets/charge
Buckshot=fan/nails/scuff
Quad Missile=rocket/fins/shrapnel
Carpet Bomb=carpetfire/casings/scuff
Skimmer=skip/sheet/spray
Volcano=eruption/lava/pumice
Fire Storm=firefront/embers/char
Roman Candle=candle/cinder/smolder
Flying Digger=boring/wings/swarf
Comet=comet/asteroid/ash
Sunburn=flare/heatrays/scorch
Riptide=breakingwaves/tendrils/waterline
Buzzsaw=saw/teeth/swarf
Static Ball=ball/corona/charge
Mystery Bombs=box/linkedcharges/casing
Flower Power=rosette/petals/roots
Turn and Burn=firehook/backdraft/char
Old Faithful=geyser/waterjet/soil
Bouncy Bomb=ball/spring/scuff
Chaos Grenade=grenade/errantfan/casing
Tar Ball=tarball/drops/tar
Lightning Strike=stormcell/electrode/fulgurite
Porcupine=quill/needles/pitted
Power Grid=batteryfan/rails/charge
Shadow Blast=hollowcap/veil/scorch
X-Ray Cannon=railcells/prism/scorch
Bazooka=rocketcone/slag/scuff
Lucky Shot=ingot/popping/coin
Shelter=roof/archcover/soil
Fire + Ice=fireice/shards/smolder
Anvil=anvil/impactanvil/anvilprint
Flare=flare/fountain/cinder
Super Flare=flare/skycap/ash
Fracture=fissure/slabs/talus
Claymore=fan/slivers/pitted
Phantom=veil/lens/mist
Flak=shrapnel/billows/casing
Flea Circus=popcorn/pellets/pitted
Super Star=star/corona/charge
Drillers=auger/groundforks/swarf
Gamma Blaster=chargecap/fissure/etch
Hot Potato=kernel/firecap/char
Funnel=funnel/drop/pool
Crazy Wall=crookedwall/brace/grit
Burnt Popcorn=charredkernel/cinder/char
Fireworks=rosette/cinder/smolder
Super Nova=star/mushroom/ash
Great Wall=wall/brace/soil
Snowblower=snowfan/flakes/frost
Lava Cannon=lavajet/slag/moltencrust
Solar Flare=heatrays/corona/scorch
Stinger=needle/barb/etch
Mega Reaction=bead/linkedcharges/smolder
Ant Farm=burrow/branch/talus
Sonic Blast=compression/shoulder/dust
Rockslide=rockfall/slab/talus
Lightning Rod=rod/stormcell/fulgurite
Star Dust=star/grit/charge
Water Balloons=balloon/splash/wetpuddles
Snowballs=snowball/flakes/frost
Sledgehammer=sledge/plates/pitted
Collide-o-scope=paired/prisms/glass
Neon Blast=plasma/corona/charge
Island=island/root/soil
Melt Down=cauldron/lava/moltencrust
Streamers=ribbon/tendrils/paper
Mass Driver=anvil/asteroid/talus
Molten Plastic=gel/lava/tar
Spinner=rotor/chargefan/charge
Flying Discs=discs/electrode/filings
Phaser=phasebeam/prisms/scorch
Shredder=comb/slivers/swarf
Aqua Bomb=watercap/droplets/wetpuddles
Lava=lava/pool/moltencrust
Bouncy Ball=ball/rubber/rubberbed
Laser Strike=column/laserfocus/scorch
Whiplash=whip/hook/scuff
Fuzz Ball=fuzz/tufts/dust
Burning Rubber=rubber/tongues/tar
Side Kick=wedge/pellets/scuff
Blockade=barricade/pods/soil
Stun Gun=prongs/corona/charge
Tornado=funnel/dust/rocks
Thor's Hammer=stormhammer/stormcell/fulgurite
Stampede=roller/rounds/grit
Hot Coals=coals/cinder/char
Fizz Bombs=fizz/bubbles/etch
Graviton=lens/inward/ore
Firefly=firebug/embers/smolder
Glue Storm=curtain/strings/gluebed
Glue Gun=nozzle/gel/gluebed
Run 'n' Gun=drone/wings/casings
Scorcher=flamerake/slag/scorch
Saucer Attack=saucers/corona/filings
Smoke Bomb=billow/cloud/ash
Nanobots=nanocloud/chips/filings
Phase Missile=rocket/phasecells/mist
Gyro Glue=whorl/strings/gluebed
Warp Gate=fold/phasecells/veil
Tesla Coil=coil/electrode/fulgurite
Magic Beans=beanroots/beanstalk/canopy
Grab Bag=parcel/pods/paper
Sand Storm=whorl/sand/grit
Chroma Blaster=prisms/shrapnel/charge
Cauldron=cauldron/firevent/char
Zipper=seam/teeth/swarf
Chalk Dust=dust/tufts/grit
Mower=comb/clod/soil
Trailblazer=fireworm/lowfront/char
Bulldozer=plow/clod/berm
Lead Balloon=balloon/plates/talus
Dive Bomb=wedge/shells/slag
Toaster=ovenbars/toastshards/char
Time Bomb=chargepack/fuse/casing
Burn Barrel=drum/tongues/smolder
Char=smolder/cinder/ash
Pop Rocket=rocket/popping/char
Sky Strike=skycells/rods/scorch
Power Washer=waterjet/spray/wetpuddles
Blackout=blackout/coil/charge
Space Laser=skycap/laserfocus/scorch
Bushwhack=needlehedge/roots/soil
Repeater=belt/slug/casings
Puddle Jumper=skip/splash/wetpuddles
Elevator=lift/column/soil
Breakout=splitwall/plates/rubble
Orbiter=orbit/cells/charge
Bouncy Tunnel=tunnel/rubber/rubberbed
Barrage=rows/shells/scuff
Fire Hose=nozzle/flamecone/smolder
Bumpers=rubber/pads/grit
Web=strings/knots/gluebed
Blowtorch=torch/lavajet/scorch
Mudslide=landslide/mudbank/soil
Party Popper=confetti/popping/paper
Torpedo=torpedo/wake/splash
Dazzler=prisms/glints/charge
Trick Shot=hook/skip/scuff
Glue Stick=gluestick/gel/gluebed
Bubble Blast=blisters/bubbles/suds
Spectra Laser=splitprism/prisms/scorch
Leap Frog=skip/spring/landing
Cluster Bombs=pod/shells/casing
Showdown=paired/pistols/casings
Corkscrew=helix/teeth/swarf
Booster Rocket=rocket/heavyjet/ash
Hedge=needlehedge/branches/soil
Quicksand=sinkhole/sand/soil
Laser Tracer=needle/chargefan/mist
Shock Wave=compression/slabs/dust
Gummy Worms=worm/gel/gluebed
Jump Rope=loop/ribbon/scuff
Super Funnel=funnel/tendrils/pool
Bunker=bunkerplates/roof/soil
Ice Crush=iceberg/icefang/frost
Liquid Nitrogen=fountain/frostmist/frost
Flash Freeze=icecrown/frostmist/frost
Avalanche=snowcap/rockfall/frost
Snow Drift=snowbank/flakes/frost
Bonfire=firecap/tongues/embers
Eruption=eruption/lavajet/slag
Blaze=firefront/flamecone/char
Heat Lamp=heatrays/flare/scorch
Zinger=prongs/needle/charge
Space Cannon=asteroid/slug/scuff
Pulsar=pulse/corona/charge
Scrambler=whorl/gyrobody/scrap
Laser Grenade=grenade/cells/scorch
Gyrobots=gyroformation/cells/filings
Badger=burrow/claws/soil
Pot o' Gold=cauldron/glints/coin
Crackdown=fissure/anvil/talus
Glacier=iceberg/slabs/frost
Paddle Ball=ball/paired/scuff
Tidal Wave=wavecrest/watercap/waterline
Pounder=piston/anvil/pitted
Frostbite=icefang/shards/frost
Explode-a-Tron=core/linkedcharges/scrap
Excavator=scoop/slabs/quarryface
Plasma Orb=plasma/chargecap/charge
Bubble Gun=nozzle/blisters/suds
Star Cruiser=roller/star/slag
Lock Box=box/barricade/soil
Carbon Crawler=crawler/coal/ash
Energy Spike=rod/corona/charge
Laser Net=prismspindle/strands/charge
Tachyon Beam=railfocus/phasecells/scorch
Fire Wall=wall/tongues/char
Buzzbots=rotor/chips/filings
Wildfire=firebranches/tongues/smolder
Robotic Worm=worm/metaljaws/swarf
Hot Spring=geyser/steam/wetpuddles
Mirror Ball=ball/prisms/glass
Twist Rockets=twinrocket/helix/ash
Rubber Paint=film/rubber/rubberbed
Yo-yo=spool/loop/scuff
Cavern=arch/scoop/talus
Toy Hammer=hammer/pads/pitted
Glitter Gun=nozzle/glints/paper
Beach Ball=ball/rind/spray
Bounce House=barricade/rubber/foam
Lollipop=lolly/rind/gel
Cyclone=spiral/wedge/grit
Slingshot=fork/pellet/scuff
Hot Seat=seatflames/firevent/char
Rapids=breakingwaves/whitewater/waterline
Slammer=anvil/ram/pitted
Blender=rotorblades/shards/swarf
Robot Blimps=balloon/cells/filings
Slime Ball=slime/drops/etch
Paintball Gun=nozzle/splat/pool
Whirlwind=whorl/windfan/dust
Phoenix=firewings/feathers/ash
Sneak Attack=veil/barbs/scuff
Pipeline=pipe/gutter/soil
Super Magnet=poles/horseshoe/filings
Quantum Cube=cube/phasecells/charge
Missile Turret=silo/rocketfins/scrap
Ion Cannon=chargecolumn/electrode/scorch
Backtrack=returnhook/bead/scuff
Puzzle Box=box/tiles/scrap
Bouncy Blocker=wall/rubber/pads
Sticker Shock=barbs/electrode/charge
Barbed Wire=spool/barbs/strands
Battery=batterycell/terminals/charge
Knockback=ram/wedge/scuff
Electric Putty=gel/coil/charge
Sparkatron=core/electrode/fulgurite
Neutron Beam=railfocus/core/scorch
Zap Stix=rods/prongs/charge
Wrecker=counterweight/plates/rubble
Wiggle Worm=worm/sinewave/grit
Six Shooter=pistols/casings/scuff
Howitzer=anvil/cap/scuff
Sandstone=boulder/sand/soil
Flying Wall=barricade/wings/grit
Airburst=cloud/shrapnel/ash
Flywheel=wheel/rotor/swarf
Backflip=hook/hull/landing
Snow Cone=icecone/flakes/frost
Icicles=stalactites/shards/frost
Steamroller=roller/steam/grit
Bungee Punch=loop/ram/scuff
Sticks & Stones=branches/boulders/soil
Coin Toss=coin/glints/dust
Bombardment=rows/asteroid/scuff
Trench=furrows/plates/talus
Rebound Lasers=discs/prisms/scorch
Ricochet Rifle=needle/puck/scuff
Bumper Bowling=ball/pads/rubberbed
Reflex Missile=rocket/bankfacet/ash
Magnablobs=slime/poles/filings
Retreat=sled/backdraft/mist
Super Retreat=sled/phasecells/dust
Rocket Launch=heavyjet/rocketcone/ash
Firefight=firebuds/crossfire/char
Auto Turrets=tripods/barrels/scrap
Sinker=pairedshafts/slabs/talus
Spike Pit=pitmouths/spikes/pitted
Flash Flood=wavecrest/whitewater/waterline
Vacuum Cannon=funnel/inward/dust
Foundation=pads/blocks/soil
Stomper=stompboot/plates/pitted
Dash=wedge/heavyjet/scuff
Mineshaft=shaft/groundforks/talus
Warp Missiles=twinrocket/phasecells/mist
Bump Rockets=twinrocket/pads/scuff
Turbo Cannon=core/lance/slag
Bombs Away=bombrows/shells/scuff
Boring Missiles=lance/rocketfins/swarf
Crash Dive=wedge/hull/slag
Matter Blaster=phasecells/chargecolumn/charge
Spark Storm=stormcloud/electrode/fulgurite
Laser Bots=robotpod/legs/charge
Lava Flow=lavafront/moltenstream/char
Fix-it Foam=foampatch/suds/armor
Gravity Grenade=gyrogrenade/inward/ore
Chasm=fissure/poles/talus
Bungee Bomb=loop/warhead/scuff
Nail Gun=nailcartridge/nails/pitted
Fling=ram/sling/landing
Hover Blocks=blocks/bubblepack/suds
Booster Worm=worm/jet/ash
Concrete=slab/blocks/grit
Spin Lasers=rotorhub/prisms/scorch
Mudrunner=crawler/clod/soil
Grenade Towers=pillars/grenades/rubble
Gamma Goo=slime/blisters/etch
Barrier-Be-Gone=wash/slag/rubberbed
Sand Blast=surfacefault/sand/grit
Danger Rope=tether/barbs/scuff
Upheaval=updraft/column/charge
Topsy-Turvy=crookedwall/blocks/soil
Earthquake=surfacefault/fault/slabs
Rumbler=strata/ram/talus
`;
module.exports={original,expansion,returning};
// Individually corrected art directions where the first sketches converged on
// the same physical silhouettes. These are content changes, never hash salts.
module.exports.revisions={
 'Dirtball':'ball/clod/grit','Ion Bore Lance':'auger/electrode/charge','Unstable Bore Lance':'lancefront/teeth/char',
 'Ember Trench Cutter':'fissure/tongues/char','Ember Oil Slick':'pool/tongues/smolder','Ember Carpet Stitch':'rows/cinder/char',
 'Mountain Mover':'quarry/boulders/talus','Tremor Quarry Charge':'quarry/plates/grit','Tremor Etching Pool':'basin/ore/talus',
 'Ion Blackout':'coil/electrode/charge','Leech Field Medic':'returnvein/droplets/drained','Ferric Fault Line':'brokenpoles/needles/ore',
 'Unstable Exchange':'pairedcap/casings/paper','Ion Sinkhole':'rod/coil/charge','Rime Trench Cutter':'icetrench/flakes/frost',
 'Caustic Fault Line':'channels/tendrils/etch','Ion Field Medic':'chargepack/bolts/charge','Foam Trench Cutter':'foamtrench/spray/suds',
 'Ferric Span Kit':'ferrospan/poles/ore','Icicles':'stalactites/icefang/frost','Fire Wall':'wall/firebuds/char',
 'Ion Shell Shelter':'shieldcells/plates/charge','Rime Field Medic':'icepatch/prism/frost','Caustic Etching Pool':'etchpool/drops/tar',
 'Foam Field Medic':'foampatch/pillow/suds','Ember Field Medic':'warmcap/firebuds/char','Caustic Aegis':'film/tendrils/etch',
 'Caustic Field Medic':'wash/gel/etch','Snowblower':'snowfan/snowball/frost','Ion Oil Slick':'chargefilm/coil/charge',
 'Leech Carpet Stitch':'veincarpet/tendrils/drained','Unstable Carpet Stitch':'fusedcarpet/slivers/char',
 'Ion Orbital Parcel':'skycells/prongs/charge','Acid Rain':'rain/tendrils/pool','Ion Rail Spike':'railfocus/prisms/charge',
 'Cheap Shot':'parcel/paper/scuff','Trick Shot':'hook/pellets/scuff','Sparkatron':'core/coil/fulgurite','Bombs Away':'bombrows/grenades/scuff',
};
// Phone-size review: distinct silhouettes for near neighbors, with the
// morphology following the weapon (shield, fission cloud, orbital rain, etc.).
module.exports.readability={
 'Fission Bomb':'mushroom/pod/slag','Ember Aegis':'field/firebuds/embers','Fire Storm':'stormcloud/tongue/embers',
 'Barrage':'crown/casings/scuff','Ember Exchange':'fold/tongue/steam','Unstable Howitzer':'doublecap/slag/char',
 'Rime Oil Slick':'pool/prism/frost','Ion Oil Slick':'pool/coil/charge','Unstable Oil Slick':'blisters/slag/smolder',
 'Backtrack':'bead/returnhook/scuff','Unstable Carpet Stitch':'fissure/linkedcharges/char','Ferric Fault Line':'fault/filings/magnetite',
 'Unstable Orbital Parcel':'asteroid/linkedcharges/smolder','Matter Blaster':'fold/chargecolumn/filings',
 'Battery':'battery/coil/filings','Reflex Missile':'hook/rocketfins/casing','Ember Orbital Parcel':'shower/firebuds/embers',
 'Quantum Cube':'cube/prisms/veil','Blaze':'tongue/flamecone/coals',
};
Object.assign(module.exports.revisions,module.exports.readability);
