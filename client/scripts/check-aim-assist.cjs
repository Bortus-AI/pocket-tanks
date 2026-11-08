/* Real built game; previews must leave terrain, scores, tactics, inventory and
   textures untouched. Representative assisted shots also run their real runtime. */
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.CLIENT_BUILD_PATH||path.resolve(__dirname,'../build');
(async()=>{
 const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+'/'))return res.writeHead(403).end();if(file.endsWith('/'))file+='index.html';try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 let browser;const errors=[],results=[];
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
  await page.goto(process.env.PUBLIC_CLIENT_URL||`http://127.0.0.1:${server.address().port}/?renderer=canvas`);
  await page.waitForFunction(()=>window.game?.scene.getScene('loading-scene')?.load.isLoading()===false,null,{timeout:45000});
  await page.evaluate(()=>{window.game.sound.mute=true;const weapons=[{id:0,name:'Single Shot',type:0}];window.game.scene.start('main-scene',{gameType:4,terrainKind:'plateaus',player1:{name:'AIM A',color:0x6eaa99,weapons},player2:{name:'AIM B',color:0xc59a76,weapons:weapons.map(w=>({...w}))}});});
  await page.waitForFunction(()=>window.game.scene.getScene('main-scene')?.arsenal);
  const renderer=await page.evaluate(()=>window.game.renderer.gl?'webgl':'canvas');
  if(process.env.PUBLIC_CLIENT_URL)assert.equal(renderer,'webgl','public default must use WebGL');
  await page.evaluate(()=>{
   const s=window.game.scene.getScene('main-scene');s.physics.world.pause();s.time.paused=true;
   window.aimSetup=(id,reverse=false,ridge=false,elevation=0)=>{
    Object.assign(s.terrain.context,{globalCompositeOperation:'source-over',globalAlpha:1});s.terrain.animate=false;s.terrain.blastArray=[];
    s.terrain.setPath(elevation?[{x:-200,y:350},{x:420,y:350},{x:640,y:350+elevation},{x:1400,y:350+elevation}]:ridge?[{x:-200,y:350},{x:450,y:350},{x:550,y:220},{x:620,y:350},{x:1400,y:350}]:[{x:-200,y:350},{x:1400,y:350}]);s.terrain.matrix=[];
    for(const [i,t] of [s.tank1,s.tank2].entries()){
     t.setPosition((i===0)!==reverse?300:720,349+(i?elevation:0));t.rotation=0;t.body.updateFromGameObject();t.body.stop();t.body.setGravity(0);t.centre={x:t.x,y:t.y-6};t.top={x:t.x,y:t.y-12};t.settled=true;t.active=i===0;t.tactics={shield:0,frost:0,frostMoves:0,acid:0,marked:0};t.score=0;t.turret.setPosition(t.x,t.y-12);t.turret.setRelativeRotation(reverse?-Math.PI/4:Math.PI/4);t.power=35;
    }
    s.tacticalWorld ||= {shot:0,zones:[],devices:[]};s.tacticalWorld.zones.forEach(z=>z.visual?.destroy());Object.assign(s.tacticalWorld,{shot:0,zones:[],devices:[],nextZone:1,nextDevice:1});
    s.physics.world.resume();s.physics.world._elapsed=0;for(let step=0;step<8;step++){s.physics.world.update(step*1000/60,1000/60);s.physics.world.postUpdate();}s.physics.world.pause();
    s.activeTank=1;s.tank1.weapons=[s.arsenal.catalog.find(w=>w.id===id)];s.tank1.selectedWeapon=0;
   };
   window.aimSnapshot=()=>({mask:s.terrain.exportMask(),scores:[s.tank1.score,s.tank2.score],tactics:JSON.stringify(s.tacticalWorld,(key,value)=>key==='visual'||key==='owner'?undefined:value),states:[s.tank1.tactics,s.tank2.tactics],inventory:s.tank1.weapons.map(w=>w.id),textures:Object.keys(s.textures.list).sort()});
  });
  const ids=process.env.AIM_IDS?process.env.AIM_IDS.split(',').map(Number):await page.evaluate(()=>window.game.scene.getScene('main-scene').arsenal.catalog.map(w=>w.id));
  for(const id of ids){
   const result=await page.evaluate(async id=>{
    aimSetup(id);const s=window.game.scene.getScene('main-scene'),before=JSON.stringify(aimSnapshot()),start=performance.now();
    try{const result=await s.tank1.autoAdjust();return {id,name:s.tank1.weapons[0].name,...result,launch:undefined,unchanged:before===JSON.stringify(aimSnapshot()),ms:Math.round(performance.now()-start)};}catch(e){return {id,error:e.stack};}
   },id);
   results.push(result);console.log(JSON.stringify(result));
  }
  const isolation=await page.evaluate(async()=>{
   aimSetup(30);const s=window.game.scene.getScene('main-scene'),t=s.tank1;let destroyed=0;
   t.tactics={shield:35,frost:1,frostMoves:1,acid:2,marked:1};
   s.tacticalWorld.zones=[{id:1,kind:'fire',x:t.x,y:t.y,radius:25,ttl:2,armedAt:0,payload:'fire',owner:s.tank2,visual:{destroy(){destroyed++;}}}];
   s.tacticalWorld.devices=[{id:1,kind:'silo',owner:s.tank2,x:800,y:350,heading:-1,ammo:2,heat:0,health:28,ttl:9,armedAt:0,lastReaction:-1,lastBoundary:0,buried:false,lock:{x:t.centre.x,y:t.centre.y}}];
   const before=JSON.stringify(aimSnapshot());const result=await t.autoAdjust();
   return {unchanged:before===JSON.stringify(aimSnapshot()),destroyed,status:result.status};
  });assert.ok(isolation.unchanged);assert.equal(isolation.destroyed,0);
  const cancelled=await page.evaluate(async()=>{
   aimSetup(0);const t=window.game.scene.getScene('main-scene').tank1,angle=t.turret.relativeRotation,pending=t.autoAdjust();t.setPower(1);const result=await pending;
   return {status:result.status,power:t.power,angleUnchanged:t.turret.relativeRotation===angle};
  });assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.power,1);assert.ok(cancelled.angleUnchanged);
  await page.evaluate(()=>{
   aimSetup(0);const s=window.game.scene.getScene('main-scene');s.HUD.mouseLocked=false;s.tank1.setPower(10);s.tank1.turret.setRelativeRotation(.15);
   const container=s.children.list.find(o=>o.list?.some(c=>c.text==='ASSIST AIM'));
   window.aimButtonText=container.list.find(c=>c.type==='Text');window.aimButton=container.list.find(c=>c.type==='Rectangle');
   aimButton.emit('pointerdown');if(aimButtonText.text!=='AIMING…'||aimButton.input.enabled)throw Error('assist button did not enter its pending state');
  });
  await page.waitForFunction(()=>aimButtonText.text==='ASSIST AIM'&&aimButton.input.enabled,null,{timeout:20000});
  assert.ok(await page.evaluate(()=>window.game.scene.getScene('main-scene').tank1.power>10),'assist button did not apply its result');
  const shots=[];
  if(process.env.AIM_VERIFY_SHOTS==='1'){
   const ids=await page.evaluate(()=>{
    const c=window.game.scene.getScene('main-scene').arsenal.catalog;
    return [...new Set([0,5,10,11,17,18,19,20,24,29,...['shell','mortar','laser','rail','barrage','boomerang','cluster','drill','ricochet'].map(b=>c.find(w=>w.createInstance&&w.behavior===b&&!w.classicMechanic)?.id),...['guided','split','bouncer','roller','projectilelaser'].map(m=>c.find(w=>w.classicMechanic===m)?.id)].filter(Number.isFinite))];
   });
   for(const id of ids)for(const layout of ['right','left','ridge','higher','lower']){
    const result=await page.evaluate(async ({id,layout})=>{
     aimSetup(id,layout==='left',layout==='ridge',layout==='higher'?-90:layout==='lower'?90:0);const s=window.game.scene.getScene('main-scene'),tank=s.tank1,entry=tank.weapons[0];
     const aim=await tank.autoAdjust(),coords=[];
     if(!['aimed','best'].includes(aim.status))return {id,layout,status:aim.status};
     // Run the actual Weapon and Phaser physics. Suppress post-impact terrain
     // collapse so this check isolates delivery accuracy against a fixed hull.
     const blast=s.terrain.blast;s.terrain.blast=()=>{};
     tank.shoot();const weapon=tank.turret.activeWeapon;
     const score=weapon.defaultUpdateScore;weapon.defaultUpdateScore=(x,y,r,f)=>{coords.push({x,y});return score(x,y,r,f);};
     weapon.shoot();weapon.allowUpdate=true;
     let ticks=0;
     s.physics.world.resume();s.physics.world._elapsed=0;
     while(ticks++<965&&tank.turret.activeWeapon){s.physics.world.update(ticks*1000/60,1000/60);s.physics.world.postUpdate();}
     s.physics.world.pause();s.terrain.blast=blast;
     const actual=tank.score;
     // Dispose remaining visuals and any test weapon that did not finish.
     const handler=weapon.weaponHandler;handler.dispose?.();
     for(const value of Object.values(handler))for(const o of Array.isArray(value)?value:[value])if(o?.scene===s&&o!==tank&&o!==s.tank2&&o.body)o.destroy();
     tank.turret.activeWeapon=null;s.tweens.killAll();s.terrain.matrix=[];
     return {id,name:entry.name,layout,status:aim.status,predictedScore:aim.score,distance:aim.distance,actual,ticks,coords};
    },{id,layout});
    shots.push(result);console.log('SHOT '+JSON.stringify(result));
   }
  }
  const failures=results.filter(r=>r.error||!r.unchanged||!['aimed','best','self','automatic','directional','blocked'].includes(r.status));
  fs.writeFileSync(process.env.AIM_REPORT||'/tmp/pocket-aim-report.json',JSON.stringify({renderer,results,shots,isolation,cancelled,failures,errors},null,2));
  assert.deepEqual(failures,[],'aim assist failed or mutated the live battlefield');assert.deepEqual(errors,[]);
  assert.deepEqual(shots.filter(s=>s.status==='aimed'&&s.actual<=0),[],'assisted real shots missed');
  console.log(JSON.stringify({passed:true,renderer,weapons:results.length,shots:shots.length}));
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
