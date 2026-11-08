/* Offline surface renderer. Every PNG is rendered from that weapon's own node
   graphs and poses. No image inputs, shared burst sprites or identity seeds. */
window.createWeaponSurfaceBaker=()=>{
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false});
 if(!gl)throw Error('WebGL2 is required for the offline surface bake');
 const vertex=`#version 300 es
 in vec2 position;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0,1);}`;
 const fragment=`#version 300 es
 precision highp float;
 in vec2 uv;out vec4 fragColor;
 uniform vec4 nodes[40];uniform vec4 shapes[40];uniform vec2 heat[40];uniform int count;
 uniform vec3 palette;uniform float centered;uniform float time;
 float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float fbm(vec3 p){return noise(p)*.55+noise(p*2.03+3.7)*.27+noise(p*4.07+9.1)*.13+noise(p*8.11+1.4)*.05;}
 void main(){
  vec2 p=vec2((uv.x-.5)*2.8,(uv.y-mix(.15,.5,centered))*1.9);
  float best=-100.,alpha=0.,material=0.,temp=0.;vec3 normal=vec3(0,0,1),world=vec3(0);float edge=0.;
  for(int i=0;i<40;i++){
   if(i>=count)break;vec4 n=nodes[i],s=shapes[i];
   vec2 size=max(vec2(.005),vec2(n.w)*s.xy);vec2 q=(p-n.xy)/size;
   float m=dot(q,q);if(m>1.45)continue;
   float k=s.z;float rough=fbm(vec3(p*8.,n.z*5.-time*1.4));
   if(k<1.5||k>3.5&&k<6.5)m/=mix(.83,1.2,rough);
   if(k>1.5&&k<3.5)m=max(abs(q.x)*.78+abs(q.y)*.7,abs(q.x)*.98-abs(q.y)*.16);
   if(k>6.5&&k<7.5)m=max(abs(q.x)*.93,abs(q.y)*.96);
   if(m>=1.)continue;
   float z=n.z+sqrt(max(.0,1.-m))*n.w;
   float a=(1.-smoothstep(.68,1.,m))*s.w;
   if(z>best){
    best=z;material=k;temp=heat[i].x;world=vec3(p,z);edge=m;
    normal=normalize(vec3(q.x/max(.25,s.x),q.y/max(.25,s.y),sqrt(max(.01,1.-m))));alpha=a;
   }else alpha=max(alpha,a*.72);
  }
  if(best< -99.){fragColor=vec4(0);return;}
  vec3 coord=world*10.+vec3(0,-time*1.7,time*.3);float f=clamp((fbm(coord)-.28)*1.9,0.,1.);
  float dx=fbm(coord+vec3(.08,0,0))-f,dy=fbm(coord+vec3(0,.08,0))-f;
  normal=normalize(normal+vec3(dx,dy,.0)*(material<1.5?8.:1.8));
  float lit=.2+max(.0,dot(normal,normalize(vec3(-.5,.7,1.))))*.8;
  float ambient=.65+.35*f;float spec=pow(max(0.,dot(reflect(normalize(vec3(.5,-.7,-1.)),normal),vec3(0,0,1))),material>3.5?24.:10.);
  vec3 color;
  if(material<.5){color=mix(vec3(.13,.15,.16),vec3(.54,.56,.55),f)*lit;alpha*=.89;}
  else if(material<1.5){
   float flame=smoothstep(.25,.85,f+temp*.08-world.y*.08);
   vec3 soot=mix(vec3(.1,.11,.12),vec3(.33,.34,.32),f)*lit;
   vec3 fire=mix(vec3(.55,.065,.006),vec3(1.,.42,.035),smoothstep(.2,.75,flame));
   fire=mix(fire,vec3(1.,.91,.51),pow(flame,5.)*.9);
   color=mix(soot,fire,flame*clamp(temp*1.5,0.,1.));
  }else if(material<2.5){color=mix(vec3(.22,.19,.14),vec3(.65,.54,.37),f)*lit;}
  else if(material<3.5){
   float facet=floor((normal.x+normal.y)*3.)/3.;color=mix(vec3(.16,.31,.41),vec3(.69,.87,.95),clamp(lit+facet*.15,0.,1.));color+=spec*.6;
  }else if(material<4.5){color=palette*(.16+lit*.65)+vec3(.86,.97,.79)*spec*.8;color*=.8+f*.3;}
  else if(material<5.5){color=palette*(.45+lit*.6)+vec3(.8,.8,1.)*pow(1.-edge,5.)*.8;alpha*=.8+.2*f;}
  else if(material<6.5){color=vec3(.8,.87,.78)*(.38+lit*.6)*(1.-pow(f,.5)*.23)+spec*.18;}
  else if(material<7.5){color=mix(vec3(.14,.24,.27),vec3(.58,.72,.7),lit)+vec3(.75,.8,.72)*spec*.6;color*=.85+.15*f;}
  else if(material<8.5){color=mix(vec3(.1,.3,.38),vec3(.54,.83,.88),lit)+spec*.65;alpha*=.82;}
  else{color=palette*(.4+lit*.6)*(1.-f*.25)+vec3(spec*.11);alpha*=.98;}
  fragColor=vec4(clamp(color,0.,1.),clamp(alpha,0.,1.));
 }`;
 const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
 const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const location=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
 const uniforms=Object.fromEntries(['nodes','shapes','heat','count','palette','centered','time'].map(n=>[n,gl.getUniformLocation(program,n)]));
 const data=new Float32Array(160),shapes=new Float32Array(160),heat=new Float32Array(80);
 return {canvas,draw(design,frame){
  const pose=window.artPose(design,frame);data.fill(0);shapes.fill(0);heat.fill(0);
  pose.forEach((n,i)=>{data.set(n.slice(0,4),i*4);shapes.set([n[4],n[5],n[6],n[7]],i*4);heat.set([n[8],0],i*2);});
  gl.uniform4fv(uniforms.nodes,data);gl.uniform4fv(uniforms.shapes,shapes);gl.uniform2fv(uniforms.heat,heat);gl.uniform1i(uniforms.count,pose.length);gl.uniform3fv(uniforms.palette,design.color);gl.uniform1f(uniforms.centered,frame.startsWith('impact')||frame.startsWith('residue')?0:1);gl.uniform1f(uniforms.time,Number(frame.split('-')[1])*.11);gl.drawArrays(gl.TRIANGLES,0,6);return canvas;
 },dispose(){gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}};
};
