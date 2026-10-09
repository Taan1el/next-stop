# Next Stop

An old rural railway made of coloured glyphs. Drive a steam train through woods, fields, mountain ridges and three country stations, or leave the cab to explore.

## Play

Open **outputs/next-stop.html** in a browser with WebGL2. The game runs offline from that single file. No images, imported models, engine or runtime libraries are required.

Choose goods, passenger or free-running service. Goods work offers mixed farm freight, heavier timber or prompt mail. Passenger stops include a short boarding wait. Free running has no delivery obligation. Settings offers an automatic fireman for relaxed driving.

| Controls | Action |
|---|---|
| WASD | Walk; aboard, W/S raises/lowers power |
| E | Board, serve a stopped destination, or leave |
| Space | Hold the brake |
| B / V | Add coal / sound the whistle |
| C / F | Cab/chase view / centre camera |
| R | Reverse while stopped; apply W again afterward |
| Mouse or arrows | Look around |
| J | Saved field notes and six walking destinations |
| Esc / H | Pause / controls |

Watch steam pressure and fire, ease power for bridges and crossings, and whistle before crossing. Completed stops replenish coal/water and record service earnings with a station bell. Steam chuffs and rail joints follow movement. Volume/mute controls are in Settings.

The locomotive has a rounded boiler, spoked wheels, moving coupling rods, brass fittings and cab gauges. Stations have brickwork, framed windows, doors, canopies, furniture and readable glyph nameboards. Warm/cool lighting, material gradients and distance haze give the valley depth. Stars keep fixed celestial directions when the camera moves. Wind moves foliage, fire flickers, smoke rises, clouds drift and lamps warm their surroundings.

Progress checkpoints locally every ten seconds and when paused. Reopen the HTML and choose **Continue last journey**. Browser storage may be unavailable for local files; Settings still exports/imports portable JSON saves.

## Develop

Readable source lives in **work/src/**. Assemble with:

    node work/build.cjs

The builder caps the HTML at 2,000,000 bytes. Focused scripts live under **work/qa/**. Real-time browser playtests use normal player inputs; local evidence and plans live under ignored **.omx/**. See **outputs/CLAUDE_HANDOFF.md** and **outputs/NEXT_STOP_VERIFICATION.md** for architecture, current coverage and limitations.

Development tests use local Playwright and Edge/Chrome installations. Adjust those test paths when moving machines; these tools are never bundled in the game.

World versions 1, 2 and 3 preserve their numerical generation for existing saves. New valleys use version 4. Validate saves before swapping live state. Edit source and rebuild instead of patching only generated HTML.

## History

Keep changes small and reviewable. Every repository author and committer must be **Taan1el <taaniel.vananurm@gmail.com>**, with no additional contributor trailers. Identity is configured locally in this repository. The private GitHub repository is [Taan1el/next-stop](https://github.com/Taan1el/next-stop), configured as origin. Push only when authorized.

The renderer queries numerical terrain and solids directly at character-grid resolution, emits glyph IDs and colours, then displays embedded numeric glyph masks. It never renders a conventional image and applies a text filter.
