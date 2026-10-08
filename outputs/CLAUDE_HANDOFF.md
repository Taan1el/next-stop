# Next Stop: Claude handoff

## Paste this into Claude

Continue developing **Next Stop** in:

C:\Users\crazy\Documents\Codex\2026-10-07\maybe-we-can-make-a-separate

Read this handoff, outputs/NEXT_STOP_BUILD_PROMPT.md, outputs/NEXT_STOP_VERIFICATION.md and applicable workspace instructions. Continue from the working game and readable source. Inspect recorded evidence before changing behavior.

Keep the player deliverable **one offline HTML file**, vanilla JavaScript and custom WebGL2. Generate numerical world data and resolve glyph IDs/colours directly into cells. No images, imported models, game engine, runtime libraries, external requests or image-to-ASCII filter. The HTML may grow to **2,000,000 bytes**; add useful behavior rather than padding.

Use a short plan with concrete acceptance criteria, then playtest-and-improve cycles through normal controls. Inspect scenes and actual behavior, fix the highest-value observed problem, rebuild and verify. If improvement ideas run dry, ask a specialist or player-persona agent to critique the game. Label source/screenshot reviews separately from actual browser playthroughs. Preserve failed evidence and explain causes. The authorized scope is this session only; do not schedule recurring work.

Edit work/src/, rebuild outputs/next-stop.html and preserve train operation, walking, notes, world/save compatibility, renderer and host lifecycle. Update evidence under .omx/ and the report/handoff after meaningful changes. Complete authorized implementation and verification rather than stopping at a proposal.

Keep small, meaningful Git commits. Both author and committer must be **Taan1el <taaniel.vananurm@gmail.com>**. The local repository already configures this identity and has no remote. Do not add additional contributor trailers or infer publication.

I eventually want the game in my OS. Keep the host interface usable. Establish the target OS and available JavaScript/WebGL or WebView runtime before implementing a wrapper or port.

## Current game

**130,946 bytes**, SHA-256 1f60bee0124fb590cd224960d6107af20d908c8c9932c0b70fdd455fcfc8dbae. Opens directly from disk without networking. See the verification report for precise browser-run versions, durations, measurements and retained failures.

The old rural branch line now has compact paper notices, soot/brass instruments, mountain ridges, 220 trees, fields/fences, pitched roofs, an open locomotive cab, moving foliage/grass, flickering boiler fire, drifting smoke/clouds and warm lamp lighting. There are three services: goods, passengers and free running. Goods choices are mixed farm freight, heavier timber or prompt mail. Passenger stops require four seconds stopped before service. Free running has no delivery obligation.

B adds coal; V whistles; fire/pressure affect pull. Slow for the bridge and farm crossing, whistle beforehand, and read earned fares/driver rating in the journal ledger. Stops refill coal/water. Settings offers an automatic fireman and whistle volume/mute. J opens six saved walking notes and destinations; C switches cab/chase, F centres the train camera. Original arrival guidance, safe collision and deliberate reverse recovery remain.

The original 17-check specification was completed earlier. Current focused coverage is **52 passing checks**, plus the packaging audit. Current browser coverage and complete circuits are itemized in the report; earlier passed runs are retained as historical evidence rather than claimed as tests of every later change. No unattended automation is active.

## File map

| File | Purpose |
|---|---|
| outputs/next-stop.html | Complete game, the only runtime file |
| outputs/NEXT_STOP_BUILD_PROMPT.md | Detailed original spec and accepted improvement amendments |
| outputs/NEXT_STOP_VERIFICATION.md | Current results, version scope and limits |
| outputs/NEXT_STOP_PREVIEW.png | Documentation screenshot, not a game asset |
| work/src/world.js | Versioned terrain, route, primitives, collision, train forces, cameras, deliveries and simulation saves |
| work/src/journey.js | Pure delivery/exploration arrival guidance |
| work/src/exploration.js | Safe foot landmarks, notes, destination and journal validation |
| work/src/railway.js | Steam, service/cargo choices, crossings, fares and portable driver ledger |
| work/src/renderer.js | Raw WebGL2 numerical scene queries and cell/display passes |
| work/src/app.js | Input, fixed-step loop, UI, synthesized whistle, save integration and host lifecycle |
| work/src/shell.html | Inline themed HTML/CSS and assembly placeholder |
| work/build.cjs | Source assembly and 2 MB bound |
| work/run-cycle.cjs | Dedicated-process full offline circuit with reverse, orbit and all six discoveries |
| work/playtest-cycle.cjs | Real-input driving and obstacle-aware walking helper |
| work/playtest-passenger.cjs | Actual passenger boarding wait, fare and free-running interactions |
| work/playtest-rural-ui.cjs | Cargo selection, keyboard/mobile/audio, JSON/host saves, legacy import and context/lifecycle |
| work/qa/ | Focused regressions, packaging audit and historical reviews |
| .omx/plans/, .omx/state/, .omx/evidence/ | Local plans, QA inventory and browser evidence, ignored by Git |

Development files and screenshots are not runtime dependencies. Edit source and rebuild, never only the generated HTML.

## Architecture to preserve

- Authoritative terrain is a seeded 129 by 129 height array. CPU and renderer share its bilinear surface. Train/carriages use a closed cumulative-arc-length route.
- Generation **1** preserves the original world. Generation **2** preserves the rural terrain/tree layout. New worlds default to **3**, adding pitched roof records and the open cab. For NEXT-STOP, checksums are 4bd6b452 / 190dfd5a / 0d37a594 respectively. Restore the explicit saved world version.
- Simulation remains independent of DOM/WebGL with fixed 60 Hz updates and bounded catch-up. Step the railway module before simulation so traction and predicted stopping use current pressure/cargo load. Guidance integrates the same forces on an isolated descriptor.
- The scene pass runs at glyph-grid resolution into three RGBA8UI attachments. The display pass expands numeric 5 by 7 glyph masks. Numerical textures contain world data, not pictures.
- Primitive types: 0 box, 1 ellipsoid, 2 numerical pitched prism. The prism interval clips two roof planes. Foliage displacement is cosmetic; static trunks remain authoritative collision. Materials 12 foliage, 17 gaslamp, 18 fire, 19 smoke, 20 red lamp and 23 locomotive soot supplement the original palette.
- Budgets remain 256 uploaded records, 192 terrain traversal cells, 48 shadow objects and one reflected query with smaller limits. Static capacity is 256 minus actual dynamic count; changes invalidate selection. Dynamic records come first. Smoke adds real dynamic records, so do not restore a hard-coded train reservation.
- F changes yaw/pitch and clears camera smoothing without changing train motion. Final smoothed chase positions must clear station solids. The new cab eye belongs inside the open frame.
- Goods/passenger stops take priority over journal choices. After service, a selected note supplies exploration station guidance. Discovery requires foot mode. Menus freeze gameplay state.
- App saves extend version-1 simulation saves with exploration and railway objects. Missing exploration means a legacy empty journal; missing railway gives an automatic fireman and preserves legacy train behavior. Missing cargo defaults to mixed. Validate candidate world, simulation, exploration and railway before replacing live references or GPU world data.
- Steam, water/coal, crossing performance, service, cargo, fares, stop times and notes travel through JSON and host saves. Volume/mute are local interface preferences for the current app instance.
- window.NextStop.create({canvas, host}) exposes start/pause/resume/resize/setInput/serialize/restore/destroy. Destroy cancels animation, removes listeners, releases GPU resources and closes synthesized audio.
- Keep explicit if/else box/roof normal branches. Intel Iris Xe ANGLE/D3D11 previously failed at draw time on a nested vector ternary; successful shader linking alone did not catch it.

## Checks

Run from the project directory:

    node work/build.cjs
    node work/qa/world-regression.cjs
    node work/qa/journey-guidance.cjs
    node work/qa/exploration-regression.cjs
    node work/qa/railway-regression.cjs
    node work/qa/renderer-resources.cjs
    node work/qa/renderer-budget.cjs
    node work/qa/audit.cjs

Results: **15 + 8 + 7 + 12 + 5 + 5 = 52**. Use actual browser interaction and screenshots for changed visuals/UI.

After meaningful gameplay changes, run a complete real-time circuit with a fresh evidence name:

    node work/run-cycle.cjs next-improvement
    node work/playtest-passenger.cjs next-passenger
    node work/playtest-rural-ui.cjs next-ui

Run heavy browser playtests serially and in dedicated processes. Background promises between Node REPL calls previously lost control timing. R resets throttle, so apply W again after reversing. The walking helper now reads numerical surfaces to plan around solid buildings and then uses ordinary turn/walk keys; it never teleports or changes player state. A straight-line helper previously pressed forward into a correctly blocking station wall.

Audio assertions wait for scheduled gain changes to reach the audio timeline. Preserve failed attempts rather than hiding them. Development browser/runtime paths are machine-specific and should be adapted elsewhere without adding player dependencies.

The valley is finite, scene/reflection budgets remain bounded, touch controls and an OS wrapper are absent, and the target OS runtime is unspecified. Measured frame rates describe this machine/sample only. Historical reports under work/qa describe earlier builds; use current verification for present scope.
