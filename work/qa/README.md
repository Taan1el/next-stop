# Next Stop focused QA

Numerical and action regressions use plain Node and isolated `vm` contexts. Run from the repository root:

    node work/qa/world-regression.cjs
    node work/qa/journey-guidance.cjs
    node work/qa/exploration-regression.cjs
    node work/qa/railway-regression.cjs
    node work/qa/refinement-regression.cjs
    node work/qa/renderer-resources.cjs
    node work/qa/renderer-budget.cjs
    node work/qa/audit.cjs

The seven focused suites cover 58 behavior/resource checks. The separate packaging audit parses the assembled runtime and checks the offline single-file restrictions. These checks do not prove shader drawing or hardware performance.

Real browser scripts live under `work/playtest-*.cjs` and `work/run-cycle.cjs`. Launch them serially to keep measurements meaningful. They use local Playwright and Edge/Chrome paths, never player dependencies. Full circuits use normal keyboard inputs and real elapsed time. Fixed-time/camera shader inspections are labeled separately.

Evidence and failures remain under ignored `.omx/evidence/`. Current artifact scope and actual results live in `outputs/NEXT_STOP_VERIFICATION.md`; plans alone are not acceptance evidence.
