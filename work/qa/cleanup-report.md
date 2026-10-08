# Standard cleanup report

Historical initial-build resource cleanup. Subsequent improvement work fixed the deferred dynamic reservation described below; renderer-budget.cjs now passes5/5. Current artifact/evidence status is in outputs/NEXT_STOP_VERIFICATION.md.

Skill: `C:/Users/crazy/.codex/plugins/cache/oh-my-codex-local/oh-my-codex/0.16.0/skills/ai-slop-cleaner/SKILL.md`.

Scope: changed `work/src/world.js`, `renderer.js`, `app.js`, `shell.html`, `work/build.cjs` and focused QA. Root authorized a narrow implementation edit in `renderer.js` only; other implementation files remained read-only to QA.

Behavior lock first: numerical/gameplay suite passed 13/13 and standalone source audit passed before cleanup. New mock-GL ownership tests then reproduced three shader-failure resource leaks while successful destruction and missing-WebGL handling passed.

Plan before edit: inventory fallback-like paths; retain explicit browser capability/failure boundaries; repair only demonstrated GPU failure ownership; avoid cosmetic rewrites, new dependencies, shader changes or speculative abstractions. Root approved this plan and edit scope.

Fallback inventory:

- Pointer-lock rejection/missing support leads to visible drag/keyboard-look instructions. Intentional browser capability boundary; root owns actual primary/rejection interaction evidence.
- Optional localStorage failure preserves manual JSON export and tells the player. Intentional portable-file boundary; root owns browser storage/export evidence.
- Missing WebGL2 and shader/link/draw failures produce explicit errors. Mock-GL tests cover normal ownership, missing WebGL and fragment compilation failure; root owns actual GPU fault/context checks.
- Missed/far reflected rays use procedural sky. Intentional bounded reflection behavior from the prompt, not an error bypass.
- Camera target versus yaw/pitch and numeric optional defaults match the shared renderer contract. No broad compatibility refactor justified in this build.
- No masking fallback, skipped validation, suppressed regression or temporary bypass found in the tested production path. No nested planning workflow needed; findings were sent to the active root.

Passes:

1. Dead code/duplication review: no material deletion justified. Unused vertex varying is compiler-eliminated and was consciously left alone to avoid unrelated shader churn.
2. Error/ownership repair: `program()` deletes shader handles in `finally`, deletes failed programs and rethrows the original diagnostic. Constructor failure releases partial renderer ownership. Reinitialization clears invalid pre-restoration handles; fatal restoration failure releases fresh partial ownership and listeners.
3. Tests: added normal idempotent destruction, scene/display shader failure, restoration shader failure and missing-WebGL resource ownership checks.

Quality gates after edit:

- Numerical/gameplay regression: **13/13 PASS**.
- Mock-GL ownership/failure: **5/5 PASS**, previously 2/5.
- `node --check work/src/renderer.js`: **PASS**.
- Standalone packaging audit: **PASS** after root rebuild; 93,511-byte output contains the failure ownership fix and inline script parses with no detected assets/dependencies/network/imports.
- Lint/typecheck: no configured toolchain in this vanilla-JS projectless build; syntax checks and focused tests used.
- Browser normal/failure/context checks: root-owned, pending root's final runtime evidence.

Implementation file changed: `work/src/renderer.js`. Shader source and first-draw GPU validation remain unchanged. No new runtime dependency or abstraction introduced.

Deferred low-impact detail: static object selection reserves 24 slots while current train emits 30. Upload is still correctly capped at 256 records, with dynamic train written first; six trailing far static candidates can be omitted. Changing selection now would alter visual culling rather than failure ownership, so it remains outside the approved cleanup scope.
