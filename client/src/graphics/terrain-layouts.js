// Pure terrain generation and spawn planning. Match hosts serialize the path,
// including its small first-point metadata, so both peers use the same layout.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const gaussian=(x,center,width)=>Math.exp(-Math.pow((x-center)/width,2));
const triangle=x=>2/Math.PI*Math.asin(Math.sin(x));
export const TERRAIN_PROFILES=[
 {key:'hills',name:'Rolling Highlands',soil:['#8c9f75','#706b4e','#46463a','#202e30'],cap:'#62735a',rim:'#bbc097'},
 {key:'basin',name:'Sunken Basin',soil:['#c7b58a','#94805b','#655442','#303634'],cap:'#8e8d66',rim:'#d6c89d'},
 {key:'twinpeaks',name:'Twin Summits',soil:['#a6ada3','#7e8a82','#4b6261','#253a41'],cap:'#8b9e8e',rim:'#d5ddc6'},
 {key:'ridgeline',name:'Crown Ridge',soil:['#b1a17f','#8b7553','#5d5141','#293537'],cap:'#849171',rim:'#cec69b'},
 {key:'plateaus',name:'Mesa Crossing',soil:['#c6a47c','#a17b54','#76513d','#343633'],cap:'#9e9b6e',rim:'#ddc095'},
 {key:'badlands',name:'Broken Badlands',soil:['#9b9a8c','#78766a','#52565a','#252f3a'],cap:'#7c8976',rim:'#b6bda1'},
];
export const seededTerrainRandom=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
export const terrainProfile=key=>TERRAIN_PROFILES.find(profile=>profile.key===key)||TERRAIN_PROFILES[0];

export const makeTerrainPath=(width,height,kind='hills',rng=Math.random)=>{
 const profile=terrainProfile(kind),phase=rng()*Math.PI*2,variation=.88+rng()*.2;
 const left=.195+rng()*.045,right=.76+rng()*.045;
 const raw=t=>{
  let y;
  switch(profile.key){
   case 'basin':y=.38+.39*Math.pow(Math.sin(Math.PI*t),2)+.018*Math.sin(t*19+phase);break;
   case 'twinpeaks':y=.8-.42*gaussian(t,.34,.11)-.35*gaussian(t,.66,.12)+.02*Math.sin(t*22+phase);break;
   case 'ridgeline':y=.78-.42*gaussian(t,.5,.2)+.035*Math.sin(t*27+phase);break;
   case 'plateaus':{
    const mesa=smooth((t-.32)/.075)*(1-smooth((t-.61)/.075));
    const shelf=smooth((t-.08)/.04)*(1-smooth((t-.23)/.04));
    y=.77-.29*mesa-.07*shelf+.009*Math.sin(t*40+phase);break;
   }
   case 'badlands':y=.63+.13*triangle(t*24+phase)+.065*triangle(t*49+phase*.7)+.025*Math.sin(t*79);break;
   default:y=.63+.12*Math.sin(t*Math.PI*2+phase)+.055*Math.sin(t*Math.PI*4+phase*.6);break;
  }
  return clamp(.64+(y-.64)*variation,.24,.9)*height;
 };
 const leftY=raw(left),rightY=raw(right);
 const surface=t=>{
  let y=raw(t)+Math.sin(t*width*.063+phase)*1.1;
  for(const [center,padY]of [[left,leftY],[right,rightY]]){
   const weight=1-smooth((Math.abs(t-center)-.034)/.05);
   y=y*(1-weight)+padY*weight;
  }
  return clamp(y,height*.24,height*.9);
 };
 const path=[];
 for(let x=-200;x<=width+200;x+=8)path.push({x,y:surface(x/width)});
 if(path[path.length-1].x<width+200)path.push({x:width+200,y:surface((width+200)/width)});
 path[0].profile=profile.key;
 path[0].spawnColumns={left:Math.round(left*width),right:Math.round(right*width)};
 return path;
};

export const pathHeightAt=(path,x)=>{
 if(!path?.length)return null;
 let low=0,high=path.length-1;
 while(high-low>1){const middle=(low+high)>>1;if(path[middle].x>x)high=middle;else low=middle;}
 const a=path[low],b=path[high];
 if(!Number.isFinite(a.y)||!Number.isFinite(b.y))return null;
 return a.y+(b.y-a.y)*clamp((x-a.x)/Math.max(1,b.x-a.x),0,1);
};

// Opposing deployment sectors never overlap. Low-slope candidates are preferred
// within each sector; a saved host path produces the same usable deployment pad.
export const chooseTankSpawn=(path,width,height,side,rng=Math.random)=>{
 const left=side===1||side==='left',min=width*(left?.15:.73),max=width*(left?.27:.85);
 const pad=path?.[0]?.spawnColumns?.[left?'left':'right'];
 const desired=clamp(Number.isFinite(pad)?pad:min+(max-min)*rng(),min,max);
 let best={x:Math.round(desired),y:pathHeightAt(path,desired)??height*.6},bestScore=Infinity;
 for(let step=-6;step<=6;step++){
  const x=Math.round(clamp(desired+step*width*.006,min,max));
  const y=pathHeightAt(path,x),before=pathHeightAt(path,x-18),after=pathHeightAt(path,x+18);
  if(y===null||before===null||after===null)continue;
  const slope=Math.abs(after-before)/36;
  const score=slope*160+Math.abs(x-desired)*.02;
  if(score<bestScore){best={x,y};bestScore=score;}
 }
 best.y=clamp(Math.floor(best.y),0,height-1);
 return best;
};
