# Testing

Run commands from the repository root with Node.js 20 or newer.

```sh
npm ci
npm run build
npm test
```

The core suites use Node built-ins. They cover 79 numerical/gameplay/resource checks, three committed save fixtures, the source/packaging audit, and release-package contents. Village checks include safe walking anchors across four world generations, one-time rewards, continuous lamp work, letter mistakes, conflicting partial jobs, save atomicity, paint accounting and bounded props. Career checks add repeated services, shared fares/rewards, railway parcels, renewed work, equipment, interrupted older saves with missing receipts and atomic imports. Source checks do not prove GPU rendering.

## Browser setup

```sh
npx playwright install chromium
npm run test:browser
```

Playwright is pinned in package-lock.json. Linux machines may also need `npx playwright install --with-deps chromium`. Its browser download is a development tool, never a player dependency.

The default is Playwright-managed Chromium. To use an installed Chrome or Edge, set `NEXT_STOP_BROWSER_CHANNEL` to `chrome` or `msedge`. `chromium` selects the managed Chromium channel. `NEXT_STOP_BROWSER_PATH` may instead point at another Chromium executable and takes precedence. For example:

```sh
# macOS/Linux
NEXT_STOP_BROWSER_CHANNEL=chrome npm run test:browser
```

```powershell
# PowerShell
$env:NEXT_STOP_BROWSER_CHANNEL='msedge'
npm run test:browser
```

The serial browser suite covers service/cargo selection, keyboard menus, narrow layout, pause, actual volume/mute, JSON and host saves, invalid-save atomicity, generations 1/3 imports, context/lifecycle restoration, wheel-linked sound, colour views, fixed star positions, local continuation and storage denial. It runs with networking disabled after opening the local HTML.

Two additional scripts walk the station jobs using ordinary controls and inspect five fixed night views. The walking run checks parcel export/import mid-task, lamp release/hold, wrong/correct letters, paint purchases, lantern/brightness controls, train boarding and continuation. Night fixtures compare actual glyph foreground/background luminance in the platform, meadow, rain and cab; lantern falloff is checked against the same meadow with it switched off. These thresholds guard readability, not artistic quality. Screenshot inspection supplements the assertions. Browser action timeouts allow 60 seconds for cold shader compilation.

Legacy states in [work/qa/fixtures/](../work/qa/fixtures/) contain only saved game data. They do not depend on previous local playtest reports. `.omx/evidence/` is generated output and is not needed as an input.

## Longer runs

```sh
npm run test:circuit
npm run test:passenger
```

The complete circuit drives all three deliveries, walks to six discoveries, tends the engine, handles crossings, intentionally overshoots/reverses and checks a station camera orbit. It also collects a railway parcel on foot, carries it through the first train leg, hands it over, buys boots with combined earnings, refreshes work and starts/departs another passenger service. The second service is a departure check, not another complete circuit. Allow roughly 8–10 minutes on a typical tested desktop; slower machines may take longer. The passenger run checks a real station leg, boarding wait, fare, bell and free-running interactions.

Run browser processes serially. Full journeys use ordinary keys and real elapsed simulation time. Fixed time/camera colour or sky inspections are explicitly labeled rendering fixtures, not extra playthroughs. Results and screenshots are written under ignored `.omx/evidence/`.

## Recorded gameplay baseline

Before release-document/tooling cleanup, the 152,824-byte world-4 build passed a 462.219-second complete circuit: three deliveries, all six discoveries, reverse recovery and camera clearance. A passenger leg passed in 131.197 seconds. Its final 600-frame circuit sample at 1280×720/standard/160×60 glyphs measured 16.7 ms median and 16.9 ms p95; CPU renderer submission was 0.4/0.7 ms. These are one-machine measurements, not universal frame-rate promises.

The 0.1.0 release cleanup added the MIT notice without changing gameplay source. Version 0.2.0 adds night lighting and station activities; 0.3.0 adds repeatable services/work and shared earnings. Validation for each version is recorded separately in [release validation](RELEASE_VALIDATION.md).

## Limits

Verified browser families are Chromium-based desktop browsers on Windows. Safari/Firefox and other operating systems need their own actual rendering tests before support is claimed. Touch controls are absent. A narrow-layout check verifies menu fit, not mobile playability. Synthesized sound state/pulses are tested; subjective listening quality is not asserted by headless automation.
