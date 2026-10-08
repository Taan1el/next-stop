# Next Stop: Claude handoff

## Paste this into Claude

Continue developing **Next Stop** in:

C:\Users\crazy\Documents\Codex\2026-10-07\maybe-we-can-make-a-separate

Read this handoff, outputs/NEXT_STOP_BUILD_PROMPT.md, outputs/NEXT_STOP_VERIFICATION.md and applicable workspace instructions. Continue from the working game and readable sources; inspect recorded evidence before changing behavior.

Keep the player deliverable **one offline HTML file**, vanilla JavaScript and custom WebGL2. Generate numerical world data and resolve glyph IDs plus colours directly into cells. No images, imported models, game engine, runtime libraries, external requests or image-to-ASCII filter. The HTML may grow to **2,000,000 bytes**; add useful behavior rather than padding.

Work in playtest-and-improve cycles during this session. Start with a short plan and concrete acceptance criteria. Play through normal controls, inspect screenshots, fix the highest-value observed problem, rebuild and repeat relevant checks. When ideas run dry, ask a specialist or player-persona agent to critique the game and choose a useful improvement. Distinguish actual playthroughs from source/screenshot reviews. Keep failed evidence and explain its cause. Do not schedule recurring work unless I explicitly request it.

Edit work/src/, rebuild outputs/next-stop.html, and preserve the train circuit, walking, journal, saves, renderer and host lifecycle. Record evidence under .omx/ and update this handoff and the verification report after meaningful changes. Complete authorized implementation and verification without stopping merely to propose the next patch.

I eventually want the game in my OS. Keep the host interface usable. Establish the actual target OS and available JavaScript/WebGL or WebView runtime before implementing its wrapper or port.

## Current baseline

**106,337 bytes**, SHA-256 8bfff4e19e89c354fbb9728f314c3592228bcbee78d064e44b150b89c370ccd7. Opens directly from disk with networking disabled.

The original 17-check specification is complete. This session passed three full keyboard circuits, including a 362.372-second run with three deliveries, overshoot/reverse recovery, camera orbit and journal 3/3. A further 116.401-second Chrome leg imported a real completed legacy save, selected Bellweather, used F and cab/chase, drove/stopped and collected/exported its note. That leg and final host/context checks tested the current artifact; the full circuit preceded the F-only addition.

The game has a seeded valley, analytical buildings/trees, lake/bridge, three stations, locomotive/two carriages, walking/collision, cab/chase, daylight/weather, bounded reflections, JSON saves, keyboard menus, quality settings, recovery and host interface. New feedback predicts braking from actual grade/power. J opens saved notes and destinations; selected places guide the train after deliveries. F centres the camera. Station camera clearance and dynamic primitive reservation are fixed.

See the verification report for scope, measurements and retained failed harness attempts. No unattended automation is active.

## File map

| File | Purpose |
|---|---|
| outputs/next-stop.html | Complete game; only required runtime file |
| outputs/NEXT_STOP_BUILD_PROMPT.md | Detailed spec, 17 original checks and improvement amendment |
| outputs/NEXT_STOP_VERIFICATION.md | Current results and limits |
| outputs/NEXT_STOP_PREVIEW.png | Documentation screenshot |
| work/src/world.js | World, route, collision, train forces, cameras, deliveries, simulation saves |
| work/src/journey.js | Pure delivery/exploration guidance |
| work/src/exploration.js | Safe landmarks, foot discovery, destination, validated journal saves |
| work/src/renderer.js | Raw WebGL2 numerical scene queries and cell/display passes |
| work/src/app.js | Input, fixed-step loop, UI, journal/save integration, host lifecycle |
| work/src/shell.html | Inline HTML/CSS and assembly placeholder |
| work/build.cjs | Assembly; 2 MB bound |
| work/run-cycle.cjs | Dedicated-process full offline circuit with reverse/orbit/journal |
| work/playtest-exploration-leg.cjs | Legacy import, selected station and night exploration |
| work/playtest-final-host.cjs | Journal/host/context/lifecycle check |
| work/qa/ | Focused regressions, packaging audit, historical reviews |
| .omx/plans/, .omx/state/, .omx/evidence/ | Plans, QA inventory, browser evidence |

Development files and screenshots are not runtime dependencies. Edit source and rebuild instead of changing only generated HTML.

## Architecture to preserve

- Authoritative terrain is a seeded 129 by 129 height array; CPU and renderer share its bilinear surface. Train motion uses a closed cumulative-arc-length route; each carriage samples its own distance.
- Simulation stays independent of DOM/WebGL with fixed 60 Hz updates and bounded catch-up. Stopping prediction reuses train-force integration on an isolated descriptor, without mutating live state.
- The scene pass runs at character-grid resolution into three RGBA8UI attachments. The display pass expands numeric 5 by 7 glyph masks. Numerical textures contain data, not pictures.
- Budgets are 256 uploaded records, 192 terrain traversal cells, 48 shadow objects and one reflected query with smaller limits. Static capacity is 256 minus actual dynamic count; capacity changes invalidate selection. Dynamic objects come first.
- F changes yaw/pitch and clears camera smoothing without changing train motion. Final smoothed chase positions must clear station solids.
- Cargo stops take priority over a journal choice. After deliveries, the selected place supplies the exploration station. Discovery is foot-only and freezes when menus pause the game.
- App saves extend version-1 simulation saves with exploration: {version:1, visited:[ids], selected:null|id}. Missing exploration is a legacy empty journal; older journal saves may omit selected. Validate candidate world, simulation and journal before swapping references or GPU world state.
- window.NextStop.create({canvas, host}) exposes start/pause/resume/resize/setInput/serialize/restore/destroy. Host readSave/writeSave and manual JSON must preserve the journal. Destroy cancels animation, removes listeners and releases GPU resources.
- Intel Iris Xe ANGLE/D3D11 once failed at draw time on a nested vector ternary for box normals. Explicit if/else branches work. Preserve this fix and check actual drawing after shader changes; linking alone did not catch it.

## Checks

Run separately from the project directory:

    node work/build.cjs
    node work/qa/world-regression.cjs
    node work/qa/journey-guidance.cjs
    node work/qa/exploration-regression.cjs
    node work/qa/renderer-resources.cjs
    node work/qa/renderer-budget.cjs
    node work/qa/audit.cjs

Current focused results: **15 + 8 + 7 + 5 + 5 = 40 passing checks**, plus packaging audit. Use actual browser interaction and screenshots for changed rendering/UI.

After gameplay changes, run a complete real-time circuit with a fresh evidence name:

    node work/run-cycle.cjs 09-next-improvement

Run long playthroughs in a dedicated process. Background promises between Node REPL calls previously lost control timing while the browser kept moving. R resets throttle, so reverse tests must apply W again. Scripts use machine-specific bundled Playwright and Edge/Chrome paths; adapt development paths elsewhere without adding player dependencies.

Night and host scripts use recorded saves from prior evidence. Inspect those prerequisites and choose fresh evidence folders when repeating them.

The finite world, rendering/reflection budgets, absent touch controls and unspecified OS runtime remain limits. Measured 60 FPS is not a universal guarantee. Historical work/qa reports describe earlier fixes; current verification and state inventory describe present status.
