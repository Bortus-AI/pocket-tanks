/* Build first. Exercises asynchronous turns with the real Phaser client and a
   separate Socket.IO/RoomStore process, including disk recovery after restart.
   PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-async.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fork}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async(predicate,message,timeout=30000)=>{const start=Date.now();while(!await predicate()){if(Date.now()-start>timeout)throw Error(message);await delay(60);}};
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pocket-async-')),storePath=path.join(directory,'rooms.json');
 let child,port,browser,hostContext,guestContext,host,guest,stage='start',requestId=0;const errors=[],serverLogs=[];
 const mark=value=>{stage=value;console.log(`CHECK ${value}`);};
 const startServer=async()=>{
  child=fork(path.join(__dirname,'fixtures/async-server.mjs'),[],{env:{...process.env,ASYNC_STORE:storePath,ASYNC_PORT:String(port||0)},stdio:['ignore','pipe','pipe','ipc']});
  child.stdout.on('data',data=>serverLogs.push(String(data)));child.stderr.on('data',data=>serverLogs.push(String(data)));
  port=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('child server startup timeout')),15000);child.once('exit',(code,signal)=>{clearTimeout(timeout);reject(Error(`child server exited ${code||signal}: ${serverLogs.join('')}`));});const ready=message=>{if(message?.type==='ready'){clearTimeout(timeout);child.off('message',ready);resolve(message.port);}};child.on('message',ready);});
 };
 const stopServer=async()=>{if(!child||child.exitCode!==null)return;const stopping=child;await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{stopping.kill('SIGKILL');reject(Error('child server shutdown timeout'));},10000);stopping.once('exit',()=>{clearTimeout(timeout);resolve();});stopping.kill('SIGTERM');});child=null;};
 const inspect=roomId=>new Promise((resolve,reject)=>{const id=++requestId,timeout=setTimeout(()=>reject(Error('inspection timeout')),5000);const reply=message=>{if(message?.type==='inspection'&&message.requestId===id){clearTimeout(timeout);child.off('message',reply);resolve(message.data);}};child.on('message',reply);child.send({type:'inspect',roomId,requestId:id});});
 const diskRoom=roomId=>{try{return JSON.parse(fs.readFileSync(storePath,'utf8')).rooms.find(room=>room.roomId===roomId);}catch{return null;}};
 const pageFor=async context=>{const page=await context.newPage();page.on('pageerror',error=>errors.push(error.stack||error.message));return page;};
 const load=async page=>{await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>window.socket?.connected&&window.game?.scene.getScene('loading-scene')?.load?.isLoading()===false,null,{timeout:30000});await page.evaluate(()=>{window.game.sound.mute=true;});};
 const ready=(page,key)=>page.waitForFunction(key=>{const scene=window.game?.scene.getScene(key),online=scene?.sceneData?.gameType===3&&['main-scene','scene-5'].includes(key);return scene?.scene.isActive()&&(!online||(!window.onlineSession?.paused&&!window.onlineSession?.restoring));},key,{timeout:30000});
 const draftButton=(page,key)=>page.evaluate(key=>{const button=window.game.scene.getScene('scene-5').onlineDraft?.buttons[key];if(!button)throw Error(`Missing ${key} draft button`);button.background.emit('pointerdown');},key);
 const pick=(page,index)=>page.evaluate(index=>{const draft=window.game.scene.getScene('scene-5').onlineDraft;draft.rows[index].background.emit('pointerdown');draft.buttons.select.background.emit('pointerdown');},index);
 const resume=async context=>{const page=await pageFor(context);await load(page);await page.evaluate(()=>window.game.scene.start('scene-1'));await ready(page,'scene-1');await page.evaluate(()=>{const scene=window.game.scene.getScene('scene-1'),button=scene.children.list.find(item=>typeof item.text==='string'&&item.text.startsWith('RESUME ONLINE MATCH'));if(!button)throw Error('No saved match Resume button');button.emit('pointerdown');});return page;};
 const state=page=>page.evaluate(()=>{
  const scene=window.game.scene.getScene('main-scene'),role=window.onlineSession.role,other=role==='host'?'player':'host';
  const tank=value=>({x:value.x,y:value.y,score:value.score,power:value.power,selectedWeapon:value.selectedWeapon,movesRemaining:value.movesRemaining,weapons:value.weapons.map(w=>w.id)});
  return {role,playerId:window.onlineSession.playerId,activeRole:scene.activeTank===1?role:scene.activeTank===2?other:null,turn:scene.tacticalWorld?.shot||0,
   players:{[role]:tank(scene.tank1),[other]:tank(scene.tank2)},terrain:scene.terrain.exportMask(),path:scene.terrain.path,kind:scene.terrain.layoutKind,
   paused:!!window.onlineSession.paused,cache:JSON.parse(localStorage.getItem('pocket-online-last-room')||'null')};
 });
 const fire=page=>page.evaluate(async()=>{
  const scene=window.game.scene.getScene('main-scene'),tank=scene.tank1;
  let selected=tank.weapons.findIndex(w=>w.id===0||w.id===30);if(selected<0)selected=tank.weapons.findIndex(w=>{const entry=scene.arsenal.catalog[w.id];return entry?.payload?.key==='kinetic'&&['shell','barrage','mortar','cluster'].includes(entry.behavior);});if(selected<0)selected=0;if(!tank.weapons[selected])throw Error('Fixture lost its actual weapon');
  tank.selectedWeapon=selected;tank.setPower(18);tank.turret.setRelativeRotation(0);scene.HUD.reset();
  // Use the normal firing path, including the durable server reservation ACK.
  const result=await scene.HUD.fire();if(!result?.ok)throw Error(`Actual FIRE was rejected: ${JSON.stringify(result)}`);
  return {id:tank.turret.activeWeapon?.id,remaining:tank.weapons.length};
 });
 try{
  await startServer();const firstPort=port;
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
  hostContext=await browser.newContext({viewport:{width:1200,height:800}});guestContext=await browser.newContext({viewport:{width:1200,height:800}});
  host=await pageFor(hostContext);guest=await pageFor(guestContext);await Promise.all([load(host),load(guest)]);
  mark('create shared room and draft');
  for(const [page,name,color]of [[host,'DAY HOST',0x6eaa99],[guest,'DAY PLAYER',0xc59a76]])await page.evaluate(({name,color})=>window.game.scene.start('scene-4',{gameType:3,player1:{name,color}}),{name,color});
  await Promise.all([ready(host,'scene-4'),ready(guest,'scene-4')]);
  await host.evaluate(()=>{const scene=window.game.scene.getScene('scene-4');scene.children.list.find(item=>item.text==='CREATE ROOM').emit('pointerdown');});
  await host.waitForFunction(()=>window.onlineSession?.roomId);const roomId=await host.evaluate(()=>window.onlineSession.roomId);
  await guest.waitForFunction(roomId=>window.game.scene.getScene('scene-4').roomList?.some(room=>room.roomId===roomId),roomId);
  await guest.evaluate(roomId=>window.game.scene.getScene('scene-4').roomList.find(room=>room.roomId===roomId).z.emit('pointerdown'),roomId);
  await Promise.all([ready(host,'scene-5'),ready(guest,'scene-5')]);await Promise.all([host,guest].map(page=>page.waitForFunction(()=>window.game.scene.getScene('scene-5').onlineDraft?.state?.pool.length===20)));
  const identities=await Promise.all([host,guest].map(page=>page.evaluate(()=>window.onlineSession.playerId)));
  assert.equal((await inspect(roomId)).graceMs,null,'async matches must not expire by timeout');
  mark('manual draft pick while the peer browser is closed');
  await guest.close();await wait(async()=>!(await inspect(roomId)).player.connected,'guest did not go offline');
  await wait(async()=>!(await host.evaluate(()=>window.onlineSession.paused)),'online host was blocked by an offline peer');
  await pick(host,0);await wait(()=>diskRoom(roomId)?.draft?.picks.host.length===1,'offline-peer draft pick was not saved');
  assert.equal(diskRoom(roomId).draft.turn,'player');assert.equal(diskRoom(roomId).draft.picks.player.length,0,'one player took the other player’s draft turn');
  assert.equal((await inspect(roomId)).player.expiresAt,null);
  guest=await resume(guestContext);await ready(guest,'scene-5');await guest.waitForFunction(()=>window.game.scene.getScene('scene-5').onlineDraft?.state?.picks.host.length===1);
  assert.equal(await guest.evaluate(()=>window.onlineSession.playerId),identities[1]);await pick(guest,1);
  await wait(()=>diskRoom(roomId)?.draft?.picks.player.length===1,'resumed manual draft pick was not saved');
  await draftButton(host,'randomRemaining');await draftButton(guest,'randomRemaining');
  await Promise.all([host,guest].map(page=>page.waitForFunction(()=>{const state=window.game.scene.getScene('scene-5').onlineDraft?.state;return state?.picks.host.length===10&&state.picks.player.length===10;})));
  await draftButton(host,'continue');await draftButton(guest,'continue');
  await Promise.all([ready(host,'main-scene'),ready(guest,'main-scene')]);
  await Promise.all([host,guest].map(page=>page.waitForFunction(()=>{const s=window.game.scene.getScene('main-scene');return s.terrain.path.length>0&&s.tank1.settled&&s.tank2.settled;})));
  await wait(()=>diskRoom(roomId)?.snapshot?.state?.activeRole==='host','initial match checkpoint was not saved');
  const initial=await state(host);assert.ok(new Set(initial.path.map(point=>Math.round(point.y))).size>10,'fixture must retain a real curved terrain map');
  assert.equal(initial.players.host.weapons[0],0);assert.equal(initial.players.player.weapons[0],30);
  mark('actual first shot settles and saves while the opponent is offline');
  await guest.close();await wait(async()=>!(await inspect(roomId)).player.connected,'guest did not disconnect before shot');
  await wait(async()=>!(await host.evaluate(()=>window.onlineSession.paused)),'host cannot play its own asynchronous turn');
  const firstShot=await fire(host);assert.equal(firstShot.id,0);assert.equal(firstShot.remaining,9);
  await wait(()=>{const snapshot=diskRoom(roomId)?.snapshot?.state;return snapshot?.turnNumber===1&&snapshot.activeRole==='player'&&snapshot.players.host.weapons.length===9;},'completed first turn was not durably saved',40000);
  await host.waitForFunction(()=>{const s=window.game.scene.getScene('main-scene');return !s.tank1.turret.activeWeapon&&!s.terrain.animate&&s.tank1.settled&&s.tank2.settled;},null,{timeout:40000});
  const afterFirst=await state(host),savedFirst=JSON.parse(JSON.stringify(diskRoom(roomId).snapshot));
  assert.equal(afterFirst.activeRole,'player');assert.equal(afterFirst.turn,1);assert.equal(afterFirst.cache.expiresAt??null,null,'browser membership still uses an expiry');
  assert.notDeepEqual(afterFirst.terrain,initial.terrain,'real shell should change curved terrain');
  await host.close();await wait(async()=>!(await inspect(roomId)).host.connected,'both tabs did not go offline');
  mark('restart the server process on the same port and saved room file');
  await stopServer();await startServer();assert.equal(port,firstPort);assert.deepEqual(diskRoom(roomId).snapshot,savedFirst);
  const reboot=await inspect(roomId);assert.equal(reboot.graceMs,null);assert.equal(reboot.host.expiresAt,null);assert.equal(reboot.player.expiresAt,null);assert.equal(reboot.host.connected,false);assert.equal(reboot.player.connected,false);
  mark('returning player restores its pending turn while the host stays offline');
  guest=await resume(guestContext);await ready(guest,'main-scene');
  await guest.waitForFunction(()=>window.game.scene.getScene('main-scene').activeTank===1);
  const recovered=await state(guest);
  assert.equal(recovered.playerId,identities[1]);assert.equal(recovered.activeRole,'player');assert.equal(recovered.turn,1);
  assert.equal(recovered.players.host.score,afterFirst.players.host.score);assert.equal(recovered.players.player.score,afterFirst.players.player.score);
  assert.deepEqual(recovered.players.host.weapons,afterFirst.players.host.weapons);assert.deepEqual(recovered.players.player.weapons,afterFirst.players.player.weapons);
  assert.equal(recovered.players.host.selectedWeapon,afterFirst.players.host.selectedWeapon);assert.equal(recovered.players.player.selectedWeapon,afterFirst.players.player.selectedWeapon);
  assert.deepEqual(recovered.terrain,afterFirst.terrain);assert.deepEqual(recovered.path,afterFirst.path);assert.equal(recovered.kind,afterFirst.kind);assert.equal(recovered.cache.expiresAt??null,null);
  assert.equal((await inspect(roomId)).host.connected,false);
  const text=await guest.evaluate(()=>{const walk=items=>items.flatMap(item=>[item.text||'',...(Array.isArray(item.list)?walk(item.list):[])]);return document.body.innerText+' '+walk(window.game.scene.getScene('main-scene').children.list).join(' ');});assert.ok(!/15\s*minutes/i.test(text),'async UI still promises a short reconnect window');
  mark('actual second shot saves with the first player still offline');
  const secondShot=await fire(guest);assert.equal(secondShot.id,30);assert.equal(secondShot.remaining,9);
  await wait(()=>{const snapshot=diskRoom(roomId)?.snapshot?.state;return snapshot?.turnNumber===2&&snapshot.activeRole==='host'&&snapshot.players.player.weapons.length===9;},'completed second turn was not durably saved',40000);
  await guest.waitForFunction(()=>{const s=window.game.scene.getScene('main-scene');return !s.tank1.turret.activeWeapon&&!s.terrain.animate&&s.tank1.settled&&s.tank2.settled;},null,{timeout:40000});
  const afterSecond=await state(guest);assert.equal(afterSecond.activeRole,'host');assert.equal(afterSecond.players.player.weapons.length,9);assert.equal(afterSecond.players.host.weapons.length,9);
  mark('park the waiting player and start an offline practice match');
  await guest.evaluate(()=>{const s=window.game.scene.getScene('main-scene');s.showExitMenu();s.exitMenuContent.getChildren().find(item=>item.text==='YES').emit('pointerdown');});
  await ready(guest,'scene-1');
  await guest.evaluate(()=>{
   const weapons=[{id:0,name:'Single Shot',type:0}];window.game.scene.getScene('scene-1').scene.start('main-scene',{gameType:4,player1:{name:'PRACTICE A',color:0x6eaa99,weapons:weapons.map(w=>({...w}))},player2:{name:'PRACTICE B',color:0xc59a76,weapons:weapons.map(w=>({...w}))}});
  });
  await guest.waitForFunction(()=>window.game.scene.getScene('main-scene')?.sceneData.gameType===4);
  await guest.evaluate(()=>window.game.scene.getScene('main-scene').physics.world.pause());
  const practiceState=page=>page.evaluate(()=>{const s=window.game.scene.getScene('main-scene');return {gameType:s.sceneData.gameType,terrain:s.terrain.exportMask(),players:[s.tank1,s.tank2].map(t=>({x:t.x,y:t.y,score:t.score,weapons:t.weapons.map(w=>w.id),selected:t.selectedWeapon})),parked:window.onlineSession.parked};});
  const practiceBefore=await practiceState(guest);assert.equal(practiceBefore.parked,true);
  mark('first player returns to its next saved turn');
  host=await resume(hostContext);await ready(host,'main-scene');await host.waitForFunction(()=>window.game.scene.getScene('main-scene').activeTank===1);
  const final=await state(host);assert.equal(final.playerId,identities[0]);assert.equal(final.activeRole,'host');assert.equal(final.turn,2);assert.deepEqual(final.terrain,afterSecond.terrain);for(const role of ['host','player']){const a=final.players[role],b=afterSecond.players[role];assert.ok(Math.abs(a.x-b.x)<2&&Math.abs(a.y-b.y)<2);assert.deepEqual({...a,x:0,y:0},{...b,x:0,y:0});}
  assert.equal(final.cache.expiresAt??null,null);
  mark('remote online turn must not mutate or interrupt parked offline practice');
  const thirdShot=await fire(host);await wait(()=>{const state=diskRoom(roomId)?.snapshot?.state;return state?.turnNumber===3&&state.activeRole==='player';},'third turn did not save while practice remained open',40000);
  await delay(300);assert.deepEqual(await practiceState(guest),practiceBefore,'online relays/checkpoint changed the offline practice match');
  const thirdState=await state(host);
  await guest.evaluate(()=>{const s=window.game.scene.getScene('main-scene');s.showExitMenu();s.exitMenuContent.getChildren().find(item=>item.text==='YES').emit('pointerdown');});await ready(guest,'scene-1');
  await guest.evaluate(()=>{const button=window.game.scene.getScene('scene-1').children.list.find(item=>typeof item.text==='string'&&item.text.startsWith('RESUME ONLINE MATCH'));if(!button)throw Error('Missing parked Resume button');button.emit('pointerdown');});
  await ready(guest,'main-scene');await guest.waitForFunction(()=>window.game.scene.getScene('main-scene').activeTank===1);
  const resumedAfterPractice=await state(guest);assert.equal(resumedAfterPractice.turn,3);assert.deepEqual(resumedAfterPractice.terrain,thirdState.terrain);assert.deepEqual(resumedAfterPractice.players.host.weapons,thirdState.players.host.weapons);assert.equal(resumedAfterPractice.players.host.score,thirdState.players.host.score);
  assert.deepEqual(errors,[],'browser errors');
  await host.screenshot({path:'/tmp/pocket-async-restored.png'});
  const report={permanentSessions:true,manualDraftWithOfflinePeer:true,serverTurnOrder:true,realOfflineShots:[firstShot.id,secondShot.id],inventories:{host:9,player:9},durableTurns:3,practiceIsolation:true,thirdShot:thirdShot.id,curvedTerrain:true,serverProcessRestart:true,samePort:true,resumeWithoutPeer:true,identityPreserved:true,scoreAndSelectionRestored:true,expiresAt:null,errors};
  fs.writeFileSync('/tmp/pocket-async-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(error){console.error(`FAILED ${stage}: ${error.stack}`);for(const [label,page]of [['host',host],['guest',guest]])if(page&&!page.isClosed())try{await page.screenshot({path:`/tmp/pocket-async-failed-${label}.png`});console.error(label,await page.evaluate(()=>({session:{phase:window.onlineSession?.phase,role:window.onlineSession?.role,paused:window.onlineSession?.paused,restoring:window.onlineSession?.restoring},scenes:window.game?.scene.getScenes(false).map(s=>({key:s.sys.settings.key,active:s.scene.isActive(),paused:s.scene.isPaused()}))})));}catch{}console.error('server logs',serverLogs.join(''));throw error;
 }finally{await browser?.close();await stopServer();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
