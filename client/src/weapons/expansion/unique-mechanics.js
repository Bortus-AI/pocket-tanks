import { addZone, addShield, applyPayload, clearZones, enemyOf, tankState, tanksInRange } from './tactics';
import { createWeaponProjectile } from '../../graphics/weapon-fx';

// These are authored rules, not ID/seed-selected mutations. A recipe changes a
// flight, activation condition, terrain shape or aftermath. Shared primitives
// stay small so the same accepted online shot can always be replayed exactly.
const authored = `
Impact Howitzer=contact-fuse
Impact Rampart=mine-trap
Nuke=annular-moat
Mega Nuke=contact-fuse+support-cut
Fireball=fire-vent
Crater Maker=stair-cut
Acid Bombs=acid-reservoir
Fission Bomb=apex-return
Lead Balloon=chute
Minigun=contact-bank
10 Shot=zigzag-flight
Flamethrower=low-skimmer
Bunker Buster=burrow-step
Crackdown=support-cut
Shredder=crosscut
Mower=roof-slot
Excavator=stair-cut
Strip Mine=mine-trap
Trench=earth-plug
Earth Mover=annular-moat
Quicksand=inward-pull
Big Dirtball=bridge-span
Oil Slick=oil-trail
Tractor Beam=upward-kick
Vacuum Cannon=contact-fuse+inward-pull
Gravity Well=contact-fuse
Magnet=shield-flip
Cyclone=upward-kick
Whirlwind=twin-flanks
Super Magnet=annular-moat
Gravity Grenade=contact-bank
Backflip=gravity-flip
Fling=upward-kick
Bubble Blast=arch-cover
Meteor Shower=ceiling-drop
Dive Bomb=apex-dive
Bombardment=contact-fuse
Acid Rain=acid-reservoir
Solar Flare=fire-vent
Lightning Rod=earth-plug
Laser Strike=roof-slot
Space Laser=ceiling-drop
Space Cannon=contact-bank
Ion Cannon=contact-fuse
Mass Driver=support-cut
Freeze Ray=glue-bed
Laser=sky-echo
Railgun=reverse-fan
Super Laser=twin-flanks
Digger=stair-cut
Magic Forest=mine-trap
Black Forest=acid-reservoir
Lemon=earth-plug
Cavern=arch-cover
Phantom=contact-fuse
Gamma Blaster=shield-flip
Lightning Strike=sky-echo
Power Grid=earth-plug
Spectra Laser=contact-fuse
Laser Grenade=contact-bank
Laser Net=bridge-span
Mirror Ball=rubber-bed
Rebound Lasers=reverse-fan
Pop Rocket=upward-kick
Fracture=crosscut
Bulldozer=wake-cut
Sand Blast=dirt-shower
Earthquake=contact-fuse
Rumbler=contact-fuse+upward-kick
Pillow Fight=chute
Ricochet Rifle=roof-slot
Bumper Bowling=twin-flanks
Heavy Roller=support-cut
Shadow Blast=aim-scramble
Old Faithful=fire-vent
Blender=inward-pull
Melt Down=annular-moat
Lava=fire-vent
Hot Spring=upward-kick
Firefight=reverse-fan
Mystery Bombs=ceiling-drop
Flak=chute
Stinger=proximity-brake
Slingshot=apex-return
Knockback=upward-kick
Flying Wall=arch-cover
Bump Rockets=twin-flanks
Barrage=sky-echo
Cluster Bombs=burrow-step
Comet=apex-dive
Riptide=low-skimmer
Flea Circus=mine-trap
Fireworks=gravity-flip
Star Dust=chute
Glitter Gun=contact-fuse
Eruption=upward-kick
Trailblazer=oil-trail
Char=roof-slot
Sledgehammer=apex-dive
Pounder=contact-fuse
Slammer=upward-kick
Spike Pit=mine-trap
Super Flare=reverse-fan
Spinner=sine-flight
Flying Discs=low-skimmer
Saucer Attack=ceiling-drop
Orbiter=gravity-flip
Plasma Orb=shield-flip
Robot Blimps=chute
Bouncy Ball=contact-bank
Toy Hammer=apex-dive
Beach Ball=upward-kick
Super Funnel=inward-pull
Great Wall=bridge-span
Glue Stick=glue-bed
Fire Wall=fire-vent
Hot Coals=mine-trap
Firefly=sine-flight
Sand Storm=roof-slot
Snow Drift=earth-plug
Paintball Gun=contact-bank
Snow Cone=arch-cover
Blowtorch=roof-slot
Blaze=oil-trail
Explode-a-Tron=contact-fuse
Badger=burrow-step
Neon Blast=sky-echo
Dazzler=aim-scramble
Shock Wave=upward-kick
Snowballs=chute
Liquid Nitrogen=glue-bed
Avalanche=support-cut
Aqua Bomb=annular-moat
Power Washer=cleanse-pulse
Fire Hose=roof-slot
Tidal Wave=inward-pull
Rapids=stair-cut
Flash Flood=upward-kick
Streamers=reverse-fan
Fuzz Ball=chute
Chroma Blaster=aim-scramble
Pulsar=contact-fuse
Spark Storm=sky-echo
Burning Rubber=fire-vent
Rubber Paint=bridge-span
Tachyon Beam=border-wrap
Neutron Beam=support-cut
Yo-yo=apex-return
Bungee Punch=upward-kick
Lock Box=arch-cover
Bounce House=rubber-bed
Hover Blocks=bridge-span
Twist Rockets=sine-flight
Graviton=inward-pull
Tesla Coil=earth-plug
Energy Spike=roof-slot
Sticker Shock=contact-fuse
Smoke Bomb=roof-slot
Slime Ball=glue-bed
Gamma Goo=acid-reservoir
Glue Gun=contact-bank
Gyro Glue=sine-flight
Zinger=zigzag-flight
Scrambler=aim-scramble
Wildfire=oil-trail
Phoenix=apex-return
Gyrobots=sine-flight
Buzzbots=wake-cut
Sneak Attack=ceiling-drop
Grab Bag=reverse-fan
Quantum Cube=arch-cover
Puzzle Box=contact-fuse
Bushwhack=mine-trap
Carbon Crawler=wake-cut
Lollipop=rubber-bed
Pipeline=oil-trail
Sky Strike=ceiling-drop
Trick Shot=contact-bank
Howitzer=apex-dive
Reflex Missile=apex-return
Turbo Cannon=pulse-thrust
Bonfire=fire-vent
Heat Lamp=roof-slot
Hot Seat=upward-kick
Party Popper=reverse-fan
Sticks & Stones=dirt-shower
Leap Frog=earth-plug
Fix-it Foam=cleanse-pulse
Bunker=arch-cover
Crash Dive=support-cut
Barbed Wire=mine-trap
Electric Putty=shield-flip
Rocket Launch=fire-vent
Six Shooter=contact-fuse
Flash Freeze=glue-bed
Coin Toss=apex-return
Frostbite=glue-bed
Bungee Bomb=inward-pull
Dash=wake-cut
Sparkatron=sky-echo
Spin Lasers=gravity-flip
Danger Rope=reverse-fan
Booster Worm=upward-kick
Foundation=bridge-span
Concrete=arch-cover
Topsy-Turvy=gravity-flip
Super Retreat=mine-trap
Bombs Away=reverse-fan
Boring Missiles=roof-slot
Mudrunner=earth-plug
Upheaval=dirt-shower
Torpedo=low-skimmer
Phaser=sky-echo
Elevator=upward-kick
Hot Potato=contact-fuse
Stampede=mine-trap
Zipper=low-skimmer
Whiplash=twin-flanks
Hedge=dirt-shower
Retreat=rubber-bed
Steamroller=bridge-span
Wrecker=burrow-step
Laser Bots=reverse-fan
Zap Stix=contact-bank
Super Tracer=survey-charge
`;
export const authoredMechanicalRules = Object.freeze(Object.fromEntries(authored.trim().split('\n').map(row => {
    const [name,rules]=row.split('=');return [name,Object.freeze(rules.split('+'))];
})));

export const ruleDescriptions = {
    'apex-dive':'At the apex, locks into a vertical dive.', 'apex-return':'Reverses horizontal travel at the apex.',
    chute:'Opens a chute at the apex and descends vertically.', 'low-skimmer':'At the apex, switches to a surface-following flight.',
    'sine-flight':'Weaves vertically while flying.', 'zigzag-flight':'Alternates sideways thrust during flight.',
    'gravity-flip':'Reverses gravity briefly at the apex.', 'ceiling-drop':'At the apex, warps above the opposing tank and drops.',
    'proximity-brake':'Brakes to a vertical drop when it approaches armor.', 'border-wrap':'Can wrap once across a battlefield edge.',
    'pulse-thrust':'Accelerates in discrete rocket pulses.', 'contact-fuse':'Sticks at first contact, then resolves its payload after a visible fuse.',
    'contact-bank':'Banks off its first contact before resolving.', 'burrow-step':'Cuts a short horizontal passage through its first contact before resolving.',
    crosscut:'Cuts crossing horizontal and vertical slots.', 'annular-moat':'Excavates a ring while retaining the central island.',
    'stair-cut':'Excavates a descending staircase.', 'roof-slot':'Cuts a narrow opening above the landing area.',
    'earth-plug':'Places a solid earthen stopper at impact.', 'arch-cover':'Adds a hollow arch over the landing area.',
    'bridge-span':'Builds a horizontal crossing at impact.', 'rubber-bed':'Leaves reflective rubber on nearby ground.',
    'glue-bed':'Leaves adhesive ground and limits nearby movement.', 'mine-trap':'Leaves an armed-on-next-shot proximity mine.',
    'oil-trail':'Leaves three separated flammable oil patches.', 'fire-vent':'Opens a vertical vent and leaves fire at its foot.',
    'acid-reservoir':'Leaves a persistent corrosive pool.', 'cleanse-pulse':'Removes nearby hazards and harmful armor statuses.',
    'shield-flip':'Transfers nearby enemy shield charge to the shooter.', 'inward-pull':'Pulls nearby armor toward the landing point.',
    'upward-kick':'Launches nearby armor vertically.', 'aim-scramble':'Rotates nearby turrets through a seeded quarter turn.',
    'reverse-fan':'Launches a second salvo back toward the shooter.', 'sky-echo':'Follows the impact with an overhead falling projectile.',
    'twin-flanks':'Opens two side cavities while preserving the landing column.', 'support-cut':'Cuts a horizontal support underneath the landing area.',
    'dirt-shower':'Builds separated falling-earth mounds along the surface.', 'wake-cut':'Leaves a narrow excavated wake during flight.',
    'survey-charge':'Its first survey marker restores one movement charge, without scoring damage.',
};

export function withMechanicalRules(definition) {
    if(definition.mechanicalRules)return definition;
    const familyNames={mortar:'Lobber',excavator:'Quarry Charge',dud:'Party Favor',carpet:'Carpet Stitch'};
    const generated=['Impact','Ember','Rime','Caustic','Ion','Tremor','Leech','Foam','Ferric','Unstable'].some(prefix=>definition.name===`${prefix} ${familyNames[definition.behavior]}`);
    const familyRule=generated?({mortar:['apex-dive'],excavator:['crosscut'],dud:['survey-charge'],carpet:['contact-fuse']}[definition.behavior]):undefined;
    const rules=authoredMechanicalRules[definition.name]||familyRule;
    if(!rules)return definition;
    const story=rules.map(rule=>ruleDescriptions[rule]).join(' '),summary=`${story} ${definition.description}`;
    return {...definition,mechanicalRules:[...rules],shortDescription:summary.length>180?`${summary.slice(0,176).replace(/\s+\S*$/,'')}…`:summary,description:`${definition.description} ${story}`};
}

const optionSemantics={
    roller:['downhill','returnToShooter','dirt','rubber','noCrater','pop','erase','zap'],
    split:['splitMode','alternateFire'], proximity:['splitMode'], spread:['side','gravity','pierce'], stream:['gravity'],
    guided:['pierce','wrap','gravity'], scatterbuild:['rubber','enemyTurret'], terraincoat:['crater','dirt','rubber','fire'],
    pillars:['rubber','splitMode'], selflaunch:['self','erase'], selfescape:[], selfshelter:['closed','rubber','tunnel'],
    sweep:['pierce','force'], radiallaser:['pierce'], orbitlaser:['pierce'], nonexcavate:['scramble','decay'],
    pitfall:['both','splitMode'], drillburst:['splitMode'], groundwave:['dirt','rubber','noCrater'], bouncer:['pop','gravity','splitMode','zap'],
};
// No ID, name, seed, color, damage, radius, count, range or strength appears here.
// Numeric fields are reduced to actual rule switches (gravity-free/pushing).
export function mechanicalSignature(definition) {
    if(definition.id>=0&&definition.id<30)return legacyMechanicalSignature(definition.id);
    definition=withMechanicalRules(definition);
    const mode=definition.classicMechanic||definition.behavior;
    const options=definition.options||{},meaning={};
    (optionSemantics[mode]||[]).forEach(key=>{
        if(options[key]===undefined)return;
        meaning[key]=typeof options[key]==='number' ? (key==='gravity' ? options[key]===0?'zero-gravity':'gravity' : !!options[key]) : options[key];
    });
    return JSON.stringify({mode,payload:definition.payload?.key,options:meaning,rules:definition.mechanicalRules||[]});
}

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const immediateModes=new Set(['shield','repair','cleanse','kamikaze','selfdome','selfrubberdome','well','pedestal','jump','randomblink','longtunnel','cheapshot','selflaunch','selfescape','selfbridge','selfshelter','sweep','selflaser','wavecoat','laser','rail']);

function earth(runtime,x,y,r=17,rubber=false) {
    if(runtime.dirtAt){runtime.dirtAt(x,y,r,rubber);return;}
    const c=runtime.terrain.context;c.save();c.fillStyle=rubber?'rgb(230,0,230)':'#77856a';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.restore();runtime.terrain.update();
    [runtime.scene.tank1,runtime.scene.tank2].forEach(t=>{t.settled=false;});
}
function lineCut(runtime,x1,y1,x2,y2,r=8) {
    const count=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/10));
    for(let i=0;i<=count;i++)runtime.carve(x1+(x2-x1)*i/count,y1+(y2-y1)*i/count,r);
}
function aftermath(runtime,p) {
    const x=clamp(p.x,3,runtime.terrain.width-3),surface=runtime.ground(x),y=clamp(Math.max(p.y,surface-10),0,runtime.terrain.height-2),scene=runtime.scene,tank=runtime.weapon.tank,foe=enemyOf(scene,tank),direction=runtime.direction||1;
    for(const rule of runtime.definition.mechanicalRules||[]) {
        if(rule==='crosscut'){lineCut(runtime,x-55,y,x+55,y);lineCut(runtime,x,y-45,x,y+45);}
        if(rule==='annular-moat')for(let i=0;i<18;i++){const a=i*Math.PI/9;runtime.carve(x+Math.cos(a)*48,y+Math.sin(a)*48,10);}
        if(rule==='stair-cut')for(let i=0;i<6;i++)runtime.carve(x+direction*i*18,y+i*15,13);
        if(rule==='roof-slot')lineCut(runtime,x-55,y-45,x+55,y-45,9);
        if(rule==='earth-plug')earth(runtime,x,y-10,24);
        if(rule==='arch-cover')runtime.build(x,y,'dome');
        if(rule==='bridge-span')runtime.build(x,y-20,'bridge');
        if(rule==='rubber-bed')runtime.coat(x,y,70,true);
        if(rule==='glue-bed'){runtime.coat(x,y,70,false);tanksInRange(scene,x,y,80).forEach(t=>{tankState(t).frost=2;tankState(t).frostMoves=0;});}
        if(rule==='mine-trap')addZone(scene,tank,'mine',x,y,32,runtime.definition.payload.key);
        if(rule==='oil-trail')for(const dx of [-55,0,55])addZone(scene,tank,'oil',clamp(x+dx,3,runtime.terrain.width-3),runtime.ground(x+dx),22,'fire');
        if(rule==='fire-vent'){lineCut(runtime,x,y,x,y-65,9);addZone(scene,tank,'fire',x,y,32,'fire');}
        if(rule==='acid-reservoir')addZone(scene,tank,'acid',x,y,42,'acid');
        if(rule==='cleanse-pulse'){clearZones(scene,x,y,95);tanksInRange(scene,x,y,95).forEach(t=>{const s=tankState(t);s.frost=0;s.frostMoves=0;s.acid=0;s.marked=0;});}
        if(rule==='shield-flip'&&Math.hypot(foe.x-x,foe.y-y)<110){const amount=Math.min(30,tankState(foe).shield);tankState(foe).shield-=amount;addShield(tank,amount);}
        if(rule==='inward-pull'||rule==='upward-kick')tanksInRange(scene,x,y,115).forEach(t=>{t.body.setVelocity(rule==='inward-pull'?Math.sign(x-t.x)*180:0,-230);t.body.setGravityY(300);t.settled=false;});
        if(rule==='aim-scramble')tanksInRange(scene,x,y,85).forEach(t=>t.turret.setRelativeRotation(t.turret.rotation+(runtime.random()<.5?-1:1)*Math.PI/2));
        if(rule==='reverse-fan')for(const offset of [-.25,0,.25])runtime.spawn(x,y-12,-direction*Math.cos(offset)*190,-130+Math.sin(offset)*80,{child:true,small:true});
        if(rule==='sky-echo')runtime.schedule(.65,()=>runtime.spawn(x,-8,0,240,{child:true,small:true}));
        if(rule==='twin-flanks'){runtime.carve(x-40,y+10,22);runtime.carve(x+40,y+10,22);}
        if(rule==='support-cut')lineCut(runtime,x-65,y+28,x+65,y+28,7);
        if(rule==='dirt-shower')for(const dx of [-50,-25,0,25,50])earth(runtime,clamp(x+dx,4,runtime.terrain.width-4),runtime.ground(x+dx)-3,12);
        if(rule==='survey-charge'&&!runtime.surveyRestored){runtime.surveyRestored=true;tank.movesRemaining=Math.min(8,(tank.movesRemaining||0)+1);}
    }
}

function flight(runtime) {
    const rules=runtime.definition.mechanicalRules||[],foe=enemyOf(runtime.scene,runtime.weapon.tank);
    for(const p of runtime.projectiles) {
        if(p.removed||p.child)continue;
        p.ruleClock=(p.ruleClock||0)+1;
        if(rules.includes('sine-flight'))p.vy+=Math.sin(p.ruleClock*.17)*18;
        if(rules.includes('zigzag-flight'))p.vx+=Math.floor(p.ruleClock/18)%2?-14:14;
        if(rules.includes('pulse-thrust')&&p.ruleClock%18===0){p.vx*=1.22;p.vy*=1.1;}
        if(rules.includes('wake-cut')&&p.ruleClock%5===0&&p.y>=0)runtime.carve(p.x,p.y+9,7);
        if(rules.includes('border-wrap')&&!p.ruleWrapped&&(p.x+p.vx/60<2||p.x+p.vx/60>runtime.terrain.width-2)){p.x=p.vx<0?runtime.terrain.width-4:4;p.ruleWrapped=true;}
        if(rules.includes('proximity-brake')&&!p.ruleBraked&&Math.hypot(p.x-foe.x,p.y-foe.y)<130){p.vx=0;p.vy=90;p.ruleBraked=true;}
        if(!p.ruleApex&&p.age>3&&p.vy>=0){
            p.ruleApex=true;
            if(rules.includes('apex-dive')){p.vx=0;p.vy=420;}
            if(rules.includes('apex-return'))p.vx*=-1;
            if(rules.includes('chute')){p.vx=0;p.vy=25;p.gravity=30;}
            if(rules.includes('gravity-flip')){p.gravity=-300;runtime.schedule(.65,()=>{p.gravity=300;});}
            if(rules.includes('ceiling-drop')){p.x=clamp(foe.x,4,runtime.terrain.width-4);p.y=-10;p.vx=0;p.vy=220;}
            if(rules.includes('low-skimmer')){p.vx=(runtime.direction||1)*220;p.gravity=0;p.ruleSkimming=true;}
        }
        if(p.ruleSkimming&&p.y>=0){const desired=runtime.ground(p.x+Math.sign(p.vx)*12)-18;p.vy=clamp((desired-p.y)*8,-180,180);}
    }
}

export function mayReleaseAtApex(runtime,p) {
    const rules=runtime.definition.mechanicalRules||[];
    if(rules.some(rule=>['contact-fuse','contact-bank','burrow-step'].includes(rule)))return false;
    if(rules.includes('apex-return'))return p.ruleApex&&Math.abs(p.x-runtime.weapon.tank.x)<70;
    if(rules.includes('gravity-flip'))return p.ruleApex&&p.gravity>0;
    if(rules.some(rule=>['chute','apex-dive','low-skimmer'].includes(rule)))return p.ruleApex&&(p.y>runtime.ground(p.x)-35||p.age>240);
    return true;
}

export function installMechanicalRules(runtime) {
    if(!runtime.definition.mechanicalRules?.length)return;
    const baseImpact=runtime.impact,baseShoot=runtime.shoot,baseUpdate=runtime.update;
    runtime.impact=p=>{
        if(p.removed)return;
        if(p.child){baseImpact(p);return;}
        const rules=runtime.definition.mechanicalRules;
        if(rules.includes('contact-fuse')&&!p.ruleFuseReady){
            p.removed=true;p.visual.destroy();
            const fuse=createWeaponProjectile(runtime.scene,p.x,p.y,runtime.fxOptions({phase:'fuse',fuse:true}));
            (runtime.ruleVisuals||(runtime.ruleVisuals=[])).push(fuse);
            // Fuse carrier remains in the scheduled event queue, keeping the
            // weapon alive; no wall-clock timer or random callback ordering.
            runtime.schedule(.8,()=>{fuse.destroy();runtime.ruleVisuals=runtime.ruleVisuals.filter(v=>v!==fuse);runtime.impact({...p,removed:false,ruleFuseReady:true,visual:{destroy(){}}});});return;
        }
        if(rules.includes('contact-bank')&&!p.ruleBanked){
            p.removed=true;p.visual.destroy();runtime.spawn(p.x,p.y-7,-p.vx*.7,-Math.max(100,Math.abs(p.vy)*.65),{gravity:300,ruleBanked:true,ruleFuseReady:p.ruleFuseReady});return;
        }
        if(rules.includes('burrow-step')&&!p.ruleBurrowed){
            const dir=runtime.direction||1;lineCut(runtime,p.x,p.y,p.x+dir*65,p.y,7);
            p.removed=true;p.visual.destroy();runtime.spawn(clamp(p.x+dir*65,3,runtime.terrain.width-3),p.y-3,dir*180,-120,{gravity:300,ruleBurrowed:true,ruleFuseReady:p.ruleFuseReady});return;
        }
        const carve=runtime.carve,retainsCore=rules.includes('annular-moat')||rules.includes('twin-flanks');
        if(retainsCore)runtime.carve=()=>{};
        try{baseImpact(p);}finally{runtime.carve=carve;}
        aftermath(runtime,p);
    };
    runtime.shoot=()=>{
        runtime.lastDeliveryPoint=null;baseShoot();
        const mode=runtime.definition.classicMechanic||runtime.definition.behavior;
        if(immediateModes.has(mode))aftermath(runtime,runtime.lastDeliveryPoint||{x:runtime.weapon.tank.x,y:runtime.weapon.tank.y});
    };
    runtime.update=()=>{flight(runtime);baseUpdate();};
    const dispose=runtime.dispose;
    runtime.dispose=()=>{(runtime.ruleVisuals||[]).forEach(v=>v.destroy());runtime.ruleVisuals=[];dispose();};
}

export function applyBuildingPayload(runtime,x,y,r) {
    applyPayload(runtime.weapon,x,y,r);
    // Leech cannot steal through non-scoring construction. Its builder variant
    // instead consumes nearby hostile shield charge to reinforce the builder.
    if(runtime.definition.payload.key==='leech') {
        const foe=enemyOf(runtime.scene,runtime.weapon.tank);
        if(Math.hypot(foe.x-x,foe.y-y)<r+24){const amount=Math.min(20,tankState(foe).shield);tankState(foe).shield-=amount;addShield(runtime.weapon.tank,amount);}
    }
}

const legacyRules=Object.freeze({1:['earth-plug'],2:['crosscut'],3:['stair-cut'],4:['support-cut'],7:['twin-flanks'],27:['dirt-shower'],28:['rubber-bed']});
export const legacyMechanicalRules=id=>[...(legacyRules[id]||[])];
// Auditable descriptions of the existing implementations, not weapon names or
// count aliases. The seven additional aftermaths distinguish the nearest old
// count/size relatives without replacing their original firing sequence.
const legacyModes=['shell','shell','muzzle-fan','muzzle-fan','repeat-impact-drill','proximity-snap-guidance','angle-probe-fan','repeat-depth-blasts','directional-widening-earth-cut','random-direction-cascade','impact-radial-spiderlings','hitscan-single-contact','animated-growing-wall','flying-earth-stream','proximity-score-ray','burning-particle-fall','timed-airborne-hail','surface-entering-burrower','continuous-underground-worm','guided-underground-worm','ricochet-contact-pop','impact-branching-blasts','impact-radial-fragments','timed-miniature-pops','overhead-vertical-turn','solid-earth-ball','sequential-turret-stream','wide-excavation','apex-scatter-fan','surface-following-cruiser'];
export const legacyMechanicalSignature=id=>JSON.stringify({mode:legacyModes[id],payload:'kinetic',options:{},rules:legacyMechanicalRules(id)});

export function applyLegacyAftermath(weapon,point) {
    const rules=legacyMechanicalRules(weapon?.id);
    if(!rules.length||weapon.legacyAftermathApplied||!weapon.terrain?.context||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return false;
    weapon.legacyAftermathApplied=true;
    const terrain=weapon.terrain,dirty=[];
    const adapter={weapon,scene:weapon.scene,terrain,definition:{mechanicalRules:rules,payload:{key:'kinetic'}},direction:Math.sign(Math.sin(weapon.turret.rotation))||1,
        ground(x){x=clamp(Math.round(x),0,terrain.width-1);for(let y=0;y<terrain.height;y++)if(terrain.getPixel(x,y).alpha)return y;return terrain.height-1;},
        carve(x,y,r){x=clamp(x,0,terrain.width-1);y=clamp(y,0,terrain.height-1);const c=terrain.context;c.save();c.globalCompositeOperation='destination-out';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.restore();dirty.push({x,y,r});},
        coat(x,y,r,rubber){const c=terrain.context;c.save();c.globalCompositeOperation='source-atop';c.fillStyle=rubber?'rgb(230,0,230)':'rgb(135,155,82)';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.restore();},
    };
    aftermath(adapter,point);terrain.update();
    dirty.forEach(({x,y,r})=>terrain.fixTerrain?.(Math.round(x),Math.round(y),Math.ceil(r)));
    [weapon.scene.tank1,weapon.scene.tank2].forEach(t=>{t.settled=false;});
    return true;
}
