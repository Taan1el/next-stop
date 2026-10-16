'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const scripts=['world-regression','journey-guidance','exploration-regression','railway-regression','refinement-regression','renderer-resources','renderer-budget','village-regression','career-regression','station-life-regression','station-scenery-regression','ambience-regression','save-fixtures','audit','release-package'];
for(const script of scripts){
  const result=spawnSync(process.execPath,[path.join(__dirname,script+'.cjs')],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
