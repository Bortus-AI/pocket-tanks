/* Build first. Uses the real socket relay with two browser clients.
   PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-online.cjs */
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const path=require('node:path');
const http=require('node:http');
const serverRequire=createRequire(path.resolve(__dirname,'../../server/package.json'));
const express=serverRequire('express');
const {Server}=serverRequire('socket.io');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const wait=async(predicate,message)=>{const start=Date.now();while(!await predicate()){if(Date.now()-start>15000)throw Error(message);await new Promise(resolve=>setTimeout(resolve,40));}};
(async()=>{
 const app=express(),server=http.createServer(app),io=new Server(server);
 app.use(express.static(path.resolve(process.env.CLIENT_BUILD_PATH||path.resolve(__dirname,'../build'))));
 const mainsocket=(await import('../../server/socket-io/main.js')).default,controller=mainsocket(io,{graceMs:null});
 let browser;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
  const host=await browser.newPage({viewport:{width:1200,height:800}}),guest=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
  for(const page of [host,guest])page.on('pageerror',error=>errors.push(error.message));
  const url=`http://127.0.0.1:${server.address().port}`;
  await Promise.all([host,guest].map(async page=>{await page.goto(url);await page.waitForFunction(()=>window.socket?.connected&&window.game?.scene.getScene('loading-scene')?.load?.isLoading()===false);}));
  await host.evaluate(()=>{window.socket.once('setRooms',({rooms})=>{window.testRoom=rooms.find(room=>room.host.socketId===window.socket.id)?.roomId;});window.socket.emit('createRoom',{player:{name:'HOST',color:0x6eaa99}});});
  await host.waitForFunction(()=>window.testRoom);
  const roomId=await host.evaluate(()=>window.testRoom);
  await guest.evaluate(roomId=>window.socket.emit('joinRoom',{roomId,name:'GUEST',color:0xc59a76}),roomId);
  await guest.waitForFunction(roomId=>window.onlineSession?.roomId===roomId,roomId);
  await host.evaluate(()=>window.socket.emit('createWeaponArray',{count:20,max:770}));
  await wait(()=>controller.rooms.get(roomId)?.draft?.pool.length===20,'authoritative draft did not start');
  for(const page of [host,guest])await page.evaluate(()=>new Promise(resolve=>window.socket.emit('randomAllWeapons',{},resolve)));
  await wait(()=>{const draft=controller.rooms.get(roomId)?.draft;return draft?.picks.host.length===10&&draft.picks.player.length===10;},'authoritative draft did not fill');
  await Promise.all([host,guest].map(page=>page.evaluate(()=>window.socket.emit('ready',{}))));
  await wait(()=>controller.rooms.get(roomId)?.phase==='match','authoritative match did not start');
  await Promise.all([host,guest].map(page=>page.waitForFunction(()=>!!window.onlineSession?.matchId&&window.onlineSession?.turn?.activeRole==='host')));
  const hostId=await host.evaluate(()=>window.onlineSession.playerId);
  const start=async(page,isHost)=>page.evaluate(({hostId,isHost})=>{
   window.game.sound.mute=true;
   const loadout=[{id:180,name:'Impact Aegis',type:2},{id:70,name:'Impact Bore Lance',type:0},{id:0,name:'Single Shot',type:0}];
   const a={name:isHost?'HOST':'GUEST',color:isHost?0x6eaa99:0xc59a76,weapons:loadout.map(w=>({...w}))};
   const b={name:isHost?'GUEST':'HOST',color:isHost?0xc59a76:0x6eaa99,weapons:loadout.map(w=>({...w}))};
   window.game.scene.start('main-scene',{gameType:3,player1:a,player2:b,hostId,onlineRole:window.onlineSession.role});
  },{hostId,isHost});
  await start(host,true);await host.waitForTimeout(150);await start(guest,false);
  await guest.waitForFunction(()=>{const s=window.game.scene.getScene('main-scene');return s.terrain.path.length>0&&s.tank1.settled&&s.tank2.settled;},null,{timeout:15000});
  const deployments=await Promise.all([host,guest].map(page=>page.evaluate(()=>{const s=window.game.scene.getScene('main-scene');return {kind:s.terrain.layoutKind,gap:Math.abs(s.tank1.x-s.tank2.x),width:s.terrain.width,spawnColumns:s.terrain.path[0].spawnColumns};})));
  deployments.forEach(d=>assert.ok(d.gap>=d.width*.45,'online tank deployments too close'));
  assert.equal(deployments[0].kind,deployments[1].kind,'online terrain profile must match');
  assert.deepEqual(deployments[0].spawnColumns,deployments[1].spawnColumns,'online spawn plan must match');
  for(const [page,isHost] of [[host,true],[guest,false]])await page.evaluate(isHost=>{
   const s=window.game.scene.getScene('main-scene');s.terrain.setPath([{x:-200,y:350},{x:1400,y:350}]);
   for(const [index,t]of [s.tank1,s.tank2].entries()){t.setPosition((index===0)===isHost?300:720,349);t.body.updateFromGameObject();t.body.stop();t.setRotation(0);t.settled=true;t.centre={x:t.x,y:t.y-6};t.turret.setPosition(t.x,t.y-12);t.turret.setRotation(Math.PI/3);}
   s.activeTank=isHost?1:2;s.tank1.active=isHost;s.tank2.active=!isHost;s.HUD.reset();
  },isHost);
  const onlineHUD=await host.evaluate(()=>{
   const scene=window.game.scene.getScene('main-scene');
   const flatten=items=>items.flatMap(item=>[item,...(Array.isArray(item.list)?flatten(item.list):[])]);
   const before={power:scene.tank1.power,rotation:scene.tank1.turret.relativeRotation};scene.tank1.autoAdjust();
   return {assist:flatten(scene.children.list).some(item=>item.text==='ASSIST AIM'),description:scene.HUD.weaponDescription.text,unchanged:scene.tank1.power===before.power&&scene.tank1.turret.relativeRotation===before.rotation};
  });
  assert.equal(onlineHUD.assist,false,'online aim-assist control must not exist');
  assert.equal(onlineHUD.unchanged,true,'online aim assist must not change the tank');
  assert.match(onlineHUD.description,/shield/i,'online HUD must describe selected shield weapon');
  const shoot=page=>page.evaluate(async()=>{
   const s=window.game.scene.getScene('main-scene'),t=s.tank1;t.selectedWeapon=0;t.setPower(20);t.turret.setRelativeRotation(Math.PI/3);
   const result=await s.HUD.fire();if(!result?.ok)throw Error(`Actual FIRE was rejected: ${JSON.stringify(result)}`);
  });
  await shoot(host);
  await guest.waitForFunction(()=>{const s=window.game.scene.getScene('main-scene');return s.activeTank===1&&!s.tank2.turret.activeWeapon&&s.tank2.tactics?.shield>0;},{timeout:20000});
  const shield=await guest.evaluate(()=>window.game.scene.getScene('main-scene').tank2.tactics.shield);assert.ok(shield>0,'shield state must reach peer');
  await shoot(guest);
  await host.waitForFunction(()=>{const s=window.game.scene.getScene('main-scene');return s.activeTank===1&&!s.tank2.turret.activeWeapon&&s.tank2.tactics?.shield>0;},{timeout:20000});
  // Material-aware authoritative roundtrip, including a receiver with stale rubber.
  const mask=await host.evaluate(()=>{const s=window.game.scene.getScene('main-scene');s.terrain.context.fillStyle='rgb(230,0,230)';s.terrain.context.fillRect(400,349,12,7);s.terrain.context.fillStyle='rgb(135,155,82)';s.terrain.context.fillRect(420,349,12,7);s.terrain.update();return s.terrain.exportMask();});
  const materials=await guest.evaluate(mask=>{const t=window.game.scene.getScene('main-scene').terrain;t.multiplayerCorrection(mask);const read=(x)=>{const p=t.context.getImageData(x,351,1,1).data;return Array.from(p)};return [read(405),read(425)];},mask);
  assert.deepEqual(materials,[[230,0,230,255],[135,155,82,255]]);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({onlineTurnHandoffs:2,onlineHUD,deployments,shieldSynced:shield,materialRoundtrip:true,maskBytes:JSON.stringify(mask).length,errors}));
 }finally{await browser?.close();controller.dispose();await new Promise(resolve=>io.close(resolve));server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
