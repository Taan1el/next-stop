'use strict';
// Generate an unfilled comparison using the SAME scene/glyph fixes as production.
// This fixture changes only colour encoding and display ink, never the live HTML.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),stage=path.join(root,'.omx/fill-reference');
let renderer=fs.readFileSync(path.join(root,'work/src/renderer.js'),'utf8');
const replace=(from,to)=>{assert(renderer.includes(from),'Reference fixture marker changed: '+from);renderer=renderer.replace(from,to);};
const start=renderer.indexOf('      // The lit material fills the cell;'),end=renderer.indexOf('      float fogDensity=',start);assert(start>=0&&end>start);
renderer=renderer.slice(0,start)+`      foreground=colour*1.28+vec3(.022);
      background=colour*mix(.39,.31,smoothstep(-.15,.25,u_sun.y));
      if (material==7) { foreground+=vec3(.11,.12,.12); background*=.45; }
      if (material==9) background=colour*.24;
      if (material==4||material==8||material==27||material==30||material==35) {
        foreground*=1.12; background*=.78;
      }
      if (material==19){foreground=mix(skyColour,vec3(.57,.58,.53),.35);background=skyColour*.70;}
`+renderer.slice(end);
replace('background=skyColour*.82;','background=skyColour*.70;');
replace('background=mix(background,air*.78,aerial);','background=mix(background,air*.58,aerial);');
replace('background=mix(background,mistColour*.82,valleyMist);','background=mix(background,mistColour*.62,valleyMist);');
replace('background=mix(background,skyColour*.86,fog);','background=mix(background,skyColour*.67,fog);');
const inkStart=renderer.indexOf('    // A small vertical ink gradient'),inkEnd=renderer.indexOf('    if (u_debug',inkStart);assert(inkStart>=0&&inkEnd>inkStart);
renderer=renderer.slice(0,inkStart)+'    vec3 colour=on ? foreground : background;\n'+renderer.slice(inkEnd);
fs.mkdirSync(path.join(stage,'work/src'),{recursive:true});
for(const name of fs.readdirSync(path.join(root,'work/src')))fs.writeFileSync(path.join(stage,'work/src',name),name==='renderer.js'?renderer:fs.readFileSync(path.join(root,'work/src',name)));
for(const name of ['work/build.cjs','LICENSE'])fs.copyFileSync(path.join(root,name),path.join(stage,name));
require(path.join(stage,'work/build.cjs'));
console.log('Reference HTML: .omx/fill-reference/outputs/next-stop.html');
