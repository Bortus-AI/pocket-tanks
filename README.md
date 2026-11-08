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
so tuning changes cannot pass as new mechanics. The visual compositor uses the
registered weapon identity and actual semantic rules for its silhouette, trail,
telegraph, action sequence and residue. Its grayscale raster audit checks every
weapon across six phases plus projectile/trail and reports perceptual neighbors
for inspection in labeled contact sheets.

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

Weapon effects use a scene-owned canvas compositor with textured fire/smoke,
ballistic debris, emissive trails, crystalline ice, corrosive vapor, branching
energy beams, animated hazard surfaces, and shield hex meshes. Visual effects do
not alter the terrain collision mask, scoring, or shot simulation. Transient
effects and shared sprites are capped and cleaned up when a scene shuts down.

The mode menu includes a terrain selector: random, rolling hills, basin, twin
summits, ridgeline, plateaus, or badlands. Each layout has a distinct height
profile and soil palette. Tanks deploy on prepared opposing sectors, at least
45% of battlefield width apart. Online clients receive the host's terrain path
and spawn plan.

To capture the effects and terrain checks after building:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_BIN=/path/to/chrome node client/scripts/check-weapon-fx.cjs
```

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
