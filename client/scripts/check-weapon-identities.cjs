/* Render all 770 weapon-owned animation sets in the actual compositor.
   Freeze randomness and compare grayscale alpha, so names, IDs, palette and
   stochastic debris cannot hide a repeated effect. No family asset fallback. */
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const artifacts=process.env.IDENTITY_ARTIFACTS||'/tmp/pocket-weapon-identities',root=path.resolve(process.env.CLIENT_BUILD_PATH||path.resolve(__dirname,'../build'));
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav'};
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const rulesSource=fs.readFileSync(path.resolve(__dirname,'../src/weapons/expansion/unique-mechanics.js'),'utf8');
 const literal=rulesSource.match(/const legacyRules=Object\.freeze\((\{[^;]+?\})\);/)?.[1];assert.ok(literal);
 const legacyRules=JSON.parse(literal.replace(/'/g,'"').replace(/([{,])(\d+):/g,'$1"$2":'));
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 let browser;const errors=[];
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',error=>errors.push(error.stack||error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.game?.scene.getScene('loading-scene')?.load?.isLoading()===false,null,{timeout:30000});
  await page.evaluate(()=>{window.game.sound.mute=true;const weapons=[{id:30,name:'Impact Howitzer',type:0}];window.game.scene.start('main-scene',{gameType:4,player1:{name:'MATERIAL A',color:0x6eaa99,weapons:weapons.map(w=>({...w}))},player2:{name:'MATERIAL B',color:0xc59a76,weapons:weapons.map(w=>({...w}))}});});
  await page.waitForFunction(()=>window.game.scene.getScene('main-scene')?.scene.isActive());
  console.log('CHECK dedicated sprites and projectiles across all 770 weapons');
  const result=await page.evaluate(async legacyRules=>{
   const scene=window.game.scene.getScene('main-scene'),fx=scene.weaponFX,phases=[.08,.24,.43,.64,.83,1.2],size=128;
   scene.scene.pause();
   await fx.ready;
   if(!fx.stats().materialArt)throw Error('Owned weapon textures were not loaded');
   // Exercise the Canvas path using the same production atlas as WebGL.
   // No GPU uploads are needed to collect these offscreen frames.
   const gpu=fx.gpuParticles,texture=fx.texture,random=Math.random;fx.gpuParticles=null;fx.texture={refresh(){}};Math.random=()=>.5;
   const records=[],sheets=[],perSheet=10,columns=7,cellWidth=144,rowHeight=154;
   const projectile=document.createElement('canvas');projectile.width=projectile.height=size;const pc=projectile.getContext('2d');
   let sheet,sc;
   try{
    for(const weapon of scene.arsenal.catalog.filter(Boolean)){
     if(records.length%perSheet===0){sheet=document.createElement('canvas');sheet.width=columns*cellWidth;sheet.height=perSheet*rowHeight;sc=sheet.getContext('2d');sc.fillStyle='#132b35';sc.fillRect(0,0,sheet.width,sheet.height);}
     fx.reset();const row=records.length%perSheet,base=weapon.id<30;
     const payload=base?([7,8,12,13,17,18,19,25,27].includes(weapon.id)?'seismic':weapon.id===14?'ion':[15,23].includes(weapon.id)?'fire':weapon.id===16?'frost':'kinetic'):weapon.payload.key;
     const options={weaponId:weapon.id,weaponName:weapon.name,payload,behavior:weapon.behavior,classicMechanic:weapon.classicMechanic,mechanicOptions:weapon.options,semanticRules:base?legacyRules[weapon.id]||[]:weapon.mechanicalRules||[],angle:.4,color:weapon.payload?.color||0xffcc88};
     await fx.prepareWeapon(weapon.id);
     fx.impact(600,365,38,options);const story=fx.stories[0];if(!story)throw Error(`Missing recipe: ${weapon.name}`);
     const owned=fx.owned.entries.get(weapon.id);if(!owned?.loaded)throw Error(`Missing dedicated asset: ${weapon.name}`);
     let elapsed=0,visiblePixels=0;const animation=[];
     for(let frame=0;frame<phases.length;frame++){
      while(elapsed<phases[frame]){const step=Math.min(1/60,phases[frame]-elapsed);fx.update(step*1000);elapsed+=step;}
      sc.drawImage(fx.canvas,536,269,size,size,frame*cellWidth+8,row*rowHeight+22,size,size);
      const pixels=fx.ctx.getImageData(536,269,size,size).data;for(let i=3;i<pixels.length;i+=4){if(pixels[i]>20)visiblePixels++;animation.push(pixels[i]);}
     }
     pc.clearRect(0,0,size,size);
     fx.drawProjectile(pc,{visible:true,age:.5,x:76,y:64,px:75,py:64,color:'#ffcc88',profile:story.profile,options,history:[{x:76,y:64},{x:32,y:64}]});
     const pixels=pc.getImageData(0,0,size,size).data;let projectilePixels=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20)projectilePixels++;
     if(!projectilePixels)throw Error(`Empty solid projectile: ${weapon.name}`);
     if(!story.recipe.probe&&!visiblePixels)throw Error(`Empty material effect: ${weapon.name}`);
     if(fx.particles.length>fx.particleLimit)throw Error('Particle budget exceeded');
     sc.drawImage(projectile,6*cellWidth+8,row*rowHeight+22);sc.fillStyle='#e4e8d8';sc.font='12px Arial';sc.fillText(`${weapon.id}  ${weapon.name} / ${story.recipe.material}`,8,row*rowHeight+15);
     const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(animation)))).map(n=>n.toString(16).padStart(2,'0')).join('');
     records.push({id:weapon.id,name:weapon.name,recipe:story.recipe,asset:owned.design.asset,signature:owned.design.signature,raster:digest,probe:story.recipe.probe,visiblePixels,projectilePixels});
     if(records.length%perSheet===0||records.length===scene.arsenal.catalog.filter(Boolean).length)sheets.push(sheet.toDataURL('image/png'));
    }
   }finally{fx.reset();fx.texture=texture;fx.gpuParticles=gpu;Math.random=random;}
   return {records,sheets,materialArt:true};
  },legacyRules);
  result.sheets.forEach((data,index)=>fs.writeFileSync(path.join(artifacts,`sheet-${String(index+1).padStart(2,'0')}.png`),Buffer.from(data.split(',')[1],'base64')));
  const rasters=new Map();for(const r of result.records.filter(r=>!r.probe)){if(!rasters.has(r.raster))rasters.set(r.raster,[]);rasters.get(r.raster).push(r.name);}
  const duplicates=[...rasters.values()].filter(g=>g.length>1);
  const report={distinctAssets:new Set(result.records.map(r=>r.asset)).size,distinctGraphs:new Set(result.records.map(r=>r.signature)).size,duplicates,total:result.records.length,materials:[...new Set(result.records.map(r=>r.recipe.material))],materialArt:result.materialArt,contactSheets:result.sheets.length,phases:6,solidProjectiles:true,errors};
  fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(artifacts,'material-recipes.json'),JSON.stringify(result.records,null,2));
  assert.equal(report.total,770);assert.equal(report.distinctAssets,770);assert.equal(report.distinctGraphs,770);assert.deepEqual(duplicates,[],'The live compositor repeats an impact animation');assert.equal(report.materials.length,10);assert.ok(report.materialArt);assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
