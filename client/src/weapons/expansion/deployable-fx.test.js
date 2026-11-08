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
