# Save compatibility fixtures

These JSON files contain only numerical game state captured from successful earlier playthroughs of the NEXT-STOP seed.

- `world1-completed.json`: original completed freight circuit, before journal and steam modules; tests compatible defaults.
- `world1-exploration.json`: original-world completed circuit with a discovered Bellweather tower and the extended save schema; tests host round trips.
- `world3-completed.json`: rural world-3 completed circuit with the service ledger and six notes; tests generation preservation.

They contain no workstation paths, logs, screenshots or user credentials. `npm test` validates all three against current save readers. Keep them unchanged when evolving later world generations; update compatibility behavior rather than regenerating historical fixtures.
