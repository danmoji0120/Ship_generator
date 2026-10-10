# Hyper Space Combat — playable demo V0.1

A standalone WebGL 1v1 combat game. The Shipyard generator, Blueprint schema and Production UI are not imported or modified. The repository was fast-forwarded to `e6471b4` before completion.

## Run

```bash
cd combat-demo
npm install
npm run dev
```

Open the Vite URL and click **ENGAGE** to capture the mouse. No assets, account or API key required. WebGL and a desktop keyboard/mouse are required.

```bash
npm run build
npm run test
npm run preview -- --port 4181
# In another terminal (Chromium at /usr/bin/chromium):
DEMO_URL=http://localhost:4181 npm run qa
node qa/duel.mjs
```

## Controls

| Input | Action |
|---|---|
| W/S, A/D | Forward/backward, lateral strafe |
| Space / left Ctrl | Rise / descend |
| Q / E | Roll |
| left Shift | Directional quick boost; defaults forward |
| Tab | Acquire hostile; lock persists across weapon modes |
| 1 | Guided six-missile salvo; requires completed lock |
| 2 | Hull aim: mouse turns ship; fixed-axis spinal shot |
| 3 | Camera aim: mouse turns camera; eligible turrets track and fire |
| RMB + mouse in 1/3 | Turn hull without changing selected weapon |
| LMB (hold) | Fire selected weapon when ready |
| ESC / RESUME | Release pointer, pause / return |
| R after outcome / REMATCH | Fresh battle |

Use the gold diamond as a lead cue for guns. Missiles track automatically after launch. Boost sideways near impact, rather than only moving away from the target. The player alone controls offensive fire. BB never fires an offensive weapon.

## Implemented combat

- Fixed 60Hz simulation; shared quaternion flight/energy/boost controller for both ships.
- Input-based directional acceleration, damped inertia, angular stabilization, bounded speed/turn rate.
- Independent weapon selection, persistent target lock, hull aiming, free-camera aiming, finite turret slew/arcs and own-hull firing clearance.
- Individual missiles with acceleration, finite turn rate/lifetime, bending trails; high-speed spinal and turret projectiles with swept segment/part collision.
- Enemy approach/range control/strafe/target tracking, missile and turret attacks, delayed collision-threat checks and paid boost evasions.
- Shared local gravity defense: predicted point, bounded range, activation delay, short-lived small spheres, shared energy and a 25-point boost reserve. Only actual swept intersections remove projectiles. Prediction error moves the field; it never applies a success probability.
- Separate armor, engine, launcher, gun, hull and core collision components; cumulative plate damage, resistance/penetration and simplified internal damage, local scorch, flashes, debris, detached/removed plates, reduced engine thrust, disabled weapons.
- Compact HUD, offscreen target indicator, lead cue, target distance/status, energy, ammunition/reload, BB and incoming-threat warnings.
- Primitive military ship assemblies, emissive propulsion, muzzle/hit/interception effects, brief hit shake, speed FOV and synthesized Web Audio effects.
- Core destruction or loss of every usable offensive system disables a ship. Wrecks remain and drift; rematch rebuilds simulation and cleans visual resources.
- `ShipDefinition`, size-ready weapon data, `ShipAssembler` and a typed future `BlueprintAdapter` boundary. Actual Blueprint conversion is intentionally absent.

## Code map

`src/config.ts`: adjustable balance constants. `definition.ts`: independent data contract/test ship. `simulation.ts`: flight, weapons, AI, interception, damage and outcome. `assembler.ts`: visual assembly. `main.ts`: input, camera, effects, HUD and fixed-step loop. `tests/combat.test.ts`: behavior tests. `qa/`: browser scripts, screenshots and reports.

## Validation and limits

See `qa/RESULTS.md` for results, including failed intermediate experiments. Browser QA uses scripted mouse/keyboard input and real WebGL rendering; it is not a human playtest. TTK is a tuning goal, not a timer or guaranteed outcome. Armor penetration uses a simplified damage transfer to the core rather than a detailed internal ballistic model. Ships use box component colliders; there is no mesh cutting or physical fragment collision. Generated sounds have not been audibly judged in headless QA. Touch/mobile controls, Blueprint importing and fleets are absent.
