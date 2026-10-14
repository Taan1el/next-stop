'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
// Identical scene/glyph fixes; only cell fill and ink shading differ.
// Browser processes are serial so frame samples do not compete for the GPU.
for(const args of [
 ['work/qa/build-fill-reference.cjs'],
 ['work/playtest-glyph-fill.cjs','fill-reference','.omx/fill-reference/outputs/next-stop.html'],
 ['work/playtest-glyph-fill.cjs','fill-final','outputs/next-stop.html','.omx/evidence/cycles/fill-reference/result.json'],
 ['work/playtest-night.cjs','fill-night']
]){const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
