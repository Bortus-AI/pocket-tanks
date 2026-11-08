/* Build first. Real independent browsers, controlled relay latency, real shots,
   durable turn recovery, and browser-process/server-process reconnect coverage.
   PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-multiplayer-turns.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fork}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async(fn,message,timeout=45000)=>{const start=Date.now();while(!await fn()){if(Date.now()-start>timeout)throw Error(message);await delay(80);}};
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pocket-turns-')),storePath=path.join(directory,'rooms.json');
 let child,port,browser,hostContext,guestContext,host,guest,roomId,stage='startup',requestId=0;
 const errors=[],logs=[],shots=[],checks=[];
 const mark=value=>{stage=value;console.log(`CHECK ${value}`);};
 const startServer=async()=>{
  child=fork(path.join(__dirname,'fixtures/multiplayer-turns-server.mjs'),[],{env:{...process.env,TURNS_STORE:storePath,TURNS_PORT:String(port||0)},stdio:['ignore','pipe','pipe','ipc']});
  child.stdout.on('data',data=>logs.push(String(data)));child.stderr.on('data',data=>logs.push(String(data)));
  port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server startup timeout')),15000);child.once('exit',code=>{clearTimeout(timer);reject(Error(`server exited ${code}: ${logs.join('')}`));});child.on('message',function ready(message){if(message?.type==='ready'){clearTimeout(timer);child.off('message',ready);resolve(message.port);}});});
 };
 const stopServer=async()=>{if(!child||child.exitCode!==null)return;const target=child;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{target.kill('SIGKILL');reject(Error('server shutdown timeout'));},10000);target.once('exit',()=>{clearTimeout(timer);resolve();});target.kill('SIGTERM');});child=null;};
 const rpc=(type,data={})=>new Promise((resolve,reject)=>{if(!child?.connected)return reject(Error('Server IPC unavailable'));const target=child,id=++requestId,reply=message=>{if(message?.type==='reply'&&message.requestId===id){clearTimeout(timer);target.off('message',reply);resolve(message.data);}},timer=setTimeout(()=>{target.off('message',reply);reject(Error(`${type} timeout`));},5000);target.on('message',reply);target.send({type,...data,requestId:id},error=>{if(error){clearTimeout(timer);target.off('message',reply);reject(error);}});});
 const inspect=()=>rpc('inspect',{roomId});
 const disk=()=>JSON.parse(fs.readFileSync(storePath,'utf8')).rooms.find(room=>room.roomId===roomId);
 const makePage=async context=>{const page=await context.newPage();page.on('pageerror',error=>{errors.push(error.stack||error.message);console.error('BROWSER ERROR',error.stack);});return page;};
 const load=async page=>{await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>window.socket?.connected&&window.game?.scene.getScene('loading-scene')?.load?.isLoading()===false,null,{timeout:30000});await page.evaluate(()=>{window.game.sound.mute=true;});};
 const ready=(page,key)=>page.waitForFunction(key=>{const s=window.game?.scene.getScene(key);return s?.scene.isActive()&&(!['main-scene','scene-5'].includes(key)||(!window.onlineSession?.paused&&!window.onlineSession?.restoring));},key,{timeout:45000});
 const draftButton=(page,key)=>page.evaluate(key=>{const button=window.game.scene.getScene('scene-5').onlineDraft.buttons[key];if(!button)throw Error(`No draft button ${key}`);button.background.emit('pointerdown');},key);
 const pick=async(page,index)=>{
  // The relay can commit a turn before its state update reaches this browser.
  // Wait for the local UI to enable picking before emitting the user's click.
  await page.waitForFunction(()=>{const d=window.game.scene.getScene('scene-5').onlineDraft;return d?.state?.turn===d.role&&d.buttons.random.text.alpha===1;},null,{timeout:45000});
  return page.evaluate(index=>{const d=window.game.scene.getScene('scene-5').onlineDraft;d.rows[index].background.emit('pointerdown');d.buttons.select.background.emit('pointerdown');},index);
 };
 const resume=async context=>{const page=await makePage(context);await load(page);await page.evaluate(()=>window.game.scene.start('scene-1'));await ready(page,'scene-1');await page.evaluate(()=>{const b=window.game.scene.getScene('scene-1').children.list.find(v=>typeof v.text==='string'&&v.text.startsWith('RESUME ONLINE MATCH'));if(!b)throw Error('Missing saved match Resume');b.emit('pointerdown');});await ready(page,'main-scene');return page;};
 const state=page=>page.evaluate(()=>{
  const s=window.game.scene.getScene('main-scene'),role=window.onlineSession.role,other=role==='host'?'player':'host';
  const tank=t=>({x:t.x,y:t.y,score:t.score,active:t.active,power:t.power,selected:t.selectedWeapon,weapons:t.weapons.map(w=>w.id),weapon:t.turret.activeWeapon?.id??null});
  return {role,playerId:window.onlineSession.playerId,activeRole:s.activeTank===1?role:s.activeTank===2?other:null,turn:s.onlineTurnNumber??window.onlineSession.turn?.number??s.tacticalWorld?.shot??0,shot:s.tacticalWorld?.shot||0,
   players:{[role]:tank(s.tank1),[other]:tank(s.tank2)},terrain:s.terrain.exportMask(),path:s.terrain.path,paused:window.onlineSession.paused,restoring:window.onlineSession.restoring,pendingShot:!!s.onlineShotId};
 });
 const settled=async(page,turn,activeRole)=>page.waitForFunction(({turn,activeRole})=>{
  const s=window.game?.scene.getScene('main-scene');if(!s?.scene.isActive()||window.onlineSession?.paused||window.onlineSession?.restoring)return false;
  const role=window.onlineSession.role,actual=s.activeTank===1?role:s.activeTank===2?(role==='host'?'player':'host'):null;
  return actual===activeRole&&(s.onlineTurnNumber??window.onlineSession.turn?.number??s.tacticalWorld?.shot??0)===turn&&!s.tank1.turret.activeWeapon&&!s.tank2.turret.activeWeapon&&!s.terrain.animate&&!s.terrain.blastArray.length&&s.tank1.settled&&s.tank2.settled;
 },{turn,activeRole},{timeout:45000});
 const compare=async(turn,activeRole,pages=[host,guest])=>{
  await wait(()=>disk()?.snapshot?.state?.turnNumber===turn&&disk().snapshot.state.activeRole===activeRole,`server did not commit turn ${turn}`);
  await Promise.all(pages.map(page=>settled(page,turn,activeRole)));
  const canonical=disk().snapshot.state,observed=await Promise.all(pages.map(state));
  const room=await inspect();assert.equal(room.turn.number,turn,'server authority differs from checkpoint turn');assert.equal(room.turn.activeRole,activeRole);assert.equal(room.turn.pendingShot??null,null,'settled turn retained pending shot');assert.equal(room.completedShots.length,turn,'completed-shot ledger differs from played shots');
  for(const value of observed){
   assert.equal(value.activeRole,activeRole);assert.equal(value.turn,turn);assert.equal(value.players.host.active?1:0,value.activeRole==='host'?1:0);assert.equal(value.players.player.active?1:0,value.activeRole==='player'?1:0);
   assert.equal(Number(value.players.host.active)+Number(value.players.player.active),1,'client has zero or two active tanks after settling');
   for(const role of ['host','player']){const a=value.players[role],b=canonical.players[role];assert.deepEqual(a.weapons,b.weapons.map(w=>w.id),`${value.role} has incorrect ${role} inventory`);assert.equal(a.score,b.score,`${value.role} has incorrect ${role} score`);assert.ok(Math.abs(a.x-b.x)<2&&Math.abs(a.y-b.y)<2,`${value.role} observes ${role} at (${a.x}, ${a.y}), checkpoint is (${b.x}, ${b.y})`);}
   assert.deepEqual(value.terrain,canonical.terrainMask,`${value.role} terrain differs from durable checkpoint`);
  }
  checks.push({turn,activeRole,inventories:{host:canonical.players.host.weapons.length,player:canonical.players.player.weapons.length}});return observed;
 };
 const canvasPoint=(page,key)=>page.evaluate(key=>{
  const s=window.game.scene.getScene('main-scene'),walk=list=>list.flatMap(v=>[v,...(Array.isArray(v.list)?walk(v.list):[])]),obj=walk(s.children.list).find(v=>v.texture?.key===key);if(!obj)throw Error(`Missing ${key}`);
  const b=obj.getBounds(),c=window.game.canvas.getBoundingClientRect();return {x:c.x+(b.x+b.width/2)*c.width/window.game.scale.width,y:c.y+(b.y+b.height/2)*c.height/window.game.scale.height};
 },key);
 const fire=async(page,id,{pauseAfterReservation=false}={})=>{
  const before=await state(page),role=before.role;
  await page.evaluate(id=>{const s=window.game.scene.getScene('main-scene'),t=s.tank1,index=t.weapons.findIndex(w=>w.id===id);if(index<0)throw Error(`Missing actual weapon ${id}`);t.selectedWeapon=index;t.setPower(18);t.turret.setRelativeRotation(-t.rotation);s.HUD.reset();},id);
  const point=await canvasPoint(page,'fireButton');await page.mouse.click(point.x,point.y);
  await page.waitForFunction(length=>window.game.scene.getScene('main-scene').tank1.weapons.length===length-1,before.players[role].weapons.length,{timeout:15000});
  if(pauseAfterReservation)await page.evaluate(()=>{const s=window.game.scene.getScene('main-scene');if(!s.tank1.turret.activeWeapon)throw Error('The interrupted-owner fixture missed its real in-flight shot');s.scene.pause();});
  const after=await state(page);assert.equal(after.players[role].weapons.length,before.players[role].weapons.length-1,'shot inventory was not consumed exactly once');shots.push({role,id,turn:before.turn});
  return before;
 };
 try{
  await startServer();const firstPort=port;
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:[...(process.env.CHROME_ARGS||'').split(' ').filter(Boolean),'--no-sandbox']});
  hostContext=await browser.newContext({viewport:{width:1200,height:800},hasTouch:true});guestContext=await browser.newContext({viewport:{width:1200,height:800},hasTouch:true});
  host=await makePage(hostContext);guest=await makePage(guestContext);await Promise.all([load(host),load(guest)]);
  mark('two independent players join and manually draft mixed weapons');
  for(const [page,name,color]of [[host,'TURN HOST',0x6eaa99],[guest,'TURN PLAYER',0xc59a76]])await page.evaluate(({name,color})=>window.game.scene.start('scene-4',{gameType:3,player1:{name,color}}),{name,color});
  await Promise.all([ready(host,'scene-4'),ready(guest,'scene-4')]);await host.evaluate(()=>window.game.scene.getScene('scene-4').children.list.find(v=>v.text==='CREATE ROOM').emit('pointerdown'));
  await host.waitForFunction(()=>window.onlineSession?.roomId);roomId=await host.evaluate(()=>window.onlineSession.roomId);
  await guest.waitForFunction(id=>window.game.scene.getScene('scene-4').roomList?.some(v=>v.roomId===id),roomId);await guest.evaluate(id=>window.game.scene.getScene('scene-4').roomList.find(v=>v.roomId===id).z.emit('pointerdown'),roomId);
  await Promise.all([ready(host,'scene-5'),ready(guest,'scene-5')]);await Promise.all([host,guest].map(page=>page.waitForFunction(()=>window.game.scene.getScene('scene-5').onlineDraft?.state?.pool.length===20)));
  for(let index=0;index<8;index++){const role=index%2?'player':'host';await wait(async()=>(await inspect()).draft.turn===role,'manual draft turn did not arrive');await pick(index%2?guest:host,index);await wait(async()=>(await inspect()).draft.picks[role].length===Math.floor(index/2)+1,'manual pick was not committed');}
  await draftButton(host,'randomRemaining');await draftButton(guest,'randomRemaining');await Promise.all([host,guest].map(page=>page.waitForFunction(()=>{const d=window.game.scene.getScene('scene-5').onlineDraft?.state;return d?.picks.host.length===10&&d.picks.player.length===10;})));
  await draftButton(host,'continue');await draftButton(guest,'continue');await Promise.all([ready(host,'main-scene'),ready(guest,'main-scene')]);
  const initial=await compare(0,'host');assert.notEqual(initial[0].playerId,initial[1].playerId);assert.equal(initial[0].role,'host');assert.equal(initial[1].role,'player');assert.ok(new Set(initial[0].path.map(p=>Math.round(p.y))).size>10,'test requires real curved terrain');
  mark('drag from power across Fire cannot shoot');
  const power=await canvasPoint(host,'power-display-right'),firePoint=await canvasPoint(host,'fireButton'),cdp=await hostContext.newCDPSession(host);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[power]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[firePoint]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await delay(500);
  assert.equal((await state(host)).players.host.weapons.length,10,'drag across Fire fired a shot');assert.equal(disk().snapshot.state.turnNumber,0);
  mark('four real alternating shots with delayed and duplicate handoffs');
  await rpc('wire',{event:'matchCheckpoint',rule:{delayMs:450,duplicateAfter:1600}});await rpc('wire',{event:'recieveTurn',rule:{duplicateAfter:2800}});
  for(const [index,page,id]of [[0,host,0],[1,guest,30],[2,host,31],[3,guest,1]]){
   mark(`real mixed shot ${index+1} weapon ${id}`);await fire(page,id);
   if(index===0){
    const reserved=(await inspect()).turn.pendingShot;assert.ok(reserved?.shotId,'simultaneous-attempt fixture missed the in-flight reservation');
    const inventory=target=>target.evaluate(()=>{const s=window.game.scene.getScene('main-scene');return [s.tank1.weapons.length,s.tank2.weapons.length];});
    const before=await Promise.all([inventory(host),inventory(guest)]);
    await Promise.all([host,guest].map(target=>target.evaluate(()=>window.game.scene.getScene('main-scene').HUD.fire())));
    assert.deepEqual(await Promise.all([inventory(host),inventory(guest)]),before,'simultaneous in-flight Fire attempts consumed extra weapons');
    const after=await inspect(),reservations=[...(after.turn.pendingShot?[after.turn.pendingShot]:[]),...after.completedShots];
    assert.equal(reservations.filter(shot=>shot.shotId===reserved.shotId).length,1);assert.equal(reservations.length,1,'simultaneous Fire attempts obtained another grant');
   }
   if(index===1)await rpc('staleLegacy',{roomId});const next=index%2?'host':'player';await compare(index+1,next);
   assert.equal(disk().snapshot.state.players.host.weapons.length,10-Math.ceil((index+1)/2));assert.equal(disk().snapshot.state.players.player.weapons.length,10-Math.floor((index+1)/2));
  }
  await delay(3000);await compare(4,'host');
  mark('opponent backgrounds and disconnects while a drill shot is in flight');
  await fire(host,70);await guest.evaluate(()=>{window.socket.emit('suspendSession',{});window.socket.io.reconnection(false);window.socket.io.engine.close();});await guest.close();
  await wait(async()=>!(await inspect()).player.connected,'opponent did not disconnect');await compare(5,'player',[host]);
  guest=await resume(guestContext);await compare(5,'player');
  mark('both browsers close, real server restarts on the same disk and port');
  await host.close();await guest.close();await wait(async()=>{const room=await inspect();return !room.host.connected&&!room.player.connected;},'both browser disconnects were not recorded');const saved=disk().snapshot;await stopServer();await startServer();assert.equal(port,firstPort);assert.deepEqual(disk().snapshot,saved);
  guest=await resume(guestContext);await compare(5,'player',[guest]);
  mark('returning non-host fires a defensive weapon with host still offline');
  await fire(guest,180);await compare(6,'host',[guest]);host=await resume(hostContext);await compare(6,'host');
  mark('owner closes during reserved shot; server restarts before completion');
  await guest.close();await fire(host,140,{pauseAfterReservation:true});
  await wait(async()=>!!(await inspect()).turn.pendingShot,'real in-flight shot was not durably reserved');
  const pending=JSON.parse(JSON.stringify((await inspect()).turn.pendingShot));assert.equal(pending.role,'host');assert.equal(pending.turnNumber,6);assert.ok(pending.shotId);
  await host.close();assert.equal(disk().snapshot.state.turnNumber,6,'pending test did not interrupt a real shot');
  await stopServer();await startServer();assert.equal(port,firstPort);assert.equal((await inspect()).turn.pendingShot.shotId,pending.shotId,'pending reservation did not survive restart');
  host=await resume(hostContext);await compare(7,'player',[host]);guest=await resume(guestContext);await compare(7,'player');
  assert.deepEqual(errors,[],'browser errors');await host.screenshot({path:'/tmp/pocket-multiplayer-turns-host.png'});await guest.screenshot({path:'/tmp/pocket-multiplayer-turns-player.png'});
  const report={passed:true,independentBrowserContexts:true,manualMixedDraft:true,canonicalTurns:checks,shots,realAlternatingShots:4,dragDoesNotFire:true,delayedAndDuplicateCheckpoints:true,legacyHandoffIgnored:true,midShotDisconnect:true,pendingOwnerShotReplayedExactlyOnce:true,offlineTurnResume:true,serverProcessRestart:true,samePort:true,terrainAndScoreAgreement:true,inventoryConsumedOnce:true,errors};fs.writeFileSync('/tmp/pocket-multiplayer-turns-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(error){console.error(`FAILED ${stage}: ${error.stack}`);for(const [label,page]of [['host',host],['player',guest]])if(page&&!page.isClosed())try{await page.screenshot({path:`/tmp/pocket-multiplayer-turns-failed-${label}.png`});const value=await state(page);delete value.terrain;delete value.path;console.error(label,JSON.stringify(value));}catch{}if(child)try{console.error('SERVER',JSON.stringify(await inspect()));}catch{}console.error('server logs',logs.join(''));throw error;}
 finally{await browser?.close();await stopServer();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
