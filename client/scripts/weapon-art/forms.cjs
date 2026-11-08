// Physical density/solid sketches, not icons or line art. Coordinates are
// emission-space x/y/z and radii. The texture baker shades their 3D surfaces.
// A node may stretch in x/y; no strokes, lettering or diagnostic symbols exist.
const forms={};
const node=(x,y,r,sx=1,sy=1,z=0)=>[x,y,z,r,sx,sy];
const row=(count,y,span,r)=>Array.from({length:count},(_,i)=>node((i/(count-1||1)-.5)*span,y,r));
const fan=(count,arc,radius,r,y=0)=>Array.from({length:count},(_,i)=>{const a=(i/(count-1||1)-.5)*arc;return node(Math.sin(a)*radius,y+Math.cos(a)*radius,r,.7,1.5);});
const curve=(points,r,sx=1,sy=1)=>points.map(([x,y])=>node(x,y,r,sx,sy));
const define=(name,nodes,motion='expand')=>forms[name]={nodes,motion};
// Compact blasts and billowing fluid volumes.
define('cap',[node(0,.26,.5,1.3,.8),node(-.34,.38,.31),node(.32,.5,.34),node(.02,.62,.3)],'rise');
define('shoulder',[node(-.48,.18,.4,1.15,.6),node(.43,.18,.35,1.4,.6),node(0,.08,.3)],'spread');
define('mushroom',[...row(5,.73,1.05,.28),node(0,.35,.22,.7,1.8),node(0,.04,.36,1.4,.45)],'rise');
define('doublecap',[...row(4,.88,.95,.22),...row(5,.48,1.2,.2),node(0,.18,.2,.7,1.8)],'rise');
define('stem',curve([[0,.05],[.02,.22],[-.03,.42],[.04,.65]],.2,.7,1.2),'rise');
define('billow',[node(-.2,.36,.36),node(.2,.22,.39),node(.36,.52,.25),node(-.28,.68,.28),node(.04,.8,.25)],'roll');
define('cloud',[node(0,.47,.43,1.6,.7),node(-.38,.35,.25),node(.43,.37,.24),node(.15,.72,.26)],'drift');
define('lobes',[node(-.4,.28,.29),node(.32,.23,.3),node(-.13,.6,.32),node(.37,.7,.21)],'inflate');
define('core',[node(0,.24,.38),node(-.16,.54,.19),node(.25,.4,.18)],'pulse');
define('hollowcap',[node(-.45,.2,.3),node(.45,.2,.3),node(-.27,.62,.27),node(.3,.64,.27),node(0,.8,.2)],'collapse');
define('compression',[node(0,.2,.4,1.8,.5),node(-.42,.34,.24,1.5,.6),node(.41,.35,.24,1.5,.6)],'compress');
define('crown',[...fan(5,Math.PI*.8,.65,.19),node(0,.22,.36)],'burst');
define('star',[...fan(5,Math.PI*1.2,.61,.13,.27),node(0,.3,.26)],'burst');
define('rosette',[...fan(7,Math.PI*1.5,.57,.17,.2),node(0,.28,.2)],'unfold');
define('petals',[...fan(4,Math.PI*.9,.56,.24,.13),node(0,.14,.21)],'unfold');
define('shower',[node(-.44,.7,.12,.6,1.6),node(-.13,.94,.15,.65,1.7),node(.2,.64,.13,.55,1.8),node(.46,.99,.11,.6,1.6)],'fall');
define('geyser',[node(0,.18,.18,.7,1.8),node(.03,.52,.2,.6,1.8),...fan(5,Math.PI*.7,.58,.15,.42)],'jet');
define('fountain',[node(0,.2,.22,.8,1.5),...fan(6,Math.PI*.85,.75,.13,.1)],'fountain');
define('eruption',[node(-.35,.12,.27),node(.35,.11,.29),node(0,.32,.29),...fan(4,Math.PI*.5,.65,.17,.15)],'jet');
define('flare',[node(0,.23,.33,.8,1.6),node(-.25,.54,.18,.7,1.8),node(.24,.73,.14,.6,1.8)],'rise');
define('tongue',[node(-.2,.14,.29),node(-.08,.42,.23,.75,1.5),node(.12,.68,.16,.6,1.8),node(.03,.92,.09,.6,1.8)],'lick');
define('flamecone',[node(0,.1,.4,1.3,.55),node(0,.34,.28),node(0,.61,.19,.8,1.5),node(0,.87,.1,.6,1.6)],'lick');
define('sheet',[...row(6,.16,1.3,.22),...row(4,.43,1,.18)],'spread');
define('candle',[node(0,.17,.19,.6,1.7),node(0,.52,.18,.55,1.8),node(.08,.83,.13,.5,1.5)],'lick');
define('firebuds',[node(-.39,.2,.24,.8,1.2),node(.12,.37,.23,.7,1.5),node(.44,.18,.19,.7,1.3)],'lick');
define('ember',curve([[-.48,.6],[-.16,.36],[.22,.75],[.48,.42]],.08,.7,1.4),'float');
define('cinder',curve([[-.48,.24],[-.29,.63],[.02,.53],[.21,.79],[.44,.43]],.07,.6,1.5),'ballistic');
define('smolder',[node(-.34,.08,.25,1.4,.4),node(.31,.08,.25,1.4,.4),node(0,.32,.27),node(.08,.58,.18)],'drift');
define('coals',[...row(5,.08,1.1,.15),node(-.16,.29,.14),node(.3,.33,.12)],'settle');
define('lava',[node(-.38,.08,.27,1.3,.5),node(.03,.13,.32,1.4,.55),node(.42,.08,.24,1.2,.45),node(.15,.4,.17)],'flow');
define('moltenstream',curve([[-.65,.3],[-.4,.24],[-.11,.35],[.16,.2],[.47,.28],[.67,.12]],.16,1.3,.55),'flow');
define('slag',curve([[-.53,.4],[-.2,.64],[.07,.42],[.37,.73],[.57,.22]],.12,1.2,.8),'ballistic');
define('pumice',curve([[-.4,.16],[-.1,.32],[.34,.12],[.5,.41]],.2,1.2,.8),'fall');
// Broken rock, earth and metal travel with gravity; these are opaque solids.
define('shrapnel',[...fan(6,Math.PI*1.15,.67,.11,.03),node(.12,.24,.14,.8,.5)],'ballistic');
define('slivers',fan(5,Math.PI*.75,.67,.1),'ballistic');
define('nail',curve([[0,.24],[.1,.52],[.17,.84]],.1,.35,2.2),'ballistic');
define('pellet',curve([[-.48,.27],[-.21,.6],[.12,.78],[.42,.43]],.13),'ballistic');
define('plates',[node(-.42,.4,.21,1.4,.45),node(.2,.6,.22,1.3,.5),node(.49,.19,.16,1.3,.45)],'tumble');
define('slab',[node(-.33,.24,.27,1.4,.6),node(.35,.45,.28,1.3,.65),node(.05,.8,.18,1.5,.7)],'tumble');
define('boulder',[node(-.3,.2,.29),node(.32,.4,.35),node(-.12,.72,.2)],'fall');
define('clod',[node(-.42,.3,.23,1.1,.8),node(-.02,.58,.24),node(.38,.24,.28)],'ballistic');
define('grit',curve([[-.58,.1],[-.35,.4],[-.12,.23],[.18,.48],[.37,.13],[.58,.32]],.07),'ballistic');
define('sand',[...row(7,.09,1.4,.11),node(-.23,.3,.12),node(.23,.39,.13)],'flow');
define('dust',[node(-.4,.14,.3,1.2,.6),node(0,.22,.36,1.3,.7),node(.43,.12,.28,1.3,.6)],'drift');
define('swarf',[node(-.5,.19,.11,1.6,.45),node(-.2,.53,.12,.6,1.7),node(.21,.42,.13,1.5,.6),node(.48,.22,.1,.65,1.5)],'tumble');
define('filings',[...fan(6,Math.PI*.92,.64,.075),...row(4,.17,.65,.07)],'align');
define('ore',[node(-.39,.15,.22,1.2,.8),node(.26,.27,.28,.9,1.1),node(-.03,.61,.19)],'align');
define('magnetite',[node(-.4,.25,.28,.7,1.2),node(.4,.25,.28,.7,1.2),node(0,.1,.18,1.5,.6)],'align');
define('poles',[node(-.45,.33,.26,.6,1.5),node(.45,.33,.26,.6,1.5),...row(3,.07,.65,.13)],'attract');
define('horseshoe',curve([[-.45,.51],[-.45,.23],[-.23,.06],[.05,.03],[.32,.12],[.46,.38]],.16),'attract');
// Ice has faceted surfaces and a dense vapor base, never wire diamonds.
define('shards',fan(6,Math.PI*.95,.64,.16,.02),'ballistic');
define('spikes',[node(-.42,.25,.15,.4,2),node(-.12,.52,.19,.45,2),node(.2,.39,.16,.4,1.9),node(.49,.17,.12,.4,2)],'grow');
define('flakes',curve([[-.55,.38],[-.27,.7],[.03,.49],[.29,.87],[.53,.42]],.1,1.3,.4),'float');
define('iceberg',[node(-.29,.19,.38,1,.75),node(.24,.28,.39,.9,1.2),node(-.1,.65,.23,.75,1.2)],'fracture');
define('icicle',[node(-.3,.56,.15,.4,2),node(.04,.44,.2,.4,2.3),node(.39,.7,.13,.4,2)],'fall');
define('icefang',[node(-.39,.3,.2,.5,1.7),node(.14,.54,.27,.4,1.7),node(.43,.16,.16,.55,1.8)],'fracture');
define('prism',[node(-.27,.22,.28,.7,1.3),node(.25,.54,.26,.55,1.4),node(.03,.81,.16,.5,1.4)],'refract');
define('frost',[node(-.4,.06,.27,1.4,.4),node(.23,.1,.35,1.4,.4),node(0,.33,.23,1.5,.6)],'creep');
define('snowball',[node(0,.28,.41),node(-.32,.13,.19),node(.28,.64,.16)],'fracture');
define('snowbank',[node(-.4,.08,.28,1.3,.5),node(0,.14,.37,1.3,.65),node(.41,.11,.25,1.1,.6)],'settle');
// Water, solvent, rubber and foam use shaded liquid volumes and breakup.
define('splash',[node(0,.13,.3,1.4,.5),...fan(5,Math.PI*.85,.58,.13,.05)],'fountain');
define('drop',curve([[-.39,.3],[-.14,.71],[.18,.56],[.43,.25]],.13,.65,1.6),'fall');
define('spray',[...fan(7,Math.PI*.9,.7,.1),node(0,.2,.24)],'fountain');
define('pool',[node(-.44,.06,.28,1.3,.33),node(0,.09,.38,1.3,.35),node(.46,.03,.26,1.3,.3)],'creep');
define('wavecrest',[node(-.42,.11,.24,1.3,.65),node(-.07,.34,.28,1.5,.65),node(.27,.59,.27,1.1,.75),node(.5,.49,.14)],'flow');
define('breakingwaves',[node(-.45,.12,.26),node(-.25,.5,.27,1.3,.7),node(.1,.65,.27,1.4,.7),node(.43,.31,.2),node(.52,.04,.19)],'flow');
define('whitewater',[...row(6,.06,1.3,.18),node(-.12,.27,.2,1.3,.6),node(.37,.34,.16)],'roll');
define('waterjet',[node(-.13,.14,.16,.5,1.8),node(0,.48,.19,.55,1.7),node(.13,.82,.14,.6,1.6)],'jet');
define('watercap',[node(0,.31,.4,1.4,.7),...fan(4,Math.PI,.62,.12,.03)],'collapse');
define('tendrils',curve([[-.55,.08],[-.36,.34],[-.22,.59],[.15,.51],[.34,.29],[.58,.13]],.11,.7,1.4),'curl');
define('gel',[node(-.31,.14,.34,1.1,.7),node(.23,.28,.32,.9,1.3),node(.42,.11,.2)],'stretch');
define('slime',[node(-.4,.05,.24,1.4,.45),node(0,.21,.35,.9,1.2),node(.38,.08,.25,1.3,.5),node(.08,.67,.12)],'stretch');
define('tar',[node(-.37,.05,.24,1.4,.36),node(.05,.14,.32,1.4,.45),node(.43,.06,.25,1.4,.38)],'settle');
define('rubber',[node(-.36,.27,.24,.9,1.3),node(.27,.2,.29,1.1,.8),node(.1,.61,.19)],'bounce');
define('bubble',[node(-.37,.24,.25),node(.15,.39,.32),node(.43,.13,.19),node(-.09,.76,.18)],'inflate');
define('foam',[node(-.42,.15,.25),node(0,.27,.34),node(.4,.16,.26),node(-.22,.57,.2),node(.22,.65,.21)],'inflate');
define('suds',[...row(6,.07,1.3,.17),node(-.22,.28,.19),node(.22,.35,.18)],'settle');
define('pillow',[node(-.33,.28,.33,1.2,.8),node(.3,.32,.31,1.2,.8),node(0,.62,.2)],'inflate');
define('tufts',curve([[-.45,.23],[-.16,.64],[.2,.42],[.47,.76]],.17),'float');
define('mist',[node(-.35,.16,.3,1.3,.6),node(.32,.37,.3,1.3,.7),node(-.18,.66,.22)],'drift');
// Construction volumes are dust/solid chunks attached to the actual build;
// these do not draw hypothetical collision terrain into the gameplay mask.
define('wall',[...row(3,.25,.6,.18),...row(3,.55,.6,.18),...row(3,.85,.6,.17)],'build');
define('roof',curve([[-.6,.18],[-.43,.55],[-.16,.73],[.16,.73],[.43,.55],[.6,.18]],.18),'build');
define('berm',[node(-.4,.09,.23),node(0,.23,.4,1.25,.7),node(.43,.1,.22)],'build');
define('pillar',curve([[0,.1],[0,.35],[0,.6],[0,.85]],.2,.8,1),'build');
define('bridge',[...row(6,.32,1.35,.16),node(-.58,.08,.15),node(.57,.08,.15)],'build');
define('pad',[...row(4,.15,1.05,.23)],'lift');
define('blocks',[node(-.42,.17,.23),node(.2,.2,.28),node(-.14,.57,.23),node(.45,.6,.18)],'build');
define('roots',curve([[-.56,.04],[-.3,.17],[0,.38],[.3,.19],[.56,.06],[.05,.72]],.14),'grow');
define('branch',curve([[0,.08],[0,.36],[-.24,.58],[.22,.61],[-.43,.78],[.41,.86]],.14),'grow');
define('canopy',[...row(5,.65,1.05,.23),node(0,.32,.18,.7,1.5)],'grow');
define('needlehedge',[...row(6,.15,1.25,.16),...fan(5,Math.PI*.55,.65,.11,.1)],'grow');
define('island',[...row(5,.34,1.2,.21),node(0,.62,.25),node(0,.08,.18)],'lift');
define('crookedwall',curve([[-.27,.06],[-.11,.28],[.12,.52],[-.03,.75],[.16,.96]],.23,1.2,.7),'build');
define('quarry',[node(-.48,.23,.3),node(.5,.26,.31),node(-.28,.56,.22),node(.32,.63,.2)],'excavate');
define('shaft',curve([[-.27,.15],[.3,.34],[-.26,.6],[.3,.85]],.18,.7,1.2),'excavate');
define('furrow',[...row(6,.17,1.3,.2)],'sweep');
define('fault',curve([[-.56,.09],[-.36,.28],[-.19,.51],[.04,.41],[.22,.69],[.48,.82]],.18,1.2,.7),'fracture');
define('strata',[...row(4,.15,1.2,.2),...row(3,.45,.95,.2),...row(2,.73,.6,.18)],'fracture');
define('burrow',curve([[-.55,.13],[-.31,.29],[-.04,.14],[.25,.29],[.53,.14]],.19),'crawl');
define('tunnel',[...row(5,.19,1.25,.19),node(-.53,.5,.18),node(.53,.5,.18)],'crawl');
define('pitmouths',[node(-.51,.1,.24,.7,1.2),node(-.1,.33,.2,.7,1.2),node(.46,.12,.23,.7,1.2)],'collapse');
define('fissure',curve([[-.5,.12],[-.25,.41],[.04,.31],[.15,.65],[.48,.83]],.18,.65,1.3),'fracture');
// Rotating, returning and energized matter stays filled and shaded.
define('helix',curve([[-.26,.07],[.2,.23],[-.2,.43],[.2,.63],[-.24,.84]],.17),'spiral');
define('whorl',curve([[.42,.15],[.48,.48],[.18,.77],[-.23,.68],[-.39,.37],[-.14,.21],[.1,.42]],.18),'spiral');
define('vortex',curve([[-.04,.05],[.05,.25],[-.14,.47],[.24,.67],[-.33,.85],[.4,.92]],.18),'inward');
define('funnel',[node(0,.1,.13),node(0,.33,.2,1.3,.7),node(0,.57,.3,1.4,.65),node(0,.8,.36,1.5,.6)],'inward');
define('hook',curve([[-.55,.18],[-.25,.19],[.11,.29],[.42,.52],[.3,.78],[.01,.73]],.17),'return');
define('loop',curve([[-.37,.14],[-.53,.43],[-.32,.74],[.03,.85],[.4,.65],[.43,.28],[.17,.12]],.15),'curl');
define('fold',[node(-.38,.4,.24,.5,1.7),node(.38,.4,.24,.5,1.7),node(0,.44,.19)],'close');
define('paired',[node(-.44,.29,.3),node(.42,.53,.3),node(0,.17,.17)],'exchange');
define('inward',[...fan(5,Math.PI*1.2,.67,.14,.17),node(0,.28,.22)],'inward');
define('ribbon',curve([[-.56,.21],[-.3,.54],[-.03,.34],[.24,.66],[.54,.49]],.14),'flutter');
define('sinewave',curve([[-.64,.38],[-.4,.62],[-.14,.36],[.12,.12],[.39,.37],[.63,.61]],.13),'wave');
define('spool',[node(-.32,.3,.28,.4,1.3),node(.32,.3,.28,.4,1.3),node(0,.3,.21,1.4,.6)],'roll');
define('corona',[node(0,.3,.32),...fan(6,Math.PI*1.5,.53,.1,.3)],'pulse');
define('electrode',[node(-.35,.25,.14,.55,1.6),node(.34,.25,.14,.55,1.6),node(-.13,.68,.16),node(.23,.8,.11)],'discharge');
define('coil',curve([[-.25,.11],[.23,.29],[-.25,.47],[.23,.66],[-.24,.85]],.14,1.3,.7),'discharge');
define('lens',[node(0,.37,.37,1.55,.55),node(-.43,.53,.18),node(.43,.27,.18)],'compress');
define('pulse',[node(0,.25,.39,1.3,.7),node(-.44,.51,.16),node(.43,.52,.16)],'pulse');
define('field',[node(-.45,.14,.24),node(.45,.14,.24),node(-.32,.6,.26),node(.32,.6,.26),node(0,.81,.2)],'assemble');
define('cells',[node(-.35,.2,.2),node(.27,.18,.21),node(-.08,.56,.24),node(.41,.74,.15)],'assemble');
define('prongs',[node(-.29,.41,.16,.55,1.8),node(.29,.41,.16,.55,1.8),node(0,.08,.2,1.3,.6)],'discharge');
define('bead',curve([[-.54,.16],[-.28,.4],[.03,.63],[.33,.75],[.57,.55]],.12),'return');
define('vein',curve([[-.51,.1],[-.22,.32],[.02,.53],[.34,.72],[.55,.6]],.18,.9,1.3),'inward');
// Casing and projectile assemblies are actual solid pieces, with lit facets.
define('slug',[node(-.25,.28,.22,1.6,.65),node(.18,.28,.24,1.25,.6)],'burst');
define('shell',[node(-.26,.27,.22,1.3,.65),node(.11,.28,.26,1.5,.7),node(.42,.28,.13,.7,.65)],'burst');
define('rocket',[node(-.16,.32,.21,1.65,.6),node(.3,.32,.19,1.3,.7),node(-.41,.16,.13,.5,1.3),node(-.41,.48,.13,.5,1.3)],'jet');
define('lance',[node(-.24,.35,.15,2.1,.5),node(.22,.35,.17,1.7,.6),node(.52,.35,.1,1.2,.4)],'pierce');
define('ball',[node(0,.35,.38),node(-.23,.61,.14)],'roll');
define('puck',[node(0,.27,.36,1.4,.4),node(-.32,.35,.14,.7,.6)],'skip');
define('pod',[node(0,.27,.38,.9,1.1),node(-.3,.5,.17),node(.29,.53,.17)],'open');
define('pineapple',[node(0,.29,.32,.85,1.2),...row(3,.29,.45,.11),node(0,.73,.13,.5,1.4)],'open');
define('grenade',[node(0,.24,.33),node(0,.65,.13,.7,1.2),node(.24,.52,.13,.6,1.1)],'open');
define('box',[node(-.25,.17,.24,1,.8),node(.23,.17,.24,1,.8),node(-.25,.55,.24,1,.8),node(.23,.55,.24,1,.8)],'open');
define('casing',[node(-.37,.33,.2,.7,1.1),node(.36,.5,.22,.65,1.15),node(.1,.16,.16,.7,.6)],'tumble');
define('fin',[node(-.34,.19,.19,.8,1.5),node(.26,.56,.18,1.4,.55),node(.35,.16,.16,1.2,.6)],'tumble');
define('teeth',[...row(5,.22,1.1,.12),...fan(3,Math.PI*.6,.6,.09,.13)],'grind');
define('saw',[node(0,.29,.3,1,.55),...fan(7,Math.PI*1.4,.48,.09,.29)],'spin');
define('rotor',[...fan(4,Math.PI*1.5,.5,.17,.28),node(0,.28,.18)],'spin');
define('auger',curve([[-.44,.2],[-.22,.41],[0,.25],[.22,.46],[.43,.31]],.15,.8,1.35),'drill');
define('piston',[node(-.23,.32,.19,1.1,.6),node(.14,.32,.3,.6,1.2),node(.37,.32,.12,1.5,.6)],'thrust');
define('anvil',[...row(4,.5,1,.19),node(0,.27,.24,.65,1.2),node(0,.06,.27,1.3,.4)],'slam');
define('plow',[node(-.3,.2,.24,.6,1.3),node(.02,.41,.26,1.3,.6),node(.38,.56,.21,1.2,.5)],'sweep');
define('barricade',[...row(4,.18,1.05,.2),...row(3,.53,.8,.2),node(0,.82,.18)],'assemble');
define('hull',[node(-.37,.16,.28,1.1,.5),node(.24,.23,.35,1.35,.6),node(.04,.6,.2,1.2,.6)],'collapse');
define('drone',[node(0,.43,.27),node(-.48,.35,.23,1.3,.35),node(.48,.35,.23,1.3,.35)],'strafe');
define('tripod',[node(0,.58,.22),node(-.35,.14,.16,.55,1.7),node(.35,.14,.16,.55,1.7),node(0,.05,.16,.5,1.1)],'deploy');
define('silo',[node(0,.3,.3,.8,1.2),node(-.28,.09,.2),node(.27,.09,.2),node(0,.73,.18,1.3,.5)],'deploy');
define('barrel',[node(0,.3,.26,.8,1.2),node(0,.67,.17,1.1,.6)],'vent');
define('battery',[node(-.26,.22,.25,.8,1.15),node(.26,.22,.25,.8,1.15),node(-.26,.62,.11),node(.26,.62,.11)],'charge');
define('coin',[node(-.23,.26,.23,.35,1.2),node(.25,.51,.24,.4,1.1)],'tumble');
define('ingot',[node(-.2,.23,.27,1.2,.6),node(.28,.4,.22,1.3,.65)],'tumble');
define('paper',curve([[-.5,.3],[-.2,.65],[.11,.41],[.42,.69]],.13,1.3,.45),'flutter');
define('rind',[node(-.36,.26,.22,.75,1.1),node(.35,.26,.22,.75,1.1),node(0,.08,.22,1.2,.5)],'open');
define('pip',curve([[-.25,.42],[0,.65],[.26,.31]],.09,.7,1.3),'ballistic');
define('whip',curve([[-.6,.13],[-.39,.4],[-.1,.7],[.25,.78],[.52,.58]],.12,.7,1.2),'snap');
define('quill',[...fan(7,Math.PI*1.2,.55,.085,.2),node(0,.22,.28)],'burst');
define('windfan',[...fan(5,Math.PI*.65,.58,.2,.1)],'sweep');
define('wedge',[node(-.39,.18,.2),node(-.09,.35,.25),node(.22,.51,.28),node(.49,.69,.14)],'thrust');
define('fan',fan(6,Math.PI*.85,.65,.14,.05),'burst');
define('needle',curve([[-.25,.3],[0,.3],[.25,.3],[.5,.3]],.1,1.8,.45),'pierce');
define('comb',[...row(5,.2,1.15,.11),...row(4,.55,.95,.12)],'rake');
define('curtain',[...row(5,.55,1.2,.15),...row(4,.2,1,.14)],'fall');
define('fizz',[node(-.3,.13,.25),node(.26,.21,.29),node(-.1,.6,.12),node(.32,.78,.08)],'bubble');
define('sled',[node(-.3,.14,.28,1.2,.45),node(.28,.2,.28,1.2,.45),node(.49,.43,.14)],'escape');
// Compile-time physical vocabulary, expanded into owned node lists.
const terms={
 "trident": "fan",
 "vents": "geyser",
 "jet": "flamecone",
 "rubberwall": "wall",
 "scorch": "pool",
 "crescent": "hook",
 "struts": "bridge",
 "clodfield": "clod",
 "torch": "tongue",
 "beads": "bead",
 "heatrays": "fan",
 "errantfan": "fan",
 "batteryfan": "fan",
 "snowfan": "fan",
 "lavajet": "geyser",
 "chargefan": "fan",
 "flamerake": "fan",
 "mudbank": "berm",
 "wake": "sheet",
 "heavyjet": "flamecone",
 "steam": "mist",
 "film": "sheet",
 "crossfire": "paired",
 "bombrows": "furrow",
 "lavafront": "wavecrest",
 "bubblepod": "pod",
 "stream": "ribbon",
 "zigzag": "sinewave",
 "brokenpoles": "poles",
 "rake": "comb",
 "basin": "quarry",
 "wellfoam": "shaft",
 "barrier": "wall",
 "shellcap": "roof",
 "liftcap": "pad",
 "icebridge": "bridge",
 "frostfan": "fan",
 "ionfan": "fan",
 "sandfan": "fan",
 "purgevein": "fan",
 "cleansingfoam": "fan",
 "burstfan": "fan",
 "mine": "grenade",
 "basinbed": "quarry",
 "faultpulse": "fault",
 "siphonwhorl": "whorl",
 "cometfall": "wedge",
 "heatray": "fan",
 "icebox": "box",
 "shrapnels": "shrapnel",
 "scuff": "dust",
 "slag": "slag",
 "hand": "rosette",
 "pitted": "pitmouths",
 "char": "smolder",
 "barb": "nail",
 "penetrator": "lance",
 "piston": "piston",
 "talus": "slab",
 "mound": "berm",
 "grit": "grit",
 "branch": "branch",
 "mist": "mist",
 "frost": "frost",
 "etch": "pool",
 "drained": "vein",
 "charge": "corona",
 "slab": "slab",
 "slabs": "slab",
 "boulders": "boulder",
 "boulderfield": "boulder",
 "rocks": "boulder",
 "clods": "clod",
 "casing": "casing",
 "casings": "casing",
 "shrapnel": "shrapnel",
 "nails": "nail",
 "needles": "nail",
 "pellets": "pellet",
 "rounds": "pellet",
 "shells": "shell",
 "plates": "plates",
 "shellplates": "plates",
 "glass": "shards",
 "flames": "tongue",
 "tongues": "tongue",
 "embers": "ember",
 "ash": "cloud",
 "smoke": "billow",
 "dust": "dust",
 "soil": "clod",
 "landslide": "slab",
 "shards": "shards",
 "spikes": "spikes",
 "snowcap": "iceberg",
 "snowdust": "flakes",
 "stalactites": "icicle",
 "icecone": "flamecone",
 "icecrown": "crown",
 "frostmist": "mist",
 "drops": "drop",
 "droplets": "drop",
 "droplet": "drop",
 "splat": "splash",
 "puddle": "pool",
 "wetpuddles": "pool",
 "waterline": "sheet",
 "oil": "tar",
 "rubberbed": "rubber",
 "gluebed": "gel",
 "gel": "gel",
 "strings": "tendrils",
 "strands": "tendrils",
 "blisters": "bubble",
 "bubbles": "bubble",
 "bubblepack": "foam",
 "jelly": "gel",
 "suds": "suds",
 "foam": "foam",
 "quartz": "shards",
 "pool": "pool",
 "tufts": "tufts",
 "cloak": "mist",
 "veil": "mist",
 "feathers": "slivers",
 "rain": "shower",
 "hail": "shower",
 "watercap": "watercap",
 "quill": "quill",
 "arch": "roof",
 "archcover": "roof",
 "root": "roots",
 "roots": "roots",
 "branches": "branch",
 "beanroots": "roots",
 "beanstalk": "pillar",
 "girder": "bridge",
 "span": "bridge",
 "rampart": "wall",
 "pedestal": "pillar",
 "lift": "pillar",
 "columns": "pillar",
 "column": "pillar",
 "pillars": "pillar",
 "heaped": "berm",
 "pads": "pad",
 "hearth": "berm",
 "bunkerplates": "roof",
 "brace": "wall",
 "quarryface": "quarry",
 "scoop": "quarry",
 "sinkhole": "shaft",
 "well": "shaft",
 "boring": "auger",
 "bore": "auger",
 "trench": "furrow",
 "trenches": "furrow",
 "furrows": "furrow",
 "pittedground": "pitmouths",
 "surfacefault": "fault",
 "channels": "furrow",
 "gutter": "furrow",
 "groundforks": "roots",
 "roofslot": "shaft",
 "undercut": "quarry",
 "moat": "quarry",
 "linkedcharges": "bead",
 "rows": "furrow",
 "staccato": "bead",
 "belt": "furrow",
 "railcells": "bead",
 "rails": "bridge",
 "parallel": "bridge",
 "segments": "bead",
 "worm": "helix",
 "crawler": "burrow",
 "twist": "helix",
 "spiral": "whorl",
 "skip": "hook",
 "returnhook": "hook",
 "roller": "puck",
 "fork": "roots",
 "shield": "field",
 "cellshield": "field",
 "shieldcells": "field",
 "laserfocus": "lance",
 "railfocus": "lance",
 "phasebeam": "lance",
 "phasecells": "cells",
 "blackout": "corona",
 "plasma": "core",
 "rod": "pillar",
 "rods": "pillar",
 "stormcell": "core",
 "stormcloud": "cloud",
 "discharge": "electrode",
 "prismspindle": "helix",
 "prisms": "prism",
 "orbit": "loop",
 "exchanger": "paired",
 "returnvein": "vein",
 "siphon": "funnel",
 "clamp": "horseshoe",
 "drain": "funnel",
 "sling": "whip",
 "tether": "whip",
 "backdraft": "wedge",
 "updraft": "geyser",
 "nozzle": "flamecone",
 "pipe": "pillar",
 "tendrils": "tendrils",
 "rocketcone": "rocket",
 "rocketfins": "fin",
 "fins": "fin",
 "torpedo": "lance",
 "rocket": "rocket",
 "asteroid": "boulder",
 "meteor": "comet",
 "comet": "wedge",
 "skycap": "cap",
 "skyore": "ore",
 "skycells": "cells",
 "sheet": "sheet",
 "lowfront": "sheet",
 "firefront": "sheet",
 "firevent": "geyser",
 "hotplate": "pad",
 "chimney": "pillar",
 "oven": "roof",
 "cauldron": "rind",
 "blastwhorl": "whorl",
 "popping": "lobes",
 "popcorn": "lobes",
 "kernel": "pod",
 "charredkernel": "pod",
 "pine": "pineapple",
 "quillfan": "fan",
 "hive": "pod",
 "pincushion": "quill",
 "nailcartridge": "shell",
 "warhead": "shell",
 "counterweight": "boulder",
 "stompboot": "piston",
 "anvilprint": "pad",
 "impactanvil": "anvil",
 "sledge": "anvil",
 "hammer": "piston",
 "stormhammer": "anvil",
 "metaljaws": "teeth",
 "claws": "teeth",
 "barbs": "teeth",
 "rotorblades": "rotor",
 "rotorhub": "rotor",
 "wheel": "saw",
 "pistols": "paired",
 "lolly": "rind",
 "balloon": "ball",
 "tarball": "ball",
 "drum": "barrel",
 "fuzz": "tufts",
 "boiler": "barrel",
 "cells": "cells",
 "coils": "coil",
 "terminals": "prongs",
 "prongs": "prongs",
 "pods": "pod",
 "pod": "pod",
 "grenades": "grenade",
 "chargepack": "battery",
 "batterycell": "battery",
 "bolts": "pellet",
 "scrap": "plates",
 "chips": "slivers",
 "foil": "paper",
 "tiles": "plates",
 "shutters": "plates",
 "parcel": "box",
 "cube": "box",
 "fuse": "bead",
 "confetti": "paper",
 "glints": "flakes",
 "tooth": "teeth",
 "sputter": "lobes",
 "spring": "helix",
 "saucers": "puck",
 "discs": "puck",
 "robotpod": "pod",
 "nanocloud": "cloud",
 "gyrobody": "ball",
 "gyrogrenade": "grenade",
 "gyroformation": "rotor",
 "legs": "tripod",
 "tripods": "tripod",
 "wings": "drone",
 "flying": "drone",
 "feather": "sliver",
 "seatflames": "tongue",
 "pistons": "piston",
 "toasthards": "shards",
 "toastshards": "slab",
 "ovenbars": "wall",
 "fuselage": "shell",
 "coal": "boulder",
 "moltencrust": "plates",
 "seam": "furrow",
 "fissure": "fissure",
 "sinewave": "sinewave",
 "wash": "sheet",
 "solvent": "spray",
 "cleaning": "spray",
 "patch": "pad",
 "armor": "plates",
 "armorpeel": "plates",
 "bankfacet": "plates",
 "spool": "spool",
 "barrels": "barrel",
 "lancefront": "lance",
 "landing": "dust",
 "fountainpod": "pod",
 "fountain": "fountain",
 "ram": "piston",
 "fulgurite": "spikes",
 "island": "island",
 "web": "tendrils",
 "knots": "bead",
 "gluestick": "pillar",
 "metalconfetti": "slivers",
 "drainpulse": "pulse",
 "twinrocket": "paired",
 "billows": "billow",
 "rubble": "clod",
 "buriedflame": "flamecone",
 "hearthcap": "cap",
 "rubblecap": "cap",
 "deepcap": "pillar",
 "padcells": "pad",
 "bermcells": "berm",
 "bridgecells": "bridge",
 "cellpool": "pool",
 "cellmine": "grenade",
 "oretrain": "bead",
 "orevert": "pillar",
 "orebed": "pool",
 "orepit": "shaft",
 "stoneroot": "roots",
 "rockshield": "field",
 "chargedwall": "wall",
 "chargedspan": "bridge",
 "pairedshafts": "paired",
 "pairedcap": "paired",
 "pairedvein": "paired",
 "pairedpole": "paired",
 "pairedflame": "paired",
 "pairedfoam": "paired",
 "pairedice": "paired",
 "paireddrop": "paired",
 "pairedrock": "paired",
 "frozen": "frost",
 "foamrows": "furrow",
 "foamfault": "fault",
 "foamquarry": "quarry",
 "foambank": "berm",
 "foampatch": "pad",
 "partyfoam": "rosette",
 "foamfall": "shower",
 "drainprism": "prism",
 "drainrail": "lance",
 "drainedhull": "hull",
 "rootcut": "furrow",
 "rootmound": "berm",
 "rootpad": "pad",
 "rootheart": "core",
 "sinkveins": "shaft",
 "downvein": "pillar",
 "rootveins": "roots",
 "veinsegments": "bead",
 "veincanopy": "canopy",
 "iceaegis": "field",
 "icebelt": "furrow",
 "iceberm": "berm",
 "icecarpet": "sheet",
 "icetrench": "furrow",
 "icepad": "pad",
 "icepatch": "pad",
 "icepulse": "pulse",
 "icepiston": "piston",
 "icefountain": "fountain",
 "iceworm": "helix",
 "icefilm": "sheet",
 "icerail": "lance",
 "iceprism": "prism",
 "cold": "frost",
 "liquidprism": "prism",
 "liquidcarpet": "sheet",
 "liquidfold": "fold",
 "liquidhook": "hook",
 "rainroof": "roof",
 "spillway": "bridge",
 "wetclamp": "horseshoe",
 "wetpuck": "puck",
 "wetwreck": "hull",
 "wetbox": "box",
 "boilingpool": "pool",
 "volatilepool": "pool",
 "etchpool": "pool",
 "leechpool": "pool",
 "acidfilm": "sheet",
 "acidroot": "roots",
 "acidrail": "lance",
 "frostpool": "pool",
 "orebox": "box",
 "orepuck": "puck",
 "orecarpet": "sheet",
 "oremound": "berm",
 "orepad": "pad",
 "oreroot": "roots",
 "orepenetrator": "lance",
 "ferroprism": "prism",
 "ferrospike": "lance",
 "ferrofold": "fold",
 "ferrohull": "hull",
 "ferroarch": "roof",
 "ferrospan": "bridge",
 "ferroshield": "field",
 "coilrack": "coil",
 "borecore": "auger",
 "lodestone": "boulder",
 "lodestonewhorl": "whorl",
 "foamprism": "prism",
 "foamrail": "lance",
 "foamroot": "roots",
 "foamhook": "hook",
 "foamhull": "hull",
 "foambox": "box",
 "foamclamp": "horseshoe",
 "foampuck": "puck",
 "foampiston": "piston",
 "foamfold": "fold",
 "foampulse": "pulse",
 "foamwhorl": "whorl",
 "foampool": "pool",
 "foammine": "grenade",
 "foampad": "pad",
 "foamroof": "roof",
 "foamwall": "wall",
 "foamspan": "bridge",
 "foamtrench": "furrow",
 "foamcarpet": "sheet",
 "foamworm": "helix",
 "chargebox": "box",
 "chargecap": "cap",
 "chargecarpet": "sheet",
 "chargeclamp": "horseshoe",
 "chargecolumn": "pillar",
 "chargefilm": "sheet",
 "chargehook": "hook",
 "chargehull": "hull",
 "chargepiston": "piston",
 "chargepuck": "puck",
 "chargewhorl": "whorl",
 "poleclamp": "horseshoe",
 "polefan": "fan",
 "polehook": "hook",
 "polepulse": "pulse",
 "poleram": "piston",
 "fallingvein": "shower",
 "ionroot": "roots",
 "warmcap": "cap",
 "heatpulse": "pulse",
 "hotpatch": "pad",
 "hotrail": "lance",
 "firebox": "box",
 "firebranches": "branch",
 "firebridge": "bridge",
 "fireclamp": "horseshoe",
 "firefold": "fold",
 "firehook": "hook",
 "firehull": "hull",
 "firepiston": "piston",
 "firepuck": "puck",
 "firewhorl": "whorl",
 "fireworm": "helix",
 "firewall": "wall",
 "firecap": "cap",
 "firewings": "drone",
 "firebug": "drone",
 "emberseed": "roots",
 "emberpod": "pod",
 "veinwall": "wall",
 "veinspan": "bridge",
 "veinshield": "field",
 "veinfold": "fold",
 "veinpuck": "puck",
 "veinram": "piston",
 "veincarpet": "sheet",
 "veinfilm": "sheet",
 "drainbox": "box",
 "rockbox": "box",
 "rockclamp": "horseshoe",
 "rockfold": "fold",
 "rockhook": "hook",
 "rockhull": "hull",
 "rockprism": "prism",
 "rockpuck": "puck",
 "rockwhorl": "whorl",
 "rockfall": "shower",
 "splitcap": "paired",
 "splitbox": "box",
 "splitfold": "fold",
 "splitpiston": "piston",
 "splitpuck": "puck",
 "splitshield": "field",
 "splitwall": "wall",
 "splitprism": "prism",
 "crackedcap": "cap",
 "fuseclamp": "horseshoe",
 "fusedcarpet": "sheet",
 "fusedhook": "hook",
 "fusedmine": "grenade",
 "fusedrail": "lance",
 "fusedroot": "roots",
 "fusepulse": "pulse",
 "burningfilm": "sheet",
 "slickflame": "sheet",
 "carpetfire": "sheet",
 "fireice": "paired",
 "ferricmine": "grenade",
 "iceroof": "roof",
 "iceclamp": "horseshoe",
 "icefold": "fold",
 "icehook": "hook",
 "icehull": "hull",
 "icemine": "grenade",
 "icepuck": "puck",
 "iceroot": "roots",
 "icewall": "wall",
 "icewhorl": "whorl",
 "soilpatch": "pad",
 "gritfilm": "sheet",
 "sudsfilm": "sheet",
 "ironfilm": "sheet",
 "solventpulse": "pulse",
 "dustball": "ball",
 "sparkdust": "flakes",
 "crystalpetals": "petals",
 "vialmine": "grenade",
 "stonemine": "grenade",
 "barbmine": "grenade",
 "flame": "tongue",
 "jetwash": "geyser",
 "crown": "crown",
 "shaft": "shaft"
};
function resolve(name,seen=new Set()){
 if(forms[name])return {form:name,...forms[name]};
 if(seen.has(name)||!terms[name])throw Error('Unmapped physical form: '+name);seen.add(name);return resolve(terms[name],seen);
}
module.exports={forms,resolve};
