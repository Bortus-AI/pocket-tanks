import designs from './designs.json';
import bounds from './bounds.json';
import { ART_TILE, ART_COLUMNS, ART_FRAMES, drawOwnFallback } from './frames';
export const WEAPON_ART=Object.freeze(designs);
const byId=new Map(designs.map(d=>[d.id,d])),byName=new Map(designs.map(d=>[d.name.toLowerCase(),d]));
export const weaponArt=options=>byId.get(options.weaponId??options.id)||byName.get((options.weaponName||options.name||'').toLowerCase())||null;

// Texture ownership is one weapon -> one PNG -> one Phaser texture. There are
// no family lookups or aliases. A bounded cache releases inactive GPU textures.
export class WeaponArt {
    constructor(scene,activeIds){this.scene=scene;this.activeIds=activeIds;this.entries=new Map();this.limit=scene.game.device.os.desktop?24:20;this.disposed=false;this.failed=new Set();}
    get(design,immediate=true){
        if(!design||this.disposed)return null;
        let entry=this.entries.get(design.id);
        if(entry){entry.used=performance.now();if(immediate&&!entry.loaded&&!entry.fallbackReady){drawOwnFallback(design,entry.canvas);entry.texture.refresh();entry.fallbackReady=true;}return entry;}
        if(this.entries.size>=this.limit){
            const active=this.activeIds();const idle=[...this.entries.values()].filter(e=>!active.has(e.id)).sort((a,b)=>a.used-b.used)[0];
            if(!idle)return null;this.remove(idle);
        }
        const canvas=document.createElement('canvas');canvas.width=ART_TILE*ART_COLUMNS;canvas.height=ART_TILE*Math.ceil(ART_FRAMES.length/ART_COLUMNS);if(immediate)drawOwnFallback(design,canvas);
        const key=`weapon-art-v2-${design.id}`;
        const texture=this.scene.textures.addCanvas(key,canvas),frames={};
        ART_FRAMES.forEach((name,i)=>{
            const x=i%ART_COLUMNS*ART_TILE,y=Math.floor(i/ART_COLUMNS)*ART_TILE;frames[name]={x,y};texture.add(name,0,x,y,ART_TILE,ART_TILE);
        });
        entry={id:design.id,key,canvas,frames,tile:ART_TILE,texture,design,loaded:false,fallbackReady:immediate,used:performance.now()};this.entries.set(design.id,entry);
        entry.ready=new Promise(resolve=>{
            const image=new Image();entry.image=image;entry.resolve=resolve;
            image.onload=()=>{
                if(!this.disposed&&this.entries.get(entry.id)===entry){
                    const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0);
                    ART_FRAMES.forEach((name,i)=>{const f=frames[name],b=bounds[entry.id][i];f.bounds=b;texture.get(name).setSize(b[2],b[3],f.x+b[0],f.y+b[1]).setTrim(ART_TILE,ART_TILE,b[0],b[1],b[2],b[3]);});
                    texture.refresh();entry.loaded=true;
                }
                image.onload=image.onerror=null;image.src='';resolve(entry);
            };
            image.onerror=()=>{this.failed.add(design.id);resolve(entry);};
            image.src=design.asset;
        });
        return entry;
    }
    prewarm(ids){return Promise.all([...new Set(ids)].slice(0,this.limit).map(id=>{const entry=this.get(weaponArt({weaponId:id}),false);return entry?.ready;}));}
    remove(entry){this.entries.delete(entry.id);entry.image.onload=entry.image.onerror=null;entry.image.src='';entry.resolve?.(entry);if(this.scene.textures.exists(entry.key))this.scene.textures.remove(entry.key);entry.canvas.width=entry.canvas.height=1;}
    stats(){return {ownedTextures:this.entries.size,ownedTextureLimit:this.limit,loadedWeaponTextures:[...this.entries.values()].filter(e=>e.loaded).length,failedWeaponTextures:[...this.failed]};}
    dispose(){this.disposed=true;for(const entry of [...this.entries.values()])this.remove(entry);this.entries.clear();}
}
