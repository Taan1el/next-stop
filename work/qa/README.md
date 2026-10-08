# Next Stop focused QA

Numerical and action regressions will use plain Node, loading `work/src/world.js` into an isolated `vm` context. The suite must exercise observable behavior, remain independent of renderer/DOM objects, and avoid pixel equality or hardware claims.

Acceptance inventory, controls and two edge scenarios live in `.omx/state/next-stop-qa.md`. Browser interaction belongs to root's persistent Playwright session; QA does not launch a competing session.

Tests will be authored after inspection of the delivered API and run again after fixes. No acceptance result is inferred from planned coverage.
