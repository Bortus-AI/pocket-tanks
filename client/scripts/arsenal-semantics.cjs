// Serialized into the browser by check-arsenal.cjs; no Node closure dependencies.
module.exports = function checkWeaponSemantics() {
    const scene=window.game.scene.getScene('main-scene');scene.physics.world.pause();
    const failures=[],verified=[];
    const assert=(condition,message)=>{if(!condition)throw Error(message);};
    const opaque=()=>{const data=scene.terrain.context.getImageData(0,0,scene.terrain.width,scene.terrain.height).data;let n=0;for(let i=3;i<data.length;i+=4)if(data[i])n++;return n;};
    const fixture=behavior=>{
        const entry=scene.arsenal.catalog.find(w=>w.id>=30&&w.id<400&&w.behavior===behavior&&w.payload.key==='kinetic');
        if(!entry)throw Error(`Missing family ${behavior}`);
        if(scene.tacticalWorld){scene.tacticalWorld.zones.forEach(z=>z.visual?.destroy());Object.assign(scene.tacticalWorld,{shot:0,zones:[],nextZone:1});}
        scene.terrain.matrix=[];scene.terrain.blastArray=[];scene.terrain.setPath([{x:-200,y:350},{x:1400,y:350}]);
        [scene.tank1,scene.tank2].forEach((tank,i)=>{tank.tactics={shield:0,frost:0,frostMoves:0,acid:0,marked:0};tank.score=0;tank.movesRemaining=4;tank.setPosition(i?720:300,349);tank.centre={x:tank.x,y:343};tank.body.updateFromGameObject();tank.body.stop();tank.body.setGravity(0);tank.turret.setPosition(tank.x,tank.y-12);tank.turret.setRotation(Math.PI/3);tank.power=35;});
        const runtime=entry.createInstance(),weapon={scene,tank:scene.tank1,turret:scene.tank1.turret,terrain:scene.terrain};weapon.weaponHandler=runtime;runtime.create(weapon);
        const calls={burst:[],carve:[],build:[],beam:[],spawn:[]};
        Object.keys(calls).forEach(method=>{const original=runtime[method];runtime[method]=(...args)=>{calls[method].push(args);return original(...args);};});
        return {runtime,entry,calls,before:opaque()};
    };
    const finish=runtime=>{for(let i=0;i<965&&!runtime.done;i++)runtime.update();assert(runtime.done,'effect never finished');scene.terrain.matrix=[];scene.tweens.killAll();scene.children.list.filter(x=>['Arc','Ellipse','Line'].includes(x.type)).forEach(x=>x.destroy());};
    const hit=(runtime,x=720,y=350)=>{const p=runtime.projectiles[0]||{visual:scene.add.circle(x,y,1)};p.x=x;p.y=y;runtime.impact(p);};
    const cases={
        shell:f=>{f.runtime.shoot();hit(f.runtime);assert(f.runtime.events.length>0,'contact-fused shell skipped its delay');assert(opaque()===f.before,'contact-fused shell excavated before its fuse');finish(f.runtime);assert(opaque()<f.before,'shell did not destroy terrain after its fuse');assert(scene.tank1.score>0,'shell did not score enemy damage');},
        cluster:f=>{f.runtime.shoot();f.runtime.projectiles[0].vy=0;f.runtime.update();assert(f.runtime.projectiles.filter(p=>p.child).length===f.entry.count,'cluster did not split into its fan');},
        mortar:f=>{f.runtime.shoot();assert(f.runtime.projectiles[0].gravity===180,'mortar lacks low-gravity high arc');},
        barrage:f=>{f.runtime.shoot();assert(f.runtime.projectiles.length<f.entry.count&&f.runtime.events.length>0,'salvo did not stagger its launches');for(let tick=0;tick<60&&f.calls.spawn.length<f.entry.count;tick++)f.runtime.update();assert(f.calls.spawn.length===f.entry.count,'salvo did not launch all scheduled rounds');assert(new Set(f.calls.spawn.map(args=>args[2])).size>1,'salvo has no spread');},
        drill:f=>{f.runtime.shoot();f.runtime.projectiles.forEach(p=>p.visual.destroy());f.runtime.projectiles=[];f.runtime.spawn(500,370,200,0,{gravity:0});for(let i=0;i<30;i++)f.runtime.update();assert(f.calls.carve.length>3,'drill stopped at first contact');assert(scene.terrain.getPixel(550,370).alpha===0,'drill did not traverse underground');},
        tunnel:f=>{f.runtime.shoot();hit(f.runtime,600,350);finish(f.runtime);assert(f.calls.burst.length===f.entry.count,'tunnel has no sequence');assert(f.calls.burst.at(-1)[0]>f.calls.burst[0][0],'tunnel does not extend horizontally');},
        fault:f=>{f.runtime.shoot();hit(f.runtime,600,350);finish(f.runtime);assert(f.calls.burst.at(-1)[1]>f.calls.burst[0][1],'fault does not descend');assert(f.calls.burst.at(-1)[0]!==f.calls.burst[0][0],'fault is not slanted');},
        trench:f=>{f.runtime.shoot();hit(f.runtime,600,350);finish(f.runtime);assert(f.calls.burst.length===f.entry.count,'trench sequence missing');assert(f.calls.burst[0][0]<600&&f.calls.burst.at(-1)[0]>600,'trench does not spread both directions');},
        excavator:f=>{f.runtime.shoot();hit(f.runtime);assert(f.calls.carve[0][2]>=80,'excavator radius too narrow');assert(scene.tank1.score<20,'excavator no longer low scoring');},
        crater:f=>{f.runtime.shoot();hit(f.runtime,600,350);finish(f.runtime);assert(new Set(f.calls.burst.map(p=>p[0])).size===1,'sinkhole is not vertical');assert(f.calls.burst.at(-1)[1]>f.calls.burst[0][1],'sinkhole does not deepen');},
        wall:f=>{f.runtime.shoot();hit(f.runtime);assert(f.calls.build[0][2]==='wall'&&opaque()>f.before,'wall did not add cover');},
        dome:f=>{f.runtime.shoot();hit(f.runtime);assert(opaque()>f.before,'dome did not add cover');assert(scene.terrain.getPixel(720,330).alpha===0,'dome is not hollow');assert(scene.terrain.getPixel(720,294).alpha>0,'dome roof missing');},
        berm:f=>{f.runtime.shoot();hit(f.runtime);assert(opaque()>f.before&&scene.terrain.getPixel(720,320).alpha>0,'berm mound missing');},
        platform:f=>{f.runtime.shoot();hit(f.runtime);assert(opaque()>f.before&&scene.terrain.getPixel(720,344).alpha>0,'platform missing');},
        bridge:f=>{f.runtime.shoot();hit(f.runtime);assert(scene.terrain.getPixel(640,345).alpha>0&&scene.terrain.getPixel(800,345).alpha>0,'bridge does not span a gap');},
        shield:f=>{f.runtime.shoot();assert(scene.tank1.tactics.shield===70,'shield did not absorb points');assert(scene.tank1.score===0,'shield invented score');},
        repair:f=>{scene.tank1.tactics.acid=2;f.runtime.shoot();assert(scene.tank1.tactics.acid===0&&scene.tank1.tactics.shield===20&&scene.tank1.movesRemaining===5,'field repair did not cleanse/resupply');},
        cleanse:f=>{scene.tank1.tactics.frost=2;f.runtime.shoot();assert(scene.tank1.tactics.frost===0,'scrubber failed to cleanse');},
        mine:f=>{f.runtime.shoot();hit(f.runtime);assert(scene.tacticalWorld.zones.some(z=>z.kind==='mine'),'mine not planted');},
        oil:f=>{f.runtime.shoot();hit(f.runtime);assert(scene.tacticalWorld.zones.some(z=>z.kind==='oil'),'oil not spilled');},
        acidpool:f=>{f.runtime.shoot();hit(f.runtime);assert(scene.tacticalWorld.zones.some(z=>z.kind==='acid'),'acid pool missing');},
        emp:f=>{scene.tank2.tactics.shield=100;f.runtime.shoot();hit(f.runtime);assert(scene.tank2.tactics.shield===0&&scene.tank2.tactics.frost>0,'EMP did not strip and immobilize');},
        vortex:f=>{f.runtime.shoot();hit(f.runtime,650,350);assert(scene.tank2.body.velocity.x<0,'vortex does not pull toward impact');},
        repulsor:f=>{f.runtime.shoot();hit(f.runtime,650,350);assert(scene.tank2.body.velocity.x>0,'repulsor does not push away');},
        blink:f=>{f.runtime.shoot();hit(f.runtime,600,350);assert(scene.tank1.x===600,'blink did not relocate');},
        swap:f=>{f.runtime.shoot();hit(f.runtime);assert(scene.tank1.x===720&&scene.tank2.x===300,'exchange did not swap positions');},
        boomerang:f=>{f.runtime.shoot();const p=f.runtime.projectiles[0],vx=p.vx;for(let i=0;i<30;i++)f.runtime.update();assert(Math.sign(p.vx)===-Math.sign(vx),'boomerang did not return');},
        ricochet:f=>{f.runtime.shoot();const p=f.runtime.projectiles[0];Object.assign(p,{x:600,y:349,vx:100,vy:100});f.runtime.update();assert(p.bounces===1,'bank shot did not bounce');},
        skyfall:f=>{f.runtime.shoot();hit(f.runtime);for(let i=0;i<40;i++)f.runtime.update();assert(f.calls.spawn.filter(args=>args[4]?.child).length===f.entry.count,'orbital follow-up missing');},
        carpet:f=>{f.runtime.shoot();hit(f.runtime,600,350);finish(f.runtime);assert(f.calls.burst.length===f.entry.count&&f.calls.burst.at(-1)[0]-f.calls.burst[0][0]>=150,'carpet strip missing');},
        laser:f=>{f.runtime.shoot();assert(f.calls.beam.length===1&&f.calls.beam[0][2]===false,'laser not a blocking beam');},
        rail:f=>{f.runtime.shoot();assert(f.calls.beam.length===1&&f.calls.beam[0][2]===true,'rail not a penetrating beam');},
        seed:f=>{f.runtime.shoot();hit(f.runtime);assert([-46,-23,0,23,46].every(dx=>scene.terrain.getPixel(720+dx,325).alpha>0),'five growth pillars missing');},
        siphon:f=>{scene.tank2.tactics.shield=50;f.runtime.shoot();hit(f.runtime);assert(scene.tank1.tactics.shield===25&&scene.tank2.tactics.shield<50,'shield transfer missing');},
        dud:f=>{f.runtime.shoot();hit(f.runtime);assert(f.calls.carve[0][2]<=12&&scene.tank1.score<=2,'dud unexpectedly strong');},
        kamikaze:f=>{f.runtime.shoot();assert(scene.tank1.score<0,'self blast does not penalize the shooter');assert(f.calls.burst[0][0]===300,'self blast moved to opponent');},
        roulette:f=>{f.runtime.shoot();hit(f.runtime);assert(f.calls.burst.length===1&&[12,60,105].includes(f.calls.burst[0][2]),'mystery box lacks outcome branches');},
    };
    for(const [behavior,check] of Object.entries(cases)) {
        let f;
        try {f=fixture(behavior);check(f);verified.push(behavior);}
        catch(error){failures.push({behavior,error:error.message});}
        finally {if(f&&!f.runtime.done)finish(f.runtime);}
    }
    return {verified,failures};
};
