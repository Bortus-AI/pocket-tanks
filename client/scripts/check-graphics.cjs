/* Build first. Exercises actual WebGL + Canvas frames, collision presentation
   isolation, upload batching, particle budgets, real shots, mobile reduced motion,
   context restoration and scene disposal. Artifacts default to /tmp/pocket-graphics.
   CLIENT_BUILD_PATH=/path/to/build PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node scripts/check-graphics.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.CLIENT_BUILD_PATH||path.resolve(__dirname,'../build'));
const artifacts=process.env.GRAPHICS_ARTIFACTS||'/tmp/pocket-graphics';
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav'};
const launchOptions={headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']};

(async()=>{
    fs.mkdirSync(artifacts,{recursive:true});
    const server=http.createServer((req,res)=>{
        const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
        if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
        try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
    });
    let browser,fallbackBrowser;
    const errors=[],shaderErrors=[],report={renderers:[],mobile:null,fallback:null};
    const watch=page=>{
        page.on('pageerror',error=>errors.push(error.stack||error.message));
        page.on('console',message=>{if(message.type()==='error'&&/shader|GL_INVALID|WebGL:|GLSL/i.test(message.text()))shaderErrors.push(message.text());});
    };
    const ready=async(page,url)=>{
        watch(page);await page.goto(url);
        await page.waitForFunction(()=>window.game?.scene.getScene('loading-scene')?.load?.isLoading()===false,null,{timeout:30000});
    };
    const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const fixture=async page=>{
        await page.evaluate(()=>{
            window.game.sound.mute=true;
            const weapons=[{id:0,name:'Single Shot',type:0},{id:30,name:'Impact Howitzer',type:0}];
            window.game.scene.start('main-scene',{gameType:4,terrainKind:'plateaus',player1:{name:'VANGUARD',color:0x6eaa99,weapons:weapons.map(w=>({...w}))},player2:{name:'SENTINEL',color:0xc59a76,weapons:weapons.map(w=>({...w}))}});
        });
        await page.waitForFunction(()=>window.game.scene.getScene('main-scene')?.scene.isActive());
        await page.evaluate(()=>window.game.scene.getScene('main-scene').weaponFX.ready);
        await page.evaluate(()=>{
            const s=window.game.scene.getScene('main-scene');s.physics.world.pause();s.terrain.setPath([{x:-200,y:365},{x:1400,y:365}]);s.terrain.matrix=[];
            [s.tank1,s.tank2].forEach((t,i)=>{t.setPosition(i?900:280,364);t.body.updateFromGameObject();t.body.stop();t.body.setGravity(0);t.setRotation(0);t.settled=true;t.active=i===0;t.centre={x:t.x,y:t.y-6};t.top={x:t.x,y:t.y-12};t.setPower(16);t.turret.setRelativeRotation(Math.PI/4);t.turret.update();});
            s.tank1.selectedWeapon=s.tank1.weapons.findIndex(w=>w.id===0);
            s.activeTank=1;s.HUD.reset();
        });
        await frames(page);
    };
    const pixel=(page,x,y)=>page.evaluate(({x,y})=>new Promise(resolve=>window.game.renderer.snapshotPixel(x,y,c=>resolve([c.red,c.green,c.blue,c.alpha]))),{x,y});
    const titlePixels=page=>page.evaluate(()=>new Promise(resolve=>window.game.renderer.snapshotArea(24,18,145,30,image=>{
        const canvas=document.createElement('canvas');canvas.width=145;canvas.height=30;const c=canvas.getContext('2d');c.drawImage(image,0,0);
        const pixels=c.getImageData(0,0,145,30).data;let count=0;
        for(let i=0;i<pixels.length;i+=4)if(pixels[i]>65&&pixels[i+1]>130&&pixels[i+1]>pixels[i]*1.3&&pixels[i+2]<pixels[i+1])count++;
        resolve(count);
    })));
    try{
        await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
        const url=`http://127.0.0.1:${server.address().port}`;
        browser=await chromium.launch(launchOptions);
        for(const renderer of ['webgl','canvas']){
            const page=await browser.newPage({viewport:{width:1200,height:800}});
            await ready(page,url+(renderer==='canvas'?'?renderer=canvas':''));
            await fixture(page);
            const state=await page.evaluate(()=>{
                const s=window.game.scene.getScene('main-scene'),t=s.tank1;
                return {webgl:!!s.renderer.gl,particleRenderer:s.weaponFX.stats().particleRenderer,materialArt:s.weaponFX.stats().materialArt,postFX:s.battleFX.enabled,
                    dimensions:[t.width,t.height,t.turret.width,t.turret.height],visualWidth:t.presentation.hull.displayWidth,textureWidth:t.presentation.hull.frame.width,
                    sameTerrainTexture:s.textures.get('terrain')===s.terrain,pipelineCount:s.cameras.main.postPipelines.length};
            });
            assert.equal(state.webgl,renderer==='webgl');assert.equal(state.particleRenderer,renderer);assert.equal(state.postFX,renderer==='webgl');
            assert.ok(state.materialArt,'production material textures were not loaded');
            assert.equal(state.pipelineCount,renderer==='webgl'?1:0,'expected the actual battlefield shader pipeline');
            assert.deepEqual(state.dimensions,[36,24,6,32]);assert.equal(state.visualWidth,36);assert.equal(state.textureWidth,144);assert.ok(state.sameTerrainTexture);
            assert.ok(await titlePixels(page)>100,'player-name glyphs are clipped or displaced');
            assert.equal(await page.evaluate(()=>{const s=window.game.scene.getScene('main-scene');return s.textures.get('hud')===s.HUD;}),true);
            const consolePixel=await pixel(page,600,550);
            assert.ok(consolePixel[0]>=20&&consolePixel[0]<=30&&consolePixel[1]>=45&&consolePixel[1]<=60&&consolePixel[2]>=55&&consolePixel[2]<=68,'HUD console background missing from framebuffer');
            const meterBefore=await pixel(page,900,700);
            await page.evaluate(()=>{const s=window.game.scene.getScene('main-scene');s.tank1.setPower(85);s.HUD.refresh();});await frames(page);
            const meterAfter=await pixel(page,900,700);
            assert.ok(meterAfter.slice(0,3).reduce((sum,v,i)=>sum+Math.abs(v-meterBefore[i]),0)>40,'power meter did not refresh on screen');
            const original=await pixel(page,600,400);
            const uploadBefore=await page.evaluate(()=>{
                const t=window.game.scene.getScene('main-scene').terrain,before=t.uploadCount;
                t.context.clearRect(570,370,60,60);t.update();t.update();t.update();return before;
            });
            await frames(page);
            const carved=await pixel(page,600,400),uploads=await page.evaluate(()=>window.game.scene.getScene('main-scene').terrain.uploadCount);
            assert.ok(original.slice(0,3).reduce((sum,v,i)=>sum+Math.abs(v-carved[i]),0)>25,'visible framebuffer did not show terrain edit');
            assert.equal(uploads-uploadBefore,renderer==='webgl'?1:0,'terrain edits must coalesce to one GPU upload per frame');
            const isolation=await page.evaluate(()=>{
                const s=window.game.scene.getScene('main-scene'),t=s.tank1,v=t.presentation;
                const logical=()=>JSON.stringify({position:[t.x,t.y,t.body.x,t.body.y],rotation:t.rotation,aim:t.turret.rotation,relative:t.turret.relativeRotation,dimensions:[t.width,t.height,t.turret.width,t.turret.height],power:t.power,score:t.score,moves:t.movesRemaining,weapons:t.weapons,mask:s.terrain.exportMask()});
                s.scene.pause();const before=logical();v.fire();v.impact(1,-1);v.update(16.67);
                const recoil=v.recoil,bounce=v.bounce;
                for(let i=0;i<120;i++)v.update(1000/120);
                const after=logical(),settled={recoil:v.recoil,bounce:v.bounce,rock:v.rock};
                const initial=v.tracks.frame.name;t.moving=true;t.x+=2;v.update(16.67);const moved=v.tracks.frame.name;t.x-=2;t.moving=false;v.update(16.67);
                s.scene.resume();return {unchanged:before===after,recoil,bounce,settled,trackMoved:initial!==moved};
            });
            assert.ok(isolation.unchanged,'presentation changed combat/collision state');assert.ok(isolation.recoil>1&&isolation.bounce>0);assert.ok(isolation.trackMoved);
            assert.ok(Math.abs(isolation.settled.bounce)<.01&&isolation.settled.recoil<.01);
            // Opaque terrain must hide the replacement hull, tracks and barrel.
            await page.evaluate(()=>{
                const s=window.game.scene.getScene('main-scene'),t=s.tank1,c=s.terrain.context;
                s.weaponFX.reset(); // Remove dust emitted by the preceding motion test.
                c.save();c.globalCompositeOperation='source-over';c.globalAlpha=1;c.fillStyle='#050508';
                c.fillRect(t.x-40,t.y-60,80,80);c.restore();s.terrain.update();
            });
            await frames(page);
            const exposedPixels=await page.evaluate(()=>new Promise(resolve=>{
                const t=window.game.scene.getScene('main-scene').tank1;
                window.game.renderer.snapshotArea(t.x-25,t.y-32,50,38,image=>{
                    const canvas=document.createElement('canvas');canvas.width=50;canvas.height=38;
                    const c=canvas.getContext('2d');c.drawImage(image,0,0);
                    const data=c.getImageData(0,0,50,38).data;let exposed=0;
                    for(let i=0;i<data.length;i+=4)if(data[i]>12||data[i+1]>12||data[i+2]>12)exposed++;
                    resolve(exposed);
                });
            }));
            if(exposedPixels)await page.screenshot({path:path.join(artifacts,`${renderer}-occlusion-failure.png`)});
            assert.equal(exposedPixels,0,'buried tank art is visible through opaque terrain');
            await fixture(page);
            const cloudsBefore=await page.evaluate(()=>window.game.scene.getScene('main-scene').atmosphere.clouds[0].image.x);
            await page.waitForTimeout(200);
            assert.ok(await page.evaluate(x=>window.game.scene.getScene('main-scene').atmosphere.clouds[0].image.x>x,cloudsBefore));
            await page.screenshot({path:path.join(artifacts,`${renderer}-battlefield.png`)});
            // A pure smoke tail must render without uploading the large compositor.
            const tailBefore=await page.evaluate(()=>{
                const fx=window.game.scene.getScene('main-scene').weaponFX;fx.reset();fx.particle('smoke',500,270,{life:.7,size:35,growth:20,alpha:.8});return fx.stats().canvasUploads;
            });
            await page.waitForTimeout(180);
            const tailAfter=await page.evaluate(()=>window.game.scene.getScene('main-scene').weaponFX.stats());
            if(renderer==='webgl')assert.equal(tailAfter.canvasUploads,tailBefore,'GPU-only particles uploaded a fullscreen canvas');
            else assert.ok(tailAfter.canvasUploads>tailBefore);
            await page.evaluate(()=>{
                const s=window.game.scene.getScene('main-scene');s.weaponFX.reset();s.weaponFX.impact(610,360,85,{payload:'fire',behavior:'shell',weaponId:15,weaponName:'Napalm'});
            });
            for(const ms of [100,260,600]){
                await page.waitForTimeout(ms===100?100:ms===260?160:340);
                await page.screenshot({path:path.join(artifacts,`${renderer}-impact-${ms}.png`)});
            }
            // The pool must stay bounded and hide its last active sprites on expiry.
            const stress=await page.evaluate(()=>{
                const fx=window.game.scene.getScene('main-scene').weaponFX;fx.reset();
                for(let i=0;i<2000;i++)fx.particle(i%2?'spark':'smoke',200+i%800,220+i%200,{life:.2,size:4});
                fx.update(16.67);return fx.stats();
            });
            assert.ok(stress.particleCount<=stress.particleLimit&&stress.spritePool<=stress.particleLimit);
            console.log(`CHECK ${renderer}: particle stress ${stress.particleCount}/${stress.particleLimit}`);
            await page.waitForFunction(()=>{const fx=window.game.scene.getScene('main-scene').weaponFX;return fx.particles.length===0;},null,{timeout:15000});
            assert.deepEqual(await page.evaluate(()=>{const fx=window.game.scene.getScene('main-scene').weaponFX;return [fx.particles.length,fx.gpuParticles?.activeCount||0];}),[0,0]);
            // Fire a real original shot through the physics/terrain/turn lifecycle.
            await fixture(page);
            console.log(`CHECK ${renderer}: real shot`);
            assert.equal(await page.evaluate(()=>{const s=window.game.scene.getScene('main-scene');s.physics.world.resume();return s.tank1.shoot();}),true);
            await page.waitForFunction(()=>{const s=window.game.scene.getScene('main-scene');return !s.tank1.turret.activeWeapon&&!s.terrain.animate&&s.tank1.settled&&s.tank2.settled;},null,{timeout:30000});
            const shot=await page.evaluate(()=>{const s=window.game.scene.getScene('main-scene');return {scores:[s.tank1.score,s.tank2.score],settled:[s.tank1.settled,s.tank2.settled],maskHasCrater:s.terrain.getPixel(400,365).alpha===0,texture:s.textures.get('terrain')===s.terrain};});
            assert.ok(shot.texture&&shot.settled.every(Boolean));
            const legacyShots=[];
            if(renderer==='webgl')for(const id of [15,21]){
                await fixture(page);console.log(`CHECK webgl: migrated original ${id}`);
                assert.equal(await page.evaluate(id=>{const s=window.game.scene.getScene('main-scene');s.tank1.weapons=[{id,name:'Legacy emitter check',type:0}];s.tank1.selectedWeapon=0;s.physics.world.resume();return s.tank1.shoot();},id),true);
                await page.waitForFunction(()=>{const s=window.game.scene.getScene('main-scene');return !s.tank1.turret.activeWeapon&&!s.terrain.animate&&!s.terrain.blastArray.length&&s.tank1.settled&&s.tank2.settled;},null,{timeout:45000});
                legacyShots.push(id);
            }
            const restarts=[];
            for(let i=0;i<3;i++){
                await fixture(page);
                restarts.push(await page.evaluate(()=>{const s=window.game.scene.getScene('main-scene');return {textures:Object.keys(s.textures.list).length,children:s.children.length,updates:s.events.listenerCount('postupdate'),pipelines:s.cameras.main.postPipelines.length,worldListeners:s.physics.world.listenerCount('worldstep')};}));
            }
            assert.deepEqual(restarts[2],restarts[0],'restarting leaked textures, objects, pipelines or listeners');
            assert.ok(await titlePixels(page)>100,'pooled Text canvases lost their glyph layout after scene restarts');
            let contextRestored=null;
            if(renderer==='webgl'){
                const supported=await page.evaluate(()=>{
                    const renderer=window.game.renderer,extension=renderer.gl.getExtension('WEBGL_lose_context');
                    if(!extension)return false;window.testContextLoss=extension;extension.loseContext();return true;
                });
                if(supported){
                    await page.waitForFunction(()=>window.game.renderer.contextLost);
                    await page.evaluate(()=>window.testContextLoss.restoreContext());
                    await page.waitForFunction(()=>!window.game.renderer.contextLost,null,{timeout:15000});await frames(page);
                    const restored=await pixel(page,600,400);assert.ok(restored.slice(0,3).some(v=>v>10));contextRestored=true;
                    await page.screenshot({path:path.join(artifacts,'webgl-restored.png')});
                }
            }
            report.renderers.push({renderer,state,original,carved,uploads:uploads-uploadBefore,isolation,buriedTankExposedPixels:exposedPixels,tailAfter,stress,shot,legacyShots,restarts,contextRestored});
            console.log(`CHECK ${renderer}: framebuffer, tank motion, particles, shot, cleanup${contextRestored?', context restored':''}`);
            await page.close();
        }
        const mobileContext=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce',userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'});
        const mobile=await mobileContext.newPage();await ready(mobile,url);await fixture(mobile);
        const mobileSky=await pixel(mobile,600,80);
        assert.ok(mobileSky.slice(0,3).reduce((sum,value)=>sum+value,0)>80,'mobile battlefield sky was not rendered');
        report.mobile=await mobile.evaluate(()=>{
            const s=window.game.scene.getScene('main-scene'),t=s.tank1,x=s.atmosphere.clouds[0].image.x;
            t.presentation.fire();s.atmosphere.update(1000);return {webgl:!!s.renderer.gl,reducedMotion:[t.presentation.reducedMotion,s.weaponFX.reducedMotion,s.atmosphere.reducedMotion,s.battleFX.reducedMotion],recoil:t.presentation.recoil,cloudUnchanged:x===s.atmosphere.clouds[0].image.x,aimControls:!!s.HUD.mobileAim,particleLimit:s.weaponFX.particleLimit};
        });
        assert.ok(report.mobile.webgl&&report.mobile.reducedMotion.every(Boolean)&&report.mobile.cloudUnchanged&&report.mobile.aimControls);assert.equal(report.mobile.recoil,0);
        assert.equal(report.mobile.particleLimit,200);
        report.mobile.skyPixel=mobileSky;
        const mobileFrame=await mobile.evaluate(()=>new Promise(resolve=>window.game.renderer.snapshot(image=>resolve(image.src))));
        fs.writeFileSync(path.join(artifacts,'mobile-renderer-frame.png'),Buffer.from(mobileFrame.split(',')[1],'base64'));
        await mobile.screenshot({path:path.join(artifacts,'mobile-reduced-motion.png')});await mobileContext.close();
        fallbackBrowser=await chromium.launch({...launchOptions,args:['--no-sandbox','--disable-webgl']});
        const fallback=await fallbackBrowser.newPage();await ready(fallback,url);await fixture(fallback);
        report.fallback=await fallback.evaluate(()=>({webgl:!!window.game.renderer.gl,particles:window.game.scene.getScene('main-scene').weaponFX.stats().particleRenderer}));
        assert.equal(report.fallback.webgl,false);assert.equal(report.fallback.particles,'canvas');
        assert.deepEqual(errors,[]);assert.deepEqual(shaderErrors,[]);
        report.errors=errors;report.shaderErrors=shaderErrors;
        fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify({passed:true,renderers:report.renderers.map(r=>r.renderer),mobile:report.mobile,fallback:report.fallback,errors,shaderErrors,artifacts}));
    }finally{await fallbackBrowser?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
