'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {zipSync,strToU8}=require('fflate');
const root=path.resolve(__dirname,'..');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

function makeRelease(directory=root){
  const {version}=JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8'));
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Release version must be major.minor.patch.');
  const html=fs.readFileSync(path.join(directory,'outputs/next-stop.html'));
  const license=fs.readFileSync(path.join(directory,'LICENSE'));
  if(!html.toString().includes(license.toString().trim()))throw Error('HTML is missing the current license notice. Rebuild first.');
  const quickstart=`NEXT STOP ${version}\n\nOpen next-stop.html in a desktop browser with WebGL2 and hardware acceleration.\nChoose a service and select Start journey. Board with E, or do station work on foot.\nKeyboard and mouse required. No server, installation or network needed.\n\nW/S: power; Space: brake; B: coal; V: whistle; R: reverse while stopped.\nE: board, serve a stopped destination, or leave. WASD: walk.\nC: camera; mouse/arrows: look; Esc: pause; H: controls.\nJ: journal pages for Railway, Work, Notes and Workshop.\nT: collect/handover parcels or start letter sorting. Hold T for 3 seconds to refill a lamp.\n1/2/3: sort addressed letters into Pinebank/Bellweather/Stonehaven sacks.\nL: hand lantern. Settings > Night visibility adjusts brightness.\n\nTwelve station jobs include three parcels carried by train to the next station.\nFares and work rewards share one purse. Paints cost 20 shillings; walking boots\ncost 40 and make walking 12% faster. Owned paints can be switched freely.\nJ > Railway: start another service after finishing at Pinebank.\nJ > Work: nearby jobs first; new rounds after a service or all parcels/letters.\nFinish or return active work before renewal. Tended lamps and earnings remain.\nUse Settings > Export save for a portable backup of progress, parcels and purchases.\nWindows Chromium-based browsers tested. Touch controls are not implemented.\n\nSource and updates: https://github.com/Taan1el/next-stop\nCopyright 2026 Taan1el. See LICENSE for the MIT terms.\n`;
  const files={
    'next-stop.html':html,
    'LICENSE':license,
    'QUICKSTART.txt':strToU8(quickstart),
    'CHANGELOG.md':fs.readFileSync(path.join(directory,'CHANGELOG.md'))
  };
  files['SHA256SUMS.txt']=strToU8(Object.entries(files).map(([name,bytes])=>`${sha256(bytes)}  ${name}`).join('\n')+'\n');
  // A fixed archive timestamp makes identical inputs produce identical ZIPs.
  const entries=Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,[bytes,{mtime:new Date(2026,0,1,0,0,0)}]]));
  return {name:`next-stop-v${version}.zip`,files,bytes:zipSync(entries,{level:9})};
}

if(require.main===module){
  require('./build.cjs');
  const release=makeRelease();
  const directory=path.join(root,'dist');fs.mkdirSync(directory,{recursive:true});
  const target=path.join(directory,release.name);fs.writeFileSync(target,release.bytes);
  fs.writeFileSync(target+'.sha256',`${sha256(release.bytes)}  ${release.name}\n`);
  console.log(`Packaged dist/${release.name} (${release.bytes.length} bytes).`);
}
module.exports={makeRelease,sha256};
