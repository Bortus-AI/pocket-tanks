const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const source=require('./source-profiles.cjs'),direction=require('./art-direction.cjs'),{resolve}=require('./forms.cjs');
const named=Object.fromEntries((direction.original+direction.returning).trim().split('\n').filter(Boolean).map(line=>line.split('=')));
const expanded=direction.expansion.trim().split('\n').flatMap(row=>row.trim().split(/\s+/));assert.equal(expanded.length,370);
const poseSource=fs.readFileSync(path.resolve(__dirname,'../../src/graphics/weapon-art/frames.js'),'utf8').replace(/export /g,'');
const {artPose,ART_FRAMES}=new Function(poseSource+';return {artPose,ART_FRAMES};')();
const group=(words,value)=>words.split(' ').includes(value);
// Authored materials are physical responses, not a color selector. The baker
// shades gas, liquid, foam and faceted solids differently in depth and time.
const materials={mixed:1,tar:9,kinetic:1,fire:1,frost:3,acid:4,ion:5,seismic:2,leech:4,foam:6,magnet:7,volatile:1};
const colors={mixed:[.44,.76,.9],tar:[.018,.021,.025],kinetic:[1,.58,.16],fire:[1,.33,.035],frost:[.44,.76,.9],acid:[.38,.68,.08],ion:[.49,.31,1],seismic:[.48,.36,.21],leech:[.65,.12,.35],foam:[.76,.89,.76],magnet:[.25,.52,.55],volatile:[1,.72,.15]};
const debris=words=>group('shrapnel slivers nail pellet plates slab boulder clod grit swarf filings ore magnetite spikes shards flakes coin ingot casing fin teeth',words);
const cold=words=>group('shards spikes flakes iceberg icicle icefang prism frost snowball snowbank',words);
const fluid=words=>group('splash drop spray pool wavecrest breakingwaves whitewater waterjet watercap tendrils gel slime tar rubber bubble foam suds pillow',words);
function kindOf(form,role,material){
 if(cold(form))return 3;if(fluid(form))return material==='tar'?9:material==='foam'?6:material==='acid'||material==='leech'?4:8;
 if(form==='filings'||form==='magnetite'||form==='ore'||form==='coin'||form==='ingot')return 7;
 if(debris(form))return material==='frost'?3:material==='magnet'?7:2;
 if(group('electrode coil corona field cells prongs pulse lens',form))return 5;
 if(group('dust mist cloud billow smolder',form)||role===2)return 0;
 return materials[material];
}
function compile(){
 const designs=source.map(({definition:w,profile:p})=>{
  const directions=(direction.revisions[w.name]||((w.id>=30&&w.id<400)?expanded[w.id-30].replaceAll('-','/'):named[w.name]));
  assert.ok(directions,`Missing authored effect: ${w.id} ${w.name}`);
  const motifs=directions.split('/');assert.equal(motifs.length,3);
  const material=w.name==='Tar Ball'?'tar':w.name==='Fire + Ice'?'mixed':w.payload.key,construction=group('wall dome berm platform bridge selfbridge seed selfdome selfrubberdome pedestal scatterbuild pillars selfshelter island rubberwall',p.mechanic);
  const nodes=motifs.map((motif,role)=>{
   const shape=resolve(motif),kind=material==='mixed'?[1,3,0][role]:construction?(role===1?2:0):kindOf(shape.form,role,material);
   return {form:shape.form,motion:shape.motion,kind,nodes:shape.nodes.map(n=>n.map(v=>Math.round(v*10000)/10000))};
  });
  const projectile=group('guided selflaunch jump',p.mechanic)?'rocket':group('drill tunnel longtunnel drillburst groundfan saw',p.mechanic)?'auger':group('mine roller bouncer ricochet',p.mechanic)?'ball':construction?'box':p.presentation==='probe'?'needle':'shell';
  const body=resolve(projectile);
  const design={id:w.id,name:w.name,version:2,asset:`assets/weapon-fx/v2/${String(w.id).padStart(3,'0')}${material==='tar'?'-tar':material==='mixed'?'-mixed':''}.png`,
   material,color:colors[material],presentation:p.presentation,construction,mechanic:p.mechanic,
   duration:group('rise grow build inflate',nodes[0].motion)?1.25:1.05,
   motifs,nodes,body:{form:body.form,nodes:body.nodes},
  };
  design.signature=crypto.createHash('sha256').update(JSON.stringify(ART_FRAMES.map(frame=>artPose(design,frame)))).digest('hex');
  return design;
 });
 assert.equal(designs.length,770);const duplicates=new Map();for(const d of designs){if(!duplicates.has(d.signature))duplicates.set(d.signature,[]);duplicates.get(d.signature).push(d.name);}
 const repeated=[...duplicates.values()].filter(names=>names.length>1);assert.deepEqual(repeated,[],'Repeated complete physical animation graphs');
 const dest=path.resolve(__dirname,'../../src/graphics/weapon-art/designs.json');fs.writeFileSync(dest,JSON.stringify(designs));
 console.log(JSON.stringify({designs:designs.length,independentGraphs:duplicates.size,bytes:fs.statSync(dest).size}));return designs;
}
if(require.main===module)compile();module.exports=compile;
