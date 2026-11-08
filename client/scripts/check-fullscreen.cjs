/* Build first. Exercises first-tap fullscreen and repeated exit/re-entry. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=path.resolve(process.env.CLIENT_BUILD_PATH||path.resolve(__dirname,'../build'));
(async()=>{
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname,file=path.resolve(base,`.${name==='/'?'/index.html':name}`);if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.wav':'audio/wav','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 let browser;const errors=[],results=[];
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1200,height:800},hasTouch:mobile,isMobile:mobile,...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'}:{})});
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.stack));
   await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.game?.scene.getScene('loading-scene')?.load.isLoading()===false);
   await page.evaluate(()=>{window.game.sound.mute=true;window.game.scene.start('scene-1');});
   const canvas=await page.locator('canvas').boundingBox(),x=canvas.x+canvas.width*200/1200,y=canvas.y+canvas.height*560/800;
   if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
   await page.waitForFunction(()=>!!document.fullscreenElement&&window.game.scale.isFullscreen);
   await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.fullscreenElement&&!window.game.scale.isFullscreen);
   const enter=page.getByRole('button',{name:'Enter fullscreen',exact:true});await enter.waitFor({state:'visible'});await enter.click();await page.waitForFunction(()=>!!document.fullscreenElement);
   await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.fullscreenElement);
   const after=await page.locator('canvas').boundingBox();await page.mouse.click(after.x+3,after.y+after.height-3);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false,'deliberately leaving fullscreen must stay windowed');
   await page.evaluate(()=>{const weapons=[{id:0,name:'Single Shot',type:0}];window.game.scene.start('main-scene',{gameType:2,player1:{name:'FULLSCREEN A',color:0x6eaa99,weapons:weapons.map(w=>({...w}))},player2:{name:'FULLSCREEN B',color:0xc59a76,weapons:weapons.map(w=>({...w}))}});});
   await page.waitForFunction(()=>window.game.scene.isActive('main-scene'));await enter.waitFor({state:'visible'});
   assert.equal(await enter.evaluate(button=>{const b=button.getBoundingClientRect();return button.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),true,'fullscreen button is covered during gameplay');
   if(mobile){assert.equal(await enter.evaluate(button=>!!button.closest('.mobile-combat-toolbar')),true);const bounds=await page.locator('#mobile-aim-controls button, #mobile-aim-controls select').evaluateAll(nodes=>nodes.map(node=>({label:node.getAttribute('aria-label'),b:node.getBoundingClientRect().toJSON()})));for(const target of bounds)assert.ok(target.b.x>=0&&target.b.right<=391&&target.b.bottom<=845,`${target.label} clipped`);}
   await enter.click();await page.waitForFunction(()=>!!document.fullscreenElement);const exit=page.getByRole('button',{name:'Exit fullscreen',exact:true});await exit.click();await page.waitForFunction(()=>!document.fullscreenElement);await enter.click();await page.waitForFunction(()=>!!document.fullscreenElement);
   assert.equal(await page.locator('#game-fullscreen-toggle').count(),1);
   await page.screenshot({path:`/tmp/pocket-fullscreen-${mobile?'phone':'desktop'}.png`});
   results.push({mobile,firstTapDefault:true,externalExitReentry:true,noForcedReentry:true,duringMatch:true,repeatedToggle:true,onePersistentControl:true});await context.close();
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
