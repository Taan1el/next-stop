# Next Stop: detailed Codex build prompt

Copy this document into Codex when ready to build. This prompt targets the selected first version: explore a procedural world and drive a train. Future OS integration is an architectural requirement; the first delivery runs locally in a browser.

## 1. Objective

Build **Next Stop**, a playable, real-time 3D railway exploration game whose world is displayed entirely as coloured character cells.

The player explores a generated valley, boards a train, drives between three stations, and completes a small delivery circuit while daylight, weather, water reflections, and lighting change live.

Deliver the complete playable application as **one self-contained `next-stop.html` file**. It must work when opened directly from disk in a supported browser with the network disabled. All application code, CSS, shaders, glyph definitions, and initial world data must be inline.

Treat this as an implementation task. Build, inspect, fix, and verify the game through completion. Begin with a short implementation plan and the main technical tradeoffs. Inspect existing workspace instructions and files before editing. Use reasonable defaults for routine choices; ask only when a missing detail prevents useful progress or changes a hard requirement.

## 2. Hard requirements

- One HTML file is sufficient to launch and play. No installation, build step, server, or internet connection is required by the player.
- Use vanilla JavaScript, inline CSS, and a custom WebGL2 renderer with inline GLSL.
- No Unity, Godot, Unreal, Three.js, Babylon.js, rendering frameworks, physics engines, or other runtime libraries.
- No image assets, image files, image atlases, embedded image payloads, SVG artwork, downloaded fonts, videos, or imported 3D models.
- No conventional scene rendered to an image and converted into ASCII afterward. No screenshot, image sampling, or luminance-to-ASCII postprocessing pipeline.
- Generate the world as numerical data: terrain heights, materials, object descriptions, route samples, weather state, and entity transforms.
- Render that data directly into a character grid. Each cell must have a selected glyph and colours before the final display pass.
- World visuals, including sky, terrain, buildings, water, train, rain, and reflections, must follow the glyph-cell presentation. Menus and accessibility text may use ordinary HTML text.
- No runtime network access, CDN requests, external scripts, external stylesheets, imports, analytics, or required companion files.
- Keep the source readable and organised. A single file must still contain clear internal boundaries.

Mathematical geometry is allowed: heightfields, boxes, cylinders, planes, capsules, and other analytical shapes described by numbers. Small triangles used to execute a screen or cell display pass are allowed. The restriction concerns conventional world models and the image-to-text pipeline.

Numeric GPU textures and buffers are allowed for terrain values, object records, character records, and embedded glyph bit masks. These are data structures, not imported pictures. Do not interpret “no images” as “no GPU data storage.”

## 3. First playable scope

Build a bounded, coherent valley rather than an unlimited world. Suggested starting size: approximately 1 km across, adjustable after profiling.

Include:

- Hills, grassland, exposed rock, shoreline, and a river or lake.
- Three visibly distinct stations connected by one continuous railway loop.
- A bridge, a few clusters of buildings, trees, and useful landmarks.
- One locomotive and two carriages, constructed from analytical numerical primitives.
- Walking near stations, boarding the locomotive, driving, and leaving the train when stopped.
- Cab and chase cameras while driving, plus an optional exploration camera.
- A seed field that regenerates the same world from the same seed and generator version.
- Daylight progression and clear, rainy, and foggy weather with smooth transitions.
- Moving water appearance and live reflections.

The first gameplay loop:

1. Start beside the train at Station A with a short, visible objective.
2. Board and collect a delivery.
3. Drive to Station B and stop inside its platform zone.
4. Confirm the delivery while nearly stationary, then receive the next destination.
5. Visit Station C and return to Station A.
6. Display circuit completion and allow continued exploration or a new seed.

Aim for a complete circuit lasting roughly 5–10 minutes. Make the first departure and objective understandable within the first minute. Choose station spacing, speed, and acceleration together to support this pace.

Keep multiplayer, combat, crafting, terrain editing, complex NPCs, branching rail networks, derailment simulation, and an economy outside this first version. Optional additions must not delay the required playable circuit.

## 4. Rendering architecture

Use a **two-pass, character-first renderer**.

```text
seed + numerical world + simulation state + camera
    -> scene queries at character-grid resolution
    -> glyph ID + foreground/background colour per cell
    -> embedded glyph-mask display pass
    -> WebGL canvas
```

### Pass A: resolve character cells

Render into a framebuffer sized to the character grid, not the full display resolution. For each cell:

1. Construct a camera ray through the cell centre using the actual viewport aspect ratio.
2. Query the authoritative terrain and numerical objects.
3. Resolve the nearest visible surface or procedural sky.
4. Determine material, hit position, normal, distance, and relevant structural features.
5. Calculate bounded lighting, shadowing, fog, and water reflection where applicable.
6. Select the glyph using material, orientation, structural pattern, and illumination.
7. Write the selected glyph ID and its foreground/background colours as numeric cell state.

Glyph choice may respond to brightness, but it must derive from the scene query itself. Do not first produce an ordinary scene-colour picture and run a separate character-selection filter on it.

Use supported integer or normalised colour attachments for cell state. A practical option is packed `RGBA8UI` records with matching integer shader outputs and samplers. Check framebuffer completeness during setup, use exact cell lookup, and disable blending for integer targets. Avoid making optional floating-point render-target extensions a prerequisite. See the [WebGL2 specification](https://registry.khronos.org/webgl/specs/latest/2.0/) for format and API rules.

### Pass B: display glyphs

For each output pixel, identify its cell, read the selected cell record, and evaluate the corresponding glyph mask. Draw the mask using that cell's colours.

Embed a small custom ASCII repertoire as numeric row bit masks. For example, store seven five-bit rows for a 5×7 character, with spacing inside an 8×12 display cell. Include recognisable characters such as ` .,:;-=+*#%@/\\|_` and enough letters and digits for diagnostics. Do not depend on a browser font to draw the world.

The display shader must only expand existing glyph state. It must not repeat world ray traversal for every pixel of a glyph, or infer characters from neighbouring image pixels.

At a 1280×720 viewport, 8×12 cells give a 160×60 character grid. Derive row and column counts from viewport dimensions and cell proportions. Do not use the column/row ratio as the camera aspect ratio. Handle partial edge cells consistently and keep proportions correct during resizing and display scaling.

Provide coarse, standard, and fine cell-size presets. Keep the world recognisably textual: meaningful character shapes, restrained palettes, readable silhouettes, and stable material patterns. Avoid filling every cell with a solid block that hides the glyph design.

### Scene-query rules

Use bounded heightfield traversal with reliable hit refinement and analytical intersections for objects and water. Do not treat vertical height error as a true signed-distance field and blindly sphere-trace it; that can skip steep terrain. Apply spatial bounds so each ray only considers relevant nearby objects and rail sections.

Use one authoritative CPU-generated terrain, route, and object dataset. Upload numerical arrays to the GPU. Rendering, collisions, station placement, and train grade must agree. Avoid independent CPU/GPU terrain-noise implementations that produce different surfaces.

## 5. World generation

Use a seeded integer PRNG. Generate named numerical records for terrain, materials, buildings, trees, railway, stations, and spawn points. Prefer typed arrays for bulk data.

Generate a feasible rail corridor before final terrain shaping. Smooth the route, constrain grade and curvature, then create cuts, embankments, and bridge spans where needed. The track must not pass through random buildings, impossible slopes, or water without a bridge.

Build an arc-length lookup table for the railway. Store stations as distances along the route. Give every carriage its own route-distance offset so carriages follow curves and slopes correctly.

Use a shared terrain sampler and documented interpolation rule for CPU collision and GPU scene queries. Keep water level, bridge deck, building bounds, and walking surfaces consistent with visible geometry.

Include a readable boundary treatment and a recovery action that returns the player or train to a safe station. Avoid unbounded coordinates, primitive counts, or memory growth.

Recreating a seed with the same generator version must reproduce the world descriptors. Save the seed and generator version; do not promise bit-identical GPU pixels across different hardware.

## 6. Simulation, train, and cameras

Use a fixed simulation step, preferably 60 Hz, with an accumulator, bounded catch-up, and interpolated presentation. Cap elapsed time after interruptions. Pause when the document is hidden or the host requests it. Clear input on focus loss to prevent stuck movement.

Train state includes route distance, speed, throttle, brake, direction, and delivery progress. Approximate longitudinal motion using traction, braking, rolling resistance, aerodynamic drag, and track grade:

```text
acceleration = (traction - braking - rolling resistance - drag) / mass
               - gravity * track grade
```

Apply force signs correctly. Braking must bring the train to rest without causing an unintended reverse movement. Account for static rest on a slope. Use route constraints and consistent units rather than a general rigid-body solver.

Provide smooth acceleration, useful braking distance, a speed limit, forward/reverse selection while stopped, and predictable station stopping. The train and carriages must remain aligned with the same railway data used by the renderer.

Walking requires terrain height, simple solid-object collision, bridge/platform support, sensible movement speed, and a safe spawn. Jumping is optional.

Cab and chase cameras need smooth motion, clamped pitch, consistent field of view, and stable behaviour when switching modes. Prevent the chase camera from sitting inside terrain or the train. Keep camera effects restrained; provide a reduced-motion option.

## 7. Light, weather, and water

Implement a moving directional sun, ambient sky light, distance fog, lit station windows after dusk, and a train headlamp. Use a strict budget for shadow queries. Near-object shadows should communicate depth without requiring expensive global illumination.

Weather must change the actual scene appearance: cloud/sky colours, fog distance, lighting, and bounded glyph-based rain. Use deterministic particles or cell overlays with depth-aware visibility so rain does not indiscriminately obscure the cab and buildings. Supply weather selection for verification as well as automatic transitions.

Water uses a defined surface level and animated procedural wave normals. For visible water cells, perform at most one bounded reflected scene query. Include nearby shoreline/buildings and the moving train when in range, with procedural sky fallback for distant or missed reflections. Mix reflection and water material in a view-dependent way, then select the final water-cell appearance.

Reflections must respond to camera position, scene movement, and time. No static reflection picture, screen-colour-to-ASCII filter, recursive reflection chain, or full fluid simulation. Name these effects accurately in documentation.

## 8. Controls and interface

Use a small, legible HTML overlay for start/pause, help, settings, objective, and status. Avoid filling the display with implementation details. Display speed, throttle, brake, next station, delivery status, and current seed where useful.

Suggested controls:

- On foot: WASD moves; mouse looks after click-to-capture; E boards nearby train.
- Driving: W/S changes throttle; Space brakes; R changes direction while stopped; C switches camera.
- E confirms station delivery or leaves the train, with a visible context hint and safe speed restriction.
- Esc releases mouse capture and opens pause; a visible Resume button restores play.
- H opens help; provide a settings button and a recovery action.

Make action priority explicit so E cannot accidentally deliver and disembark together. Include mouse-drag or keyboard-look fallback when pointer lock is unavailable. Request pointer lock only from a player action and handle rejection. Do not require fullscreen. See [pointer-lock documentation](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock).

Include keyboard-accessible menus, visible focus, scalable HUD text, high-contrast colours, reduced motion, and a text objective that does not rely on colour alone.

## 9. Save/load and later OS integration

Use a versioned JSON save containing world seed/version, simulation time, weather state, player mode and position, train state, settings, and delivery progress.

Offer Save Export and Save Import through browser download and file input. Guard optional browser storage so failure does not prevent play or manual save/load. Validate imported data, version, size, numeric ranges, and route references before restoring it. Apply a save only after it passes validation.

Browser storage behaviour under `file://` is not guaranteed; manual JSON export/import is therefore part of the required portable save path. See [localStorage documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

Keep clear internal sections or classes for `WorldGenerator`, `Simulation`, `Train`, `Camera`, `Input`, `GlyphRenderer`, `UI`, and `HostAdapter`. World generation and simulation must not depend on DOM elements or WebGL objects.

Expose an instance-oriented entry point, for example:

```js
const game = window.NextStop.create({ canvas, host });
game.start();
game.pause();
game.resume();
game.resize(width, height);
game.setInput(inputState);
const save = game.serialize();
game.restore(save);
game.destroy();
```

The host adapter can supply persistence, input, lifecycle notifications, and diagnostic logging. Default browser behaviour must work without a custom host. Ensure `destroy()` stops animation, removes listeners, and releases GPU resources; re-creating an instance must not double the simulation.

Deliver the browser application first. Document how these boundaries support later embedding in an OS application or WebView. If the target OS has no compatible JavaScript/browser/WebGL runtime, actual integration will require a runtime or a renderer/platform port. Do not promise that an HTML file runs directly on an arbitrary OS, and do not add desktop wrappers or privileged OS access in this build.

## 10. Performance and failure handling

Aim for 60 FPS at standard glyph resolution on the development machine; provide a lower-quality setting targeting at least 30 FPS. These are measured targets, not universal hardware guarantees.

Keep work bounded by character count, view distance, local primitive counts, shadow rays, and reflection rays. Cache static world data; reuse typed arrays and GPU resources. Avoid per-frame GPU readback and unnecessary allocations. See [WebGL performance guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) for blocking calls and resource constraints.

Provide a diagnostics toggle with character-grid dimensions, frame-time statistics, active quality, and useful scene budgets. Optional automatic quality changes must use hysteresis, respect manual settings, and leave physics unchanged.

Handle shader failures with readable diagnostics. When WebGL2 is unavailable, show a clear message instead of a blank screen. Handle context loss by pausing presentation; on restoration, recreate GPU resources from CPU state and continue safely. Resize without stretching glyphs or regenerating the world.

Optional audio may use Web Audio synthesis after a player action. Include mute and volume controls if audio is implemented. Audio must not become a required external asset or block gameplay.

## 11. Implementation stages

Work in small, reviewable batches, keeping the application runnable after each stage. Maintain a concise plan and verification notes under `.omx/` when available.

1. **Character renderer:** offline shell, WebGL setup, embedded glyphs, two-pass cell state, camera, seeded terrain, resize, and diagnostics. Verify the direct glyph pipeline before adding game systems.
2. **World and walking:** coherent valley, railway corridor, stations, buildings, water, collision, and safe spawn.
3. **Train and playable circuit:** route table, train forces, carriage transforms, boarding, cameras, station detection, deliveries, and completion.
4. **Live atmosphere:** daylight, shadows, headlamp, windows, fog, rain, animated water, and bounded reflections.
5. **Portability and polish:** saves, host interface, accessible menus, settings, recovery, failure handling, and measured performance.
6. **Final verification:** offline local launch, complete route, visual checks, save round trip, resize/lifecycle checks, and source audit.

Use independent work lanes when they help, with clear ownership and coordinated changes to the shared HTML file. Do not let parallel agents overwrite one another. Finish required stages before optional features.

## 12. Acceptance checks and delivery

Verify with browser interaction, visual inspection, and focused checks for the risky generation/simulation rules. Source inspection alone cannot prove rendering or gameplay works.

The build is complete when:

1. `next-stop.html` opens directly from disk with the network disabled and reaches a playable state.
2. Runtime inspection shows no application network requests or external dependencies.
3. Source audit finds no image assets, imported models, engines, or image-to-ASCII pipeline.
4. The grid-sized scene pass emits glyph IDs before the display pass. A debug cell view exposes selected IDs, and visible world surfaces remain character-based.
5. Identical seed/version reproduces world descriptors; different seeds visibly change the world.
6. Terrain, platforms, bridges, stations, and train agree between rendering and simulation.
7. The player can walk, board, accelerate, brake, stop at all stations, deliver cargo, finish the circuit, and leave safely.
8. Carriages follow curves and grade without cutting straight across the route.
9. Physics remains consistent across different presentation frame rates, pause/resume, and focus loss.
10. Daylight and weather visibly alter the scene. Water reflects a visible moving object or shoreline from an appropriate test camera.
11. Resize and quality changes preserve camera proportions, glyph proportions, and game state.
12. JSON export/import restores the world, train, player, and progress. Invalid saves produce a readable error and preserve the current game.
13. Missing WebGL2, rejected mouse capture, shader errors, and context loss have useful handling. Mark any failure case that could not be exercised.
14. Menus work by keyboard; help, pause, reduced motion, recovery, and save controls are discoverable.
15. A timed playable run reports median and slow-frame timing, browser version, viewport, cell grid, and quality setting. Report available hardware information without inventing it.
16. No unresolved application JavaScript exceptions, shader compilation/link failures, or observed WebGL errors remain in the tested run.
17. Host lifecycle and serialization interfaces exist and can be exercised without requiring OS packaging.

Deliver:

- The final, readable **`next-stop.html`**, containing brief embedded launch and controls instructions.
- A short completion report with the file path, implemented features, verification evidence, measured performance, and any remaining limitations.
- Optional development notes and tests may remain in the workspace, but the player must need only the HTML file. Optional user save files are data, not runtime dependencies.

Do not mark untested checks as passed. If browser tooling or another external limitation prevents a check, state what remains unverified and preserve the runnable deliverable. Otherwise continue fixing and verifying until the required game works. Do not stop at a static ASCII scene, renderer demo, or implementation plan.

## 13. Authorized improvement-session amendment

The initial playable specification is complete. Continue from the existing implementation in playtest-and-improve cycles when asked; preserve all original rendering and portability requirements.

- The standalone HTML may grow to **2,000,000 bytes**. Treat this as a ceiling, not a target to fill.
- Run complete circuits through ordinary keyboard input, capture representative scenes, and inspect arrival feedback, camera behavior, exploration, saves and performance.
- Improve observed problems in focused batches, rebuild and verify affected behavior. Use a specialist or player-persona agent when useful improvement ideas are unclear; label source/screenshot reviews separately from actual playthroughs.
- Preserve failed evidence and distinguish harness problems from game failures. Long real-time browser control loops should run in a dedicated process.
- Preserve old saves. New journal discoveries and selected destinations must validate atomically and travel in both JSON files and host saves.
- Keep current controls documented, including J for the journal and F for train-camera centring. Cargo stops take priority over journal destinations until deliveries finish.
- Update the verification report, preview and Claude handoff after meaningful changes, recording artifact size/hash and the version each browser run actually loaded.
- The user's selected scope is **this session only**. Do not create recurring automation without new authorization.

The current build and completed improvement evidence are documented in NEXT_STOP_VERIFICATION.md. Future work should recheck affected behavior rather than treating this prompt as test evidence.


## 14. Rural railway renewal amendment

The player selected all three directions: light steam management, passenger/cargo work and relaxed exploration. Continue from this implementation, retaining a gentle branch-line pace and the original single-file/direct-glyph requirements.

- Match an old rural railway: station-paper menus, restrained serif/typewriter text, soot and brass instruments. Keep the centre of the world visible and move detailed controls/settings into paused menus.
- Give scenery depth through generated mountain ridges, woods, fields, fences and pitched country roofs. Retain safe rail grade, terrain/collision agreement and deterministic world versions so original saves still recreate their own landscape.
- Make glyph-rendered scenery visibly alive: analytical wind displacement of foliage, moving grass detail, flickering fire, drifting smoke/clouds and warm lamp light. Avoid imported animation, image textures, models or a post-render text filter.
- Keep steam operation understandable: coal firing, pressure-dependent pull, a whistle, bridge/crossing instructions, station resupply and a saved driver ledger. Offer an automatic fireman for relaxed travel. Synthesized whistle audio needs volume and mute controls and starts only after player action.
- Offer goods, passenger and free-running service. Goods choices should affect manifests, pull or earnings; passenger service should require a stopped boarding wait; free running should remove job obligations while preserving ordinary train interactions.
- Provide six foot discoveries with saved notes and selectable destinations. Visiting a place is actual on-foot play, not progress granted from a passing train.
- Verify normal controls, station work, deliberate overshoot/reverse recovery, camera clearance, walking routes, animated cells, offline rendering, paused menus, narrow layout, file/host saves and context restoration. Keep failed evidence, report causes honestly, and distinguish reviews/render inspections from complete playthroughs.
- Use a local Git repository with small meaningful commits. All author and committer identities must be Taan1el <taaniel.vananurm@gmail.com>; do not add other contributor trailers or infer remote publication.

The 2,000,000-byte ceiling and this-session-only playtest scope remain in force. See the verification report for the exact delivered artifact and measured results.

## 15. Structural detail, colour and feedback amendment

Refine the existing rural railway rather than changing its genre. Keep the numerical glyph renderer and offline single HTML.

- Make the locomotive read as a working steam engine: capped cylindrical boiler, flared chimney, domes, brass/copper pipes, buffers, divided cab, pressure gauges, spoked wheels, crank pins and animated coupling/piston rods. Derive mechanism phase from signed unwrapped travel so reverse and route wrap remain continuous; stop/pause must freeze the mechanisms.
- Give stations and country houses true triangular gables, masonry/siding, slate courses, framed glazing, doors, sills, chimneys, station canopies, furniture, a tower clock and nameboards formed directly from numeric glyph masks. Leave station spawns and walking routes safe.
- Add colour through warm highlights, cool shadow/sky bounce, material gradients, brass reflections and distant aerial haze. Keep each surface represented as coloured glyph cells. Stars use fixed celestial directions, with no positional parallax from walking; turning the camera changes their projection.
- Use appropriate feedback: synthesized steam rhythm tied to wheels, rail-joint clicks, whistle and station bells; earned shillings/service ratings in restrained notices; small button response with reduced-motion support. Existing services, coal/pressure, crossings, boarding waits and exploration supply the core loop. Do not indiscriminately copy arcade targets, combos or screen shake into this quiet railway.
- Checkpoint locally during play and on pause. Offer an explicit Continue action on reopening. Keep fresh starts, portable JSON and host saves usable when storage is denied. Corrupt checkpoints must not replace valid live state.
- Preserve numerical world generations 1/2/3; version 4 carries the detailed structures and train. Keep close-detail LOD and actual dynamic reservation within the existing 256-record renderer budget.
- Verify actual controls, moving/stopped/paused mechanisms, each service/cargo, old-save import, shader drawing, sky translation/rotation, audio mute/volume, checkpoint continuation/storage denial, and a complete offline circuit with six foot discoveries. Distinguish rendering fixtures from ordinary-input playthroughs, report exact loaded artifact versions and retain failed evidence.

Keep small commits authored and committed solely by Taan1el <taaniel.vananurm@gmail.com>. The file-size ceiling remains 2,000,000 bytes; use the available room for worthwhile detail rather than padding.
