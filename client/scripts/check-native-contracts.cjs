/* All30 originals: real Weapon construction, natural500ms SceneClock launch,
   Arcade collisions, terrain blast/collapse, native timers and Phaser/custom
   tweens. Cosmetic compositor art is suppressed; visual persistence is reported
   separately from gameplay completion and lingering physics projectiles. */
const assert = require('node:assert/strict'),
    fs = require('node:fs'),
    http = require('node:http'),
    path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(process.env.CLIENT_BUILD_PATH || path.resolve(__dirname, '../build'));
const prefix = process.env.ARTIFACT_PREFIX || '/tmp/pocket-native-contracts';
(async () => {
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
                '.html': 'text/html',
                '.css': 'text/css',
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
        results = [];
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        browser = await chromium.launch({
            headless: true,
            ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}),
            args: ['--no-sandbox'],
        });
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/?renderer=canvas`);
        await page.waitForFunction(
            () => window.game?.scene.getScene('loading-scene')?.load.isLoading() === false,
            null,
            { timeout: 30000 },
        );
        for (let id = 0; id < 30; id++) {
            const result = await page.evaluate((id) => {
                const game = window.game;
                game.sound.mute = true;
                game.loop.sleep();
                // The same scene object may restart, so mark a prior fake compositor dead.
                const previous = game.scene.getScene('main-scene');
                previous.weaponFX?.dispose?.();
                const weapons = [{ id, name: `Native${id}`, type: 0 }];
                game.scene.start('main-scene', {
                    gameType: 4,
                    player1: { name: 'NATIVE A', color: 0x6eaa99, weapons },
                    player2: { name: 'NATIVE B', color: 0xc59a76, weapons: weapons.map((w) => ({ ...w })) },
                });
                const s = game.scene.getScene('main-scene');
                s.weaponFX?.dispose?.();
                const shape = (x, y) => ({
                    x,
                    y,
                    setPosition(x, y) {
                        this.x = x;
                        this.y = y;
                        return this;
                    },
                    setVisible() {
                        return this;
                    },
                    destroy() {},
                });
                s.weaponFX = {
                    disposed: false,
                    ready: Promise.resolve(),
                    prepareWeapon() {
                        return Promise.resolve();
                    },
                    projectile: shape,
                    impact() {
                        return true;
                    },
                    muzzle() {},
                    beam() {
                        return true;
                    },
                    zone() {
                        return false;
                    },
                    build() {
                        return true;
                    },
                    particle() {},
                    stats() {
                        return { particleRenderer: 'canvas' };
                    },
                    dispose() {
                        this.disposed = true;
                    },
                };
                s.physics.world.resume();
                s.time.paused = false;
                s.tweens.paused = false;
                s.tweens.getDelta = () => 1000 / 60;
                Object.assign(s.terrain.context, { globalCompositeOperation: 'source-over', globalAlpha: 1 });
                s.terrain.setPath([
                    { x: -200, y: 350 },
                    { x: 1400, y: 350 },
                ]);
                s.terrain.matrix = [];
                s.terrain.blastArray = [];
                s.terrain.animate = false;
                for (const [index, tank] of [s.tank1, s.tank2].entries()) {
                    tank.setPosition(index ? 720 : 300, 349);
                    tank.rotation = 0;
                    tank.body.updateFromGameObject();
                    tank.body.stop();
                    tank.body.setGravity(0);
                    tank.active = index === 0;
                    tank.settled = true;
                    tank.power = 45;
                    tank.movesRemaining = 4;
                    tank.selectedWeapon = 0;
                    tank.turret.setRelativeRotation(Math.PI / 4);
                    tank.score = 0;
                }
                s.activeTank = 1;
                s.gameOver = false;
                let virtualTime = s.time.now,
                    steps = 0,
                    launched = 0,
                    completedAt = null,
                    terrainCompleteAt = null,
                    physicsCompleteAt = null,
                    handedOffAt = null;
                const tick = () => {
                    s.sys.step((virtualTime += 1000 / 60), 1000 / 60);
                    steps++;
                };
                for (let settle = 0; settle < 8; settle++) tick();
                s.tank1.active = true;
                s.tank2.active = false;
                s.activeTank = 1;
                s.HUD.reset();
                const baselineChildren = s.children.list.length;
                const excluded = new Set([
                    s.tank1,
                    s.tank2,
                    s.tank1.turret,
                    s.tank2.turret,
                    s.leftWall,
                    s.rightWall,
                ]);
                const physicsObjects = () =>
                    s.physics.world.bodies.entries.filter(
                        (body) => body.enable && body.gameObject?.active && !excluded.has(body.gameObject),
                    );
                const realTimeout = window.setTimeout,
                    realInterval = window.setInterval,
                    createdTimeouts = [],
                    createdIntervals = [];
                window.setTimeout = (callback, delay, ...args) => {
                    const timer = realTimeout(callback, delay, ...args);
                    createdTimeouts.push(timer);
                    return timer;
                };
                window.setInterval = (callback, delay, ...args) => {
                    const timer = realInterval(callback, delay, ...args);
                    createdIntervals.push(timer);
                    return timer;
                };
                let spawnedPhysicsActors = 0,
                    maxMovingProjectiles = 0,
                    maxLiveProjectiles = 0;
                const spriteFactory = s.physics.add.sprite;
                s.physics.add.sprite = (...args) => {
                    spawnedPhysicsActors++;
                    return spriteFactory.apply(s.physics.add, args);
                };
                let weapon, error;
                try {
                    if (!s.tank1.shoot()) throw Error('actual Tank.shoot rejected the shot');
                    weapon = s.tank1.turret.activeWeapon;
                    const shoot = weapon.shoot;
                    weapon.shoot = () => {
                        launched++;
                        return shoot();
                    };
                    for (let frame = 0; frame < 2400; frame++) {
                        tick();
                        const actors = physicsObjects();
                        maxLiveProjectiles = Math.max(maxLiveProjectiles, actors.length);
                        maxMovingProjectiles = Math.max(
                            maxMovingProjectiles,
                            actors.filter((body) => Math.hypot(body.velocity.x, body.velocity.y) > 0).length,
                        );
                        if (launched && completedAt === null && !s.tank1.turret.activeWeapon)
                            completedAt = steps;
                        if (
                            completedAt !== null &&
                            terrainCompleteAt === null &&
                            !s.terrain.animate &&
                            !s.terrain.blastArray.length
                        )
                            terrainCompleteAt = steps;
                        if (completedAt !== null && physicsCompleteAt === null && !physicsObjects().length)
                            physicsCompleteAt = steps;
                        if (handedOffAt === null && s.activeTank === 2) handedOffAt = steps;
                        if (
                            handedOffAt !== null &&
                            physicsCompleteAt !== null &&
                            terrainCompleteAt !== null &&
                            steps - Math.max(handedOffAt, physicsCompleteAt, terrainCompleteAt) >= 90
                        )
                            break;
                    }
                } catch (caught) {
                    error = caught.stack;
                } finally {
                    s.physics.add.sprite = spriteFactory;
                    window.setTimeout = realTimeout;
                    window.setInterval = realInterval;
                    createdTimeouts.forEach((timer) => clearTimeout(timer));
                    createdIntervals.forEach((timer) => clearInterval(timer));
                }
                const h = weapon?.weaponHandler;
                const result = {
                    id,
                    name: s.arsenal.catalog[id].name,
                    launched,
                    spawnedPhysicsActors,
                    maxMovingProjectiles,
                    maxLiveProjectiles,
                    steps,
                    virtualSeconds: steps / 60,
                    completedAt,
                    terrainCompleteAt,
                    physicsCompleteAt,
                    handedOffAt,
                    weaponActive: !!s.tank1.turret.activeWeapon,
                    terrain: {
                        animate: s.terrain.animate,
                        blasts: s.terrain.blastArray.length,
                        columns: s.terrain.matrix.length,
                    },
                    settled: [s.tank1.settled, s.tank2.settled],
                    physics: physicsObjects().map((body) => ({
                        texture: body.gameObject.texture?.key,
                        x: body.x,
                        y: body.y,
                        vx: body.velocity.x,
                        vy: body.velocity.y,
                    })),
                    visualPersistence: {
                        extraChildren: s.children.list.length - baselineChildren,
                        tweens: s.tweens.getTweens().length,
                    },
                    globalTimers: { timeouts: createdTimeouts.length, intervals: createdIntervals.length },
                    score: s.tank1.score,
                    secondary: {
                        particles: h?.particles?.length,
                        balls: h?.ballsArray?.length,
                        rounds: h?.particles?.length,
                        allShot: h?.allShot,
                    },
                    error,
                };
                s.weaponFX.disposed = true;
                return result;
            }, id);
            results.push(result);
            console.log(JSON.stringify(result));
        }
        const failures = results.filter(
            (r) =>
                r.error ||
                r.launched !== 1 ||
                (![8, 27].includes(r.id) && r.maxMovingProjectiles === 0) ||
                ([2, 3, 6, 26].includes(r.id) &&
                    r.spawnedPhysicsActors !== { 2: 3, 3: 5, 6: 5, 26: 12 }[r.id]) ||
                r.weaponActive ||
                r.terrain.animate ||
                r.terrain.blasts ||
                r.physics.length ||
                !r.settled.every(Boolean) ||
                r.handedOffAt === null ||
                r.globalTimers.timeouts ||
                r.globalTimers.intervals ||
                !Number.isFinite(r.score),
        );
        const report = {
            passed: failures.length === 0 && errors.length === 0,
            results,
            failures,
            errors,
            compositor: 'suppressed for deterministic gameplay isolation',
            stepHz: 60,
            maxVirtualSeconds: 40,
            afterCompletionObservationFrames: 90,
        };
        fs.mkdirSync(path.dirname(prefix), { recursive: true });
        fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2));
        assert.equal(results.length, 30);
        assert.deepEqual(failures, [], 'native gameplay contract failed');
        assert.deepEqual(errors, []);
        console.log(
            JSON.stringify({
                passed: true,
                weapons: results.length,
                globalTimers: 0,
                artifact: prefix + '.json',
            }),
        );
    } finally {
        await browser?.close();
        server.closeAllConnections();
        if (server.listening) await new Promise((resolve) => server.close(resolve));
    }
})().catch((error) => {
    console.error(error.stack);
    process.exitCode = 1;
});
