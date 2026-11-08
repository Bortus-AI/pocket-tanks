const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),designs=require('./weapon-art/compile.cjs')();
(async()=>{
 const out=path.join(root,'public/assets/weapon-fx/v2');fs.mkdirSync(out,{recursive:true});
 const only=process.env.WEAPON_ART_IDS?.split(',').map(Number);const selected=only?designs.filter(d=>only.includes(d.id)):designs;
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:[...(process.env.CHROME_ARGS||'').split(' ').filter(Boolean),'--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();await page.setContent('<html><body></body></html>');
  const frames=fs.readFileSync(path.join(root,'src/graphics/weapon-art/frames.js'),'utf8').replace(/export /g,'');
  await page.addScriptTag({content:frames+'\nwindow.artPose=artPose;window.artFrames=ART_FRAMES;'});await page.addScriptTag({path:path.join(__dirname,'weapon-art/surface-baker.js')});
  await page.evaluate(()=>{window.baker=window.createWeaponSurfaceBaker();});
  const records=[];let done=0;
  for(const design of selected){
   const rendered=await page.evaluate(design=>{
    const sheet=document.createElement('canvas');sheet.width=sheet.height=640;const c=sheet.getContext('2d');const fingerprints={};
    for(let i=0;i<window.artFrames.length;i++){
     const frame=window.artFrames[i],source=window.baker.draw(design,frame);c.drawImage(source,i%5*128,Math.floor(i/5)*128);
    }
    return {png:sheet.toDataURL('image/png')};
   },design);
   const buffer=Buffer.from(rendered.png.split(',')[1],'base64'),filename=path.basename(design.asset);fs.writeFileSync(path.join(out,filename),buffer);
   records.push({id:design.id,name:design.name,asset:design.asset,bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),signature:design.signature});
   if(++done%20===0||done===selected.length)console.log(JSON.stringify({baked:done,total:selected.length,last:design.name,bytes:records.reduce((n,r)=>n+r.bytes,0)}));
  }
  assert.equal(new Set(records.map(r=>r.sha256)).size,records.length,'Two complete weapon texture sets repeat');
  fs.writeFileSync(path.join(out,only?'sample-manifest.json':'manifest.json'),JSON.stringify({version:2,tile:128,columns:5,frames:25,source:'authored physical geometry; offline WebGL surface bake',weapons:records},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1});
