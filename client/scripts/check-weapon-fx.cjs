/* Build first, then run with Playwright available:
   PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-weapon-fx.cjs
   Captures actual renderer frames and stresses only presentation effects; game
   scoring, terrain, turn lifetimes, and online behavior have separate checks. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.CLIENT_BUILD_PATH||path.resolve(__dirname,'../build'));
const artifacts=process.env.FX_ARTIFACTS||'/tmp/pocket-weapon-fx';
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(!file.startsWith(`${root}${path.sep}`)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
 });
 let browser;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>window.game?.scene.getScene('loading-scene')?.load?.isLoading()===false,null,{timeout:30000});
  const fixture=async()=>{
   await page.evaluate(()=>{
    window.game.sound.mute=true;
    const weapons=[{id:30,name:'Impact Howitzer',type:0}];
    window.game.scene.start('main-scene',{gameType:4,player1:{name:'VANGUARD',color:0x6eaa99,weapons:weapons.map(w=>({...w}))},player2:{name:'SENTINEL',color:0xc59a76,weapons:weapons.map(w=>({...w}))}});
   });
   await page.waitForTimeout(100);
   await page.evaluate(()=>{
    const s=window.game.scene.getScene('main-scene');s.physics.world.pause();s.terrain.setPath([{x:-200,y:365},{x:1400,y:365}]);s.terrain.matrix=[];
    [s.tank1,s.tank2].forEach((t,i)=>{t.setPosition(i?900:280,364);t.body.updateFromGameObject();t.body.stop();t.body.setGravity(0);t.setRotation(0);t.settled=true;t.active=i===0;t.centre={x:t.x,y:t.y-6};t.power=45;t.turret.setPosition(t.x,t.y-12);t.turret.setRotation(Math.PI/3);});s.activeTank=1;s.HUD.reset();
   });
  };
  const emit=async scenario=>page.evaluate(scenario=>{
   const s=window.game.scene.getScene('main-scene');
   const spec={kinetic:['shell','kinetic'],fire:['shell','fire'],frost:['shell','frost'],ion:['rail','ion'],acid:['acidpool','acid'],shield:['shield','foam'],barrage:['barrage','volatile']}[scenario];
   const entry=s.arsenal.catalog.find(w=>w.id>=30&&w.id<400&&w.behavior===spec[0]&&w.payload.key===spec[1]);
   if(!entry)throw Error(`No fixture weapon for ${scenario}`);
   const runtime=entry.createInstance(),weapon={scene:s,tank:s.tank1,turret:s.tank1.turret,terrain:s.terrain};weapon.weaponHandler=runtime;runtime.create(weapon);
   if(['kinetic','fire','frost'].includes(scenario)){runtime.burst(610,363,72,1);runtime.finish();}
   else if(scenario==='ion'){runtime.beam({x:350,y:225},Math.atan2(360-225,790-350),true);runtime.finish();}
   else if(scenario==='acid'){runtime.impact({x:610,y:363,removed:false,visual:{destroy(){}}});runtime.finish();}
   else if(scenario==='shield'){runtime.shoot();runtime.update();}
   else{
    s.tank1.setPower(40);runtime.shoot();
    const tick=()=>{runtime.update();if(runtime.done)s.events.off('update',tick);};s.events.on('update',tick);s.events.once('shutdown',()=>s.events.off('update',tick));
   }
   window.testFXRuntime=runtime;
  },scenario);
  await page.evaluate(()=>{window.game.registry.set('terrainKind','random');window.game.scene.start('scene-2');});
  await page.waitForTimeout(100);
  const terrainChoices=[];
  for(let i=0;i<7;i++){
   terrainChoices.push(await page.evaluate(()=>window.game.scene.getScene('scene-2').children.list.find(child=>child.text?.startsWith('TERRAIN:'))?.text));
   await page.mouse.click(600,737);await page.waitForTimeout(20);
  }
  assert.equal(new Set(terrainChoices).size,7,'terrain selector must expose random plus six layouts');
  for(let i=0;i<5;i++){await page.mouse.click(600,737);await page.waitForTimeout(15);}
  assert.equal(await page.evaluate(()=>window.game.registry.get('terrainKind')),'plateaus');
  await fixture();
  assert.equal(await page.evaluate(()=>window.game.scene.getScene('main-scene').terrain.layoutKind),'plateaus','selected terrain did not carry into match');
  const terrainResults=[];
  for(const terrainKind of ['hills','basin','twinpeaks','ridgeline','plateaus','badlands']){
   await page.evaluate(terrainKind=>{
    const weapons=[{id:30,name:'Impact Howitzer',type:0}];
    window.game.scene.start('main-scene',{gameType:4,terrainKind,player1:{name:'VANGUARD',color:0x6eaa99,weapons:weapons.map(w=>({...w}))},player2:{name:'SENTINEL',color:0xc59a76,weapons:weapons.map(w=>({...w}))}});
   },terrainKind);
   await page.waitForTimeout(150);
   const map=await page.evaluate(()=>{const s=window.game.scene.getScene('main-scene');return {kind:s.terrain.layoutKind,spawnGap:Math.abs(s.tank1.x-s.tank2.x),width:s.terrain.width,positions:[s.tank1.x,s.tank1.y,s.tank2.x,s.tank2.y],shape:s.terrain.path.filter((p,i)=>i%20===0).map(p=>Math.round(p.y)).join(',')};});
   assert.equal(map.kind,terrainKind);assert.ok(map.spawnGap>=map.width*.45,`${terrainKind} tank deployments too close`);
   assert.ok(map.positions.every(Number.isFinite),`${terrainKind} invalid tank position`);
   terrainResults.push(map);await page.screenshot({path:path.join(artifacts,`terrain-${terrainKind}.png`)});
  }
  assert.equal(new Set(terrainResults.map(map=>map.shape)).size,6,'terrain profiles reused a silhouette');
  const frames=[],samples=[];
  for(const scenario of ['kinetic','fire','frost','ion','acid','shield','barrage']){
   await fixture();await emit(scenario);
   let elapsed=0;
   for(const ms of [100,300,800]){
    await page.waitForTimeout(ms-elapsed);elapsed=ms;
    const file=path.join(artifacts,`${scenario}-${ms}.png`);await page.screenshot({path:file,clip:{x:scenario==='shield'?40:300,y:145,width:700,height:385}});
    frames.push({scenario,ms,file});
    const sample=await page.evaluate(()=>{
     const s=window.game.scene.getScene('main-scene'),fx=s.weaponFX;
     if(!fx||typeof fx.stats!=='function')throw Error('Expected scene.weaponFX.stats()');
     return {...fx.stats(),canvas:fx.canvas?{width:fx.canvas.width,height:fx.canvas.height}:null};
    });samples.push({scenario,ms,...sample});
   }
  }
  // Stress real effect emission. Calling a presentation method does not carve
  // terrain or modify damage, so the compositor budget can be isolated here.
  await fixture();await emit('fire');
  const stress=await page.evaluate(()=>{
   const s=window.game.scene.getScene('main-scene'),r=window.testFXRuntime;
   const fx=s.weaponFX;fx.reset();
   for(let i=0;i<200;i++){
    const entry=s.arsenal.catalog[30+i];
    fx.impact(80+(i%12)*85,120+(i%5)*45,55,{weaponId:entry.id,weaponName:entry.name,payload:entry.payload.key,
     behavior:entry.behavior,classicMechanic:entry.classicMechanic,mechanicOptions:entry.options,semanticRules:entry.mechanicalRules,color:entry.payload.color});
   }
   return fx.stats();
  });
  if(stress.particleLimit!==undefined)assert.ok(stress.particleCount<=stress.particleLimit,'particle budget exceeded');
  if(stress.beamLimit!==undefined)assert.ok(stress.beamCount<=stress.beamLimit,'beam budget exceeded');
  assert.ok(stress.storyCount>0&&stress.storyCount<=stress.storyLimit,'authored animation stress must exercise and respect the storyboard budget');
  const drawSamples=[];
  for(let i=0;i<24;i++){await page.waitForTimeout(20);drawSamples.push(await page.evaluate(()=>window.game.scene.getScene('main-scene').weaponFX.stats().drawMs));}
  await page.waitForTimeout(5000);
  const settled=await page.evaluate(()=>window.game.scene.getScene('main-scene').weaponFX.stats());
  assert.equal(settled.particleCount,0,'expired one-shot particles remain active');
  assert.equal(settled.beamCount,0,'expired beams remain active');
  assert.equal(settled.burstCount,0,'expired impact envelopes remain active');
  assert.equal(settled.storyCount,0,'expired authored animations remain active');
  assert.equal(settled.projectileCount,0,'completed impacts left projectile visuals');
  assert.equal(settled.zoneCount,0,'one-shot effects created persistent hazard visuals');
  // Restart three times: old manager must be disposed and texture keys stable.
  const resetSamples=[];
  for(let i=0;i<3;i++){
   await fixture();await emit('kinetic');await page.waitForTimeout(50);
   resetSamples.push(await page.evaluate(()=>{const s=window.game.scene.getScene('main-scene');return {textures:Object.keys(s.textures.list).length,children:s.children.length,fx:s.weaponFX.stats()};}));
  }
  assert.equal(resetSamples[2].textures,resetSamples[0].textures,'scene restarts leaked textures');
  assert.deepEqual(errors,[],'VFX runtime errors');
  const report={scenarios:7,frames:frames.length,samples,stress,settled,restarts:resetSamples,terrainChoices,terrainResults,drawSamples,errors};
  fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify(report,null,2));
  // Render a labeled HTML contact sheet using the actual captured game frames.
  const sheet=await browser.newPage({viewport:{width:1232,height:900}});
  const imageRows=['kinetic','fire','frost','ion','acid','shield','barrage'].map(scenario=>`<section><h2>${scenario.toUpperCase()}</h2><div>${frames.filter(frame=>frame.scenario===scenario).map(frame=>`<figure><img src="data:image/png;base64,${fs.readFileSync(frame.file).toString('base64')}"/><figcaption>${frame.ms} ms</figcaption></figure>`).join('')}</div></section>`).join('');
  await sheet.setContent(`<html><head><style>body{margin:0;padding:16px;background:#091b24;color:#e7eddd;font:14px Arial}section{margin-bottom:20px}section h2{font-size:17px;letter-spacing:3px;margin:5px 0}section div{display:flex;gap:8px}figure{width:394px;margin:0}img{display:block;width:394px;height:auto;border:1px solid #4b6669}figcaption{text-align:center;padding:5px}</style></head><body><h1>WEAPON VFX / LIVE RENDERER FRAMES</h1>${imageRows}</body></html>`);
  await sheet.locator('img').last().waitFor();await delay(100);
  await sheet.screenshot({path:path.join(artifacts,'contact-sheet.png'),fullPage:true});
  console.log(JSON.stringify({scenarios:7,frames:frames.length,stress,settled,restartTextures:resetSamples.map(s=>s.textures),terrainProfiles:terrainResults.length,terrainChoices:terrainChoices.length,maxDrawMs:Math.max(...drawSamples.filter(Number.isFinite)),errors,artifacts}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
