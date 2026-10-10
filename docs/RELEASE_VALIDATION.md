# Release validation

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
