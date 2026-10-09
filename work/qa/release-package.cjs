'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {unzipSync,strFromU8}=require('fflate');
const {makeRelease,sha256}=require('../package-release.cjs');
const root=path.resolve(__dirname,'../..'),release=makeRelease(root),files=unzipSync(release.bytes);
assert.deepEqual(Object.keys(files).sort(),['CHANGELOG.md','LICENSE','QUICKSTART.txt','SHA256SUMS.txt','next-stop.html'].sort());
assert.deepEqual(Buffer.from(files['next-stop.html']),fs.readFileSync(path.join(root,'outputs/next-stop.html')));
assert.deepEqual(Buffer.from(files.LICENSE),fs.readFileSync(path.join(root,'LICENSE')));
for(const line of strFromU8(files['SHA256SUMS.txt']).trim().split('\n')){
  const [hash,name]=line.split('  ');assert.equal(sha256(files[name]),hash,'Checksum mismatch for '+name);
}
assert.deepEqual(release.bytes,makeRelease(root).bytes,'Packaging identical inputs must be reproducible.');
assert.match(strFromU8(files['QUICKSTART.txt']),/Keyboard and mouse required/);
console.log('PASS release archive: five player files, exact HTML/license, verified checksums, deterministic ZIP.');
