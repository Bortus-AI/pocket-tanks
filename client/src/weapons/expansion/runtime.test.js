import { expansionCatalog } from './catalog';
import { ExpansionRuntime, hashSeed, rouletteRoll, BEAM_DAMAGE } from './runtime';
import { tankState, worldState, addZone, beginTacticalShot, safeLaunch } from './tactics';

const def=name=>{const d=expansionCatalog.find(w=>w.name===name);if(!d)throw new Error(name);return d;};
const fluent=()=>{const shape={destroy:jest.fn()};['setDepth','setStrokeStyle','setOrigin','setPosition','lineStyle','lineBetween','clear'].forEach(key=>shape[key]=jest.fn(()=>shape));return shape;};
const makeTank=x=>{
    const t={x,y:200,centre:{x,y:194},power:40,score:0,movesRemaining:4,settled:true,
        body:{setVelocity:jest.fn(),setGravityY:jest.fn(),stop:jest.fn(),updateFromGameObject:jest.fn()},
        updateScore(points){this.score+=points;},turret:{rotation:Math.PI/2,setRelativeRotation:jest.fn()},setPower:jest.fn()};
    t.isPointInside=(px,py)=>Math.abs(px-t.x)<12&&Math.abs(py-t.centre.y)<10;
    t.setPosition=(nx,ny)=>{t.centre={x:nx,y:ny-6};t.x=nx;t.y=ny;return t;};
    return t;
};
// Terrain: solid from y=200 down, except columns listed in `empty`.
const setup=(name,{empty=()=>false,rotation=Math.PI/2,power=40,shot=5,preview=false}={})=>{
    const a=makeTank(100),b=makeTank(400);a.power=power;
    const ctx=Object.fromEntries(['save','restore','beginPath','rect','clip','arc','ellipse','fill','stroke','moveTo','lineTo','closePath'].map(key=>[key,jest.fn()]));ctx.createLinearGradient=()=>({addColorStop:jest.fn()});
    const scene={tank1:a,tank2:b,events:{once:jest.fn(),off:jest.fn()},add:{graphics:fluent,circle:fluent,ellipse:fluent,line:fluent,text:jest.fn(fluent)},tweens:{add:jest.fn()},cache:{audio:{exists:()=>false}},isAimPreview:preview};
    const terrain={width:1200,height:533,context:ctx,update:jest.fn(),getPixel:(x,y)=>({alpha:y>=200&&!empty(Math.round(x))?255:0,red:60,green:70,blue:40}),getSlope:()=>0,fixTerrain:jest.fn()};
    scene.terrain=terrain;worldState(scene).shot=shot;
    const runtime=new ExpansionRuntime(def(name));
    const weapon={id:runtime.definition.id,scene,tank:a,turret:{x:100,y:188,rotation},terrain};runtime.create(weapon);
    return {runtime,scene,terrain,weapon,a,b};
};
const drain=runtime=>{for(let guard=0;guard<50&&runtime.events.length;guard++){const due=runtime.events;runtime.events=[];due.forEach(e=>e.fn());}};
const land=(runtime,x,y)=>runtime.impact({x,y,vx:100,vy:100,visual:{destroy(){}}});

describe('seed and Mystery Box',()=>{
    test('seed comes from synced turn data, never settled tank positions',()=>{
        const one=setup('Impact Starburst'),two=setup('Impact Starburst');
        two.a.x+=0.4;two.a.y+=0.6;
        const again=new ExpansionRuntime(def('Impact Starburst'));again.create({...two.weapon,tank:two.a});
        expect(again.seed).toBe(one.runtime.seed);
        expect(setup('Impact Starburst',{shot:6}).runtime.seed).not.toBe(one.runtime.seed);
        expect(setup('Impact Starburst',{power:41}).runtime.seed).not.toBe(one.runtime.seed);
        expect(hashSeed(1,2,3)).toBe(hashSeed(1,2,3));
    });
    test('roulette outcome ignores aim, follows the shot counter, and is hidden from the aim preview',()=>{
        const id=def('Impact Mystery Box').id;
        const rolls=Array.from({length:40},(_,shot)=>rouletteRoll(id,shot));
        expect(new Set(rolls.map(r=>r<.3?'back':r>.8?'jackpot':'dud')).size).toBe(3);
        const low=setup('Impact Mystery Box',{power:20}),high=setup('Impact Mystery Box',{power:90,rotation:1});
        land(low.runtime,400,200);land(high.runtime,400,200);
        expect(low.a.score).toBe(high.a.score);expect(low.b.score).toBe(high.b.score);
        const preview=setup('Impact Mystery Box',{preview:true});land(preview.runtime,400,200);
        expect(preview.a.score).toBe(0);expect(preview.b.score).toBe(0);expect(preview.runtime.lastDeliveryPoint).toEqual({x:400,y:200});
        expect(preview.terrain.context.arc).not.toHaveBeenCalled();
    });
});

describe('Phase Anchor and Exchange',()=>{
    test('blink samples ground in the clamped column and fizzles over an empty column',()=>{
        const {runtime,a,scene}=setup('Impact Phase Anchor',{empty:x=>x===24});
        land(runtime,3,150);
        expect(a.x).toBe(100);expect(scene.add.text).toHaveBeenCalledWith(expect.any(Number),expect.any(Number),'NO GROUND',expect.any(Object));
        const ok=setup('Impact Phase Anchor',{empty:x=>x===3});land(ok.runtime,3,150);
        expect(ok.a.x).toBe(24);expect(ok.a.y).toBe(199);
    });
    test('blink payload never harms the relocated owner',()=>{
        const {runtime,a,scene}=setup('Ember Phase Anchor');land(runtime,700,190);
        expect(worldState(scene).zones.filter(z=>z.kind==='fire')).toHaveLength(0);
        const volatile=setup('Unstable Phase Anchor');land(volatile.runtime,700,190);drain(volatile.runtime);
        expect(volatile.a.score).toBe(0);expect(a.score).toBe(0);
    });
    test('exchange carries the payload to the enemy at your old position',()=>{
        const {runtime,a,b}=setup('Rime Exchange');land(runtime,405,195);
        expect(a.x).toBe(400);expect(b.x).toBe(100);
        expect(tankState(b).frost).toBe(2);expect(tankState(a).frost).toBe(0);
    });
});

describe('beams',()=>{
    test('Rail Spike scales contact by strength and payload damage and scores once',()=>{
        const {runtime,a,b}=setup('Impact Rail Spike');runtime.shoot();
        expect(a.score).toBe(Math.round(BEAM_DAMAGE*.85));expect(a.score).toBe(55);expect(b.score).toBe(0);
        const prism=setup('Impact Prism Beam');prism.runtime.shoot();expect(prism.a.score).toBe(46);
    });
    test('Leech beam receives the real damage; Ember beam applies its payload once',()=>{
        const leech=setup('Leech Rail Spike');leech.runtime.shoot();
        expect(leech.a.score).toBe(36);expect(tankState(leech.a).shield).toBe(22);
        const ember=setup('Ember Prism Beam');ember.runtime.shoot();
        expect(worldState(ember.scene).zones.filter(z=>z.kind==='fire')).toHaveLength(1);
    });
    test('a missed beam still bursts and scores at its end point',()=>{
        const {runtime,a,b}=setup('Impact Prism Beam',{rotation:Math.PI*.75});b.x=900;b.centre={x:900,y:194};
        runtime.shoot();expect(runtime.terrain.context.arc).toHaveBeenCalled();expect(b.score).toBe(0);expect(a.score).toBeLessThanOrEqual(0);
    });
});

describe('per-shot payload accounting',()=>{
    test('multi-burst terrain families apply payload on every burst but fire zones stay grouped and capped',()=>{
        const {runtime,scene,b}=setup('Ember Mole Train');runtime.direction=1;land(runtime,400,186);drain(runtime);
        const fires=worldState(scene).zones.filter(z=>z.kind==='fire');
        expect(fires).toHaveLength(3);expect(new Set(fires.map(z=>z.group)).size).toBe(1);
        fires.forEach(z=>{z.x=400;z.y=194;z.radius=40;});
        const before=runtime.weapon.tank.score;beginTacticalShot(scene,b);
        expect(runtime.weapon.tank.score-before).toBe(12);
    });
    test('Ferric marks reach targets near middle bursts of a terrain chain',()=>{
        const {runtime,b}=setup('Ferric Trench Cutter');runtime.direction=1;b.x=400;b.centre={x:400,y:194};
        land(runtime,330,200);drain(runtime);
        expect(tankState(b).marked).toBe(2);
    });
    test('volatile delayed blast schedules once per shot at .65 of the delivered radius',()=>{
        const {runtime}=setup('Unstable Starburst');const spy=jest.spyOn(runtime,'schedule');
        runtime.burst(400,200);runtime.burst(420,200);runtime.burst(440,200);
        expect(spy).toHaveBeenCalledTimes(1);
        const burst=jest.spyOn(runtime,'burst');drain(runtime);
        const [,,r,strength,withPayload]=burst.mock.calls[0];
        expect(r*runtime.definition.payload.radius).toBeCloseTo(20*1.15*.65,5);expect(strength).toBeCloseTo(.65*.5,5);expect(withPayload).toBe(false);
    });
});

describe('support and builder payloads respect the owner',()=>{
    test('Ember Aegis leaves no flames on you; Unstable Aegis never detonates under you',()=>{
        const ember=setup('Ember Aegis');ember.runtime.shoot();
        expect(worldState(ember.scene).zones).toHaveLength(0);expect(tankState(ember.a).shield).toBe(70);
        const unstable=setup('Unstable Aegis');unstable.runtime.shoot();
        expect(unstable.runtime.events).toHaveLength(0);
        expect(unstable.a.score).toBeGreaterThan(-10);
    });
    test('Tremor support defuses nearby mines without blowing up the owner',()=>{
        const {runtime,scene,a}=setup('Tremor Field Medic');addZone(scene,scene.tank2,'mine',110,200,30,'kinetic');
        runtime.shoot();expect(worldState(scene).zones).toHaveLength(0);expect(a.score).toBe(0);
    });
    test('Ember Rampart built beside you does not burn you',()=>{
        const {runtime,scene}=setup('Ember Rampart');land(runtime,110,200);
        expect(worldState(scene).zones.filter(z=>z.kind==='fire')).toHaveLength(0);
        const far=setup('Ember Rampart');land(far.runtime,400,200);
        expect(worldState(far.scene).zones.filter(z=>z.kind==='fire')).toHaveLength(1);
    });
});

describe('map edges',()=>{
    test('pushes are clamped so a tank cannot be launched off the map',()=>{
        const t=makeTank(1100),scene={terrain:{width:1200,height:533}};
        const vx=safeLaunch(scene,t,600,-200);
        expect(t.x+vx*((200+Math.sqrt(200*200+2*300*333))/300)).toBeLessThanOrEqual(1200-24+1e-6);
        expect(safeLaunch(scene,t,-300,-200)).toBe(-300);
    });
    test('a mine that leaves the map fizzles with visible feedback',()=>{
        const {runtime,scene}=setup('Impact Buried Gift');
        runtime.spawn(1195,100,600,0,{gravity:0});runtime.update();
        expect(runtime.projectiles).toHaveLength(0);
        expect(scene.add.text).toHaveBeenCalledWith(expect.any(Number),expect.any(Number),'OFF MAP',expect.any(Object));
    });
});
