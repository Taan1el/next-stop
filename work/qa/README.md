# Next Stop focused QA

Numerical and action regressions use plain Node and isolated `vm` contexts. Run from the repository root:

    node work/qa/world-regression.cjs
    node work/qa/journey-guidance.cjs
    node work/qa/exploration-regression.cjs
    node work/qa/railway-regression.cjs
    node work/qa/refinement-regression.cjs
    node work/qa/renderer-resources.cjs
    node work/qa/renderer-budget.cjs
    node work/qa/village-regression.cjs
    node work/qa/career-regression.cjs
    node work/qa/audit.cjs

The nine focused suites cover 80 behavior/resource checks. Career checks cover repeated services, shared earnings, cross-station parcels, refreshed work, equipment, missing legacy receipts and rejected imports. The separate packaging audit parses the assembled runtime and checks the offline single-file restrictions. These checks do not prove shader drawing or hardware performance.

Real browser scripts live under `work/playtest-*.cjs` and `work/run-cycle.cjs`. Run `npm ci`, `npx playwright install chromium` and `npm run test:browser`. The shared launcher also supports installed Chrome/Edge or an explicit executable path. Launch processes serially to keep measurements meaningful. Full circuits use normal keyboard inputs and real elapsed time; fixed-time/camera shader inspections are labeled separately.

Three historical save states are committed under `fixtures/` and checked by `save-fixtures.cjs`. Browser scripts require no ignored evidence files as inputs. Generated results remain under ignored `.omx/evidence/`. See [testing](../../docs/TESTING.md) and [release validation](../../docs/RELEASE_VALIDATION.md) for coverage and limits.
