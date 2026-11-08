/* Build first. PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-combat-hud.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=path.resolve(process.env.CLIENT_BUILD_PATH||path.resolve(__dirname,'../build'));
(async()=>{
 const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(base,`.${pathname==='/'?'/index.html':pathname}`);if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.wav':'audio/wav','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 let browser;const errors=[];
 try{
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:[...(process.env.CHROME_ARGS||'').split(' ').filter(Boolean),'--no-sandbox']});
  const url=`http://127.0.0.1:${server.address().port}`;
  const check=async page=>{
   page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.game?.scene.getScene('loading-scene')?.load.isLoading()===false,null,{timeout:30000});
   await page.evaluate(()=>{window.game.sound.mute=true;const weapons=[{id:0,name:'Single Shot',type:0},{id:31,name:'Ember Howitzer',type:0}];window.game.scene.start('main-scene',{gameType:4,player1:{name:'PLAYER ONE',color:0x6eaa99,weapons:weapons.map(w=>({...w}))},player2:{name:'PLAYER TWO',color:0xc59a76,weapons:weapons.map(w=>({...w}))}});});
   await page.waitForTimeout(200);
   return page.evaluate(()=>{
    const scene=window.game.scene.getScene('main-scene');scene.physics.world.pause();scene.activeTank=1;scene.tank1.active=true;scene.tank2.active=false;scene.HUD.reset();
    const base=scene.HUD.weaponDescription.text;
    scene.HUD.weaponScrollDisplay.setActive(1);scene.HUD.refresh();const fire=scene.HUD.weaponDescription.text;
    scene.tank1.selectedWeapon=0;scene.tank1.turret.activeWeapon={id:31};scene.HUD.refreshWeaponDescription();const firing=scene.HUD.weaponDescription.text;scene.tank1.turret.activeWeapon=null;
    scene.activeTank=2;scene.tank2.selectedWeapon=0;scene.HUD.reset();const otherTurn=scene.HUD.weaponDescription.text;
    const catalog=scene.arsenal.catalog;scene.tank2.weapons=catalog.map(w=>({id:w.id,name:w.name}));const clipped=[];
    for(let i=0;i<catalog.length;i++){scene.tank2.selectedWeapon=i;scene.HUD.refreshWeaponDescription();const b=scene.HUD.weaponDescription.getBounds();if(b.bottom>800||b.right>1200||!scene.HUD.weaponDescription.text)clipped.push({id:catalog[i].id,bottom:b.bottom,right:b.right});}
    scene.tank2.weapons=[];scene.HUD.refreshWeaponDescription();const empty=scene.HUD.weaponDescription.text;
    scene.tank2.weapons=[{id:31,name:'Ember Howitzer'}];scene.tank2.selectedWeapon=0;scene.HUD.reset();
    const flatten=items=>items.flatMap(item=>[item,...(Array.isArray(item.list)?flatten(item.list):[])]);
    return {base,fire,firing,otherTurn,empty,clipped,descriptions:catalog.length,offlineAssist:flatten(scene.children.list).some(item=>item.text==='ASSIST AIM'),fontSize:scene.HUD.weaponDescription.style.fontSize,bounds:scene.HUD.weaponDescription.getBounds()};
   });
  };
  const desktop=await browser.newPage({viewport:{width:1200,height:800}});const desktopResult=await check(desktop);await desktop.screenshot({path:'/tmp/pocket-selected-weapon-description.png'});
  const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'});
  const mobile=await mobileContext.newPage();const mobileResult=await check(mobile);await mobile.screenshot({path:'/tmp/pocket-selected-weapon-description-mobile.png'});
  for(const result of [desktopResult,mobileResult]){assert.equal(result.offlineAssist,true);assert.match(result.base,/medium shell/i);assert.match(result.fire,/burning/i);assert.equal(result.firing,result.fire,'fired weapon description must remain visible while projectile active');assert.equal(result.otherTurn,result.base);assert.match(result.empty,/No weapons/);assert.deepEqual(result.clipped,[]);}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({desktop:desktopResult,mobile:mobileResult,errors}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
