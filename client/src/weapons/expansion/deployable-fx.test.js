import { devicePresentation, deviceShotDelay, RUN_ANIMATION_MS, DEVICE_EFFECT_LIFETIMES } from './deployable-fx';
test('strafe rounds fire when the animated drone reaches each stored origin in either direction',()=>{
 for(const heading of [-1,1]){
  const effect={kind:'run',from:{x:300,y:350},to:{x:300+84*heading,y:350}};
  const times=[28,56,84].map((distance,index)=>{
   const shot={from:{x:300+distance*heading,y:327}},delay=deviceShotDelay(effect,shot,index);
   const animatedX=effect.from.x+(effect.to.x-effect.from.x)*(delay/RUN_ANIMATION_MS);
   expect(animatedX).toBeCloseTo(shot.from.x,8);return delay;
  });
  expect(times[0]).toBeCloseTo(RUN_ANIMATION_MS/3);expect(times[1]).toBeCloseTo(RUN_ANIMATION_MS*2/3);expect(times[2]).toBe(RUN_ANIMATION_MS);
  expect(DEVICE_EFFECT_LIFETIMES.run).toBeGreaterThan(times[2]+220);
 }
 expect(deviceShotDelay({kind:'burst'},{from:{x:0}},1)).toBe(85);
});
test('device renderer stops idle uploads and disposes its scene texture/listeners',()=>{
 const context=new Proxy({clearRect:jest.fn()},{get(target,key){return key in target?target[key]:()=>{};},set(target,key,value){target[key]=value;return true;}});
 const canvas=jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);
 const refresh=jest.fn(),destroy=jest.fn(),listeners=new Map();
 const image={setDepth(){return this;},destroy};
 const scene={sys:{game:{},settings:{key:'test'}},renderer:{width:1200,height:800},terrain:{height:533},tacticalWorld:{devices:[]},
  events:{on:jest.fn((event,handler)=>listeners.set(event,handler)),once:jest.fn((event,handler)=>listeners.set(event,handler)),off:jest.fn()},
  textures:{exists:jest.fn(()=>true),remove:jest.fn(),addCanvas:jest.fn(()=>({refresh}))},add:{image:()=>image}};
 const fx=devicePresentation(scene);expect(devicePresentation(scene)).toBe(fx);
 listeners.get('update')(0,16);listeners.get('update')(16,16);expect(refresh).not.toHaveBeenCalled();
 fx.deploy({id:1,x:120,y:200});listeners.get('update')(32,16);expect(refresh).toHaveBeenCalledTimes(1);
 for(let i=0;i<20;i++)listeners.get('update')(100+i*60,60);
 const count=refresh.mock.calls.length;listeners.get('update')(2000,16);listeners.get('update')(2016,16);
 expect(refresh).toHaveBeenCalledTimes(count);
 listeners.get('shutdown')();expect(destroy).toHaveBeenCalledTimes(1);expect(scene.textures.remove).toHaveBeenCalledWith('device-fx-test');
 expect(scene.events.off).toHaveBeenCalledWith('update',expect.any(Function));canvas.mockRestore();
});

const mockScene=(devices=[])=>{
 const refresh=jest.fn(),listeners=new Map();
 const scene={sys:{game:{},settings:{key:'t2'}},renderer:{width:1200,height:800},terrain:{height:533},tacticalWorld:{devices},
  tank1:{x:100,y:300},tank2:{x:900,y:300},
  events:{on:jest.fn((e,h)=>listeners.set(e,h)),once:jest.fn((e,h)=>listeners.set(e,h)),off:jest.fn()},
  textures:{exists:jest.fn(()=>false),remove:jest.fn(),addCanvas:jest.fn(()=>({refresh}))},add:{image:()=>({setDepth(){return this;},destroy(){}})}};
 return {scene,refresh,listeners};
};
const proxyContext=()=>new Proxy({},{get:(t,k)=>k in t?t[k]:()=>({addColorStop(){}}),set:(t,k,v)=>{t[k]=v;return true;}});
test('static devices redraw only on state change and the empty missile path never crashes',()=>{
 const canvas=jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(proxyContext());
 try{
  const sentry={id:1,kind:'sentry',x:300,y:300,heading:1,ammo:4,heat:0,owner:null};
  const {scene,refresh,listeners}=mockScene([sentry]);const fx=devicePresentation(scene),update=listeners.get('update');
  update(0,16);const first=refresh.mock.calls.length;for(let i=0;i<30;i++)update(0,16);
  expect(refresh.mock.calls.length).toBe(first);
  sentry.ammo=3;update(0,16);expect(refresh.mock.calls.length).toBe(first+1);
  fx.missile(sentry,[]);expect(fx.effects).toHaveLength(0);
  fx.effects.push({kind:'missile',id:1,path:[],start:fx.time,x:0,y:0});expect(()=>update(0,16)).not.toThrow();
 }finally{canvas.mockRestore();}
});
test('device cues use the sound manager master chain, not context.destination',()=>{
 const canvas=jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(proxyContext());
 try{
  const connections=[];const node=()=>({connect:jest.fn(t=>connections.push(t)),disconnect(){},start(){},stop(){},frequency:param(),gain:param(),Q:param(),pan:param(),detune:param(),onended:null});
  function param(){return {setValueAtTime(){},exponentialRampToValueAtTime(){}};}
  const destination={name:'context-destination'},master={name:'phaser-master',connect(){}};
  const context={state:'running',currentTime:0,sampleRate:8000,destination,createOscillator:node,createGain:node,createBiquadFilter:node,createBufferSource:node,
   createBuffer:(c,l)=>({getChannelData:()=>new Float32Array(l)})};
  const {scene}=mockScene();scene.sound={context,destination:master,mute:false,play:jest.fn()};
  devicePresentation(scene).deploy({id:7,x:10,y:10});
  expect(connections).toContain(master);expect(connections).not.toContain(destination);
  scene.sound.mute=true;connections.length=0;scene.deployableFX.wreck({id:7,x:10,y:10});expect(connections).toHaveLength(0);
 }finally{canvas.mockRestore();}
});
