/* Exercise all370 generated weapon delivery contracts in the actual built game.
   Canvas collision geometry is real; visual effects and post-impact collapse are
   suppressed to isolate promised terrain, support, hazard and payload behavior.
   Build first. Optional environment: CLIENT_BUILD_PATH, PLAYWRIGHT_MODULE,
   CHROME_BIN, ARTIFACT_PREFIX (writes PREFIX.json).
*/
const fs = require('fs'),
    http = require('http'),
    path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(process.env.CLIENT_BUILD_PATH || path.resolve(__dirname, '../build'));
const artifactPrefix = process.env.ARTIFACT_PREFIX || '/tmp/pocket-generated-contracts';
const pageErrors = [];
(async () => {
    const server = http.createServer((req, res) => {
        try {
            const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
            const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
            if (!file.startsWith(root + path.sep)) {
                res.writeHead(403).end();
                return;
            }
            const mime = {
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.html': 'text/html',
                '.json': 'application/json',
                '.png': 'image/png',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.woff2': 'font/woff2',
            };
            res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
            res.end(fs.readFileSync(file));
        } catch {
            res.writeHead(404).end();
        }
    });
    let browser;
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
        const page = await browser.newPage();
        page.on('pageerror', (error) => pageErrors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/?renderer=canvas');
        await page.waitForFunction(
            () => window.game?.scene.getScene('loading-scene')?.load.isLoading() === false,
        );
        await page.evaluate(() => {
            window.game.sound.mute = true;
            const weapons = [{ id: 30, name: 'Impact Howitzer', type: 0 }];
            window.game.scene.start('main-scene', {
                gameType: 4,
                player1: { name: 'A', color: 0x6eaa99, weapons },
                player2: { name: 'B', color: 0xc59a76, weapons: [...weapons] },
            });
        });
        await page.waitForFunction(() => window.game.scene.getScene('main-scene').arsenal);
        const report = await page.evaluate(() => {
            const s = window.game.scene.getScene('main-scene');
            s.physics.world.pause();
            s.time.paused = true;
            s.weaponFX.dispose();
            const shape = (x = 0, y = 0) => ({
                x,
                y,
                destroy() {},
                setPosition(x, y) {
                    this.x = x;
                    this.y = y;
                    return this;
                },
            });
            s.weaponFX = {
                disposed: false,
                impact() {
                    return false;
                },
                muzzle() {},
                projectile: shape,
                zone() {
                    return false;
                },
                beam() {
                    return false;
                },
                build() {
                    return false;
                },
            };
            s.terrain.fixTerrain = () => {};
            const fixture = (id) => {
                s.terrain.context.globalCompositeOperation = 'source-over';
                s.terrain.context.globalAlpha = 1;
                s.terrain.setPath([
                    { x: -200, y: 350 },
                    { x: 1400, y: 350 },
                ]);
                s.terrain.matrix = [];
                s.terrain.blastArray = [];
                s.tacticalWorld = { shot: 0, zones: [], devices: [], nextZone: 1, nextDevice: 1 };
                for (const [i, t] of [s.tank1, s.tank2].entries()) {
                    t.setPosition(i ? 720 : 300, 349);
                    t.rotation = 0;
                    t.centre = { x: t.x, y: t.y - 6 };
                    t.top = { x: t.x, y: t.y - 12 };
                    t.body.updateFromGameObject();
                    t.body.stop();
                    t.tactics = { shield: 0, frost: 0, frostMoves: 0, acid: 0, marked: 0 };
                    t.power = 50;
                    t.movesRemaining = 4;
                    t.score = 0;
                    t.updateScore = (n) => (t.score += n);
                    t.turret.setPosition(t.x, t.y - 12);
                    t.turret.setRelativeRotation(Math.PI / 2);
                }
                if (id >= 190 && id < 210)
                    Object.assign(s.tank1.tactics, { frost: 2, frostMoves: 1, acid: 2, marked: 2 });
                const entry = s.arsenal.catalog[id],
                    r = entry.createInstance();
                r.create({ id, scene: s, tank: s.tank1, turret: s.tank1.turret, terrain: s.terrain });
                return { entry, r };
            };
            const outcomes = [];
            for (let id = 30; id < 400; id++) {
                const { entry, r } = fixture(id),
                    calls = { burst: [], build: [], carve: [] };
                for (const k of Object.keys(calls)) {
                    const original = r[k];
                    r[k] = (...args) => {
                        calls[k].push(args);
                        return original(...args);
                    };
                }
                try {
                    r.shoot();
                    if (
                        !['shield', 'repair', 'cleanse', 'kamikaze', 'laser', 'rail'].includes(entry.behavior)
                    ) {
                        if (!r.projectiles.length) r.update();
                        const p = r.projectiles.find((p) => !p.removed);
                        if (p) {
                            p.x = 720;
                            p.y = 350;
                            p.vx = 100;
                            p.vy = 100;
                            r.impact(p);
                        }
                    }
                    for (let n = 0; n < 965 && !r.done; n++) r.update();
                    outcomes.push({
                        id,
                        name: entry.name,
                        behavior: entry.behavior,
                        payload: entry.payload.key,
                        done: r.done,
                        tick: r.tick,
                        bursts: calls.burst.length,
                        builds: calls.build.length,
                        carves: calls.carve.length,
                        score: s.tank1.score,
                        own: { ...s.tank1.tactics },
                        foe: { ...s.tank2.tactics },
                        zones: s.tacticalWorld.zones.map((z) => ({
                            kind: z.kind,
                            x: z.x,
                            y: z.y,
                            r: z.radius,
                        })),
                        moves: s.tank1.movesRemaining,
                    });
                } catch (error) {
                    outcomes.push({ id, name: entry.name, error: error.stack });
                }
                r.dispose();
                s.tweens.killAll();
                s.children.list
                    .filter(
                        (o) =>
                            ['Arc', 'Ellipse', 'Line', 'Text'].includes(o.type) &&
                            o.depth > 0 &&
                            o !== s.HUD.weaponDescription,
                    )
                    .forEach((o) => {
                        if (o.type !== 'Text') o.destroy();
                    });
            }
            const drill = [];
            for (const id of [70, 71, 72, 73, 74, 75, 76, 77, 78, 79]) {
                const { r, entry } = fixture(id);
                const ctx = s.terrain.context;
                ctx.fillStyle = '#665544';
                ctx.fillRect(0, 50, 1200, 483);
                s.terrain.update();
                const contacts = [],
                    origCarve = r.carve,
                    origImpact = r.impact;
                r.carve = (x, y, rad) => {
                    contacts.push({ x, y, rad });
                    return origCarve(x, y, rad);
                };
                let impacts = [];
                r.impact = (p) => {
                    impacts.push({ x: p.x, y: p.y, drilled: p.drilled });
                    return origImpact(p);
                };
                r.spawn(100, 150, 240, 0, { gravity: 0 });
                for (let n = 0; n < 965 && !r.done; n++) r.update();
                drill.push({
                    id,
                    name: entry.name,
                    first: contacts[0],
                    last: contacts.at(-1),
                    carves: contacts.length,
                    impacts,
                    tick: r.tick,
                });
                r.dispose();
            }
            const poisoned = [];
            const opaque = () => {
                const d = s.terrain.context.getImageData(0, 0, 1200, 350).data;
                let n = 0;
                for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
                return n;
            };
            for (const id of [
                ...Array.from({ length: 50 }, (_, i) => 130 + i),
                ...Array.from({ length: 10 }, (_, i) => 350 + i),
            ]) {
                const values = {};
                for (const op of ['source-over', 'source-atop']) {
                    const { r, entry } = fixture(id);
                    const before = opaque();
                    s.terrain.context.globalCompositeOperation = op;
                    r.shoot();
                    const p = r.projectiles[0];
                    p.x = 720;
                    p.y = 350;
                    r.impact(p);
                    for (let n = 0; n < 965 && !r.done; n++) r.update();
                    values[op] = opaque() - before;
                    r.dispose();
                }
                poisoned.push({ id, name: s.arsenal.catalog[id].name, ...values });
            }
            const downward = [];
            for (let id = 70; id <= 79; id++) {
                const { r, entry } = fixture(id);
                const impacts = [],
                    baseImpact = r.impact;
                r.impact = (p) => {
                    impacts.push({ x: p.x, y: p.y, drilled: p.drilled });
                    return baseImpact(p);
                };
                r.spawn(500, 349, 0, 240, { gravity: 0 });
                for (let n = 0; n < 965 && !r.done; n++) r.update();
                downward.push({ id, name: entry.name, impacts, tick: r.tick });
                r.dispose();
            }
            // Counterplay affects existing hazards; the newly delivered family
            // effect must then remain, even when its payload is a counter.
            const hazardOrder = [];
            for (const [id, kind] of [
                [215, 'mine'],
                [221, 'oil'],
                [237, 'acid'],
            ]) {
                const { r, entry } = fixture(id);
                let removedOld = false;
                s.tacticalWorld.zones.push({
                    id: 999,
                    kind,
                    x: 710,
                    y: 350,
                    radius: 35,
                    owner: s.tank1,
                    ttl: 3,
                    armedAt: 0,
                    payload: entry.payload.key,
                    visual: {
                        destroy() {
                            removedOld = true;
                        },
                    },
                });
                r.shoot();
                const projectile = r.projectiles[0];
                Object.assign(projectile, { x: 720, y: 350, vx: 100, vy: 100 });
                r.impact(projectile);
                for (let tick = 0; tick < 965 && !r.done; tick++) r.update();
                hazardOrder.push({
                    id,
                    name: entry.name,
                    removedOld,
                    fresh: s.tacticalWorld.zones.some(
                        (zone) => zone.kind === kind && zone.id !== 999 && zone.x === 720,
                    ),
                    oldSurvived: s.tacticalWorld.zones.some((zone) => zone.id === 999),
                });
                r.dispose();
            }
            return { outcomes, drill, poisoned, downward, hazardOrder };
        });
        const assert = require('assert/strict');
        const failures = [];
        for (const outcome of report.outcomes) {
            try {
                assert.equal(outcome.error, undefined);
                assert.ok(outcome.done);
                const self = ['shield', 'repair', 'cleanse'].includes(outcome.behavior);
                if (['wall', 'dome', 'berm', 'platform', 'bridge', 'seed'].includes(outcome.behavior))
                    assert.ok(outcome.builds > 0, 'missing construction');
                if (outcome.behavior === 'shield' && outcome.payload === 'ion')
                    assert.equal(outcome.own.shield, 70, 'Ion negated its own shield');
                if (outcome.behavior === 'repair') {
                    assert.equal(outcome.moves, 5);
                    if (outcome.payload === 'ion')
                        assert.equal(outcome.own.shield, 20, 'Ion negated repair shield');
                }
                if (
                    ['repair', 'cleanse'].includes(outcome.behavior) ||
                    (self && ['frost', 'acid', 'magnet'].includes(outcome.payload))
                ) {
                    assert.equal(outcome.own.frost, 0, 'self support froze owner');
                    assert.equal(outcome.own.acid, 0, 'self support corroded owner');
                    assert.equal(outcome.own.marked, 0, 'self support marked owner');
                }
                if (['mine', 'oil', 'acidpool'].includes(outcome.behavior)) {
                    const kind = outcome.behavior === 'acidpool' ? 'acid' : outcome.behavior;
                    assert.ok(
                        outcome.zones.some((z) => z.kind === kind),
                        'hazard missing',
                    );
                }
                if (outcome.payload === 'volatile')
                    assert.ok(outcome.bursts > 0, 'volatile follow-up missing');
                if (
                    !self &&
                    ![
                        'wall',
                        'dome',
                        'berm',
                        'platform',
                        'bridge',
                        'seed',
                        'mine',
                        'oil',
                        'acidpool',
                        'blink',
                        'swap',
                    ].includes(outcome.behavior)
                )
                    assert.ok(outcome.bursts > 0, 'offensive delivery did not resolve');
            } catch (error) {
                failures.push({ id: outcome.id, name: outcome.name, error: error.message });
            }
        }
        for (const outcome of report.poisoned)
            if (outcome['source-over'] <= 0 || outcome['source-atop'] !== outcome['source-over'])
                failures.push({
                    id: outcome.id,
                    name: outcome.name,
                    error: 'construction depends on inherited composite mode',
                    ...outcome,
                });
        for (const outcome of report.drill)
            if (!outcome.impacts.length || Math.abs(outcome.impacts[0].x - 250) > 0.01)
                failures.push({
                    id: outcome.id,
                    name: outcome.name,
                    error: 'solid penetration differs from150px',
                    impact: outcome.impacts[0],
                });
        for (const outcome of report.downward)
            if (!outcome.impacts.length || Math.abs(outcome.impacts[0].y - 499.5) > 0.01)
                failures.push({
                    id: outcome.id,
                    name: outcome.name,
                    error: 'downward drill vanished or missed150px budget',
                    impacts: outcome.impacts,
                });
        for (const outcome of report.hazardOrder)
            if (!outcome.removedOld || !outcome.fresh || outcome.oldSurvived)
                failures.push({
                    ...outcome,
                    error: 'payload must counter old hazard and preserve newly delivered hazard',
                });
        Object.assign(report, {
            perIdAssertions: 370,
            failures,
            errors: pageErrors,
            passed: failures.length === 0 && pageErrors.length === 0,
        });
        fs.mkdirSync(path.dirname(artifactPrefix), { recursive: true });
        fs.writeFileSync(artifactPrefix + '.json', JSON.stringify(report, null, 2));
        assert.equal(report.outcomes.length, 370);
        assert.deepEqual(
            report.outcomes.map((o) => o.id),
            Array.from({ length: 370 }, (_, i) => i + 30),
        );
        assert.equal(report.poisoned.length, 60);
        assert.equal(report.drill.length, 10);
        assert.equal(report.downward.length, 10);
        assert.equal(report.hazardOrder.length, 3);
        assert.deepEqual(failures, []);
        assert.deepEqual(pageErrors, []);
        console.log(
            JSON.stringify({
                passed: report.passed,
                perIdAssertions: report.perIdAssertions,
                constructionPairs: report.poisoned.length,
                drillChecks: report.drill.length + report.downward.length,
                hazardOrderChecks: report.hazardOrder.length,
            }),
        );
    } finally {
        await browser?.close();
        server.closeAllConnections();
        if (server.listening) await new Promise((r) => server.close(r));
    }
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
