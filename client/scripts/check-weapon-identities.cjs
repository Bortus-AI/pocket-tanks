/* Build first. Renders the actual WeaponFX compositor in Chromium, in grayscale,
   at six phases plus the projectile/trail. Produces a full roster of contact
   sheets, exact pixel hashes and perceptual nearest pairs for human inspection.
   PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-weapon-identities.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const artifacts=process.env.IDENTITY_ARTIFACTS||'/tmp/pocket-weapon-identities',root=process.env.CLIENT_BUILD_PATH||path.resolve(__dirname,'../build');
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav'};
(async()=>{
 fs.mkdirSync(artifacts,{recursive:true});
 const rulesSource=fs.readFileSync(path.resolve(__dirname,'../src/weapons/expansion/unique-mechanics.js'),'utf8');
 const literal=rulesSource.match(/const legacyRules=Object\.freeze\((\{[^;]+?\})\);/)?.[1];assert.ok(literal,'Original weapon rule metadata must be available for the render audit');
 const legacyRules=JSON.parse(literal.replace(/'/g,'"').replace(/([{,])(\d+):/g,'$1"$2":'));
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 let browser;const errors=[];
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',error=>errors.push(error.stack||error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.game?.scene.getScene('loading-scene')?.load?.isLoading()===false,null,{timeout:30000});
  await page.evaluate(()=>{window.game.sound.mute=true;const weapons=[{id:30,name:'Impact Howitzer',type:0}];window.game.scene.start('main-scene',{gameType:4,player1:{name:'IDENTITY A',color:0x6eaa99,weapons:weapons.map(w=>({...w}))},player2:{name:'IDENTITY B',color:0xc59a76,weapons:weapons.map(w=>({...w}))}});});
  await page.waitForFunction(()=>window.game.scene.getScene('main-scene')?.scene.isActive());
  await page.evaluate(()=>{const s=window.game.scene.getScene('main-scene'),entry=s.arsenal.catalog[30],runtime=entry.createInstance(),weapon={id:30,scene:s,tank:s.tank1,turret:s.tank1.turret,terrain:s.terrain};runtime.create(weapon);runtime.burst(600,300,25,.01);runtime.finish();s.scene.pause();s.weaponFX.reset();});
  console.log('CHECK actual Phaser compositor ready; rendering all 770 grayscale identities');
  const result=await page.evaluate(async legacyRules=>{
   const scene=window.game.scene.getScene('main-scene'),fx=scene.weaponFX,phases=[.08,.24,.43,.64,.83,.96],size=128;
   fx.monochrome=true;
   const records=[],sheets=[],perSheet=10,columns=7,cellWidth=144,rowHeight=162;
   const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d',{willReadFrequently:true});
   let sheet,sc;
   const beginSheet=()=>{sheet=document.createElement('canvas');sheet.width=columns*cellWidth;sheet.height=perSheet*rowHeight;sc=sheet.getContext('2d');sc.fillStyle='#071218';sc.fillRect(0,0,sheet.width,sheet.height);};
   for(const weapon of scene.arsenal.catalog.filter(Boolean)){
    if(records.length%perSheet===0)beginSheet();
    const row=records.length%perSheet,base=weapon.id<30;
    const payload=base?([7,8,12,13,17,18,19,25,27].includes(weapon.id)?'seismic':weapon.id===14?'ion':[15,23].includes(weapon.id)?'fire':weapon.id===16?'frost':'kinetic'):weapon.payload.key;
    const options={weaponId:weapon.id,weaponName:weapon.name,payload,behavior:weapon.behavior,classicMechanic:weapon.classicMechanic,mechanicOptions:weapon.options,semanticRules:base?legacyRules[weapon.id]||[]:weapon.mechanicalRules||[],angle:.4,color:0xffffff};
    const story=fx.story(size/2,size/2,38,options);if(!story)throw Error(`No compositor story for ${weapon.name}`);
    const pixels=new Uint8Array(size*size*columns),perceptual=[];
    for(let frame=0;frame<columns;frame++){
     c.globalCompositeOperation='source-over';c.globalAlpha=1;c.fillStyle='#000000';c.fillRect(0,0,size,size);
     if(frame<phases.length){story.age=story.life*phases[frame];fx.drawStory(c,story);}else fx.drawIdentityProjectile(c,{x:88,y:64,px:87,py:64,age:.5,color:'#ffffff',profile:story.profile,options,history:Array.from({length:16},(_,i)=>({x:88-i*4,y:64+Math.sin(i/3)*3}))});
     const data=c.getImageData(0,0,size,size).data;
     for(let index=0;index<size*size;index++){const gray=Math.round(data[index*4]*.299+data[index*4+1]*.587+data[index*4+2]*.114);pixels[frame*size*size+index]=gray;data[index*4]=data[index*4+1]=data[index*4+2]=gray;}
     c.putImageData(new ImageData(data,size,size),0,0);
     sc.drawImage(canvas,frame*cellWidth+8,row*rowHeight+24);
     const thumbnail=document.createElement('canvas');thumbnail.width=9;thumbnail.height=8;const tc=thumbnail.getContext('2d');tc.drawImage(canvas,0,0,9,8);const tiny=tc.getImageData(0,0,9,8).data;
     for(let y=0;y<8;y++){let bits=0;for(let x=0;x<8;x++)bits=(bits<<1)|(tiny[(y*9+x)*4]>tiny[(y*9+x+1)*4]?1:0);perceptual.push(bits);}
    }
    sc.fillStyle='#d5dfd7';sc.font='13px Arial';sc.fillText(`${weapon.id}  ${weapon.name}`,8,row*rowHeight+16);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).map(value=>value.toString(16).padStart(2,'0')).join('');
    records.push({id:weapon.id,name:weapon.name,hash,perceptual,story:story.profile.source,mechanic:story.profile.mechanic});
    if(records.length%perSheet===0||records.length===scene.arsenal.catalog.filter(Boolean).length)sheets.push(sheet.toDataURL('image/png'));
   }
   return {records,sheets};
  },legacyRules);
  result.sheets.forEach((data,index)=>fs.writeFileSync(path.join(artifacts,`sheet-${String(index+1).padStart(2,'0')}.png`),Buffer.from(data.split(',')[1],'base64')));
  const buckets=new Map();for(const record of result.records){if(!buckets.has(record.hash))buckets.set(record.hash,[]);buckets.get(record.hash).push(record.name);}
  const duplicates=[...buckets.values()].filter(group=>group.length>1),popcount=value=>{let n=0;while(value){value&=value-1;n++;}return n;},nearest=[];
  for(let a=0;a<result.records.length;a++)for(let b=a+1;b<result.records.length;b++){const left=result.records[a],right=result.records[b];let distance=0;for(let index=0;index<left.perceptual.length;index++){distance+=popcount(left.perceptual[index]^right.perceptual[index]);if(distance>12)break;}if(distance<=12)nearest.push({distance,left:{id:left.id,name:left.name},right:{id:right.id,name:right.name}});}
  nearest.sort((a,b)=>a.distance-b.distance);
  const perceptualZeroPairs=nearest.filter(pair=>pair.distance===0);
  const report={total:result.records.length,uniqueRasterAnimations:buckets.size,exactDuplicates:duplicates,perceptualZeroPairs,perceptualNearPairs:nearest,contactSheets:result.sheets.length,phases:6,projectileAndTrail:true,grayscale:true,equalToneMaterials:true,errors};
  fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(artifacts,'raster-fingerprints.json'),JSON.stringify(result.records,null,2));
  console.log(JSON.stringify({...report,perceptualNearPairs:nearest.slice(0,30)}));assert.equal(result.records.length,770);assert.deepEqual(duplicates,[],'Actual grayscale raster animations repeat');assert.deepEqual(perceptualZeroPairs,[],'Low-resolution phone-size animation fingerprints repeat');assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
