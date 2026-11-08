/* Tar must be solid black terrain around a hit tank, visible in both renderers.
   Also guards the digging context leak that previously hid later construction. */
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.CLIENT_BUILD_PATH||path.resolve(__dirname,'../build')),artifacts=process.env.TAR_ARTIFACTS||'/tmp/pocket-tar-ball';
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 let browser;const errors=[],report=[];
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:[...(process.env.CHROME_ARGS||'').split(' ').filter(Boolean),'--no-sandbox','--enable-unsafe-swiftshader']});
  for(const renderer of ['webgl']){ // the game is WebGL-only
   const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',e=>errors.push(e.message));
   const url=new URL(process.env.PUBLIC_CLIENT_URL||`http://127.0.0.1:${server.address().port}/`);if(renderer==='canvas')url.searchParams.set('renderer','canvas');
   await page.goto(url.href);await page.waitForFunction(()=>window.game?.scene.getScene('loading-scene')?.load.isLoading()===false,null,{timeout:45000});
   await page.evaluate(()=>{window.game.sound.mute=true;const weapons=[{id:0,name:'Single Shot',type:0}];window.game.scene.start('main-scene',{gameType:4,player1:{name:'TAR A',color:0x6eaa99,weapons},player2:{name:'TAR B',color:0xc59a76,weapons:weapons.map(w=>({...w}))}});});
   await page.waitForFunction(()=>window.game.scene.getScene('main-scene')?.arsenal);
   const result=await page.evaluate(()=>{
    const s=window.game.scene.getScene('main-scene');s.physics.world.pause();s.time.paused=true;
    Object.assign(s.terrain.context,{globalCompositeOperation:'source-over',globalAlpha:1});s.terrain.setPath([{x:-200,y:350},{x:1400,y:350}]);s.terrain.matrix=[];
    [s.tank1,s.tank2].forEach((t,i)=>{t.setPosition(i?720:300,349);t.body.updateFromGameObject();t.body.stop();t.rotation=0;t.centre={x:t.x,y:t.y-6};t.top={x:t.x,y:t.y-12};t.turret.setPosition(t.x,t.y-12);t.turret.setRelativeRotation(Math.PI/4);t.tactics={shield:0,frost:0,frostMoves:0,acid:0,marked:0};});
    s.tank1.turret.shoot(17);const digging=s.tank1.turret.activeWeapon,projectile=digging.weaponHandler.projectile;
    projectile.prevState={x:580,y:420};projectile.body.x=610;projectile.body.y=420;projectile.rotation=0;digging.defaultDigTerrain(projectile,3,.3);
    const contextRestored=s.terrain.context.globalCompositeOperation==='source-over';projectile.destroy();s.tank1.turret.activeWeapon=null;
    const entry=s.arsenal.catalog.find(w=>w.name==='Tar Ball'),r=entry.createInstance();
    s.activeTank=1;s.tank1.active=true;s.tank2.active=false;s.tank1.weapons=[{id:entry.id,name:entry.name,type:entry.type}];s.tank1.selectedWeapon=0;s.HUD.reset();
    r.create({id:entry.id,scene:s,tank:s.tank1,turret:s.tank1.turret,terrain:s.terrain});r.shoot();const p=r.projectiles[0];p.x=s.tank2.centre.x;p.y=s.tank2.centre.y;
    // An unrelated caller's canvas state cannot prevent the tar from forming.
    s.terrain.context.globalCompositeOperation='source-atop';r.impact(p);for(let tick=0;tick<965&&!r.done;tick++)r.update();
    const mask=s.terrain.exportMask();s.terrain.context.clearRect(0,0,s.terrain.width,s.terrain.height);s.terrain.update();s.terrain.multiplayerCorrection(mask);
    const tarRoundtrip=Array.isArray(mask.tar)&&mask.tar.length>0;
    const center=s.tank2.centre,samples=[[0,-30],[-30,0],[30,0],[0,30]].map(([dx,dy])=>{const c=s.terrain.getPixel(center.x+dx,center.y+dy);return {alpha:c.alpha,red:c.red,green:c.green,blue:c.blue};});
    const outside=s.terrain.getPixel(center.x,center.y-60).alpha;
    return {renderer:window.game.renderer.gl?'webgl':'canvas',weapon:entry.name,id:entry.id,contextRestored,tarRoundtrip,samples,outside,finished:r.done,point:{x:center.x,y:center.y-30}};
   });
   assert.equal(result.renderer,renderer);assert.ok(result.contextRestored,'digging leaked its canvas composite mode');assert.ok(result.tarRoundtrip,'black tar did not survive authoritative terrain serialization');assert.ok(result.finished);assert.equal(result.outside,0);
   assert.ok(result.samples.every(p=>p.alpha===255&&Math.max(p.red,p.green,p.blue)<12),'tar ball is absent, translucent, or ordinary earth');
   await page.waitForFunction(()=>window.game.scene.getScene('main-scene').weaponFX?.owned.entries.get(495)?.loaded,null,{timeout:30000});
   await page.waitForTimeout(1400);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const artwork=await page.evaluate(()=>{const s=window.game.scene.getScene('main-scene'),entry=s.weaponFX.owned.entries.get(495);return {material:entry?.design.material,asset:entry?.design.asset,loaded:entry?.loaded};});assert.equal(artwork.material,'tar');assert.ok(artwork.loaded,'dedicated black tar animation atlas did not load');
   const framebuffer=await page.evaluate(({x,y})=>new Promise(resolve=>window.game.renderer.snapshotPixel(x,y,c=>resolve({red:c.red,green:c.green,blue:c.blue,alpha:c.alpha}))),result.point);
   assert.ok(Math.max(framebuffer.red,framebuffer.green,framebuffer.blue)<35,`${renderer}: black tar pixels did not reach the framebuffer`);
   report.push({...result,artwork,framebuffer});await page.screenshot({path:path.join(artifacts,`${renderer}-tar-ball.png`)});await page.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify({passed:true,report,errors},null,2));console.log(JSON.stringify({passed:true,report,errors,artifacts}));
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
