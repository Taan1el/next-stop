# Next Stop verification and improvement report

The playable game is **next-stop.html, 106,337 bytes**. It contains HTML, CSS, JavaScript, shaders, numeric glyph definitions and the procedural world generator. Open it directly in a WebGL2 browser. No server, internet connection, installation, image assets, engine or runtime companion files are required.

SHA-256: 8bfff4e19e89c354fbb9728f314c3592228bcbee78d064e44b150b89c370ccd7.

## Improvements from playthroughs

- **Arrival guidance:** actual grade and current power determine stopping prediction using the same train forces as the simulation. BRAKE NOW, platform-ready, missed-stop, reverse and add-power cues guide ordinary driving. Crossing a platform centre no longer shows an almost-full-loop distance while delivery is already valid.
- **Camera:** final smoothed chase positions clear station buildings. F centres the train camera; C switches cab/chase. These actions preserve train physics and delivery progress.
- **Field journal:** leave the cab to discover three station landmarks and read their saved notes with J. Notes cannot be collected aboard. Two discoveries in the full run required walking; Bellweather was close enough to be discovered on disembarking.
- **Exploration destinations:** choose an undiscovered journal place. Cargo stops retain priority until deliveries finish; afterward train guidance leads to the selected station, and foot hints lead to its landmark. Discovery clears the selection.
- **Portable progress:** JSON and host saves retain discoveries and destinations. Original version-1 saves load with an empty journal. Invalid journal data is rejected before replacing live state.
- **Renderer capacity:** static selection reserves the actual dynamic train record count and refreshes when it changes. Dynamic records remain first, with the 256-record upload cap enforced.

A railway-explorer agent reviewed source and captured scenes, suggesting arrival feedback, reasons to leave the cab and camera recovery. Independent physics and renderer agents checked the resulting changes. The explorer critique was a review, not a separately claimed browser playthrough.

## Real browser runs

Successful runs used ordinary keyboard controls in offline browsers. State reads supported assertions; the train was not teleported and time was not accelerated.

| Run | Duration | Result |
|---|---:|---|
| 01 baseline | 307.041 s | Three deliveries and safe exit; reproduced misleading platform distance |
| 02 driving polish | 307.304 s | Followed three brake cues, finished deliveries, checked platform-centre crossing |
| 05 field journal | 362.372 s | Three deliveries, deliberate overshoot/reverse recovery, tower camera orbit, three foot discoveries |
| 06 legacy-save night exploration | 116.401 s | Imported a real completed old save, selected Bellweather, used F and both cameras, drove/stopped, collected/exported its note |

These runs recorded no application exceptions, console warnings, WebGL errors or external application requests. Edge was **154.0.4258.62**; Chrome was **154.0.8037.97**. The night leg and final host checks loaded the current 106,337-byte artifact.

The longest complete circuit loaded **105,953 bytes**, just before adding F and its help text. The 384-byte addition received numerical camera checks and actual keyboard verification in the current Chrome build. Another full circuit was not needed for this camera-only action.

Failed attempts remain in the evidence. Attempt 03 omitted W after R, which correctly resets power. Attempt 04 lost control-poll timing while a long asynchronous playthrough ran between Node REPL calls; a dedicated Node process fixed the harness. Attempt 07 tried clicking Settings behind an open journal dialog; corrected navigation passed as 08. These attempts are not counted as successful runs.

## Focused verification

**40/40 regression checks passed:** world/physics 15, journey guidance 8, exploration 7, renderer resource ownership 5 and renderer budget 5. The packaging audit parses the inline script and checks the asset/dependency/network restrictions. The builder rejects HTML over **2,000,000 bytes**. Source assembly matches the artifact byte for byte.

Actual journal UI checks verified paused-state freezing, Tab wrapping, keyboard selection and restored focus, and a fitting **390 by 844** layout without horizontal overflow. JSON file export/import restored exact state. Invalid destination input produced a readable error and preserved state and live object identities. Old saves were imported through the actual file chooser.

The current build passed injected host export/import with a discovered note, destroy/recreate listener and animation cleanup, and actual WebGL context loss/restoration while the journal was open. Progress and the paused dialog survived; drawing resumed without GL or console errors. Independent numerical checks walked all 24 landmark anchors across eight seeds and exercised atomic app-level rejection of invalid selections.

The original implementation passed all **17 initial acceptance checks**. Retained evidence covers direct glyph rendering, terrain/route agreement, reflections responding to train movement, daylight/weather and lit windows, walking/boarding, reverse, save validation, pointer-capture rejection and fallback controls, focus loss, seed changes, quality/resize, missing WebGL2 and deliberate shader failure. Changed behavior was rechecked above; not every original visual experiment was repeated this session.

## Performance and limits

The latest full circuit used **1280 by 720**, standard quality and **160 by 60 cells** (9,600). Its final rolling 600-frame sample measured **16.7 ms median / 16.8 ms p95**, about 60 FPS. Renderer CPU submission measured **0.3 ms median / 0.6 ms p95**; this is not GPU execution time. The current Chrome night leg measured **16.7 / 16.9 ms** in its final 600-frame sample. These describe this machine and sampling window, not universal performance.

The valley is finite. Scene distance, primitive counts, terrain traversal, shadows and a single water reflection query are bounded. There are no mobile touch controls or OS wrapper. window.NextStop.create({canvas, host}) exposes lifecycle, input and serialization for future embedding; the target OS/runtime is still unspecified.

This request was **this session only**. No recurring automation was created.

Evidence is under .omx/evidence/cycles/01-baseline/, 02-driving-polish/, 05-field-journal/, 06-legacy-night-exploration/, 08-final-host/ and journal-ui-checks.json. Failed attempts 03, 04 and 07 remain alongside them. Initial acceptance evidence remains under .omx/evidence/; focused scripts are in work/qa/.

NEXT_STOP_PREVIEW.png is a documentation screenshot from the successful daylight braking check, not an application asset. Only **next-stop.html** is needed to play; saves are optional user data.
