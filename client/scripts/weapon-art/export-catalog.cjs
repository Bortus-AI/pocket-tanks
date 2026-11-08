// Regenerates catalog.json from the live weapon packs so baked art follows the
// current payloads and options. Legacy ids 0-29 keep their catalog entries.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../..');
const babel=require(path.join(root,'node_modules/@babel/core'));
const transform=require.resolve(path.join(root,'node_modules/@babel/plugin-transform-modules-commonjs'));
const cache=new Map();
function load(file){
 file=path.resolve(file);if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.js');else if(!/\.(js|json)$/.test(file))file+='.js';if(cache.has(file))return cache.get(file).exports;
 if(file.endsWith('.json'))return require(file);
 const mod=new Module(file,module);mod.filename=file;cache.set(file,mod);
 mod.require=id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id)):require(id);
 mod._compile(babel.transformFileSync(file,{babelrc:false,configFile:false,plugins:[transform]}).code,file);return mod.exports;
}
const src=p=>path.join(root,'src/weapons',p);
const {expansionCatalog}=load(src('expansion/catalog.js'));
const {classicAdaptations,earlyClassicAdaptations}=load(src('expansion/classics.js'));
const {laterClassicAdaptations,modernClassicAdaptations}=load(src('expansion/later-classics.js'));
const {withMechanicalRules}=load(src('expansion/unique-mechanics.js'));
const {stableWeaponId}=load(src('weapon-ids.js'));
const previous=require('./catalog.json');
const byId=new Map(previous.filter(w=>w.id<30).map(w=>[w.id,w]));
expansionCatalog.forEach(d=>byId.set(d.id,d));
const seen=new Set(expansionCatalog.map(d=>d.name.toLowerCase().replace(/[^a-z0-9]/g,'')));
[classicAdaptations,earlyClassicAdaptations,laterClassicAdaptations,modernClassicAdaptations].forEach(pack=>pack.forEach(d=>{
 const key=d.name.toLowerCase().replace(/[^a-z0-9]/g,'');if(seen.has(key))return;seen.add(key);
 const id=stableWeaponId(d.name);if(!Number.isInteger(id))throw Error(`unpinned weapon ${d.name}`);
 byId.set(id,{...d,id});
}));
const shape=(old,live)=>{
 // Keep the catalog's field set; mechanicalRules come from the live rule table.
 const ruled=live.id>=30?withMechanicalRules(live):live;
 const out={};for(const k of Object.keys(old||ruled))if(ruled[k]!==undefined)out[k]=ruled[k];
 if(ruled.mechanicalRules?.length)out.mechanicalRules=ruled.mechanicalRules;else delete out.mechanicalRules;
 return JSON.parse(JSON.stringify(out));
};
const prevById=new Map(previous.map(w=>[w.id,w]));
const next=[...byId.keys()].sort((a,b)=>a-b).map(id=>id<30?byId.get(id):shape(prevById.get(id),byId.get(id)));
if(next.length!==770)throw Error(`expected 770 weapons, got ${next.length}`);
next.forEach((w,i)=>{if(w.id!==i)throw Error(`gap at ${i}`);});
const changed=next.filter((w,i)=>JSON.stringify(w)!==JSON.stringify(previous[i]));
const payloadChanged=next.filter((w,i)=>w.payload?.key!==previous[i].payload?.key).map(w=>`${w.id} ${w.name}: ${previous[w.id].payload?.key} -> ${w.payload?.key}`);
if(process.argv.includes('--write'))fs.writeFileSync(path.join(__dirname,'catalog.json'),JSON.stringify(next,null,2)+'\n');
console.log(JSON.stringify({total:next.length,changed:changed.length,payloadChanged},null,1));
