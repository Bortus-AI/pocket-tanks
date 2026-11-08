import Phaser from 'phaser';
import { frameSeconds, reducedMotion } from './motion';

// Phaser 3 post pipeline. Only the battlefield receives bloom,
// localized pressure waves, heat refraction and short-lived impact illumination.
const fragmentShader = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uTime;
uniform float uMotion;
uniform vec4 uImpact0;
uniform vec4 uImpact1;
uniform vec4 uImpact2;
uniform vec4 uHeat;
varying vec2 outTexCoord;

vec2 pressure(vec2 pixel, vec4 impact) {
    vec2 delta = pixel - impact.xy;
    float distance = length(delta);
    float age = impact.w;
    float envelope = max(0.0, 1.0 - age / .65) * step(0.0, age);
    float radius = impact.z * .3 + age * 250.0;
    float ring = exp(-abs(distance - radius) * .12);
    return delta / max(1.0, distance) * ring * envelope * 2.8;
}
float illumination(vec2 pixel, vec4 impact) {
    float age = impact.w;
    float envelope = max(0.0, 1.0 - age / .22) * step(0.0, age);
    return exp(-length(pixel - impact.xy) / max(1.0, impact.z * 1.5)) * envelope;
}
vec3 bright(vec2 uv) {
    vec3 color = texture2D(uMainSampler, clamp(uv, vec2(.001), vec2(.999))).rgb;
    return color * smoothstep(.68, 1.0, max(max(color.r, color.g), color.b));
}
void main() {
    vec2 pixel = vec2(outTexCoord.x, 1.0-outTexCoord.y) * uResolution;
    float world = smoothstep(128.0, 150.0, pixel.y) * (1.0-smoothstep(uResolution.y*2.0/3.0-8.0,uResolution.y*2.0/3.0,pixel.y));
    vec2 shift = pressure(pixel,uImpact0)+pressure(pixel,uImpact1)+pressure(pixel,uImpact2);
    vec2 heatDelta = pixel-uHeat.xy;
    float heat = exp(-abs(heatDelta.x)/max(1.0,uHeat.z*.7)) * (1.0-smoothstep(-15.0,10.0,heatDelta.y)) * smoothstep(-uHeat.z*2.0,-uHeat.z*.4,heatDelta.y) * max(0.0,1.0-uHeat.w/2.0);
    shift.x += sin(pixel.y*.16-uTime*9.0)*heat*1.5;
    vec2 uv = outTexCoord + vec2(shift.x,-shift.y)/uResolution*world*uMotion;
    uv = clamp(uv,vec2(.001),vec2(.999));
    vec4 base = texture2D(uMainSampler,uv);
    vec2 stepUV = vec2(2.5)/uResolution;
    vec3 glow = (bright(uv+vec2(stepUV.x,0.0))+bright(uv-vec2(stepUV.x,0.0))+bright(uv+vec2(0.0,stepUV.y))+bright(uv-vec2(0.0,stepUV.y)))*.25;
    float light = illumination(pixel,uImpact0)+illumination(pixel,uImpact1)+illumination(pixel,uImpact2);
    gl_FragColor = vec4(base.rgb + world*(glow*.13+vec3(1.0,.58,.25)*light*.18*uMotion),base.a);
}`;

class BattlePostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    constructor(game) {
        super({game, fragShader:fragmentShader, renderTarget:true});
        this.effect = null;
    }

    onDraw(renderTarget) {
        const effect = this.effect;
        this.set2f('uResolution',this.renderer.width,this.renderer.height);
        this.set1f('uTime',effect?.time||0);
        this.set1f('uMotion',effect?.reducedMotion?0:1);
        for (let i=0;i<3;i++) {
            const impact=effect?.impacts[i];
            this.set4fv(`uImpact${i}`,impact?[impact.x,impact.y,impact.r,impact.age]:[0,0,1,10]);
        }
        const heat=effect?.heat;
        this.set4fv('uHeat',heat?[heat.x,heat.y,heat.r,heat.age]:[0,0,1,10]);
        this.bindAndDraw(renderTarget);
    }
}

export class BattleEffects {
    constructor(scene) {
        this.scene=scene;this.time=0;this.impacts=[];this.heat=null;this.reducedMotion=reducedMotion();
        this.camera=scene.cameras.main;
        this.enabled=!!scene.renderer.gl;
        if(this.enabled) {
            scene.renderer.pipelines.addPostPipeline('battle-cinematic',BattlePostFX);
            this.camera.setPostPipeline('battle-cinematic');
            this.pipeline=this.camera.getPostPipeline('battle-cinematic');
            this.pipeline.effect=this;
        }
        this.onUpdate=(_,delta)=>{
            const dt=frameSeconds(delta);this.time+=dt;
            this.impacts=this.impacts.filter(impact=>(impact.age+=dt)<.7);
            if(this.heat&&(this.heat.age+=dt)>2)this.heat=null;
        };
        this.onDispose=()=>this.dispose();
        scene.events.on('update',this.onUpdate);scene.events.once('shutdown',this.onDispose);
    }

    impact(x,y,r,style) {
        if(!this.enabled||this.reducedMotion||['field','warp','foam'].includes(style))return;
        this.impacts.unshift({x,y,r,age:0});this.impacts.length=Math.min(3,this.impacts.length);
        if(['fire','volatile'].includes(style))this.heat={x,y,r,age:0};
    }

    dispose() {
        if(this.disposed)return;this.disposed=true;
        this.scene.events.off('update',this.onUpdate);this.scene.events.off('shutdown',this.onDispose);
        if(this.pipeline){this.pipeline.effect=null;this.camera.removePostPipeline('battle-cinematic');}
        if(this.scene.battleFX===this)this.scene.battleFX=null;
    }
}
