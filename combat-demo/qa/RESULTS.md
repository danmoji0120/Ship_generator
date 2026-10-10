# V0.1 verification results

Validated with Chromium WebGL / SwiftShader at 1280×720 and 1440×900. Full duel automation reads snapshots and sends mouse/keyboard inputs. It does not set HP, spawn favorable projectiles, move ships directly or invoke weapon firing functions.

## Final checks

| Check | Result |
|---|---|
| Standalone TypeScript + Vite build | Passed |
| Vitest behavior tests | 12 passed |
| Existing Shipyard TypeScript + Vite build | Passed |
| Browser input / pause / resume checks | Passed; see browser-report.json |
| Full browser duel | VICTORY at 42.2s simulation time |
| Player missile / spinal / turret shots | 36 / 4 / 68 |
| Actual collision impacts | 119 total |
| Local field interceptions | BB 31, enemy 3 |
| Enemy paid boost evasions | 16 |
| Player / enemy remaining core integrity | 40.5% / 0.0% |
| R restart | time 0, both ships intact, empty projectiles, lock cleared |
| Browser errors | 0 |
| Separate simulation engagement without evasive player movement | DEFEAT at 64.3s |

The automated victory demonstrates firing all three weapon types, real damage, AI evasion, BB interception, victory and restart. The short smoke run separately verifies mouse movement in mode 3 preserves hull attitude, mode changes preserve lock, boost moves the ship and consumes energy, missile/spinal firing, and ESC resume.

Unit tests cover six-axis flight/damping, exact boost cost/cooldown/regeneration, independent modes/lock, finite-speed homing acceleration, hull-aligned spinal fire, turret arcs and independent aiming, paid AI boost, real active-field segment intersection, failed/delayed interception followed by an actual ship hit, fast projectile component collision, destroyed engine/weapon behavior, outcome/reset and a real collision-based engagement.

## Experiments that failed or lost

| Experiment | Result and response |
|---|---|
| First automated suite | 2 failures: AI energy included both boost and defense; long engagement did not finish. Boost test now isolates defense. Actual missile speed bug and aiming errors were subsequently corrected. |
| Initial missile acceleration | Direction normalization accidentally reset speed each tick. Fixed by computing speed before assigning normalized direction; acceleration assertion added. |
| First browser pilot | Synthetic mouse events did not reach the window listener. Fixed the test input event target; this was a QA harness problem. |
| Before hull-axis reticle correction | Defeat 46.7s; actual spinal axis now projected as the mode-2 reticle. |
| Before AI accuracy / timing adjustment | Defeat 34.0s; bounded enemy aim estimation error and slower tactical firing cadence added. |
| Late boost pilot retaining destroyed weapons | Defeat 42.3s; preserved in duel-late-boost-loss.json. Pilot now selects remaining working weapons and reserves boosts for imminent missile impacts. |
| Earlier successful final-code pilot | Victory 38.1s; preserved in duel-victory-before-ttk-tuning.json. Equal core durability increased from 480 to 600 for both ships. |

No failed design is marked as a victory: every outcome is based on actual core destruction or loss of all usable offensive systems. There is no scripted kill timer or interception success roll.

## Limits and next tuning

- Observed final browser victory 42.2s is slightly below the approximate 45–90s target; the non-evasive simulation loss is 64.3s. Human sessions and broader input profiles are needed before calling balance validated.
- Headless SwiftShader used 49.1s wall time for the duel/restart sequence. This is not a hardware-GPU FPS claim. Physical desktop GPU performance and human mouse/boost feel were not assessed.
- Audio generation works in the browser but has not been audibly judged in headless QA.
- Penetration transfers simplified internal damage to the core; collision components are boxes. No detailed compartment ballistics or physical fragment collision.
- BB and boosts compete for energy; manual boosting can take energy below the BB reserve. BB only spends while at least 25 energy will remain.
- Next priorities: human mouse sensitivity and boost timing, clearer weapon damage feedback, turret fire readability and several measured duel profiles around the target TTK.
- No generator code, Blueprint schema, Production UI or generator tests were edited. Existing full Shipyard tests were not rerun; the existing project build passed. Latest remote work was preserved by fast-forward to e6471b4.

Screenshots: start.png, engagement.png, combat.png and duel-end.png. Raw current and historical reports accompany this file. Weapon/flight/AI/defense constants remain editable in src/config.ts; ship component durability is in src/definition.ts.
