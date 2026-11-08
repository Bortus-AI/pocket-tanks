/* Build first. Real deployment capsules, independent clients, offline-owner
   reactions and actual server-process/disk recovery.
   PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-deployables.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fork}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async(fn,message,timeout=45000)=>{const start=Date.now();while(!await fn()){if(Date.now()-start>timeout)throw Error(message);await delay(70);}};
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pocket-devices-')),storePath=path.join(directory,'rooms.json');
 let child,port,browser,hostContext,guestContext,host,guest,roomId,stage='startup',requestId=0,recovered=false;
 const errors=[],logs=[],shots=[],checks=[];
 const mark=value=>{stage=value;console.log(`CHECK ${value}`);};
 const startServer=async()=>{
  child=fork(path.join(__dirname,'fixtures/deployables-server.mjs'),[],{env:{...process.env,DEVICE_STORE:storePath,DEVICE_PORT:String(port||0),DEVICE_RECOVERED:recovered?'1':'0'},stdio:['ignore','pipe','pipe','ipc']});
  child.stdout.on('data',data=>logs.push(String(data)));child.stderr.on('data',data=>logs.push(String(data)));
  port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server startup timeout')),15000);child.once('exit',code=>{clearTimeout(timer);reject(Error(`server exited ${code}: ${logs.join('')}`));});child.on('message',function ready(message){if(message?.type==='ready'){clearTimeout(timer);child.off('message',ready);resolve(message.port);}});});
 };
 const stopServer=async()=>{if(!child||child.exitCode!==null)return;const target=child;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{target.kill('SIGKILL');reject(Error('server shutdown timeout'));},10000);target.once('exit',()=>{clearTimeout(timer);resolve();});target.kill('SIGTERM');});child=null;};
 const rpc=(type,data={})=>new Promise((resolve,reject)=>{const id=++requestId,target=child;const reply=message=>{if(message?.type==='reply'&&message.requestId===id){clearTimeout(timer);target.off('message',reply);resolve(message.data);}},timer=setTimeout(()=>{target.off('message',reply);reject(Error(`${type} IPC timeout`));},5000);target.on('message',reply);target.send({type,roomId,...data,requestId:id});});
 const inspect=()=>rpc('inspect');
 const disk=()=>{try{return JSON.parse(fs.readFileSync(storePath,'utf8')).rooms.find(room=>room.roomId===roomId);}catch{return null;}};
 const pageFor=async context=>{const page=await context.newPage();page.on('pageerror',error=>{errors.push(error.stack||error.message);console.error('PAGE ERROR',error.stack);});return page;};
 const load=async page=>{await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>window.socket?.connected&&window.game?.scene.getScene('loading-scene')?.load?.isLoading()===false,null,{timeout:30000});await page.evaluate(()=>{window.game.sound.mute=true;});};
 const ready=(page,key)=>page.waitForFunction(key=>{const s=window.game?.scene.getScene(key);return s?.scene.isActive()&&(!['main-scene','scene-5'].includes(key)||(!window.onlineSession?.paused&&!window.onlineSession?.restoring));},key,{timeout:40000});
 const resume=async context=>{const page=await pageFor(context);await load(page);await page.evaluate(()=>window.game.scene.start('scene-1'));await ready(page,'scene-1');await page.evaluate(()=>{const button=window.game.scene.getScene('scene-1').children.list.find(v=>typeof v.text==='string'&&v.text.startsWith('RESUME ONLINE MATCH'));if(!button)throw Error('Missing saved match Resume');button.emit('pointerdown');});await ready(page,'main-scene');return page;};
 const state=page=>page.evaluate(()=>{
  const s=window.game.scene.getScene('main-scene'),role=window.onlineSession.role,other=role==='host'?'player':'host';
  const devices=(s.tacticalWorld?.devices||[]).map(({owner,...device})=>({...device,owner:owner===s.tank1?role:other}));
  return {role,playerId:window.onlineSession.playerId,turn:s.onlineTurnNumber,activeRole:s.activeTank===1?role:s.activeTank===2?other:null,devices,
   inventories:{[role]:s.tank1.weapons.map(w=>w.id),[other]:s.tank2.weapons.map(w=>w.id)},scores:{[role]:s.tank1.score,[other]:s.tank2.score},fx:!!s.deployableFX};
 });
 const canonicalDevices=()=>{const snapshot=disk().snapshot;return (snapshot.state.tactics.devices||[]).map(device=>({...device,owner:device.owner===1?snapshot.role:snapshot.role==='host'?'player':'host'}));};
 const settle=async(turn,activeRole,pages=[host,guest])=>{
  await wait(()=>disk()?.snapshot?.state?.turnNumber===turn&&disk().snapshot.state.activeRole===activeRole,`turn ${turn} did not commit`);
  const canonical=canonicalDevices();
  for(const page of pages){
   await page.waitForFunction(({turn,activeRole})=>{const s=window.game?.scene.getScene('main-scene'),role=window.onlineSession.role;if(!s?.scene.isActive()||window.onlineSession.paused||window.onlineSession.restoring)return false;const active=s.activeTank===1?role:s.activeTank===2?(role==='host'?'player':'host'):null;return s.onlineTurnNumber===turn&&active===activeRole&&!s.tank1.turret.activeWeapon&&!s.tank2.turret.activeWeapon&&!s.terrain.animate&&!s.terrain.blastArray.length&&s.tank1.settled&&s.tank2.settled;},{turn,activeRole},{timeout:45000});
   const value=await state(page);assert.deepEqual(value.devices,canonical,`${value.role} device state/ownership differs from canonical`);
  }
  checks.push({turn,activeRole,devices:canonical.map(({id,kind,owner,ammo,heat,lock})=>({id,kind,owner,ammo,heat,lock}))});
  return canonical;
 };
 const fire=async(page,id,{power=25,rotation=Math.PI/4,capture}={})=>{
  const before=await state(page);
  await page.evaluate(({id,power,rotation})=>{const s=window.game.scene.getScene('main-scene'),t=s.tank1,index=t.weapons.findIndex(w=>w.id===id);if(index<0)throw Error(`Missing weapon ${id}`);t.selectedWeapon=index;t.setPower(power);t.turret.setRelativeRotation(rotation-t.rotation);s.HUD.reset();},{id,power,rotation});
  const result=await page.evaluate(async()=>window.game.scene.getScene('main-scene').HUD.fire());
  assert.equal(result?.ok,true,`actual FIRE rejected: ${JSON.stringify(result)}`);
  await page.waitForFunction(length=>window.game.scene.getScene('main-scene').tank1.weapons.length===length-1,before.inventories[before.role].length);
  if(capture){await delay(180);await page.screenshot({path:`/tmp/pocket-deployables-${capture}-capsule.png`});}
  shots.push({role:before.role,id,turn:before.turn});
 };
 const screenshot=async(page,name)=>page.screenshot({path:`/tmp/pocket-deployables-${name}.png`});
 try{
  await startServer();const firstPort=port;
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
  hostContext=await browser.newContext({viewport:{width:1200,height:800}});guestContext=await browser.newContext({viewport:{width:1200,height:800}});
  host=await pageFor(hostContext);guest=await pageFor(guestContext);await Promise.all([load(host),load(guest)]);
  mark('real lobby and deterministic shared-device draft');
  for(const [page,name,color]of [[host,'DEVICE HOST',0x6eaa99],[guest,'DEVICE PLAYER',0xc59a76]])await page.evaluate(({name,color})=>window.game.scene.start('scene-4',{gameType:3,player1:{name,color}}),{name,color});
  await Promise.all([ready(host,'scene-4'),ready(guest,'scene-4')]);await host.evaluate(()=>window.game.scene.getScene('scene-4').children.list.find(v=>v.text==='CREATE ROOM').emit('pointerdown'));
  await host.waitForFunction(()=>window.onlineSession?.roomId);roomId=await host.evaluate(()=>window.onlineSession.roomId);
  await guest.waitForFunction(id=>window.game.scene.getScene('scene-4').roomList?.some(v=>v.roomId===id),roomId);await guest.evaluate(id=>window.game.scene.getScene('scene-4').roomList.find(v=>v.roomId===id).z.emit('pointerdown'),roomId);
  await Promise.all([ready(host,'scene-5'),ready(guest,'scene-5')]);await host.waitForFunction(()=>window.game.scene.getScene('scene-5').onlineDraft?.state?.pool.length===20);
  const ids=await host.evaluate(()=>{const catalog=window.game.scene.getScene('scene-5').arsenal.catalog;return Object.fromEntries(['Auto Turrets','Missile Turret',"Run 'n' Gun",'Single Shot','Impact Aegis'].map(name=>[name,catalog.find(w=>w.name===name)?.id]));});
  assert.ok(Object.values(ids).every(Number.isInteger));
  const hostPool=[ids['Auto Turrets'],ids['Missile Turret'],ids["Run 'n' Gun"],...Array(7).fill(ids['Single Shot'])],pool=hostPool.flatMap((id,index)=>[id,index===2?ids['Impact Aegis']:ids['Single Shot']]);
  assert.equal((await rpc('pool',{pool})).ok,true);
  for(let index=0;index<20;index++){
   const page=index%2?guest:host,role=index%2?'player':'host';
   await wait(async()=>(await inspect()).draft.turn===role,'draft turn did not arrive');
   // Server persistence can finish before its draftState reaches the next
   // browser. Wait for that browser's authoritative UI state before clicking.
   await page.waitForFunction(({role,index,weaponId,owned})=>{
    const draft=window.game?.scene.getScene('scene-5')?.onlineDraft,state=draft?.state;
    return !window.onlineSession?.paused&&!window.onlineSession?.restoring&&state?.turn===role&&
     state.pool.length===20&&state.pool[index]===weaponId&&state.picks[role].length===owned&&
     !state.picks.host.includes(index)&&!state.picks.player.includes(index)&&!!draft.rows[index];
   },{role,index,weaponId:pool[index],owned:Math.floor(index/2)},{timeout:30000});
   await page.evaluate(index=>{const d=window.game.scene.getScene('scene-5').onlineDraft;d.rows[index].background.emit('pointerdown');d.buttons.select.background.emit('pointerdown');},index);
   await wait(async()=>(await inspect()).draft.picks[role].length===Math.floor(index/2)+1,'pick was not committed');
  }
  for(const page of [host,guest])await page.evaluate(()=>window.game.scene.getScene('scene-5').onlineDraft.buttons.continue.background.emit('pointerdown'));
  await Promise.all([ready(host,'main-scene'),ready(guest,'main-scene')]);
  mark('flat terrain and positions configured before the first durable baseline');
  await Promise.all([host,guest].map(page=>page.evaluate(()=>{
   const s=window.game.scene.getScene('main-scene'),role=window.onlineSession.role;
   s.terrain.setPath([{x:0,y:350,profile:'hills'},{x:1200,y:350}]);s.terrain.matrix=[];s.terrain.animate=false;s.terrain.blastArray=[];
   for(const [tank,x]of [[s.tank1,role==='host'?200:550],[s.tank2,role==='host'?550:200]]){tank.setPosition(x,350);tank.setRotation(0);tank.body.updateFromGameObject();tank.body.stop();tank.body.setGravity(0);tank.settled=true;tank.centre={x,y:344};}
   s.terrain.save();s.HUD.reset();
   if(role==='host')window.socket.emit('terrainPath',{path:s.terrain.path,hostPos:{x:200,y:350},playerPos:{x:550,y:350}});
  })));
  await rpc('baseline');await settle(0,'host');
  assert.equal(disk().snapshot.state.players.host.x,200);assert.equal(disk().snapshot.state.players.player.x,550);
  mark('actual Auto Turrets capsule unfolds two persistent guns');
  await fire(host,ids['Auto Turrets'],{capture:'sentries'});let devices=await settle(1,'player');
  assert.equal(devices.filter(d=>d.kind==='sentry').length,2);assert.ok(devices.every(d=>d.owner==='host'&&d.ammo===6));
  await screenshot(host,'sentries-deployed');
  const hostId=(await state(host)).playerId;await host.close();await wait(async()=>!(await inspect()).host.connected,'host did not go offline');
  mark('guest shot triggers the offline owner\'s sentries exactly once');
  await fire(guest,ids['Single Shot'],{power:8,rotation:0});devices=await settle(2,'host',[guest]);
  assert.equal(devices.filter(d=>d.kind==='sentry').length,2);assert.ok(devices.every(d=>d.ammo===4&&d.heat===2&&d.lastBoundary===2));
  const afterReaction=JSON.parse(JSON.stringify(devices));await rpc('duplicateCheckpoint');await delay(250);assert.deepEqual((await state(guest)).devices,afterReaction,'duplicate checkpoint fired sentries again');
  await screenshot(guest,'offline-owner-reaction');
  mark('close both browsers and restart the actual durable server on the same port');
  await guest.close();const saved=JSON.parse(JSON.stringify(disk().snapshot));await stopServer();recovered=true;await startServer();assert.equal(port,firstPort);assert.deepEqual(disk().snapshot,saved);
  host=await resume(hostContext);devices=await settle(2,'host',[host]);assert.deepEqual(devices,afterReaction);assert.equal((await state(host)).playerId,hostId);
  guest=await resume(guestContext);await settle(2,'host');await screenshot(host,'after-server-restart');
  mark('actual Missile Turret capsule deploys a separate silo');
  await fire(host,ids['Missile Turret'],{capture:'silo'});devices=await settle(3,'player');assert.equal(devices.filter(d=>d.kind==='silo').length,1);assert.equal(devices.find(d=>d.kind==='silo').ammo,2);
  await screenshot(host,'silo-deployed');
  await fire(guest,ids['Single Shot'],{power:8,rotation:0});devices=await settle(4,'host');const silo=devices.find(d=>d.kind==='silo');assert.ok(silo.lock,'silo did not retain its visible delayed target lock');assert.equal(silo.ammo,2);
  await screenshot(host,'silo-locked');
  mark('reload preserves the silo lock without an extra reaction');
  const locked=JSON.parse(JSON.stringify(devices));await host.reload();await ready(host,'main-scene');await settle(4,'host');assert.deepEqual((await state(host)).devices,locked);
  mark('actual Run n Gun capsule deploys the mobile firing drone while silo launches');
  await fire(host,ids["Run 'n' Gun"],{capture:'runner'});devices=await settle(5,'player');
  const runner=devices.find(d=>d.kind==='runner');assert.ok(runner);assert.equal(runner.ammo,9);assert.equal(devices.find(d=>d.kind==='silo').ammo,1);assert.equal(devices.find(d=>d.kind==='silo').lock,null);
  await screenshot(host,'runner-deployed');
  mark('clear forward firing lane proves a three-round drone strafe, then defensive Aegis');
  const targetX=runner.x+130,hostScoreBefore=(await state(guest)).scores.host;
  await guest.evaluate(({targetX,runnerX})=>{
   const s=window.game.scene.getScene('main-scene'),terrain=s.terrain,ctx=terrain.context,x=Math.floor(runnerX-30),width=Math.ceil(targetX-runnerX+70);
   ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fillRect(x,0,width,350);ctx.globalCompositeOperation='source-over';ctx.fillStyle='#637055';ctx.fillRect(x,350,width,terrain.height-350);ctx.restore();terrain.update();terrain.save();
   const t=s.tank1;t.setPosition(targetX,350);t.setRotation(0);t.body.updateFromGameObject();t.body.stop();t.body.setGravity(0);t.settled=true;t.centre={x:targetX,y:344};s.HUD.reset();
  },{targetX,runnerX:runner.x});
  await fire(guest,ids['Impact Aegis'],{power:8,rotation:0});
  // Capture during the cosmetic run, before tracer/casing actors expire.
  await delay(300);await screenshot(guest,'runner-tracers');
  devices=await settle(6,'host');const moved=devices.find(d=>d.kind==='runner');assert.ok(moved);assert.ok(Math.abs(moved.x-runner.x-84)<.01,'Run n Gun must advance through all six run segments');assert.equal(moved.ammo,6,'Run n Gun did not fire three actual rounds');assert.equal(moved.lastReaction,6);assert.equal(moved.heat,1);
  assert.ok((await state(guest)).scores.host>=hostScoreBefore+24,'actual strafing hits did not award the owner points');
  await screenshot(guest,'runner-firing-run');
  assert.deepEqual(errors,[],'browser runtime errors');
  const report={actualCapsules:ids,independentClients:true,flatBaseline:true,offlineOwnerReaction:true,duplicateCheckpointNoExtraReaction:true,durableDeviceFields:true,serverProcessRestart:true,samePort:true,identityPreserved:true,siloLockSurvivesReload:true,mobileDroneRun:true,shots,checks,errors};
  fs.writeFileSync('/tmp/pocket-deployables-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(error){
  console.error(`FAILED ${stage}: ${error.stack}`);
  for(const [name,page]of [['host',host],['guest',guest]])if(page&&!page.isClosed())try{await screenshot(page,`failure-${name}`);console.error(name,await state(page));}catch{}
  try{console.error('server state',JSON.stringify(await inspect()));}catch{}console.error('logs',logs.join(''));throw error;
 }finally{await browser?.close();await stopServer();}
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
