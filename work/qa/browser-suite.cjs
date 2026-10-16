'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
// Browser processes run serially so they do not compete for GPU measurements.
for(const [script,name] of [['playtest-rural-ui','ui'],['playtest-legacy3'],['playtest-colour-feedback','colour-feedback'],['playtest-final-host'],['playtest-village','village'],['playtest-night','night'],['qa/glyph-stability'],['qa/watch-touch']]){
  const result=spawnSync(process.execPath,[path.join(root,'work',script+'.cjs'),...(name?[name]:[])],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
