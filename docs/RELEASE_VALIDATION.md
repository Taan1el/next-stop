# Release validation

## 0.4.0

Checked on 14 October 2026 on Windows with Node.js 24.14.1, locked Playwright 1.64.0 and managed Chromium 156.0.8078.4. This version integrates woodland/cloud rendering with the career gameplay and adds material-specific cell fills, distance fading and subtle vertical shading inside glyph ink. World descriptors, physics and save formats are unchanged.

| Check | Result |
|---|---|
| `npm test` | Passed; 80 focused checks, three historical fixtures, offline/source audit and deterministic archive validation |
| `npm run test:browser` | Passed; all six scripts serially and offline, including legacy import, host lifecycle, station work, UI and night visibility |
| Paired colour comparison | Passed; eight fixed views use identical scene and glyph fixes, with only colour encoding and ink shading changed in the reference |
| Actual short control checks | Passed on reference and final builds; walk, board, change camera, consume coal/increase fire, drive, brake and pause |
| Five night fixtures | Passed; platform, lantern meadow, moonlit meadow, rain and actual cab at 22:00; checked WebGL errors zero |
| Fresh local Git clone assembly | Passed; dependency-free assembler reproduced the exact 193,236-byte HTML |
| Player package opened offline | Passed; five-file ZIP, 63,432 bytes, twelve jobs, board, fire, move, brake and pause; exact HTML/checksums and WebGL error zero |
| Source syntax, relative links and archive reproducibility | Passed; identical player ZIP checksum across three time zones |

All eight comparison views retain identical glyph IDs. Mean background luminance increased by 2.12 times for the engine view's grass, 1.80 times for lake water, 1.73 times for woodland leaves and 1.86 times for ridge rock. Default-framebuffer samples confirm the ink gradient reaches displayed glyphs while nameboard contrast remains readable; 1,064 cab gauge cells remain present. Screenshots of the engine, woodland and actual night cab were inspected. The reference builder preserves the same vegetation, cloud and glyph fixes as production, avoiding geometry differences in the colour comparison.

The warmed, paused-camera comparison used 600 consecutive positive frame intervals at 1280×720 with standard 160×60 glyphs. Reference median/p95: 16.7/16.8 ms; final: 16.7/17.1 ms. Maximum intervals were 17.8 and 22.7 ms, with none over 50 ms. CPU submission median/p95 changed from 0.4/1.5 to 0.5/2.4 ms. These are one-machine rendering samples, not a moving full-circuit benchmark or a universal frame-rate claim. The full circuit and passenger journeys recorded under 0.3.0 are historical; no new complete circuit is claimed for this visual update.

An initial browser-suite attempt exceeded the legacy runner's 30-second startup allowance. An unchanged build passed on retry. The runner now reports boot readiness, detects fatal startup, and uses the other runners' 60-second allowance. The complete suite then passed; legacy startup measured 40.772 seconds. First startup can therefore remain slow on this test machine even though warmed frame rendering is smooth. No game code was changed to hide that timeout.

Independent code and architecture reviews cleared the changes after fixes to stable tree variation, unreachable canopy glyph selection, a cloud-horizon coverage check, actual cab test coverage and frame-sample reporting. Generation 1–4 checksums remain unchanged. This remains a desktop Chromium prototype; other browser families, operating systems and touch controls are unverified. No GitHub release publication is implied.

```text
7f60cc3d74e585c6ad0f9ce831751d3cef74354fac7210d296cd96762016e310  next-stop.html
6e245292d481c8497ba2e0e8750a25d5f928b1b8052aded39232f84fe2be550a  next-stop-v0.4.0.zip
```

## 0.3.0

Checked on 11 October 2026 on Windows with Node.js 24.14.1, locked Playwright 1.64.0 and managed Chromium 156.0.8078.4. Gameplay was isolated from concurrent visual work; the renderer and world descriptors retain the 0.2.0 implementation.

| Check | Result |
|---|---|
| `npm test` | Passed; 80 focused checks, three historical fixtures, offline audit and deterministic archive validation |
| Serial browser suite | Passed; all six scripts offline, including journal tabs, saves, lifecycle, station work and fixed night views |
| Actual complete circuit and work loop | Passed in 484.582 seconds; three deliveries, six discoveries, reverse recovery, camera clearance, train-carried parcel, boots purchase, work renewal and a new passenger departure |
| Actual station-work journey | Passed in 58.504 seconds; local parcel save round-trip, lamp hold/release, addressed letters, paint accounting and continuation |
| Passenger and free running | Passed in 124.547 seconds; stopped boarding wait, fare, bell and normal free-running interactions |
| Final menu layering | Additional full UI script passed after fixing instrument text appearing above the journal on narrow windows; screenshot inspected |
| Fresh local clone assembly | Passed; exactly reproduced the final 186,401-byte HTML without dependencies |
| Player package | Passed; five files, 60,858 bytes, exact HTML/license and verified checksums |
| Extracted ZIP opened offline | Passed; twelve jobs, board, fire, move, brake and pause; WebGL error zero |
| Source syntax, relative links and ZIP time-zone reproducibility | Passed |

The work-loop journey physically collected a Pinebank parcel, boarded, drove to Bellweather and handed it to the porter on foot. The first fare plus parcel reward funded 40-shilling boots. After the circuit, a new work round preserved earnings and equipment, could not be claimed twice, and a new passenger service preserved the world and clock. Its departure was checked; a second complete circuit is not claimed. Renewed state passed an exact host save round-trip. Final purse: 36 shillings, with 54 in banked railway fares, 22 from the parcel and 40 spent on boots.

The complete circuit used the preceding 186,280-byte gameplay build. Final changes refreshed the displayed ledger immediately and preserved reputation from older village saves; core and serial browser checks covered those changes. The last CSS layering adjustment was followed by the full UI script and extracted-package check. The long-run 600-frame sample at 1280×720, standard 160×60 glyphs, measured 16.7 ms median / 16.8 ms p95 and CPU renderer submission 0.3 / 0.5 ms. These are one-machine measurements on that gameplay build, not universal performance claims.

Two independent code/architecture reviews cleared the gameplay and save changes after interrupted legacy saves with absent fare receipts were covered. Twelve additional career checks plus a reputation-compatibility check cover renewal, shared accounting, cross-station handover, equipment and atomic imports. Unexpected browser diagnostics were absent and checked WebGL errors were zero. Generation 1–4 checksums remain unchanged. Fixed night views are rendering inspections, not extra playthroughs.

```text
d209eca666a5067590e264f9d28c909d82b46d25ab1a8f4b1a6e3f58ef0cc8d0  next-stop.html
51554f3cfbaede03f90c466c1c44ad931487aacf19f847b6f7c58e261f005b41  next-stop-v0.3.0.zip
```

This remains a desktop prototype. Other browser families/operating systems and touch controls are unverified. No GitHub release publication is implied.

## 0.2.0

Checked on 10 October 2026 on Windows with Node.js 24.14.1, locked Playwright 1.64.0 and managed Chromium 156.0.8078.4. Checks ran in the development checkout; a separate fresh local Git clone reproduced the exact HTML with the dependency-free assembler. The full clean-install validation for 0.1.0 remains below.

| Check | Result |
|---|---|
| Fresh clone, `node work/build.cjs` | Passed; reproduced the committed 174,050-byte HTML without installing dependencies |
| `npm test` | Passed; 67 focused checks, three historical fixtures, source audit and deterministic archive check |
| `npm run test:browser` | Passed; six scripts, serially, networking disabled |
| Actual station-work journey | Passed in 77.565 seconds; parcel, lamp, letters, paint, night settings, boarding and continuation |
| Complete train circuit | Passed in 460.604 seconds; three deliveries, six discoveries, deliberate overshoot/reverse and clear station orbit |
| Passenger and free-running check | Passed in 126.686 seconds; stopped boarding wait, fare, bell and free-running interactions |
| Five night rendering fixtures | Passed; platform, lantern-lit meadow, moonlit meadow, rainy platform and cab at 22:00 |
| `npm run release:package` | Passed; five-file player ZIP, 57,050 bytes |
| Extracted ZIP opened offline | Passed; nine jobs/default night settings, board, fire, move, brake and pause; WebGL error zero |
| Source syntax, documentation links and ZIP time-zone reproducibility | Passed |

The village run exported/imported a carried parcel through actual DOM controls and rejected an invalid overlapping parcel/letter save without replacing live references. It also checked a released lamp attempt, a continuous completed refill, wrong/correct letter choices, purchase accounting, free reuse of owned paint, pause freezing and saved brightness. Nine pure village checks cover reachable anchors across generations, one-time rewards, partial-task exclusivity and atomic restores. Two independent code/architecture reviews cleared the change after a task-overlap bug was fixed and regression-tested.

Night tests inspect the actual glyph foreground/background attachments. Default nearby meadow foreground median was 106.38 with the lantern and 75.56 with moonlight alone, on a 0–255 luminance scale. Fixed camera/time views are rendering inspections, not additional journeys. Screenshots from these views and the actual circuit were inspected. The home arrival occurred after dark with readable terrain and buildings.

The circuit's final 600-frame sample at 1280×720, standard 160×60 glyphs, measured 16.7 ms median / 16.9 ms p95; CPU renderer submission was 0.3 / 0.7 ms. These are one-machine measurements, not universal performance claims. Unexpected browser diagnostics were absent and checked WebGL error states were zero. Generation 1–4 checksums remain unchanged.

```text
6a95cb8a254a00b91ec5af7fc37ba3d87903cbf133f5c9f864e43fdafe48a90a  next-stop.html
00cf42b51566337ad2b690702f6fcbf7f3e02346cd9de2ebb793820e1daa2fa8  next-stop-v0.2.0.zip
```

The game remains a desktop prototype. Other browser families/operating systems and touch controls are not validated by this work. This record does not imply GitHub release publication.

## 0.1.0

Version 0.1.0 was checked on 10 October 2026 using a fresh local Git clone on Windows, Node.js 24.14.1, Playwright 1.64.0 and its managed Chromium 156.0.8078.4. Dependencies were installed with the lockfile. Browser runners needed no personal runtime paths or previous evidence files.

| Check | Result |
|---|---|
| `npm ci` | Passed; development dependencies installed |
| `npm run build` | Passed; reproduced the committed 153,897-byte HTML |
| `npm test` | Passed; 58 core checks, three historical fixtures, source audit and release archive check |
| `npm run test:browser` | Passed; all four browser scripts ran serially with networking disabled |
| `npm run release:package` | Passed; five-file player ZIP, 50,796 bytes |
| Extracted ZIP, opened offline | Passed; board, add coal, move, brake and pause; WebGL error zero |
| Source syntax and relative documentation links | Passed |
| ZIP reproducibility across three time zones | Identical SHA-256 |

Browser coverage includes actual service selection and audio controls, pause/menu navigation, valid and rejected saves, generations 1/3, host persistence, context recreation, moving-train sound, fixed stars, local continuation and storage denial. The final browser reports contained no unexpected console errors/warnings, and checked WebGL error states were zero. Screenshots were inspected; narrow menu fit is not a mobile-play support claim.

Artifact checksums:

```text
66272c930f638b6eeaff0345de8f65e265e7f687bd032bec3ac2c3203762c70c  next-stop.html
6ed61b6c4cae96d2ae84b100155e5a1e06eef23d304c23c59c7b85c5a3519d90  next-stop-v0.1.0.zip
```

The MIT notice is embedded in the standalone HTML. Release preparation changes documentation and developer tooling; gameplay modules are unchanged from the recorded world-4 baseline in [testing](TESTING.md).

The earlier complete circuit and passenger run are historical gameplay evidence, not new full journeys for this documentation/tooling cleanup. Other browser families and operating systems remain unverified. No GitHub release publication is implied by this local validation.
