# Next Stop verification and improvement report

The playable game is **next-stop.html, 152,824 bytes**. It contains HTML, CSS, JavaScript, shaders, numeric glyph masks and the procedural world generator. Open it directly in a WebGL2 browser. No server, connection, installation, images, engine or runtime companion files are needed. This uses 7.64% of the 2,000,000-byte ceiling; the remaining budget is room for useful work, not padding.

SHA-256: 64b6277c424d461363f2da89c9575ba9faa2b3438b0adbf2bfe6d165a07aa3f6.

## Structural detail, colour and feedback

Version **4** refines the existing railway. The locomotive uses capped analytical cylinders, spoked wheels, quartered crank pins and moving coupling/piston rods, a flared chimney, domes, buffers, brass/copper pipes, divided cab and actual-pressure gauges. Passenger carriages, timber logs, a mail van and mixed farm goods have distinct numerical bodies/cargo. Wheel motion follows signed unwrapped travel, including reverse and route wrap; stopped/paused mechanisms freeze.

Buildings have true triangular gables, brick/siding variation, slate courses, framed glazing, doors, sills and chimneys. Stations add canopies, steps, furniture, a tower clock and readable nameboards emitted directly from numerical glyph masks. The default world has **1,492 static records and 220 trees**. Details use distance LOD, while chimney smoke is limited to the nearest three stacks; the renderer remains capped at 256 uploaded records.

Material gradients, warm highlights, cool ambient shadows, sky/ground colour bounce, metallic highlights and distant aerial haze give surfaces and landscape depth. Stars come from a fixed 64-direction celestial catalogue. Translating the camera leaves their projected cells unchanged; rotating it reprojects those same directions. Clouds can occlude them. All these values go directly into glyph IDs/colours.

The Web Audio API synthesizes wheel-linked steam pulses, rail-joint clicks, whistle and station bells. Pause silences the transport immediately; volume/mute apply immediately, with no stale scheduled gain. A served stop shows earned shillings and service rating. Buttons have restrained hover/press response; reduced motion disables the UI animations. The existing steam/service/crossing/exploration loop supplies choices and rewards appropriate to the rural railway.

Local progress checkpoints every ten seconds during play and on pause. **Continue last journey** restores it after reopening the file. Storage denial leaves play and portable JSON export usable; corrupt checkpoint data cannot replace valid live state. Host save operations remain explicit.

### Latest browser evidence

| Run | Loaded artifact | Coverage and result |
|---|---:|---|
| 21 detail/colour inspection | 152,808 bytes, world 4 | Passed cab/side/front/station/clock/name/night drawing, zero GL errors, real W/brake motion of wheel/rod records and paused freeze |
| 23 colour/feedback | 152,808 bytes, world 4 | Passed real-input steam/joint pulses, pause silence, fixed star translation/rotation, colour views, exact Continue, corrupt-checkpoint atomicity and storage-denied JSON export |
| 26 UI/audio repeat | **152,824 bytes**, world 4 | Passed immediate volume/mute, timber selection, frozen pause, keyboard ledger/focus wrapping, 390×844 layout, actual file/host saves, invalid-save atomicity, legacy world 1 and context/lifecycle restoration |
| 27 passenger/free running | **152,824 bytes**, world 4 | Passed actual passenger leg in **131.197 s**, early-service rejection, boarding wait, fare and one station bell; free-running boarding/exit |
| 28 world-3 compatibility | **152,824 bytes** | Passed actual file-chooser import of the existing completed world-3 save, exact serialized state/checksum and error-free rendering |
| 29 final detailed circuit | **152,824 bytes**, world 4 | Passed in **462.219 s**: three deliveries, all six foot discoveries, firing/crossings, deliberate overshoot/reverse recovery, clear camera orbit and three station bells |
| 30 final colour/feedback | **152,824 bytes**, world 4 | Passed moving-train periodic checkpoint, train rhythm/pause, fixed star cells, day/dusk/night views, exact Continue, corrupt-checkpoint atomicity and storage-denied export |

Runs 21/23 preceded only the 16-byte immediate-volume fix. Their visual/checkpoint source is unchanged in the delivered file; 26 rechecked affected audio controls, and 30 repeated the colour/feedback checks on the exact final artifact with an added periodic-save assertion. Fixed camera/time views in 21/23/30 are **render inspections**, not claimed playthroughs. In the isolated upward night-sky inspection, all **17 visible star cells** stayed identical after an 80-by-60-metre translation; rotation changed their projection. The ordinary-input sound leg in 30 emitted **36 chuffs and three rail clicks** over 41.47 metres of wheel travel, with a running AudioContext; pulse counters froze and transport gain was zero while paused. It observed a recent moving-train checkpoint before pausing, then restored the paused checkpoint exactly after reload. This verifies synthesis/state, not subjective listening quality.

Successful latest runs reported no unexpected application exceptions, console warnings or WebGL errors, and requested only local files with networking disabled. The deliberate invalid-save diagnostic was expected and explicitly checked. Edge was 154.0.4258.62; Chrome was 154.0.8037.97.

**58/58 focused checks passed:** world/physics 15, guidance 8, exploration 7, railway/service/version 12, refinement 5, renderer ownership/failures 5 and renderer budget/LOD 6. Checks preserve all four NEXT-STOP checksums: **4bd6b452 / 190dfd5a / 0d37a594 / 63514cfa**. They exercise seam/reverse travel, stopped mechanisms, save validation, every service/cargo primitive budget, safe station spawns and close/far/close LOD retaining building silhouettes. Packaging/source parsing and byte-exact assembly checks are separate.

Failed attempts remain: 22 initially timed out navigating the local file; 24 could not complete its initial radio selection. The repeat of 22 and trace 25 exposed a real queued-gain issue: Mute could stay applied after unchecking it in a paused menu. Direct current master gain plus canceled obsolete automation fixed it; 26 passed both directions and keyboard volume changes. Navigation now allows cold local shader setup up to 60 seconds; gameplay runs still use real elapsed time.

Final circuit 29 used **1280×720**, standard quality, **160×60 glyph cells**. Its final 600-frame sample measured **16.7 ms median / 16.9 ms p95**, near 60 FPS. Renderer CPU submission was **0.4 / 0.7 ms**; CPU submission is not GPU execution time. The completed service earned **54 shillings** and emitted **1,574 chuffs, 157 rail clicks and three bells**. These measurements describe this machine and sampling window. The earlier short inspection-21 sample measured 16.7 / 16.8 ms, with CPU submission 0.5 / 1.7 ms. Evidence lives under .omx/evidence/cycles/21-detail-colour/, 23-colour-feedback/, 26-ui-immediate-audio/, 27-detailed-passenger/, 28-legacy3-render/, 29-detailed-final/ and 30-final-colour-feedback/.

## Rural railway improvements

- **Less clutter:** station-paper menus, serif/typewriter notices and a compact soot/brass speed dial. The centre of the world stays clear. Journal, help and settings live in paused menus. Foot mode hides train instruments.
- **Landscape depth:** seeded mountain ridges/foothills, 220 trees, trackside woods, field fences, wheat/grass colours, pitched roofs and an open locomotive cab. The route remains the same safe branch line; generation versions preserve original saves.
- **Visible movement:** foliage shifts in wind, grass detail moves, boiler fire changes glyphs/colour, smoke rises and drifts, clouds move smoothly, and gaslamps cast warm pulsing light. These are numerical primitives and direct glyph cells. Static tree trunks retain authoritative collision.
- **Steam operation:** B adds coal; fire and pressure affect engine pull. V whistles. Bridge/crossing instructions require easing power/braking, with speed and whistle performance affecting the driver rating. Coal/water refill at stops. An automatic fireman supports relaxed travel.
- **Services:** goods, passenger or free running. Goods choices supply mixed farm freight, heavier timber or prompt mail, affecting manifests, pull or earnings. Passenger stops require four seconds stopped before E serves the platform. Free running removes delivery obligations while retaining ordinary train and walking interactions.
- **Reasons to leave the cab:** six foot discoveries, saved field notes and selectable destinations. The journal includes a collapsible driver ledger of completed stops, earnings and supplies.
- **Portable state:** saves carry steam, service/cargo, crossing performance, fares, stop times, discoveries and chosen destinations. Old world versions reproduce their terrain/checksums. Candidate data validates before live references change. Whistle volume/mute are local interface preferences.

Existing grade/power-aware arrival cues, platform-centre handling, reverse recovery, F camera centring, safe smoothed chase positions and dynamic primitive reservation remain.

## Historical rural-renewal browser runs

Successful driving runs use ordinary keyboard controls in offline browsers. State reads support assertions; the train/player is not teleported and simulation time is not accelerated. The walking tester reads authoritative surfaces to plan around obstacles, then uses normal turn/walk keys.

| Run | Loaded artifact | Duration | Result |
|---|---:|---:|---|
| 09 rural renewal | 127,058 bytes, world 2 | 447.282 s | Three deliveries, all six notes, fire/whistle/crossing operation, deliberate overshoot/reverse and camera orbit |
| 14 passenger/free running | 129,976 bytes, world 3 | 110.475 s | Cab departure, actual passenger arrival, blocked early service, four-second boarding wait, earned fare; free-running boarding/exit |
| 17 rural UI/audio | **130,946 bytes**, world 3 | Focused run | Timber selection, pause freeze, keyboard ledger/Tab wrap, narrow layout, audio controls, file/host saves, legacy import, context/lifecycle |
| 19 final rural circuit | **130,946 bytes**, world 3 | **449.399 s** | Three deliveries, **six of six** foot discoveries, firing/crossings, overshoot/reverse recovery and collision-free camera orbit |

Runs 17 and 19 loaded SHA-256 1f60bee0124fb590cd224960d6107af20d908c8c9932c0b70fdd455fcfc8dbae, the earlier 130,946-byte build. Passenger run 14 preceded only its volume/mute controls; those received real keyboard verification in 17. Edge was 154.0.4258.62 and Chrome was 154.0.8037.97. Successful runs recorded no unexpected application exceptions, console warnings, WebGL errors or external requests. The deliberate invalid-save diagnostic in the UI run was expected and checked explicitly.

Earlier historical coverage remains: baseline/driving circuits 01 and 02 (307.041 / 307.304 seconds); field-journal circuit 05 (362.372 seconds); legacy-save night/exploration leg 06 (116.401 seconds). Those used earlier builds and do not prove every new feature.

Failed evidence remains. Attempts 10 and 11 drove successfully but their straight-line walking helper pressed forward into a correctly solid station building. Extending the timeout did not solve it; obstacle planning fixed the harness, and 19 repeated the complete flow. Attempt 18 completed two stops/four notes but required a one-metre endpoint on a two-metre planning grid; the corrected endpoint tolerance passed numerical replay before the full repeat. Attempt 13 timed out during local navigation while several browsers were running; the serial repeat passed as 14. Attempts 15 and 16 read audio gain before scheduled changes reached its timeline; waiting for actual gain changes passed as 17. Earlier attempts 03/04/07 involved omitted reverse power, background control timing and clicking behind an open dialog. None is counted as a passed run.

## Historical rural-renewal focused and visual verification

The rural-renewal build passed **52/52 checks:** world/physics 15, journey guidance 8, exploration 7, railway/version/service 12, renderer ownership/failures 5 and renderer budget 5. Latest coverage is the 58 checks above. The packaging audit parses the inline runtime and checks dependency/media/network restrictions. The builder caps the game at **2,000,000 bytes**. Source assembly matches the delivered HTML byte for byte.

UI checks verified a frozen serialized state while paused, keyboard access to the ledger, focus wrapping and destination selection. At **390 by 844**, the 350 by 804 menu fits with internal scrolling and no horizontal overflow. Native range/checkbox keys changed whistle volume/mute and the actual audio gain.

Actual JSON download/file import and host export/import restored exact progress. Invalid boiler pressure produced a readable rejection and preserved state/live object identities. A real original save was imported through the file chooser, recreating generation 1 checksum **4bd6b452** and an automatic fireman. Numerical checks also preserve generation 2 checksum **190dfd5a**; rural-renewal generation 3 is **0d37a594** for NEXT-STOP.

Destroy/recreate released listeners/animation and retained saved service through restart. Real WebGL context loss/restoration while the journal was open preserved progress and its paused state, and drawing resumed without GL or console errors.

Fixed-camera rendering inspections over **1.2 seconds** measured **380 changed fire cells** among 492 visible fire cells, and **22 changed foliage cells** among 56 visible foliage cells. These count glyph/material differences; they are separate visual inspections, not additional claimed playthroughs. Screenshots show the new hills/woods, roofs, open cab, firebox, paper UI and mobile journal. Motion is generated from numerical scene/time values rather than swapped image frames.

The original 17 acceptance checks were completed earlier. Retained evidence covers direct glyph emission, terrain/route agreement, water reflections responding to motion, daylight/weather and lit windows, pointer-capture fallback, quality/resize, missing WebGL2 and deliberate shader failure. Changed behavior was rechecked above; every historical visual experiment was not repeated this session.

## Historical performance and continuing limits

Rural-renewal circuit 19 used **1280 by 720**, standard quality and **160 by 60 glyph cells** (9,600). Its final rolling 600-frame window measured **16.7 ms median / 16.9 ms p95**. Renderer CPU submission measured **0.3 / 0.7 ms**; these are not GPU execution times. Run 09 measured 16.7 / 16.9 ms, near 60 FPS. Measurements describe this machine and sampling window, not universal performance.

Rendering remains bounded: 256 uploaded primitives, 192 terrain traversal cells, 48 shadow objects and one reflected query with reduced limits. The world is finite. There are no mobile touch controls or OS wrapper. window.NextStop.create({canvas, host}) exposes lifecycle, input and serialization for future embedding; the target OS/runtime remains unspecified.

A local Git repository contains small, reviewable commits. All author and committer identities are **Taan1el <taaniel.vananurm@gmail.com>**, with no additional contributor trailers. No remote is configured or publication performed. No recurring automation was created; this improvement request was **this session only**.

Local evidence is under .omx/evidence/cycles/09-rural-renewal/, 14-passenger/, 17-rural-ui-audio/ and 19-rural-final/. Failed attempts remain alongside them. Animation, scene captures and exact assembly/hash evidence are under .omx/evidence/rural-renewal/. Focused scripts are in work/qa/.

NEXT_STOP_PREVIEW.png is a screenshot from the current final circuit, not a game asset. Only **next-stop.html** is required to play; exported saves are optional user data.
