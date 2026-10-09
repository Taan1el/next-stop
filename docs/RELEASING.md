# Preparing a release

Next Stop is a desktop prototype. A player download contains one self-contained HTML game; developer dependencies are never included.

1. Update the version in package.json and package-lock.json together, and describe the release in CHANGELOG.md.
2. From a fresh checkout, run `npm ci`, `npm run build`, `npm test`, then install Chromium with `npx playwright install chromium` and run `npm run test:browser`.
3. Run the full circuit and passenger checks when gameplay changes. Inspect screenshots and play with sound on before claiming visual or audio quality.
4. Run `npm run release:package`. This rebuilds the HTML and creates `dist/next-stop-vVERSION.zip` plus its SHA-256 sidecar.
5. Extract the archive and open next-stop.html offline. Check its version, controls, saving and license before publishing it.

The ZIP contains only next-stop.html, LICENSE, QUICKSTART.txt, CHANGELOG.md and SHA256SUMS.txt. No source tooling, local reports or dependencies are shipped. Fixed ZIP timestamps make packaging reproducible for identical inputs. `npm test` checks archive contents, exact HTML/license bytes and checksums.

Attach the ZIP and checksum sidecar to a versioned GitHub release when publishing. Repository visibility and release publication are separate owner decisions. A package generated locally is not automatically uploaded or published.

Keep support claims tied to actual tested platforms. Current coverage is Windows desktop Chromium; Firefox, Safari, other operating systems and touch play remain unverified or unimplemented. See [testing](TESTING.md) and [release validation](RELEASE_VALIDATION.md).
