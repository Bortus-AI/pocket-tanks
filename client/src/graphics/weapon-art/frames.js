// Owned animation frames are resolved from physical geometry. Names, IDs,
// palettes and random seeds never enter the motion or topology calculations.
export const ART_TILE=128;
export const ART_COLUMNS=5;
export const ART_FRAMES=[...Array.from({length:12},(_,i)=>`impact-${i}`),...Array.from({length:2},(_,i)=>`body-${i}`),...Array.from({length:3},(_,i)=>`trail-${i}`),...Array.from({length:3},(_,i)=>`residue-${i}`),...Array.from({length:2},(_,i)=>`muzzle-${i}`),...Array.from({length:2},(_,i)=>`beam-${i}`),'debris-0'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const move=(motion,x,y,t)=>{
    switch(motion){
        case 'rise':case 'lick':return [x+Math.sin(y*7+t*8)*t*.07,y+t*.4];
        case 'jet':case 'fountain':return [x*(.5+t),y+t*.62-t*t*.22];
        case 'float':case 'drift':return [x+t*.18+Math.sin(y*8+t*4)*.06*t,y+t*.25];
        case 'ballistic':case 'tumble':case 'fall':return [x*(.6+t*1.1),y+t*.5-t*t*.95];
        case 'roll':case 'crawl':case 'flow':case 'sweep':case 'rake':return [x*(.65+t*.6)+t*.22,y*(1-t*.25)];
        case 'inward':case 'attract':case 'close':return [x*(1.2-t*.8),y*(1.1-t*.5)];
        case 'curl':case 'spiral':case 'spin':case 'drill':case 'wave':{
            const angle=t*(motion==='spin'?2.5:1.2),cy=y-.35;return [x*Math.cos(angle)-cy*Math.sin(angle),.35+x*Math.sin(angle)+cy*Math.cos(angle)+t*.12];
        }
        case 'return':case 'exchange':case 'snap':return [x*(1.2-t*.65)+Math.sin(t*Math.PI)*.1,y+t*.15];
        case 'grow':case 'build':case 'lift':case 'assemble':case 'deploy':return [x,y*clamp(t*2.5,.15,1)];
        case 'settle':case 'creep':return [x*(.7+t*.7),y*(1-t*.65)];
        case 'stretch':case 'flutter':return [x*(1+t*.5)+Math.sin(y*8+t*7)*t*.08,y*(1-t*.2)];
        case 'compress':case 'slam':case 'thrust':case 'pierce':return [x*(.6+t*.9),y*(1-t*.4)];
        case 'bounce':case 'skip':return [x+t*.25,y+Math.abs(Math.sin(t*Math.PI*2))*.2*(1-t)];
        case 'pulse':case 'discharge':case 'charge':return [x*(.8+.23*Math.sin(t*12)),y*(.85+.2*Math.sin(t*10))];
        default:return [x*(.6+t*.75),y*(.65+t*.6)];
    }
};

// [x,y,z,r,stretchX,stretchY,material,opacity,temperature]
export const artPose=(design,frameName)=>{
    const [channel,indexString]=frameName.split('-'),index=Number(indexString);
    const t=channel==='impact'?index/11:channel==='trail'||channel==='residue'?index/2:index;
    const result=[];
    if(channel==='body'){
        for(const n of design.body.nodes)result.push([n[0]*.82,(n[1]-.32)*.82,n[2],n[3]*.82,n[4],n[5],7,1,.2]);
    }
    design.nodes.forEach((layer,role)=>{
        const material=layer.kind;
        let progress=t,scale=1,offsetX=0,offsetY=0,alpha=1,temperature=0;
        if(channel==='impact'){
            const start=role===0?0:role===1?.1:.37;
            progress=clamp((t-start)/(1-start),0,1);
            if(t<start)return;
            scale=role===0?.85:role===1?.73:1;
            alpha=role===0?Math.pow(1-t,.35):role===1?Math.pow(1-progress,.5):Math.sin(progress*Math.PI)*.8;
            offsetY=role===2?-.08:0;
            temperature=role===0?1-t*.95:.75-t*.8;
        }else if(channel==='body'){
            scale=role===0?.27:role===1?.22:.18;offsetX=role===0?.24:role===1?-.18:-.37;offsetY=-.22;
            progress=.3+index*.13;temperature=.7;
        }else if(channel==='trail'){
            scale=role===0?.42:role===1?.35:.4;offsetX=-role*.11;offsetY=-.2;
            progress=.12+t*.62;alpha=role===2?.65:.9;temperature=.9-t*.7;
        }else if(channel==='residue'){
            scale=role===2?.95:role===1?.47:.55;offsetY=-.09;
            progress=.55+t*.4;alpha=role===2?.9:.48;temperature=.22-t*.22;
        }else if(channel==='muzzle'){
            scale=role===0?.42:role===1?.29:.3;offsetX=.17+role*.18;offsetY=-.22;
            progress=.12+index*.38;temperature=1-index*.5;
        }else if(channel==='beam'){
            scale=role===0?.75:role===1?.57:.5;offsetX=(role-1)*.38;offsetY=-.22;
            progress=.25+index*.25;temperature=.95-index*.25;
        }else{
            scale=role===0?.32:role===1?.45:.35;offsetX=(role-1)*.18;offsetY=-.21;progress=.48;
        }
        layer.nodes.forEach(n=>{
            let [x,y]=move(layer.motion,n[0],n[1],progress);
            let r=n[3]*(channel==='impact'?(.3+Math.sin(Math.min(.97,progress+.13)*Math.PI)*.8):1);
            let sx=n[4],sy=n[5],kind=material;
            if(design.material==='frost'&&material!==0){sx*=.7;sy*=1.25;}
            if(design.material==='foam'){r*=1.1;sy*=.8+progress*.5;}
            if(design.material==='magnet'){x*=.8;sy*=1.12;}
            if(channel==='residue'){
                kind=design.material==='fire'||design.material==='volatile'?0:design.material==='frost'?3:design.material==='foam'?6:material;
                y*=role===2?.46:.3;sy*=.5;
            }
            if(channel==='body'){kind=role===2?7:material;x*=1.15;sy*=.65;}
            if(channel==='beam'){x*=2.1;y*=.33;sy*=.4;kind=design.material==='frost'?3:material===2||material===7?7:5;}
            if(channel==='debris'){kind=material===0?2:material;y*=.75;}
            result.push([x*scale+offsetX,y*scale+offsetY,n[2]+(2-role)*.15,r*scale,sx,sy,kind,alpha,temperature]);
        });
    });
    return result.slice(0,40);
};

export const ownedFrame=(particle)=>{
    const count={impact:12,trail:3,residue:3,muzzle:2,beam:2,debris:1}[particle.channel]||1;
    return `${particle.channel}-${Math.min(count-1,Math.max(0,Math.floor(particle.age/particle.life*count)))}`;
};

// A weapon's own geometry can appear immediately while its baked surface loads.
// This contains no family assets and is replaced once by that weapon's PNG.
export const drawOwnFallback=(design,target=null)=>{
    const canvas=target||document.createElement('canvas');canvas.width=ART_TILE*ART_COLUMNS;canvas.height=ART_TILE*Math.ceil(ART_FRAMES.length/ART_COLUMNS);
    const c=canvas.getContext('2d');
    ART_FRAMES.forEach((frame,i)=>{
        c.save();c.translate(i%ART_COLUMNS*ART_TILE,Math.floor(i/ART_COLUMNS)*ART_TILE);
        const centered=!frame.startsWith('impact')&&!frame.startsWith('residue');
        for(const n of artPose(design,frame)){
            const x=(.5+n[0]/2.8)*ART_TILE,y=((centered?.5:.85)-n[1]/1.9)*ART_TILE;
            const rx=n[3]*n[4]*ART_TILE/2.8,ry=n[3]*n[5]*ART_TILE/1.9;
            c.save();c.translate(x,y);c.scale(rx,ry);c.globalAlpha=n[7]*.9;
            const color=n[6]===0?[.35,.37,.37]:n[6]===7?[.4,.53,.56]:n[6]===2?[.4,.33,.23]:design.color;
            const rgb=(v,k=1)=>Math.round(Math.min(255,v*255*k));
            const g=c.createRadialGradient(-.27,-.35,.05,0,0,1);g.addColorStop(0,`rgb(${color.map(v=>rgb(v,1.5)).join(',')})`);g.addColorStop(.55,`rgb(${color.map(v=>rgb(v,.85)).join(',')})`);g.addColorStop(1,`rgba(${color.map(v=>rgb(v,.3)).join(',')},0)`);
            c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
        }
        c.restore();
    });return canvas;
};

// Retain the original animation origin while avoiding transparent-pixel work.
export const drawOwnedFrame=(c,art,name,x,y,width,height)=>{
    const f=art.frames[name],b=f.bounds||[0,0,ART_TILE,ART_TILE];
    c.drawImage(art.canvas,f.x+b[0],f.y+b[1],b[2],b[3],x+b[0]/ART_TILE*width,y+b[1]/ART_TILE*height,b[2]/ART_TILE*width,b[3]/ART_TILE*height);
};
