/* Build first, then run with Playwright installed locally or supplied using
   PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node scripts/check-arsenal.cjs.
   This exercises the actual built Phaser runtime, canvas terrain, and HTML arsenal. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(process.env.CLIENT_BUILD_PATH||path.resolve(__dirname, '../build'));
const artifacts = process.env.ARSENAL_ARTIFACTS || '/tmp';
const mime = {'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav'};

(async () => {
    const server = http.createServer((req,res) => {
        const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
        const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!file.startsWith(`${root}${path.sep}`)) { res.writeHead(403).end(); return; }
        try { res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');res.end(fs.readFileSync(file)); }
        catch { res.writeHead(404).end(); }
    });
    let browser;
    const errors = [];
    try {
        await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
        browser = await chromium.launch({headless:true,...(process.env.CHROME_BIN ? {executablePath:process.env.CHROME_BIN} : {}),args:['--no-sandbox']});
        const page = await browser.newPage({viewport:{width:1200,height:800}});
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(()=>window.game?.scene.getScene('loading-scene')?.load?.isLoading() === false, null, {timeout:30000});
        const startMatch = async id => {
            await page.evaluate(id=>{
                window.game.sound.mute=true;
                const loadout=[{id,name:'TEST WEAPON',type:0},{id:0,name:'Single Shot',type:0}];
                window.game.scene.start('main-scene',{gameType:4,player1:{name:'TEST A',color:0x6eaa99,weapons:loadout.map(w=>({...w}))},player2:{name:'TEST B',color:0xc59a76,weapons:loadout.map(w=>({...w}))}});
            },id);
            await page.waitForTimeout(150);
            await page.evaluate(id=>{const s=window.game.scene.getScene('main-scene');for(const tank of [s.tank1,s.tank2])tank.selectedWeapon=tank.weapons.findIndex(w=>w.id===id);s.HUD.reset();},id);
        };
        await startMatch(30);
        const catalog = await page.evaluate(()=>window.game.scene.getScene('main-scene').arsenal.catalog.map(w=>({id:w.id,name:w.name,behavior:w.behavior,hasRuntime:!!w.createInstance})));
        assert.ok(catalog.length >= 400, 'arsenal must contain at least 400 usable weapons');
        assert.equal(new Set(catalog.map(w=>w.id)).size,catalog.length,'duplicate weapon IDs');
        assert.equal(new Set(catalog.map(w=>w.name)).size,catalog.length,'duplicate weapon names');
        const runtimeIds=catalog.filter(w=>w.hasRuntime).map(w=>w.id), results=[];
        for(let start=0;start<runtimeIds.length;start+=10) {
            const batch=await page.evaluate(ids=>{
                const scene=window.game.scene.getScene('main-scene');scene.physics.world.pause();const out=[];
                for(const id of ids) {
                    const entry=scene.arsenal.catalog.find(w=>w.id===id);let runtime;
                    try {
                        // Keep the same world object so its physics listener remains attached.
                        if(scene.tacticalWorld){scene.tacticalWorld.zones.forEach(z=>z.visual?.destroy());Object.assign(scene.tacticalWorld,{shot:0,zones:[],nextZone:1});}
                        scene.tank1.tactics=null;scene.tank2.tactics=null;
                        scene.terrain.matrix=[];scene.terrain.blastArray=[];scene.terrain.setPath([{x:-200,y:350},{x:1400,y:350}]);
                        for(const [i,tank] of [scene.tank1,scene.tank2].entries()) {
                            tank.setPosition(i?720:300,349);tank.body.updateFromGameObject();tank.body.stop();tank.centre={x:tank.x,y:tank.y-6};
                            tank.power=35;tank.turret.setPosition(tank.x,tank.y-12);tank.turret.setRotation(Math.PI/3);tank.score=0;
                        }
                        runtime=entry.createInstance();const weapon={scene,tank:scene.tank1,turret:scene.tank1.turret,terrain:scene.terrain};
                        weapon.weaponHandler=runtime;runtime.create(weapon);runtime.shoot();
                        for(let tick=0;tick<965&&!runtime.done;tick++)runtime.update();
                        if(!runtime.done)throw Error('weapon did not finish');
                        if(runtime.events.length||runtime.projectiles.length)throw Error('weapon left active events/projectiles');
                        if(!Number.isFinite(scene.tank1.score)||!Number.isFinite(scene.tank2.score))throw Error('invalid score');
                        out.push({id,ok:true,ticks:runtime.tick});
                    } catch(error) {out.push({id,ok:false,error:error.message});try{runtime?.dispose()}catch{}}
                    scene.terrain.matrix=[];scene.tweens.killAll();scene.children.list.filter(x=>['Arc','Ellipse','Line'].includes(x.type)).forEach(x=>x.destroy());
                }
                return out;
            },runtimeIds.slice(start,start+10));
            results.push(...batch);
        }
        assert.deepEqual(results.filter(r=>!r.ok),[],'weapon simulations failed');
        const semantics=await page.evaluate(require('./arsenal-semantics.cjs'));
        assert.deepEqual(semantics.failures,[],'weapon family semantic checks failed');
        assert.equal(semantics.verified.length,37);
        // Real weapon construction, scene timers, physics updates, and turn switching.
        for(const behavior of ['shell','shield','drill']) {
            const entry=catalog.find(w=>w.hasRuntime&&w.behavior===behavior);
            assert.ok(entry,`missing ${behavior} family`);
            await startMatch(entry.id);
            await page.evaluate(()=>{
                const scene=window.game.scene.getScene('main-scene');
                scene.terrain.setPath([{x:-200,y:350},{x:1400,y:350}]);scene.terrain.matrix=[];
                [scene.tank1,scene.tank2].forEach((tank,i)=>{tank.setPosition(i?720:300,349);tank.body.updateFromGameObject();tank.body.stop();tank.body.setGravity(0);tank.settled=true;tank.active=i===0;});
                scene.activeTank=1;scene.tank1.turret.setPosition(300,337);scene.tank1.turret.setRelativeRotation(Math.PI/3);scene.tank1.setPower(18);scene.tank1.shoot();
            });
            await page.waitForFunction(()=>{const scene=window.game.scene.getScene('main-scene');return scene.activeTank===2&&!scene.tank1.turret.activeWeapon&&!scene.terrain.animate&&scene.tank1.settled&&scene.tank2.settled;}, null, {timeout:25000});
        }
        const ux=await require('./arsenal-ux.cjs')(page,catalog);
        // A real dialog interaction must pause, filter, equip an owned weapon, and resume.
        await page.evaluate(()=>window.game.scene.getScene('main-scene').arsenal.open());
        await page.locator('.arsenal input').fill('oil');
        const searchCount=await page.locator('.weapon-row').count();assert.ok(searchCount>0&&searchCount<catalog.length);
        await page.screenshot({path:path.join(artifacts,'pocket-arsenal.png')});
        await page.locator('.arsenal .close').click();
        await page.locator('.arsenal').waitFor({state:'detached'});
        await page.setViewportSize({width:390,height:844});
        await page.evaluate(()=>window.game.scene.getScene('main-scene').arsenal.open());
        const bounds=await page.locator('.arsenal').boundingBox();assert.ok(bounds.width<=390&&bounds.height<=844,'mobile arsenal exceeds viewport');
        await page.screenshot({path:path.join(artifacts,'pocket-arsenal-mobile.png')});
        await page.locator('.arsenal .close').click();
        await page.locator('.arsenal').waitFor({state:'detached'});
        await page.setViewportSize({width:1200,height:800});
        await page.evaluate(()=>{
            const scene=window.game.scene.getScene('main-scene');
            const entry=scene.arsenal.catalog.find(w=>w.id<400&&w.behavior==='shell'&&w.payload.key==='fire');
            const runtime=entry.createInstance(),weapon={scene,tank:scene.tank1,turret:scene.tank1.turret,terrain:scene.terrain};
            weapon.weaponHandler=runtime;runtime.create(weapon);runtime.burst(650,350,55,1);runtime.burst(720,350,36,.6);runtime.finish();
        });
        await page.waitForTimeout(100);
        await page.screenshot({path:path.join(artifacts,'pocket-weapons-effects.png')});
        assert.deepEqual(errors,[],'browser runtime errors');
        console.log(JSON.stringify({catalogCount:catalog.length,simulated:results.length,failed:0,semanticFamilies:semantics.verified.length,ux,maxTicks:Math.max(...results.map(r=>r.ticks)),lifecycle:['shell','shield','drill'],searchCount,browserErrors:errors}));
    } finally { await browser?.close();await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
