# Pocket Tanks

Live demo - https://pocket-tanks.netlify.app

The fastest game of artillery you'll ever play. Two tanks firing unique weapons at each other to earn points. Each player gets 10 turns.

Various modes available -

1. CPU
2. Two player (2 players on same computer)
3. Online Multiplayer (global players)
4. Practice

# Tech stack

MERN (MongoDB, Expressjs, Reactjs, Node.js)
Gaming library - Phaser js

# Sample from original

![alt text](https://github.com/Amankumar321/pocket-tanks/blob/6b8af457f00a59afbba9ddd35206e5803a484950/564da9c610227989f789a120bbee611c.jpeg)
![alt text](https://github.com/Amankumar321/pocket-tanks/blob/6b8af457f00a59afbba9ddd35206e5803a484950/643x0w.jpg)

# About

Pocket Tanks is designed to be easy to learn, and fun to master. All the excitement of lobbing projectiles over a mound of dirt without all the complicated details found in most artillery games. Select your angle, power, and fire over 30 distinct weapons at your opponent. There is an innovative weapon shop to keep the game moving fast and a target practice mode for experimenting with all the weapons "no holds barred! "  

This is a remake of famous game "Pocket Tanks" from 2001 which is available on windows/Mac/iOS/android with over 500k download on play store. You would find a lot of videos on YouTube of gameplay.

This is a web version of the game and it allows online multiplayer which means you can invite your friends to play against you. Just select "Online Multiplayer" mode, create your room and ask you friend to join it. You can play against CPU level 8 when you have mastered the game and want to test your skills !

Youtube (Watch and learn) - https://www.youtube.com/watch?v=Uw7nAUGwgYQ

# Controls

- Esc - exit game
- W - increase power
- S - decrease power
- A - move left
- D - move right
- Q - angle rotate left
- E - angle rotate right
- Space - Fire

All controls are available with Mouse click on buttons
## Remastered arsenal

The expanded arsenal contains 770 weapons: the existing 30 base implementations,
370 returning expansion adaptations, and 370 new designs built from 37 delivery
systems and 10 interacting payloads. Returning weapons are **adaptations** with remastered timing, effects,
and balance; matching an original name does not establish exact original-game
behavioral parity. The in-game arsenal distinguishes these adaptations from the
retained base weapons and new designs. Seven of the closest base relatives now
also have distinct terrain aftermaths while preserving their firing sequences.

Weapon identities include delivery, triggers, terrain geometry and aftermath.
The mechanical audit excludes names, IDs, seeds, color, damage, radius and count
so tuning changes cannot pass as new mechanics. Presentation follows the actual
delivery and payload: solid projectiles, textured material bursts, ballistic
fragments and drifting smoke. All 770 weapons own separate texture sets and
animated physical compositions. The runtime controls where and when impacts
happen; the render audit checks every weapon and captures contact sheets.

**Auto Turrets** deploys twin sentries with line of sight, heat and ammunition.
**Missile Turret** saves a visible target lock and fires an arcing missile on a
later shot boundary. **Run 'n' Gun** deploys a mobile strafing drone. Dirt blocks
their firing lanes, buried devices cannot operate, and destroying support or
batteries can hurt either player. Ammunition, heat, target locks and lifetimes
remain in the saved match; offline time never advances their combat state.

Open **ARSENAL** or press **B** during a match or draft. Search names, effects,
risks, and combinations; filter by category, collection, or owned inventory.
Target Practice includes every weapon. In competitive modes the browser selects
only weapons already in the active player's loadout. The draft shows effect and
risk descriptions before selection.

Some useful combinations and counterplays:

- Spill oil, then ignite it with a fire payload. Either tank can be burned.
- Corrode armor before a scoring attack; foam clears corrosion and fire.
- Use terrain builders for cover, then drills or piercing beams to break through.
- Mark armor to attract guided rounds and ion arcs. Ion also strips shields.
- Use shields to absorb scoring damage. This remains a points-based game.
- Mines arm on a later shot and respond to tank movement. Owners are not immune.
- Return shots, volatile breeches, duds, and self-detonations require judgment.

Hazard duration advances at shot boundaries. Merely waiting does not advance
status duration. The inventory list recycles visible rows, and effects and field
hazards have bounded lifetimes and counts.

Roster references: [archived official Weapons Depot](https://classic.blitwise.com/ptanksdepot.html),
[publisher's expansion announcements](https://www.blitwise.com/mikes-dev-blog/category/News),
and the [Rumble pack test roster](https://community.blitwise.com/post/beta-test-3-rumble-chasm-packs-1-week-to-rumble-release-13388365).
Reference metadata records the distinction between original implementations,
playable adaptations, and source coverage. Publisher artwork and game binaries
are not included in this implementation.

Validation:

```sh
CI=true npm test --prefix client -- --watchAll=false --runInBand
npm run build --prefix client
# With Playwright available in the environment:
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-arsenal.cjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-online.cjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-deployables.cjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-weapon-identities.cjs
```

The browser checks exercise every added weapon against real canvas terrain,
shot/turn lifecycles, arsenal interactions, and online turn handoffs including
shields and rubber/glue material synchronization.

## Weapon visuals and terrain

Weapon effects use textured fireballs, turbulent smoke and flame, ballistic
debris, emissive trails, crystalline ice, liquid splashes, corrosive vapor,
branching energy beams, animated hazard surfaces, and soft shield illumination.
Abstract impact storyboards, trail glyphs and shield wire meshes are removed
from the live renderer. Visual effects do
not alter the terrain collision mask, scoring, or shot simulation. Transient
effects and sprite pools are capped and cleaned up when a scene shuts down.

The mode menu includes a terrain selector: random, rolling hills, basin, twin
summits, ridgeline, plateaus, or badlands. Each layout has a distinct height
profile and soil palette. Tanks deploy on prepared opposing sectors, at least
45% of battlefield width apart. Online clients receive the host's terrain path
and spawn plan.

To capture the effects and terrain checks after building:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-weapon-fx.cjs
```

## Animation and WebGL rendering

The client now uses Phaser **3.90.0**, pinned in the package and lockfile. It
prefers WebGL and automatically uses Canvas when WebGL is unavailable. Append
`?renderer=canvas` to compare the Canvas renderer explicitly.

Tanks use four-times-resolution artwork with animated tracks, barrel recoil,
spring suspension, impact rocking and smoothly eased visual aiming. The original
36 × 24 tank and 6 × 32 turret remain the collision and firing anchors; visual
easing never changes shot direction, hitboxes, scoring or saved combat state.
Floating scores use timed easing and are destroyed after fading out.

Clouds, distant ridges and drifting dust move using small reusable textures.
Each weapon has a dedicated 25-frame atlas: twelve impact frames, two projectile
frames, three trail frames, three residue frames, two muzzle frames, two beam
frames and one debris frame. The 770 PNGs live in
`client/public/assets/weapon-fx/v2/` with their ownership and SHA-256 manifest.
No two weapons share a finished texture, frame set or animation graph. Lighting,
scheduling and sprite pooling remain common rendering infrastructure.

The art direction source is `client/scripts/weapon-art/art-direction.cjs`; every
registered weapon has an entry. Physical node graphs are resolved into
`client/src/graphics/weapon-art/designs.json`, then shaded by an offline WebGL
surface renderer. There are no name/ID seeds, recolor variants, glyphs or family
fallbacks. The pixel audit checks all seven channels in normalized grayscale and
also checks impact alpha silhouettes, so color cannot hide a repeated effect.

Only relevant weapon atlases load during a match. A bounded GPU cache releases
inactive atlases; a weapon can render its own geometry immediately while its
baked surface loads. WebGL batches pooled sprites and Canvas draws the same
owned frames. Alpha bounds trim transparent margins while preserving animation
origins. Persistent zones and deployable shots retain the originating
weapon ID across saves/reconnects. Original weapon collision and scoring clocks
are unchanged. The particle-only WebGL path avoids a full battlefield upload.

WebGL adds subtle bloom, localized impact illumination, pressure-wave refraction
and heat shimmer. These effects stay inside the battlefield. Operating-system
reduced-motion preferences disable tank rocking/recoil, moving scenery, camera
shake and shader refraction. Canvas retains the artwork and animation improvements.

The visible terrain and collision texture share one source. Collision reads
remain synchronous while GPU uploads are combined at the end of each frame.
Original digging tracks also queue a texture refresh without rebuilding collision
buffers. `npm run check:digging --prefix client` verifies Ground Hog, Worm and
Homing Worm against real WebGL and Canvas framebuffer pixels.
The HUD console and changing power meter also explicitly refresh their GPU
textures. Legacy smoke and Chain Reaction emitters use the Phaser 3.90 API.
Turn completion and checkpoints run after Arcade synchronizes body positions
back to tank sprites, so the saved and displayed settled positions agree.
Fullscreen and viewport changes refresh parent bounds before fitting the canvas
and repositioning native controls, including square and short landscape screens.

Validation, using the same `CLIENT_BUILD_PATH` when building outside `client/build`:

```sh
CI=true npm test --prefix client -- --watchAll=false --runInBand
npm run build --prefix client
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome npm run check:graphics --prefix client
```

The graphics check captures real WebGL and Canvas frames, tests visible terrain
and HUD changes, verifies animation does not alter combat state, fires original
weapons, stresses particle limits, checks scene cleanup and context restoration,
and exercises mobile reduced motion and automatic Canvas fallback. Screenshots
and its report are written to `/tmp/pocket-graphics` (or `GRAPHICS_ARTIFACTS`).

To rebuild and inspect the weapon artwork (Playwright/Chrome and Python Pillow):

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome npm run art:bake --prefix client
npm run art:audit --prefix client
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome npm run check:weapon-identities --prefix client
```

The asset audit rejects duplicate impact silhouettes and repeated projectile,
trail, residue, muzzle, beam or debris frames. The browser audit loads every
weapon’s owned asset and freezes random debris before comparing live compositor
frames. Texture ownership, cache limits, scene cleanup, context recovery and
Canvas fallback are covered by the graphics check.

## Online draft, reconnecting, and phone names

Online players draft from the same randomly dealt twenty-slot pool. Tap a row
to preview its effect, then choose **SELECT WEAPON**. **RANDOM** takes one
available pick; **RANDOM ALL** immediately fills your remaining loadout slots
from the unclaimed pool, preserving anything already selected. Each player gets
ten weapons, and each chooses whether to randomize their own loadout. Both press
**CONTINUE** when ready. Picks, turns, and readiness are validated by the server.

Online matches have no inactivity timeout. You can take your turn while your
opponent is offline, then return later after they have played. Draft selections
also work one turn at a time without both browsers staying connected. Closing
or minimizing a browser keeps the room and its saved turn intact.

Reconnect or refresh the same tab to restore automatically. After closing a tab,
open the game in the same browser and choose **RESUME ONLINE MATCH**. **RETURN TO
MENU** parks the game without ending it; explicit **END MATCH**/**Leave match**
ends the room. Completed turns, inventories, terrain, scores, shields, positions,
and whose turn it is are saved together. An interrupted approved shot resumes
from its saved pre-shot checkpoint and completes once.

The connection screen also has **RESUME MATCH** to retry immediately in the
current game, including after a phone was backgrounded. No trip through the
main menu is required.

Use **END MATCH & RETURN TO MENU** in the in-game Back menu (the **☰** button
on phones) to close the room for both players and return to the main menu. Saving
and returning to the menu keeps the match available instead.

On phones, angle, power, ammo and Fire use native controls in the existing
combat HUD. Drag a slider for broad adjustments, tap **+ / −** for one-unit changes,
hold to repeat, or type an exact number. Angles cover the entire circle for
digging shots: 0° points right, 90° up, 180° left and 270° down. **FIRE** uses a
normal press and release in its own area, separated from the ammo selector and
aiming inputs. The battlefield keeps its full size. Aiming stays disabled during
shots and the opponent's online turn. The controls and reconnect screen also
work in fullscreen.

**ASSIST AIM** in local matches predicts the selected weapon using its own flight
and collision logic, including muzzle position, guidance, spread, digging, banks,
beams and authored delivery rules. It searches integer power settings against a
private terrain copy; previewing cannot consume ammo or change scores, shields,
terrain or persistent devices. Changing weapon, aim, power, turn or position while
it searches cancels that result. Self-use and automatically targeted weapons keep
their existing settings. **BEST AVAILABLE** reports an approximate solution;
**NO CLEAR SHOT** keeps the current controls when no delivery is found. Random
scatter and terrain movement during a multi-stage attack can still affect the
outcome. Assist remains unavailable online.

Verify the complete catalog with `npm run check:aim-assist --prefix client` after
building. Add `AIM_VERIFY_SHOTS=1` to compare assisted settings with actual Phaser
shots across left, right, ridge, higher and lower target scenarios. `AIM_IDS=0,5,11,18` limits the catalog
sweep, and `AIM_REPORT=/tmp/aim.json` selects the JSON report path.

Target Practice lists are alphabetical in both the weapon selector and the
arsenal, including filtered results. Numeric names use natural ordering. Each
selection retains its canonical weapon ID.

Tar Ball creates an opaque black terrain sphere around a tank hit by its shell.
Its dedicated animation uses glossy black tar, and the material survives online
terrain corrections. Construction explicitly owns its canvas drawing state, so
previous digging or explosions cannot hide a later wall, shelter, or tar ball.

Run `npm run check:weapon-contracts --prefix client` against a production build
for the repeatable arsenal audit. It checks all 770 canonical IDs, including full
shots for all 30 originals, per-payload construction/status/hazard contracts,
measured drill penetration, named classic behaviors, persistent devices, moving
tank actors, and tether physics. Tar Ball and the three tether weapons also get
WebGL/Canvas checks. The individual commands are `check:generated-contracts`,
`check:early-contracts`, `check:later-contracts`, `check:native-contracts`,
`check:tether-contracts`, and `check:tar-ball`. Set `CLIENT_BUILD_PATH` to a staged
build and `CONTRACT_ARTIFACTS` to the full audit report directory. These checks
record their tested behavior; runtime completion alone does not certify exact
fidelity to every detail of the original commercial weapons.

The first game tap enters fullscreen where the browser permits it. The **⛶**
control remains available in menus, combat and recovery, including after exiting
fullscreen. Exiting deliberately stays windowed until **⛶** is pressed again.

Online turns use one server-owned turn number and a unique approved shot ID.
The server saves the pre-shot position and shot approval before either player
executes it. Only that shot's completed checkpoint can pass control to the other
player. If its owner disconnects mid-shot, resuming replays the saved shot once
from its pre-shot checkpoint. Old handoffs, duplicate clicks and stale messages
cannot create another turn. Temporary lookup errors or another tab taking over
retain the saved Resume action.

The server atomically stores rooms and checkpoints in `server/data/rooms.json`
(or `ONLINE_ROOM_STORE`) with restricted file permissions. These saves survive
server-process restarts. Transient connections are restored as offline when the
server starts. Browser resume credentials do not expire and stay local to that
browser. Keep the save file when moving/redeploying the server; corrupted save
files fail closed rather than being silently replaced.

Player-name fields now use native browser inputs in every setup mode. Tap to
open the phone keyboard, edit or paste a name, and use **Done** or **Continue**.
Names support letters, numbers, spaces, underscores, and hyphens, up to fifteen
characters.

Additional checks:

```sh
node server/scripts/check-sessions.mjs
node server/scripts/check-persistence.mjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-resume.cjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-async.cjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-player-name.cjs
```

Session design follows Socket.IO's guidance that transport IDs are temporary
and missed server events need application-level state restoration:
[Socket instance](https://socket.io/docs/v4/client-socket-instance/),
[delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/).
