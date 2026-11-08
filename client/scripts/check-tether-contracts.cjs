/* Real built Paddle Ball/Bungee Bomb/Danger Rope behavior, renderer captures,
   nearby acquisition, distant misses, actor cleanup, and complete actual shots. */
const assert = require('node:assert/strict'),
    fs = require('node:fs'),
    http = require('node:http'),
    path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(process.env.CLIENT_BUILD_PATH || path.resolve(__dirname, '../build'));
const artifacts = process.env.TETHER_CONTRACT_ARTIFACTS || '/tmp/pocket-tether-contracts';
(async () => {
    fs.mkdirSync(artifacts, { recursive: true });
    const server = http.createServer((req, res) => {
        try {
            const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
                file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
            if (!file.startsWith(root + path.sep)) {
                res.writeHead(403).end();
                return;
            }
            const mime = {
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.html': 'text/html',
                '.png': 'image/png',
                '.json': 'application/json',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
            };
            res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
            res.end(fs.readFileSync(file));
        } catch {
            res.writeHead(404).end();
        }
    });
    let browser;
    const errors = [],
        contracts = [],
        shots = [];
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        browser = await chromium.launch({
            headless: true,
            ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}),
            args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
        });
        for (const renderer of ['canvas', 'webgl']) {
            const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
            page.on('pageerror', (error) => errors.push(error.message));
            await page.goto(
                `http://127.0.0.1:${server.address().port}/` +
                    (renderer === 'canvas' ? '?renderer=canvas' : ''),
            );
            await page.waitForFunction(
                () => window.game?.scene.getScene('loading-scene')?.load.isLoading() === false,
                null,
                { timeout: 30000 },
            );
            await page.evaluate(() => {
                window.game.sound.mute = true;
                const weapons = [{ id: 648, name: 'Paddle Ball', type: 0 }];
                window.game.scene.start('main-scene', {
                    gameType: 4,
                    player1: { name: 'TETHER A', color: 0x6eaa99, weapons },
                    player2: { name: 'TETHER B', color: 0xc59a76, weapons: weapons.map((w) => ({ ...w })) },
                });
            });
            await page.waitForFunction(() => window.game.scene.getScene('main-scene')?.arsenal);
            assert.equal(await page.evaluate(() => !!window.game.renderer.gl), renderer === 'webgl');
            await page.evaluate(() => {
                window.tetherFixture = (id) => {
                    const s = window.game.scene.getScene('main-scene');
                    s.physics.world.pause();
                    s.time.paused = true;
                    s.tweens.killAll();
                    s.weaponFX.reset();
                    Object.assign(s.terrain.context, {
                        globalCompositeOperation: 'source-over',
                        globalAlpha: 1,
                    });
                    s.terrain.setPath([
                        { x: -200, y: 350 },
                        { x: 1400, y: 350 },
                    ]);
                    s.terrain.matrix = [];
                    s.terrain.blastArray = [];
                    s.terrain.animate = false;
                    s.tacticalWorld?.zones.forEach((z) => z.visual?.destroy());
                    s.tacticalWorld = { shot: 0, zones: [], devices: [], nextZone: 1, nextDevice: 1 };
                    const entry = s.arsenal.catalog.find((w) => w.id === id);
                    for (const [index, t] of [s.tank1, s.tank2].entries()) {
                        t.setPosition(index ? 720 : 300, 349);
                        t.rotation = 0;
                        t.body.updateFromGameObject();
                        t.body.stop();
                        t.body.setGravity(0);
                        t.centre = { x: t.body.x, y: t.body.y - 6 };
                        t.top = { x: t.body.x, y: t.body.y - 12 };
                        t.active = index === 0;
                        t.settled = true;
                        t.power = 45;
                        t.score = 0;
                        t.tactics = { shield: 0, frost: 0, frostMoves: 0, acid: 0, marked: 0 };
                        t.weapons = [{ id: entry.id, name: entry.name, type: entry.type }];
                        t.selectedWeapon = 0;
                        t.turret.activeWeapon = null;
                        t.turret.setPosition(t.body.x, t.body.y - 12);
                        t.turret.setRelativeRotation(Math.PI / 4);
                    }
                    s.activeTank = 1;
                    s.gameOver = false;
                    s.HUD.reset();
                    const runtime = entry.createInstance();
                    runtime.create({
                        id,
                        scene: s,
                        tank: s.tank1,
                        turret: s.tank1.turret,
                        terrain: s.terrain,
                    });
                    return runtime;
                };
            });
            for (const id of [648, 753, 765]) {
                await page.evaluate(async (id) => {
                    const s = window.game.scene.getScene('main-scene');
                    await s.weaponFX.prepareWeapon(id);
                }, id);
                const begin = await page.evaluate((id) => {
                    const r = window.tetherFixture(id),
                        s = window.game.scene.getScene('main-scene');
                    r.shoot();
                    const p = r.projectiles.find((p) => !p.child && !p.removed);
                    if (!p) return { error: 'primary projectile missing' };
                    Object.assign(p, { x: 700, y: 349, vx: 230, vy: 120 });
                    r.impact(p);
                    if (!r.tetherState?.tank) {
                        r.dispose();
                        return { error: 'near hit did not attach actual tank' };
                    }
                    const state = r.tetherState,
                        initial = { x: s.tank2.x, y: s.tank2.y };
                    window.tetherUnderTest = { runtime: r, initial, positions: [] };
                    for (let tick = 0; tick < 30 && !r.done; tick++) {
                        r.update();
                        tetherUnderTest.positions.push({
                            x: s.tank2.x,
                            y: s.tank2.y,
                            ballX: r.tetherState?.x,
                            ballY: r.tetherState?.y,
                        });
                    }
                    return {
                        attached: true,
                        ropeVisible: state.rope.visible,
                        redBall: s.children.list.some(
                            (o) => o.type === 'Arc' && o.fillColor === 0xd82c3e && o.visible,
                        ),
                    };
                }, id);
                assert.equal(begin.error, undefined, `${renderer} ${id}: ${begin.error}`);
                assert.ok(begin.ropeVisible);
                if (id === 648) assert.ok(begin.redBall, 'Paddle Ball must have a visible red weighted ball');
                await page.evaluate(
                    () =>
                        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
                );
                await page.screenshot({ path: path.join(artifacts, `${renderer}-${id}.png`) });
                const result = await page.evaluate(
                    ({ id, renderer }) => {
                        const { runtime: r, initial, positions } = window.tetherUnderTest,
                            s = window.game.scene.getScene('main-scene');
                        for (let tick = 0; tick < 965 && !r.done; tick++) {
                            r.update();
                            positions.push({
                                x: s.tank2.x,
                                y: s.tank2.y,
                                ballX: r.tetherState?.x,
                                ballY: r.tetherState?.y,
                            });
                        }
                        const final = { x: s.tank2.x, y: s.tank2.y },
                            summary = {
                                id,
                                renderer,
                                name: r.definition.name,
                                initial,
                                final,
                                done: r.done,
                                events: r.events.length,
                                projectiles: r.projectiles.length,
                                actorCleared: !r.tetherState,
                                outcome: r.lastTetherResult,
                                xRange:
                                    Math.max(...positions.map((p) => p.x)) -
                                    Math.min(...positions.map((p) => p.x)),
                                minY: Math.min(...positions.map((p) => p.y)),
                                ballRange:
                                    Math.max(
                                        ...positions
                                            .filter((p) => Number.isFinite(p.ballX))
                                            .map((p) => p.ballX),
                                    ) -
                                    Math.min(
                                        ...positions
                                            .filter((p) => Number.isFinite(p.ballX))
                                            .map((p) => p.ballX),
                                    ),
                                score: s.tank1.score,
                            };
                        r.dispose();
                        const miss = window.tetherFixture(id);
                        miss.shoot();
                        const p = miss.projectiles[0];
                        Object.assign(p, { x: 100, y: 349, vx: 150, vy: 120 });
                        miss.impact(p);
                        for (let tick = 0; tick < 965 && !miss.done; tick++) miss.update();
                        summary.miss = {
                            attached: !!miss.lastTetherResult?.attached,
                            targetX: s.tank2.x,
                            score: s.tank1.score,
                        };
                        miss.dispose();
                        return summary;
                    },
                    { id, renderer },
                );
                contracts.push(result);
                assert.ok(
                    result.done && result.actorCleared && result.events === 0 && result.projectiles === 0,
                );
                assert.ok(
                    result.outcome?.attached && result.outcome.collisions > 0 && result.score > 0,
                    'attached tether must cause actual contact damage',
                );
                if (id === 648) assert.ok(result.ballRange > 30);
                if (id === 753)
                    assert.ok(result.xRange > 100 && result.minY < 279 && result.outcome.collisions >= 2);
                if (id === 765)
                    assert.ok(Math.abs(result.final.x - 300) < Math.abs(result.initial.x - 300) - 150);
                assert.deepEqual(
                    result.miss,
                    { attached: false, targetX: 720, score: 0 },
                    'a distant miss remotely affected the target',
                );
                console.log(JSON.stringify(result));
            }
            if (renderer === 'canvas')
                for (const id of [648, 753, 765]) {
                    const shot = await page.evaluate((id) => {
                        const s = window.game.scene.getScene('main-scene');
                        window.game.loop.sleep();
                        const unused = window.tetherFixture(id);
                        unused.dispose();
                        s.physics.world.resume();
                        s.time.paused = false;
                        s.tweens.getDelta = () => 1000 / 60;
                        let time = s.time.now;
                        for (let settle = 0; settle < 8; settle++) s.sys.step((time += 1000 / 60), 1000 / 60);
                        s.activeTank = 1;
                        s.tank1.active = true;
                        s.tank2.active = false;
                        s.HUD.reset();
                        if (!s.tank1.shoot()) throw Error('Tank.shoot rejected tether');
                        const weapon = s.tank1.turret.activeWeapon;
                        let launched = 0;
                        const shoot = weapon.shoot;
                        weapon.shoot = () => {
                            launched++;
                            return shoot();
                        };
                        let steps = 0;
                        for (; steps < 1800; steps++) {
                            s.sys.step((time += 1000 / 60), 1000 / 60);
                            if (
                                s.activeTank === 2 &&
                                !s.tank1.turret.activeWeapon &&
                                !s.terrain.animate &&
                                !s.terrain.blastArray.length &&
                                s.tank1.settled &&
                                s.tank2.settled
                            )
                                break;
                        }
                        return {
                            id,
                            name: weapon.weaponHandler.definition.name,
                            launched,
                            steps,
                            handedOff: s.activeTank === 2,
                            activeWeapon: !!s.tank1.turret.activeWeapon,
                            terrain: s.terrain.animate,
                            blasts: s.terrain.blastArray.length,
                            settled: [s.tank1.settled, s.tank2.settled],
                            actorCleared: !weapon.weaponHandler.tetherState,
                            outcome: weapon.weaponHandler.lastTetherResult,
                            score: s.tank1.score,
                        };
                    }, id);
                    shots.push(shot);
                    assert.ok(
                        shot.handedOff &&
                            shot.launched === 1 &&
                            !shot.activeWeapon &&
                            !shot.terrain &&
                            !shot.blasts &&
                            shot.settled.every(Boolean) &&
                            shot.actorCleared,
                        'real tether shot did not finish cleanly',
                    );
                    assert.ok(
                        shot.outcome?.attached && shot.score > 0,
                        'real aimed tether shot did not attach and score',
                    );
                    console.log('SHOT ' + JSON.stringify(shot));
                }
            await page.close();
        }
        const report = { passed: true, contracts, shots, errors };
        fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
        assert.equal(contracts.length, 6);
        assert.equal(shots.length, 3);
        assert.deepEqual(errors, []);
        console.log(
            JSON.stringify({
                passed: true,
                rendererContracts: contracts.length,
                realShots: shots.length,
                artifacts,
            }),
        );
    } catch(error) {
        fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify({passed:false,contracts,shots,errors,error:error.stack},null,2));
        throw error;
    } finally {
        await browser?.close();
        server.closeAllConnections();
        if (server.listening) await new Promise((resolve) => server.close(resolve));
    }
})().catch((error) => {
    console.error(error.stack);
    process.exitCode = 1;
});
