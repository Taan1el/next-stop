# Architecture

Next Stop is vanilla JavaScript, inline CSS and raw WebGL2. The assembled HTML is the only runtime file. Numeric GPU textures hold scene data and glyph masks; they are not imported pictures.

## Source map

| File | Responsibility |
|---|---|
| [world.js](../work/src/world.js) | Seeded terrain, route, numerical primitives, walking collision, train forces, cameras, deliveries and simulation saves |
| [journey.js](../work/src/journey.js) | Grade/power-aware station approach and braking guidance |
| [exploration.js](../work/src/exploration.js) | Safe foot landmarks, notes and selected destinations |
| [railway.js](../work/src/railway.js) | Steam, services, cargo, crossings, fares and station supplies |
| [village.js](../work/src/village.js) | Station jobs, partial work, reward receipts, reputation, paint ownership and nearby numerical props |
| [renderer.js](../work/src/renderer.js) | Numerical scene queries, glyph records and display pass |
| [app.js](../work/src/app.js) | Input, fixed-step loop, menus, synthesized sound, storage and host lifecycle |
| [shell.html](../work/src/shell.html) | Interface, styles and assembly placeholders |
| [build.cjs](../work/build.cjs) | Assembly, embedded license and the 2,000,000-byte bound |

## Scene to glyphs

The scene pass runs at character-grid resolution. Analytical ray queries resolve terrain and solids into three RGBA8UI attachments: glyph/material/depth, foreground and background. The display pass expands embedded 5×7 numerical masks. Glyph selection happens before final display, with no image-to-text stage.

Terrain is a seeded 129×129 height array. CPU and GPU share bilinear sampling. Object records describe boxes, ellipsoids, legacy roof prisms, capped elliptical cylinders, pitched boxes and triangular gables. Materials add numerical masonry, siding, glazing, slate, metal, wheel spokes, instruments and cargo detail.

Budgets are explicit: 256 uploaded records, 192 terrain traversal cells, 48 shadow objects and one reflected scene query with reduced limits. Dynamic shapes reserve their actual count before static selection. Close details use distance LOD; chimney smoke is bounded. Stars are fixed celestial directions projected from camera orientation, independent of camera position.

Nearby village props share the dynamic reservation. Their work anchors are checked against existing walking collision; decorative porters and noticeboards add no new solid bounds. Night shading combines directional moonlight, warm station pools, an optional foot lantern and a bounded midtone lift. Refilled lamps strengthen their station pool. Boiler paint changes the numerical material palette while retaining its detail.

## Simulation and presentation

Simulation uses fixed 60 Hz updates with bounded catch-up. Railway state updates before train forces and arrival guidance. Route samples use cumulative 3D arc length; carriages follow independent route offsets.

Version-4 wheels use signed unwrapped travel, interpolated before radius-specific phase calculation. Reverse and route wrap remain continuous. Wind, flames, smoke and other cosmetic motion do not move authoritative tree trunks or station collision. Paused menus freeze game state.

New worlds use generation 4. Earlier generations retain their numerical descriptors. NEXT-STOP seed checksums are 4bd6b452 / 190dfd5a / 0d37a594 / 63514cfa for generations 1–4. Changing an existing generation requires explicit compatibility planning.

## State and sound

Candidate world, simulation, exploration, railway and village saves validate before replacing live references. Older saves without newer fields receive compatible defaults. Village state is omitted until used, preserving untouched legacy exports. Partial letters and parcels are mutually exclusive. Village receives the candidate railway before validation, so fares and work receipts determine one purse after paint and equipment purchases. Local checkpoints are optional; portable JSON export/import and an explicit host adapter remain available.

Railway version 1 retains its existing per-service fields and adds an optional `career` record only after starting another service: banked fares, completed services and the current start time. Starting a service resets its ledger and delivery circuit, preserving the world, simulation time, wheel travel and carried parcel. Mail bonuses use elapsed service time. Fares are banked once, not copied into village receipts.

Village version 1 remains readable and export-compatible. Version 2 is used after work renewal or a boots purchase; it adds `round`, `pastEarnings`, `pastCompleted`, `renewedServices` and `gear`. Renewal banks completed repeatable receipts before clearing them, retains completed lamps, and rotates deterministic letter orders. One completed service unlocks one renewal; alternatively all repeatable jobs must be done. Active parcels/letters and lamp work block renewal. Railway parcels have fixed next-station destinations and require an on-foot handover. Boots derive a walking multiplier rather than changing collision or world descriptors.

The Web Audio API synthesizes all railway sounds after a player gesture. Voices feed transport and master gains. Pause silences transport; volume/mute apply immediately. Destroy closes audio, cancels animation, removes listeners and releases GPU resources. Real context loss/restoration preserves game progress.

## Embedding

`window.NextStop.create({canvas, host})` exposes `start`, `pause`, `resume`, `resize`, `setInput`, `serialize`, `restore` and `destroy`. Optional `host.readSave`, `host.writeSave` and `host.onError` adapt persistence/errors. The current interface also expects the HTML shell's menu controls. An OS wrapper is not included.

Keep explicit shader normal branches: Intel Iris Xe ANGLE/D3D11 previously failed at draw time on a nested vector conditional despite successful shader linking. Actual drawing tests supplement source and resource checks.
