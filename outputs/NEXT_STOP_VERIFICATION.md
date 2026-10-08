# Next Stop verification and improvement report

The playable game is **next-stop.html, 130,946 bytes**. It contains HTML, CSS, JavaScript, shaders, numeric glyph masks and the procedural world generator. Open it directly in a WebGL2 browser. No server, connection, installation, images, engine or runtime companion files are needed.

SHA-256: 1f60bee0124fb590cd224960d6107af20d908c8c9932c0b70fdd455fcfc8dbae.

## Rural railway improvements

- **Less clutter:** station-paper menus, serif/typewriter notices and a compact soot/brass speed dial. The centre of the world stays clear. Journal, help and settings live in paused menus. Foot mode hides train instruments.
- **Landscape depth:** seeded mountain ridges/foothills, 220 trees, trackside woods, field fences, wheat/grass colours, pitched roofs and an open locomotive cab. The route remains the same safe branch line; generation versions preserve original saves.
- **Visible movement:** foliage shifts in wind, grass detail moves, boiler fire changes glyphs/colour, smoke rises and drifts, clouds move smoothly, and gaslamps cast warm pulsing light. These are numerical primitives and direct glyph cells. Static tree trunks retain authoritative collision.
- **Steam operation:** B adds coal; fire and pressure affect engine pull. V whistles. Bridge/crossing instructions require easing power/braking, with speed and whistle performance affecting the driver rating. Coal/water refill at stops. An automatic fireman supports relaxed travel.
- **Services:** goods, passenger or free running. Goods choices supply mixed farm freight, heavier timber or prompt mail, affecting manifests, pull or earnings. Passenger stops require four seconds stopped before E serves the platform. Free running removes delivery obligations while retaining ordinary train and walking interactions.
- **Reasons to leave the cab:** six foot discoveries, saved field notes and selectable destinations. The journal includes a collapsible driver ledger of completed stops, earnings and supplies.
- **Portable state:** saves carry steam, service/cargo, crossing performance, fares, stop times, discoveries and chosen destinations. Old world versions reproduce their terrain/checksums. Candidate data validates before live references change. Whistle volume/mute are local interface preferences.

Existing grade/power-aware arrival cues, platform-centre handling, reverse recovery, F camera centring, safe smoothed chase positions and dynamic primitive reservation remain.

## Actual browser runs

Successful driving runs use ordinary keyboard controls in offline browsers. State reads support assertions; the train/player is not teleported and simulation time is not accelerated. The walking tester reads authoritative surfaces to plan around obstacles, then uses normal turn/walk keys.

| Run | Loaded artifact | Duration | Result |
|---|---:|---:|---|
| 09 rural renewal | 127,058 bytes, world 2 | 447.282 s | Three deliveries, all six notes, fire/whistle/crossing operation, deliberate overshoot/reverse and camera orbit |
| 14 passenger/free running | 129,976 bytes, world 3 | 110.475 s | Cab departure, actual passenger arrival, blocked early service, four-second boarding wait, earned fare; free-running boarding/exit |
| 17 rural UI/audio | **130,946 bytes**, world 3 | Focused run | Timber selection, pause freeze, keyboard ledger/Tab wrap, narrow layout, audio controls, file/host saves, legacy import, context/lifecycle |
| 19 final rural circuit | **130,946 bytes**, world 3 | **449.399 s** | Three deliveries, **six of six** foot discoveries, firing/crossings, overshoot/reverse recovery and collision-free camera orbit |

Runs 17 and 19 loaded the exact SHA-256 above. Passenger run 14 preceded only the volume/mute controls; those received real keyboard verification in 17. Edge was 154.0.4258.62 and Chrome 154.0.8037.97. Successful runs recorded no unexpected application exceptions, console warnings, WebGL errors or external requests. The deliberate invalid-save diagnostic in the UI run was expected and checked explicitly.

Earlier historical coverage remains: baseline/driving circuits 01 and 02 (307.041 / 307.304 seconds); field-journal circuit 05 (362.372 seconds); legacy-save night/exploration leg 06 (116.401 seconds). Those used earlier builds and do not prove every new feature.

Failed evidence remains. Attempts 10 and 11 drove successfully but their straight-line walking helper pressed forward into a correctly solid station building. Extending the timeout did not solve it; obstacle planning fixed the harness, and 19 repeated the complete flow. Attempt 18 completed two stops/four notes but required a one-metre endpoint on a two-metre planning grid; the corrected endpoint tolerance passed numerical replay before the full repeat. Attempt 13 timed out during local navigation while several browsers were running; the serial repeat passed as 14. Attempts 15 and 16 read audio gain before scheduled changes reached its timeline; waiting for actual gain changes passed as 17. Earlier attempts 03/04/07 involved omitted reverse power, background control timing and clicking behind an open dialog. None is counted as a passed run.

## Focused and visual verification

**52/52 checks passed:** world/physics 15, journey guidance 8, exploration 7, railway/version/service 12, renderer ownership/failures 5 and renderer budget 5. The packaging audit parses the inline runtime and checks dependency/media/network restrictions. The builder caps the game at **2,000,000 bytes**. Source assembly matches the delivered HTML byte for byte.

UI checks verified a frozen serialized state while paused, keyboard access to the ledger, focus wrapping and destination selection. At **390 by 844**, the 350 by 804 menu fits with internal scrolling and no horizontal overflow. Native range/checkbox keys changed whistle volume/mute and the actual audio gain.

Actual JSON download/file import and host export/import restored exact progress. Invalid boiler pressure produced a readable rejection and preserved state/live object identities. A real original save was imported through the file chooser, recreating generation 1 checksum **4bd6b452** and an automatic fireman. Numerical checks also preserve generation 2 checksum **190dfd5a**; current generation 3 is **0d37a594** for NEXT-STOP.

Destroy/recreate released listeners/animation and retained saved service through restart. Real WebGL context loss/restoration while the journal was open preserved progress and its paused state, and drawing resumed without GL or console errors.

Fixed-camera rendering inspections over **1.2 seconds** measured **380 changed fire cells** among 492 visible fire cells, and **22 changed foliage cells** among 56 visible foliage cells. These count glyph/material differences; they are separate visual inspections, not additional claimed playthroughs. Screenshots show the new hills/woods, roofs, open cab, firebox, paper UI and mobile journal. Motion is generated from numerical scene/time values rather than swapped image frames.

The original 17 acceptance checks were completed earlier. Retained evidence covers direct glyph emission, terrain/route agreement, water reflections responding to motion, daylight/weather and lit windows, pointer-capture fallback, quality/resize, missing WebGL2 and deliberate shader failure. Changed behavior was rechecked above; every historical visual experiment was not repeated this session.

## Performance and limits

The final circuit used **1280 by 720**, standard quality and **160 by 60 glyph cells** (9,600). Its final rolling 600-frame window measured **16.7 ms median / 16.9 ms p95**. Renderer CPU submission measured **0.3 / 0.7 ms**; these are not GPU execution times. Run 09 measured 16.7 / 16.9 ms, near 60 FPS. Measurements describe this machine and sampling window, not universal performance.

Rendering remains bounded: 256 uploaded primitives, 192 terrain traversal cells, 48 shadow objects and one reflected query with reduced limits. The world is finite. There are no mobile touch controls or OS wrapper. window.NextStop.create({canvas, host}) exposes lifecycle, input and serialization for future embedding; the target OS/runtime remains unspecified.

A local Git repository contains small, reviewable commits. All author and committer identities are **Taan1el <taaniel.vananurm@gmail.com>**, with no additional contributor trailers. No remote is configured or publication performed. No recurring automation was created; this improvement request was **this session only**.

Local evidence is under .omx/evidence/cycles/09-rural-renewal/, 14-passenger/, 17-rural-ui-audio/ and 19-rural-final/. Failed attempts remain alongside them. Animation, scene captures and exact assembly/hash evidence are under .omx/evidence/rural-renewal/. Focused scripts are in work/qa/.

NEXT_STOP_PREVIEW.png is a screenshot from the current final circuit, not a game asset. Only **next-stop.html** is required to play; exported saves are optional user data.
