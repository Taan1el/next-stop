# Release validation

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
