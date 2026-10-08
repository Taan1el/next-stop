# Independent Next Stop source review

Reviewed numerical world/simulation, renderer, application, shell and build as read-only implementation files. QA owns only this folder and `.omx/state/next-stop-qa.md`.

## Confirmed source properties

- World generation uses seeded integer PRNG; route, heightfield, stations and objects are reproducible records. Terrain CPU sampling is bilinear over a typed height array. Renderer uploads that exact array and uses the same interpolation for scene queries.
- Rail route stores cumulative 3D arc length, finite grade and yaw. Each carriage has its own distance offset; train forces oppose motion for brake/friction and hold a braked train at rest on slopes.
- Scene pass runs at grid resolution and writes three `RGBA8UI` attachments: selected glyph/material/depth, foreground, background. Display pass fetches those records and evaluates embedded 5×7 numeric bit masks; it does not query the world or convert an image into text.
- Numerical terrain textures, object records and glyph row bits use typed arrays. No imported images, model files, fonts, engines, libraries or image processing APIs detected by packaging audit.
- Heightfield query traverses bounded XZ cells and solves the local bilinear ray equation; object intersections are analytical boxes/ellipsoids. Object transforms agree with CPU yaw rotation. Shadows and one water reflection scene query have explicit limits.
- Simulation/save validation is independent of DOM and graphics. Candidate save values are validated before mutation. Main app regenerates candidate world and simulation before replacing the running state. Manual JSON saves are supported independently of guarded optional storage.
- Input uses held keys and per-step drained mouse deltas. App owns fixed 60 Hz accumulator with bounded catch-up. All registered successful-instance listeners are tracked for removal; `destroy()` cancels animation and releases renderer resources.
- Shell contains keyboard controls, focus styles, named dialog/menu controls, text objectives, reduced motion, high contrast and recovery. Application host entry point exposes instance lifecycle, input and serialization methods; browser packaging makes no arbitrary-OS execution claim.

## Findings communicated to owners

1. Save restore originally discarded high-contrast setting. World owner added validation and restoration; focused round trip covers it.
2. Pause originally retained active drag/last pointer, permitting camera motion after focus loss. Root reports clearing drag state in pause and guarding stale pointer state.
3. Renderer restoration failure callback was unwired by app, hiding shader/resource errors. Root reports wiring `onError` to pause and readable fatal UI/host error.
4. Dynamic train changed from 24 to 30 records while static-selection reservation remained 24. Cap stayed bounded but could omit six selected far static objects. Resolved in the improvement session: reserve the actual dynamic count, invalidate cached selection when capacity changes, and retain dynamic-first capped uploads. Focused renderer-budget.cjs passes five transitions; normal circuit rendering passed.
5. Fragment shader compile failure retained compiled vertex shader; display compilation failure retained scene program/listeners; restoration failure retained fresh allocations. Mock-GL checks reproduced these failures. Root authorized QA's narrow renderer-only fix; all five ownership/failure checks now pass. See `cleanup-report.md`.

## Evidence and limits

Focused Node tests exercise descriptors, terrain samples, route closure/physics feasibility, bridge/platform support, walking collision, braking/rest, equal fixed steps under 30/60/144 Hz presentation schedules, carriage offsets, seam interpolation, delivery priority, a full physics-driven circuit and valid/invalid atomic saves. See `world-regression.cjs`.

Packaging audit parses the final inline script and rejects companion assets, media payloads, network/import/dependency/engine entry points. It supplements runtime request tracking; it is not a proof of all possible dynamic network behavior.

Root owns actual browser interactions and visual inspection, performance measurement, resize/quality/failure checks, GPU error observation and lifecycle tests. Source properties above must not be presented as substitutes for those required runtime checks.

Root reports initial offline hardware rendering fixed by replacing a nested box-normal shader ternary with equivalent explicit branches after ANGLE/D3D11 compilation failed. Shader source was preserved during QA resource cleanup. Root reports initial baseline renders diverse glyph IDs with no GL, console or warning errors; full browser acceptance remains root-owned.
