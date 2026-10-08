# Next Stop

A rural railway made of coloured glyphs. Walk the valley, drive the local train and work its station stops through changing weather.

## Play

Open **outputs/next-stop.html** in a browser with WebGL2. It runs offline. The game needs only that file; no engine, images, imported models or runtime libraries.

## Develop

Readable JavaScript and the HTML shell live in **work/src/**. Assemble with:

    node work/build.cjs

The generated HTML is limited to 2,000,000 bytes. Regression scripts are under **work/qa/**; actual browser evidence is kept locally under **.omx/**. See **outputs/CLAUDE_HANDOFF.md** and **outputs/NEXT_STOP_VERIFICATION.md** for current architecture and test coverage.

Development playtests use Playwright installed on the developer's machine. It is not bundled in the game. Adjust the test scripts' local runtime paths when moving machines.

## History

Keep changes small and reviewable, separating behavior, rendering, UI, verification and documentation. Repository author and committer: **Taan1el <taaniel.vananurm@gmail.com>**.

The custom renderer queries numerical terrain and solids directly at character-grid resolution, emits glyph IDs and colours, then expands embedded numeric glyph masks. It never renders a conventional image and applies a text filter.
