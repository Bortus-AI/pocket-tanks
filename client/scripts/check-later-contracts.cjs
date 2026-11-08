/* Built-game contracts for later classics. Includes all canonical IDs585–769,
   then strict timer, lifetime, target, terrain and material regressions. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(
  process.env.CLIENT_BUILD_PATH || path.resolve(__dirname, "../build"),
);
const artifacts =
  process.env.LATER_CONTRACT_ARTIFACTS || "/tmp/pocket-later-contracts";
fs.mkdirSync(artifacts, { recursive: true });
(async () => {
  const server = http.createServer((q, r) => {
    const p = new URL(q.url, "http://localhost").pathname;
    const f = path.resolve(
      root,
      `.${p === "/" ? "/index.html" : decodeURIComponent(p)}`,
    );
    if (!f.startsWith(root + path.sep)) {
      r.writeHead(403).end();
      return;
    }
    try {
      r.setHeader(
        "Content-Type",
        {
          ".js": "text/javascript",
          ".html": "text/html",
          ".css": "text/css",
          ".png": "image/png",
        }[path.extname(f)] || "application/octet-stream",
      );
      r.end(fs.readFileSync(f));
    } catch {
      r.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const errors = [];
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_BIN
        ? { executablePath: process.env.CHROME_BIN }
        : {}),
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      "http://127.0.0.1:" + server.address().port + "/?renderer=canvas",
    );
    await page.waitForFunction(
      () =>
        window.game?.scene.getScene("loading-scene")?.load.isLoading() ===
        false,
    );
    await page.evaluate(() => {
      window.game.sound.mute = true;
      const weapons = [{ id: 0, name: "Single Shot", type: 0 }];
      window.game.scene.start("main-scene", {
        gameType: 4,
        player1: { name: "A", color: 0x6eaa99, weapons },
        player2: { name: "B", color: 0xc59a76, weapons },
      });
    });
    await page.waitForFunction(
      () => window.game.scene.getScene("main-scene")?.arsenal,
    );
    const catalog = await page.evaluate(() =>
      window.game.scene
        .getScene("main-scene")
        .arsenal.catalog.filter((w) => w.id >= 585 && w.id <= 769)
        .map(({ logoCanvas, createInstance, ...w }) => w),
    );
    fs.writeFileSync(
      path.join(artifacts, "catalog.json"),
      JSON.stringify(catalog, null, 2),
    );
    await page.evaluate(() => {
      const s = window.game.scene.getScene("main-scene");
      s.physics.world.pause();
      s.time.paused = true;
      window.auditScenario = (id, kind = "contact") => {
        const entry = s.arsenal.catalog[id],
          beforeChildren = new Set(s.children.list);
        let r;
        try {
          Object.assign(s.terrain.context, {
            globalCompositeOperation: "source-over",
            globalAlpha: 1,
          });
          s.terrain.matrix = [];
          s.terrain.blastArray = [];
          s.terrain.animate = false;
          s.terrain.setPath([
            { x: -200, y: 350 },
            { x: 1400, y: 350 },
          ]);
          if (s.tacticalWorld)
            s.tacticalWorld.zones.forEach((z) => z.visual?.destroy());
          s.tacticalWorld = {
            shot: 0,
            zones: [],
            devices: [],
            nextZone: 1,
            nextDevice: 1,
          };
          for (const [i, t] of [s.tank1, s.tank2].entries()) {
            t.setPosition(i ? 720 : 300, 349);
            t.body.updateFromGameObject();
            t.body.stop();
            t.body.setGravity(0);
            t.centre = { x: t.x, y: t.y - 6 };
            t.top = { x: t.x, y: t.y - 12 };
            t.power = kind === "lob" ? 45 : 35;
            t.rotation = 0;
            t.score = 0;
            t.tactics = {
              shield: 0,
              frost: 0,
              frostMoves: 0,
              acid: 0,
              marked: 0,
            };
            t.turret.setPosition(t.x, t.y - 12);
            t.turret.setRotation(kind === "lob" ? Math.PI / 4 : Math.PI / 3);
          }
          r = entry.createInstance();
          const w = {
            id,
            scene: s,
            tank: s.tank1,
            turret: s.tank1.turret,
            terrain: s.terrain,
            weaponHandler: r,
          };
          r.create(w);
          const calls = {},
            callTicks = {},
            callOwners = {};
          for (const key of [
            "burst",
            "build",
            "carve",
            "coat",
            "dirtAt",
            "ray",
            "spawn",
            "pointBurst",
            "fragments",
            "impact",
            "walker",
            "beam",
          ])
            if (r[key]) {
              calls[key] = [];
              callTicks[key] = [];
              callOwners[key] = [];
              const orig = r[key];
              r[key] = (...a) => {
                callTicks[key].push(r.tick);
                callOwners[key].push(r.weapon.tank === s.tank1 ? 1 : 2);
                calls[key].push(
                  a.map((x) =>
                    x && typeof x === "object"
                      ? {
                          x: x.x,
                          y: x.y,
                          vx: x.vx,
                          vy: x.vy,
                          child: x.child,
                          classicBounces: x.classicBounces,
                          ruleBanked: x.ruleBanked,
                          ruleFuseReady: x.ruleFuseReady,
                          laterBounces: x.laterBounces,
                          punchReturning: x.punchReturning,
                          returnFire: x.returnFire,
                          ownerRole:
                            x.owner === s.tank1
                              ? 1
                              : x.owner === s.tank2
                                ? 2
                                : undefined,
                        }
                      : x,
                  ),
                );
                return orig.apply(r, a);
              };
            }
          const pixel = (x, y) => {
            const p = s.terrain.getPixel(x, y);
            return { r: p.red, g: p.green, b: p.blue, a: p.alpha };
          };
          if (kind === "crater") {
            const ctx = s.terrain.context;
            ctx.save();
            ctx.globalCompositeOperation = "destination-out";
            ctx.beginPath();
            ctx.arc(300, 350, 90, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            s.terrain.update();
            s.tank1.setPosition(300, 439);
            s.tank1.body.updateFromGameObject();
            s.tank1.centre = { x: 300, y: 433 };
            s.tank1.top = { x: 300, y: 427 };
            s.tank1.turret.setPosition(300, 427);
          }
          if (kind === "empty") {
            s.terrain.context.clearRect(
              0,
              0,
              s.terrain.width,
              s.terrain.height,
            );
            s.terrain.update();
          }
          if (kind === "unequal") {
            s.terrain.setPath([
              { x: -200, y: 350 },
              { x: 450, y: 350 },
              { x: 640, y: 240 },
              { x: 1400, y: 240 },
            ]);
            s.tank2.setPosition(720, 239);
            s.tank2.body.updateFromGameObject();
            s.tank2.centre = { x: 720, y: 233 };
            s.tank2.top = { x: 720, y: 227 };
            s.tank2.turret.setPosition(720, 227);
          }
          if (kind === "coin-gold") r.random = () => 0.25;
          if (kind === "coin-silver") r.random = () => 0.75;
          const initial = pixel(720, 340),
            initialTankY = [s.tank1.y, s.tank2.y];
          let minTankY = [...initialTankY],
            maxTankY = [...initialTankY];
          r.shoot();
          const launch = {
            projectiles: r.projectiles.length,
            events: r.events.length,
            details: r.projectiles.map((p) => ({
              x: p.x,
              y: p.y,
              vx: p.vx,
              vy: p.vy,
              gravity: p.gravity,
              energy: p.laterEnergy,
            })),
            calls: Object.fromEntries(
              Object.entries(calls).map(([key, value]) => [key, value.length]),
            ),
            tanks: [s.tank1, s.tank2].map((t) => ({
              x: t.x,
              y: t.y,
              vx: t.body.velocity.x,
              vy: t.body.velocity.y,
            })),
          };
          if (
            [
              "contact",
              "settled",
              "coin-gold",
              "coin-silver",
              "fast-ball",
              "slow-ball",
              "punch-miss",
            ].includes(kind) &&
            r.projectiles.length
          ) {
            for (const p of r.projectiles.filter((p) => !p.child)) {
              Object.assign(p, {
                x:
                  kind === "punch-miss"
                    ? 500
                    : kind.endsWith("-ball")
                      ? 700
                      : 720,
                y: 350,
                vx:
                  kind === "fast-ball" ? 600 : kind === "slow-ball" ? 120 : 180,
                vy: kind.endsWith("-ball") ? 0 : 100,
              });
              r.impact(p);
            }
          }
          let maxActorSpriteDelta = 0;
          if (kind === "worldstep") {
            s.physics.world.resume();
            s.physics.world._elapsed = 0;
          }
          for (let i = 0; i < 965 && !r.done; i++) {
            if (kind === "worldstep")
              s.physics.world.update((i * 1000) / 60, 1000 / 60);
            r.update();
            if (kind === "worldstep") {
              s.physics.world.postUpdate();
              if (r.laterState?.tank)
                maxActorSpriteDelta = Math.max(
                  maxActorSpriteDelta,
                  Math.abs(r.laterState.tank.x - r.laterState.x),
                );
            }
            [s.tank1, s.tank2].forEach((t, k) => {
              minTankY[k] = Math.min(minTankY[k], t.y);
              maxTankY[k] = Math.max(maxTankY[k], t.y);
            });
          }
          if (kind === "settled")
            for (let step = 0; step < 180; step++) s.terrain.updateTerrain();
          const bytes = s.terrain.context.getImageData(
            0,
            0,
            s.terrain.width,
            s.terrain.height,
          ).data;
          let rubber = 0,
            glue = 0,
            solid = 0;
          for (let q = 0; q < bytes.length; q += 4) {
            if (bytes[q + 3]) solid++;
            if (bytes[q] === 230 && bytes[q + 1] === 0 && bytes[q + 2] === 230)
              rubber++;
            if (bytes[q] === 135 && bytes[q + 1] === 155 && bytes[q + 2] === 82)
              glue++;
          }
          return {
            id,
            name: entry.name,
            kind,
            launch,
            initialTankY,
            minTankY,
            maxTankY,
            callTicks,
            callOwners,
            actorPending: !!r.laterState,
            maxActorSpriteDelta,
            materials: { rubber, glue, solid },
            done: r.done,
            tick: r.tick,
            calls,
            score: s.tank1.score,
            tanks: [s.tank1, s.tank2].map((t) => ({
              x: t.x,
              y: t.y,
              vx: t.body.velocity.x,
              vy: t.body.velocity.y,
              tactics: t.tactics,
            })),
            zones: s.tacticalWorld.zones.map(({ visual, owner, ...z }) => z),
            devices: s.tacticalWorld.devices.map(({ owner, ...d }) => d),
            initial,
            pixels: {
              roof: pixel(720, 310),
              center: pixel(720, 340),
              surface: pixel(720, 350),
              leftBoundary: pixel(5, 20),
              rightBoundary: pixel(1195, 20),
              targetCentre: pixel(s.tank2.centre.x, s.tank2.centre.y),
              enclosureRoof: pixel(s.tank2.x, Math.round(s.tank2.y - 42)),
              ownerRoof: pixel(300, 295),
              sphere: pixel(720, 285),
              belowImpact: pixel(720, 380),
              opponentPassage: pixel(720, 252),
              floor: pixel(600, 520),
              aboveFloor: pixel(600, 480),
            },
            remaining: r.projectiles.length,
            events: r.events.length,
          };
        } catch (e) {
          return { id, name: entry.name, error: e.stack };
        } finally {
          r?.dispose();
          s.physics.world.pause();
          s.tweens.killAll();
          for (const o of [...s.children.list])
            if (!beforeChildren.has(o)) o.destroy();
          s.terrain.matrix = [];
        }
      };
    });
    const results = [];
    for (let start = 585; start <= 769; start += 5) {
      const ids = Array.from(
        { length: Math.min(5, 770 - start) },
        (_, i) => start + i,
      );
      const rows = await page.evaluate(
        (ids) => ids.map((id) => auditScenario(id)),
        ids,
      );
      results.push(...rows);
      console.log("audited through", ids.at(-1));
    }
    const extra = await page.evaluate(() => ({
      foamCrater: auditScenario(750, "crater"),
      emptyEnergy: auditScenario(746, "empty"),
      liveHop: auditScenario(616, "worldstep"),
      settledBox: auditScenario(657, "settled"),
      lobbedBox: auditScenario(657, "lob"),
      unequalCavern: auditScenario(671, "unequal"),
      coinGold: auditScenario(719, "coin-gold"),
      coinSilver: auditScenario(719, "coin-silver"),
      fastBall: auditScenario(724, "fast-ball"),
      slowBall: auditScenario(724, "slow-ball"),
      emptyFoundation: auditScenario(736, "empty"),
      missedPunch: auditScenario(717, "punch-miss"),
    }));
    extra.rayBounds = await page.evaluate(() => {
      const scene = window.game.scene.getScene("main-scene");
      Object.assign(scene.terrain.context, {
        globalCompositeOperation: "source-over",
        globalAlpha: 1,
      });
      scene.terrain.matrix = [];
      scene.terrain.setPath([
        { x: -200, y: 350 },
        { x: 1400, y: 350 },
      ]);
      const entry = scene.arsenal.catalog.find(
          (w) => w.name === "Rebound Lasers",
        ),
        runtime = entry.createInstance();
      runtime.create({
        id: entry.id,
        scene,
        tank: scene.tank1,
        turret: scene.tank1.turret,
        terrain: scene.terrain,
        weaponHandler: runtime,
      });
      try {
        return {
          ceiling: runtime.ray(100, 50, -Math.PI / 2, 200, false, 10, 2),
          wall: runtime.ray(40, 150, Math.PI, 200, false, 10, 2),
          terrain: runtime.ray(100, 330, Math.PI / 2, 120, false, 10, 2),
        };
      } finally {
        runtime.dispose();
      }
    });
    const contracts = [],
      failures = [];
    const byName = (name) => results.find((r) => r.name === name);
    const check = (name, fn) => {
      try {
        fn();
        contracts.push({ name, passed: true });
      } catch (error) {
        const failure = { name, error: error.message };
        contracts.push({ ...failure, passed: false });
        failures.push(failure);
      }
    };
    const positiveMaterial = (p) =>
      p.a > 0 && p.r === 230 && p.g === 0 && p.b === 230;
    check("185 registered runtimes execute without errors", () => {
      assert.equal(results.length, 185);
      assert.deepEqual(
        results.filter((r) => r.error),
        [],
      );
      assert.ok(
        results.every(
          (r) => r.done && !r.remaining && !r.events && !r.actorPending,
        ),
      );
    });
    check("Time Bomb ten-second countdown and final detonation", () => {
      const r = byName("Time Bomb");
      assert.equal(r.launch.calls.burst, 0);
      assert.ok(r.launch.events > 0);
      assert.equal(r.callTicks.burst[0], 600);
      assert.equal(r.calls.burst.length, 2, "volatile follow-up must remain");
      assert.ok(r.tick >= 600);
    });
    check("Bumpers tall reflective boundary walls", () => {
      const r = byName("Bumpers");
      assert.ok(positiveMaterial(r.pixels.leftBoundary));
      assert.ok(positiveMaterial(r.pixels.rightBoundary));
      assert.ok(r.materials.rubber > 15000);
    });
    check("Puddle Jumper delivery hops leave the firing tank in place", () => {
      const r = byName("Puddle Jumper");
      assert.equal(r.launch.projectiles, 1);
      assert.equal(r.launch.calls.burst, 0);
      assert.ok(r.calls.burst.length >= 4);
      assert.equal(r.tanks[0].x, 300);
      assert.equal(r.tanks[0].y, 349);
    });
    check("Leap Frog owns its hops and emits opponent lasers", () => {
      const r = byName("Leap Frog");
      assert.ok(r.calls.ray.length >= 3);
      assert.ok(r.minTankY[0] < r.initialTankY[0] - 40);
      assert.ok(r.tick > 120 && r.tick < 960);
      assert.ok(r.tanks[0].x > 300);
    });
    check("Live Arcade frames do not apply tank actor movement twice", () => {
      const r = extra.liveHop;
      assert.ok(!r.error);
      assert.ok(r.done && !r.actorPending && r.tick < 960);
      assert.ok(r.calls.ray.length >= 3);
      assert.ok(
        r.maxActorSpriteDelta < 0.01,
        "kinematic actor sprite diverged from its tracked position",
      );
    });
    check("Backtrack attacks first then retreats away", () => {
      const r = byName("Backtrack");
      assert.equal(r.launch.projectiles, 1);
      assert.equal(r.launch.calls.burst, 0);
      assert.ok(r.calls.burst.length > 0);
      assert.ok(r.tanks[0].x < 300);
      assert.ok(r.tick > 30);
    });
    check(
      "Lock Box lifts its target into a hollow reflective enclosure",
      () => {
        const r = byName("Lock Box");
        assert.ok(r.minTankY[1] < r.initialTankY[1] - 40);
        assert.ok(r.materials.rubber > 600);
        assert.equal(r.pixels.targetCentre.a, 0);
        assert.ok(extra.settledBox.materials.rubber > 600);
        assert.equal(
          extra.settledBox.pixels.targetCentre.a,
          0,
          "the enclosure must remain hollow after terrain settling",
        );
        assert.equal(extra.settledBox.pixels.enclosureRoof.a, 255,
          "the enclosure roof must remain above the tank after settling");
        assert.equal(extra.settledBox.pixels.enclosureRoof.r, 230);
        assert.equal(extra.settledBox.pixels.enclosureRoof.b, 230);
        assert.equal(extra.lobbedBox.calls.impact.length, 1);
        assert.ok(extra.lobbedBox.calls.impact[0][0].y > 325,
          "a 45-power, 45-degree lob must reach terrain or armor before resolving");
        assert.equal(r.tanks[0].y, 349);
      },
    );
    check("Neutron Beam automatic target independent of manual turret", () => {
      const r = byName("Neutron Beam");
      assert.ok(r.score > 0);
      assert.ok(Math.abs(r.calls.beam[0][1]) < 0.05);
    });
    check(
      "Fix-it Foam raises a trapped tank with actual reflective material",
      () => {
        const r = extra.foamCrater;
        assert.ok(!r.error);
        assert.ok(r.tanks[0].y < r.initialTankY[0] - 50);
        assert.ok(r.materials.rubber > 10000);
      },
    );
    check(
      "Crash Dive remains active while descending and launching artillery",
      () => {
        const r = byName("Crash Dive");
        assert.ok(r.launch.events > 0);
        assert.ok(r.tanks[0].y > r.initialTankY[0] + 50);
        assert.ok(r.calls.spawn.some((call) => call[4]?.child));
        assert.ok(r.tick > 20);
      },
    );
    check("Upheaval rises then emits a targeting beam", () => {
      const r = byName("Upheaval");
      assert.ok(r.minTankY[0] < r.initialTankY[0] - 80);
      assert.ok(r.calls.ray.length > 0);
      assert.ok(r.callTicks.ray[0] > 30);
      assert.ok(r.tick > r.callTicks.ray[0]);
      assert.ok(
        r.tanks[0].y < r.initialTankY[0] + 10,
        "ascent must not excavate a downward shaft during landing",
      );
    });
    check("Matter Blaster sends terrain-dependent energy outward", () => {
      const full = byName("Matter Blaster"),
        empty = extra.emptyEnergy;
      assert.ok(!empty.error);
      assert.equal(full.launch.projectiles, 1);
      assert.equal(full.launch.calls.burst, 0);
      assert.ok(full.launch.details[0].energy > empty.launch.details[0].energy);
      assert.ok(full.calls.burst.length > 0);
    });
    check("Stomper owns its destructive motion through landing", () => {
      const r = byName("Stomper");
      assert.ok(r.launch.events > 0);
      assert.ok(r.calls.carve.length > 30);
      assert.ok(r.tick > 30);
      assert.ok(r.tanks[0].x > 300);
    });
    check("Rebound Lasers resolve with multiple finite reflected rays", () => {
      const r = byName("Rebound Lasers");
      assert.ok(r.calls.ray.length >= 7);
      assert.ok(r.calls.ray.some((call) => call[6] > 0));
      assert.ok(r.tick < 960);
      assert.ok(
        extra.rayBounds.ceiling.y > 100,
        "an upward ray must reflect downward from the ceiling",
      );
      assert.ok(
        extra.rayBounds.wall.x > 100,
        "a left-facing ray must reflect rightward from the wall",
      );
      assert.ok(
        extra.rayBounds.terrain.y < 300,
        "a downward ray must reflect upward from terrain",
      );
    });
    check("Breakout carves a true moving escape tunnel", () => {
      const r = byName("Breakout");
      assert.ok(r.calls.carve.length > 30);
      assert.ok(r.tanks[0].x > 450);
      assert.ok(r.minTankY[0] < r.initialTankY[0] - 30);
      assert.ok(r.tick > 30 && r.tick < 960);
    });
    check("Jump Rope has two independently bouncing streams", () => {
      const r = byName("Jump Rope");
      assert.equal(r.launch.events, 16);
      assert.ok(r.calls.spawn.length >= 32);
      assert.notEqual(
        r.calls.spawn[0][2],
        r.calls.spawn[1][2],
        "the paired streams must leave at different angles",
      );
      assert.ok(r.calls.impact.some((c) => c[0].laterBounces >= 2));
    });
    check("Bunker shelters its tank underground with reflective cover", () => {
      const r = byName("Bunker");
      assert.ok(r.tanks[0].y > r.initialTankY[0] + 40);
      assert.ok(positiveMaterial(r.pixels.ownerRoof));
      assert.ok(r.calls.carve.length > 10);
    });
    check("Mirror Ball retains a moving bouncing laser carrier", () => {
      const r = byName("Mirror Ball");
      assert.equal(r.launch.projectiles, 1);
      assert.ok(r.calls.impact.some((c) => c[0].laterBounces >= 4));
      assert.ok(r.calls.ray.length >= 5);
    });
    check("Cavern connects tanks at different elevations", () => {
      const r = extra.unequalCavern;
      assert.ok(!r.error);
      assert.ok(r.calls.carve.length > 30);
      assert.ok(r.calls.carve.every((c) => c[0] >= 300 && c[0] <= 720));
      assert.equal(r.pixels.opponentPassage.a, 0);
      assert.ok(Math.min(...r.calls.carve.map((c) => c[1])) < 270);
    });
    check("Six Shooter has six actual second-contact explosions", () => {
      const r = byName("Six Shooter");
      assert.equal(r.calls.burst.length, 6);
      assert.ok(r.calls.impact.some((c) => c[0].laterBounces === 1));
      assert.equal(r.launch.calls.burst, 0);
    });
    check(
      "Gravity Grenade compresses nearby tanks into floating solid rubble",
      () => {
        const r = byName("Gravity Grenade");
        assert.ok(r.tanks[1].y < 310);
        assert.ok(r.pixels.sphere.a > 0);
        assert.equal(r.pixels.belowImpact.a, 0);
        assert.ok(r.pixels.targetCentre.a > 0);
        assert.equal(r.tanks[0].x, 300);
      },
    );
    check("Retreat reaches the far side away from the opponent", () => {
      const r = byName("Retreat");
      assert.equal(r.tanks[0].x, 22);
      assert.ok(r.tick >= 90 && r.tick < 960);
    });
    check("Super Retreat fires before raising reflective cover", () => {
      const r = byName("Super Retreat");
      assert.equal(r.tanks[0].x, 22);
      assert.ok(r.materials.rubber > 200);
      assert.ok(r.calls.ray.length > 0);
      assert.ok(r.score > 0);
    });
    check("Dash stays on terrain and damages armor it traverses", () => {
      const r = byName("Dash");
      assert.ok(r.tanks[0].x > 800);
      assert.ok(r.score > 0);
      assert.ok(r.tick > 100 && r.tick < 960);
    });
    check(
      "Coin Toss golden face triples damage without changing blast geometry",
      () => {
        const g = extra.coinGold,
          z = extra.coinSilver;
        assert.equal(g.calls.burst.length, 1);
        assert.equal(z.calls.burst.length, 1);
        assert.equal(g.calls.burst[0][2], z.calls.burst[0][2]);
        assert.equal(g.calls.burst[0][3], z.calls.burst[0][3] * 3);
      },
    );
    check("Bumper Bowling contact points scale with incoming speed", () => {
      assert.equal(extra.fastBall.launch.projectiles, 1);
      assert.ok(extra.fastBall.score > extra.slowBall.score);
      assert.equal(extra.fastBall.calls.burst.length, 0);
      assert.ok(extra.fastBall.tick > 30);
    });
    check(
      "Foundation constructs the bottom of an otherwise empty field",
      () => {
        const r = extra.emptyFoundation;
        assert.ok(r.pixels.floor.a > 0);
        assert.equal(r.pixels.aboveFloor.a, 0);
        assert.ok(r.materials.solid >= 1200 * 30);
      },
    );
    check("Firefight provokes an opponent-owned return shot", () => {
      const r = byName("Firefight");
      assert.ok(
        r.calls.spawn.some((c) => c[4]?.returnFire && c[4]?.ownerRole === 2),
      );
      assert.ok(r.callOwners.burst.includes(2));
    });
    check("Bungee Punch returns a missed glove toward its firing tank", () => {
      const r = extra.missedPunch;
      assert.ok(!r.error);
      assert.ok(r.calls.impact.some((c) => c[0].punchReturning));
      assert.ok(
        r.score < 0,
        "a returned missed glove must be able to strike its owner",
      );
    });
    check(
      "Bombardment cruise missiles enter from four corners of the sky",
      () => {
        const r = byName("Bombardment"),
          children = r.calls.spawn.filter((c) => c[4]?.child);
        assert.equal(children.length, 8);
        assert.equal(new Set(children.map((c) => `${c[0]}:${c[1]}`)).size, 4);
        assert.ok(
          children.some((c) => c[2] < 0) && children.some((c) => c[2] > 0),
        );
      },
    );
    check(
      "Auto Turrets deploy persistent sentries beside the firing tank",
      () => {
        const r = byName("Auto Turrets");
        assert.equal(r.launch.projectiles, 0);
        assert.equal(r.devices.length, 2);
        assert.ok(r.devices.every((d) => Math.abs(d.x - 300) <= 22));
      },
    );
    const report = {
      passed: failures.length === 0 && errors.length === 0,
      errors,
      scope: { firstId: 585, lastId: 769, count: 185 },
      contracts,
      failures,
      extra,
      results,
    };
    fs.writeFileSync(
      path.join(artifacts, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        passed: report.passed,
        contracts: contracts.length,
        failures,
        artifacts,
      }),
    );
    assert.deepEqual(failures, [], "later-classic semantic contracts failed");
    assert.deepEqual(errors, [], "unhandled browser errors");
    fs.writeFileSync(
      path.join(artifacts, "results.json"),
      JSON.stringify(results, null, 2),
    );
    console.log(
      JSON.stringify({
        entries: results.length,
        errors: results
          .filter((r) => r.error)
          .map((r) => ({ id: r.id, error: r.error.split("\n")[0] })),
      }),
    );
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
