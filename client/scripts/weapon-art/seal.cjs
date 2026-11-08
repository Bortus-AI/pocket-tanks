const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),designs=require(path.join(root,'src/graphics/weapon-art/designs.json'));
const report=JSON.parse(fs.readFileSync('/tmp/pocket-owned-pixel-audit.json','utf8'));
for(const channel of ['all','impactAlpha','phone','impact','body','trail','residue','muzzle','beam','debris']){
 assert.equal(report[channel].unique,770,`Repeated ${channel} rasters`);assert.deepEqual(report[channel].duplicates,[]);
}
const audited=JSON.parse(fs.readFileSync('/tmp/pocket-owned-audited-assets.json','utf8'));
const weapons=designs.map(d=>{
 const buffer=fs.readFileSync(path.join(root,'public',d.asset));
 assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'),audited[d.id],`Asset changed since audit: ${d.name}`);
 return {id:d.id,name:d.name,asset:d.asset,bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),signature:d.signature};
});
assert.equal(new Set(weapons.map(w=>w.sha256)).size,770);assert.equal(new Set(weapons.map(w=>w.asset)).size,770);
const bounds=JSON.parse(fs.readFileSync('/tmp/pocket-owned-frame-bounds.json','utf8'));fs.writeFileSync(path.join(root,'src/graphics/weapon-art/bounds.json'),JSON.stringify(bounds));
const area=Object.values(bounds).flat().reduce((sum,b)=>sum+b[2]*b[3],0);console.log(JSON.stringify({atlasVisibleAreaRatio:area/(770*25*128*128)}));
const out=path.join(root,'public/assets/weapon-fx/v2');fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:2,tile:128,columns:5,frames:25,sharedAssets:0,source:'authored physical geometry; offline WebGL surface bake',weapons},null,2));fs.writeFileSync(path.join(out,'raster-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({weapons:weapons.length,frames:weapons.length*25,bytes:weapons.reduce((n,w)=>n+w.bytes,0),sharedAssets:0,channels:Object.keys(report)}));
