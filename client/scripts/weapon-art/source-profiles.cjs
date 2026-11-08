const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../..');
const babel=require(path.join(root,'node_modules/@babel/core'));
const transform=require.resolve(path.join(root,'node_modules/@babel/plugin-transform-modules-commonjs'));
const cache=new Map();
function load(file){
 file=path.resolve(file.endsWith('.js')?file:file+'.js');if(cache.has(file))return cache.get(file).exports;
 const mod=new Module(file,module);mod.filename=file;cache.set(file,mod);
 mod.require=id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id)):require(id);
 mod._compile(babel.transformFileSync(file,{babelrc:false,configFile:false,plugins:[transform]}).code,file);return mod.exports;
}
const {weaponIdentity}=load(path.join(root,'src/graphics/weapon-identity.js'));
const catalog=require('./catalog.json');
const rules=fs.readFileSync(path.join(root,'src/weapons/expansion/unique-mechanics.js'),'utf8').match(/const legacyRules=Object\.freeze\((\{[^;]+?\})\);/)[1];
const legacyRules=JSON.parse(rules.replace(/'/g,'"').replace(/([{,])(\d+):/g,'$1"$2":'));
const legacyPayload=id=>[7,8,12,13,17,18,19,25,27].includes(id)?'seismic':id===14?'ion':[15,23].includes(id)?'fire':id===16?'frost':'kinetic';
module.exports=catalog.map(w=>{
 const definition=w.id<30?{...w,payload:{key:legacyPayload(w.id)},mechanicalRules:legacyRules[w.id]||[]}:w;
 return {definition,profile:weaponIdentity(definition)};
});
