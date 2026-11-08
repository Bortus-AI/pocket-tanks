/* Verify original burrowing tracks in the actual framebuffer, including the
   default WebGL renderer and explicit Canvas comparison. Build first. */
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.CLIENT_BUILD_PATH||path.resolve(__dirname,'../build'));
const artifacts=process.env.DIGGING_ARTIFACTS||'/tmp/pocket-digging';
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav'};
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,`.${pathname==='/'?'/index.html':decodeURIComponent(pathname)}`);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 let browser;const errors=[],report=[];
 const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const pixel=(page,x,y)=>page.evaluate(({x,y})=>new Promise(resolve=>window.game.renderer.snapshotPixel(x,y,c=>resolve([c.red,c.green,c.blue,c.alpha]))),{x,y});
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
  for(const renderer of ['webgl','canvas']){
   const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',e=>errors.push(e.message));
   const url=new URL(process.env.PUBLIC_CLIENT_URL||`http://127.0.0.1:${server.address().port}/`);if(renderer==='canvas')url.searchParams.set('renderer','canvas');
   await page.goto(url.href);
   await page.waitForFunction(()=>window.game?.scene.getScene('loading-scene')?.load?.isLoading()===false,null,{timeout:30000});
   await page.evaluate(()=>{
    window.game.sound.mute=true;const weapons=[{id:17,name:'Ground Hog',type:3}];
    window.game.scene.start('main-scene',{gameType:4,terrainKind:'plateaus',player1:{name:'DIG A',color:0x6eaa99,weapons:weapons.map(w=>({...w}))},player2:{name:'DIG B',color:0xc59a76,weapons:weapons.map(w=>({...w}))}});
   });
   await page.waitForFunction(()=>window.game.scene.getScene('main-scene')?.scene.isActive());
   await page.evaluate(async()=>{
    const s=window.game.scene.getScene('main-scene');await s.weaponFX.ready;s.physics.world.pause();s.time.paused=true;
    s.terrain.setPath([{x:-200,y:365},{x:1400,y:365}]);s.terrain.matrix=[];
    const c=s.terrain.context;c.save();c.globalCompositeOperation='source-over';c.fillStyle='#c0a080';c.fillRect(490,390,290,60);c.restore();s.terrain.update();
   });
   await frames(page);
   assert.equal(await page.evaluate(()=>!!window.game.renderer.gl),renderer==='webgl','default URL must use WebGL when supported');
   for(const [index,id] of [17,18,19].entries()){
    const x=520+index*85,y=420,before=await pixel(page,x,y);
    const stroke=await page.evaluate(({id,x,y})=>{
     const s=window.game.scene.getScene('main-scene'),t=s.terrain;
     s.tank1.turret.activeWeapon?.weaponHandler.projectile?.destroy();s.tank1.turret.shoot(id);
     const weapon=s.tank1.turret.activeWeapon,projectile=weapon.weaponHandler.projectile;projectile.setVisible(false);projectile.rotation=0;
     // Air-only motion must remain a no-op.
     projectile.prevState={x:x-20,y:250};projectile.body.x=x+20;projectile.body.y=250;weapon.weaponHandler.digTerrain(weapon);
     const airDirty=t.gpuDirty,uploads=t.uploadCount,before=t.context.getImageData(x,y,1,1).data;
     const mask=JSON.stringify(t.exportMask());
     projectile.prevState={x:x-20,y};projectile.body.x=x;projectile.body.y=y;weapon.weaponHandler.digTerrain(weapon);
     projectile.body.x=x+20;weapon.weaponHandler.digTerrain(weapon);
     return {name:weapon.weaponHandler.name,airDirty,dirty:t.gpuDirty,uploadsBefore:uploads,uploadsBeforeFrame:t.uploadCount,canvasBefore:[...before],canvasAfter:[...t.context.getImageData(x,y,1,1).data],maskUnchanged:mask===JSON.stringify(t.exportMask())};
    },{id,x,y});
    assert.equal(stroke.airDirty,false,'air-only motion marked terrain dirty');
    assert.ok(stroke.canvasBefore[0]-stroke.canvasAfter[0]>=30,`${stroke.name} did not paint its track`);
    assert.ok(stroke.maskUnchanged,`${stroke.name} changed collision material`);
    assert.equal(stroke.uploadsBeforeFrame,stroke.uploadsBefore,'digging uploaded outside the end-of-frame batch');
    await frames(page);const after=await pixel(page,x,y),uploads=await page.evaluate(()=>window.game.scene.getScene('main-scene').terrain.uploadCount);
    assert.ok(before.slice(0,3).reduce((sum,v,i)=>sum+v-after[i],0)>35,`${renderer} ${stroke.name}: canvas track changed but framebuffer did not (${before} -> ${after})`);
    assert.equal(uploads-stroke.uploadsBefore,1,`${stroke.name} did not coalesce both strokes into one texture refresh`);
    report.push({renderer,id,...stroke,frameBefore:before,frameAfter:after,uploads:uploads-stroke.uploadsBefore});
    console.log(`CHECK ${renderer}: ${stroke.name} track visible; collision unchanged; texture flushes ${uploads-stroke.uploadsBefore}`);
   }
   await page.screenshot({path:path.join(artifacts,`${renderer}-digging.png`)});await page.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify({passed:true,report,errors},null,2));console.log(JSON.stringify({passed:true,weapons:3,renderers:2,errors,artifacts}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
