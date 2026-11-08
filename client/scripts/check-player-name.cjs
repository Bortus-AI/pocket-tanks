/* Build first. PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-player-name.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.CLIENT_BUILD_PATH||path.resolve(__dirname,'../build'));
(async()=>{
 const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 let browser;const errors=[];
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.game?.scene.getScene('loading-scene')?.load.isLoading()===false,null,{timeout:30000});
  const tapContinue=async()=>{const b=await page.locator('canvas').boundingBox();await page.touchscreen.tap(b.x+b.width*.5,b.y+b.height*700/800);};
  const results=[];
  for(const mode of [1,2,3,4]){
   await page.evaluate(mode=>{window.game.sound.mute=true;window.game.scene.getScenes(true).forEach(scene=>window.game.scene.stop(scene.sys.settings.key));window.game.scene.start('scene-3',{gameType:mode});},mode);
   await page.waitForFunction(mode=>window.game.scene.isActive('scene-3')&&!window.game.scene.isActive('scene-4')&&window.game.scene.getScene('scene-3').sceneData.gameType===mode,mode);
   const name=page.getByRole('textbox',{name:'Player 1 name'});await name.waitFor({state:'visible'});await name.tap();await name.fill('');await name.pressSequentially(`Phone Pilot${mode}`);
   assert.equal(await name.inputValue(),`Phone Pilot${mode}`);
   const disabled=await page.evaluate(()=>window.game.scene.getScene('scene-3').input.keyboard.enabled);assert.equal(disabled,false,'game keyboard should not consume name entry');
   await name.press('Backspace');await name.pressSequentially(String(mode));await name.press('Enter');
   assert.equal(await page.evaluate(()=>window.game.scene.getScene('scene-3').input.keyboard.enabled),true);
   await tapContinue();await page.waitForFunction(()=>window.game.scene.isActive('scene-4'));
   const transferred=await page.evaluate(()=>window.game.scene.getScene('scene-4').sceneData.player1.name);assert.equal(transferred,`Phone Pilot${mode}`);
   if(mode===2||mode===4){
    const other=page.getByRole('textbox',{name:'Player 2 name'});await other.waitFor({state:'visible'});await other.tap();await other.fill('Second Pilot');await other.press('Enter');
    await tapContinue();await page.waitForFunction(()=>window.game.scene.isActive('scene-5')||window.game.scene.isActive('main-scene'));
    const second=await page.evaluate(()=>{const key=window.game.scene.isActive('scene-5')?'scene-5':'main-scene';return window.game.scene.getScene(key).sceneData.player2.name;});assert.equal(second,'Second Pilot');
   }
   results.push({mode,name:transferred,secondPlayer:mode===2||mode===4});
  }
  await page.evaluate(()=>{window.game.scene.getScenes(true).forEach(scene=>window.game.scene.stop(scene.sys.settings.key));window.game.scene.start('scene-3',{gameType:3});});await page.getByRole('textbox',{name:'Player 1 name'}).waitFor({state:'visible'});
  await page.getByRole('textbox',{name:'Player 1 name'}).tap();await page.getByRole('textbox',{name:'Player 1 name'}).fill('Mobile Pilot');await page.getByRole('textbox',{name:'Player 1 name'}).press('Enter');
  const fieldBounds=await page.getByRole('textbox',{name:'Player 1 name'}).boundingBox();assert.ok(fieldBounds.width>80&&fieldBounds.height>15);assert.ok(fieldBounds.x>=0&&fieldBounds.x+fieldBounds.width<=390);
  await page.screenshot({path:'/tmp/pocket-mobile-player-name.png'});
  assert.equal(await page.locator('.player-name-input').count(),1,'scene changes leaked native inputs');assert.deepEqual(errors,[]);
  console.log(JSON.stringify({mobile:true,results,fieldBounds,inputCount:1,errors}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
