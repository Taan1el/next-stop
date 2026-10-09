'use strict';
// Exercise numerical object selection/upload without claiming GPU pixel coverage.
// Production source is loaded read-only. A recording GL stub checks the actual
// upload boundaries while a stationary camera exercises selection-cache changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const filename = path.resolve(__dirname, '../src/renderer.js');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });

function primitive(index, dynamic = false) {
  return {
    x: (dynamic ? -100 : 10) + index * 0.25, y: 2, z: 20,
    hx: 1, hy: 1, hz: 1, yaw: 0, material: dynamic ? 8 : 4, type: 0
  };
}

const staticObjects = Array.from({ length: 300 }, (_, i) => primitive(i));
const renderer = Object.create(context.NSGlyphRenderer.prototype);
const uploads = [];
Object.assign(renderer, {
  staticObjects: staticObjects.map(object => ({ object, radius: Math.sqrt(3) })),
  objectData: new Float32Array(256 * 12),
  objectTexture: {},
  _selection: [], _selectionPosition: null, _selectionCapacity: -1,
  gl: {
    TEXTURE_2D: 1, RGBA: 2, FLOAT: 3,
    bindTexture() {},
    texSubImage2D(target, level, x, y, width, height, format, type, data) {
      uploads.push({ target, level, x, y, width, height, format, type,
        data: new Float32Array(data) });
    }
  }
});

const eye = [0, 5, 0];
let dynamic = [], dynamicQueries = 0, passed = 0;
const sim = { dynamicObjects() { dynamicQueries++; return dynamic; } };

for (const count of [30, 40, 260, 0, 30]) {
  dynamic = Array.from({ length: count }, (_, i) => primitive(i, true));
  const previousSelection = renderer._selection;
  const beforeQueries = dynamicQueries;
  renderer._uploadObjects(sim, eye);
  const expectedStatic = Math.max(0, 256 - count);
  const upload = uploads.at(-1);

  assert.equal(dynamicQueries, beforeQueries + 1, 'Query dynamic shapes once per upload.');
  assert.notEqual(renderer._selection, previousSelection,
    'Changing dynamic count must refresh selection without camera movement.');
  assert.equal(renderer._selectionCapacity, expectedStatic);
  assert.equal(renderer._selection.length, expectedStatic);
  assert.equal(renderer.objectCount, 256);
  assert.equal(upload.width, 3, 'Each numerical primitive occupies three RGBA records.');
  assert.equal(upload.height, 256, 'GPU upload must remain inside the 256-object allocation.');
  assert.equal(upload.data.length, 256 * 12, 'Upload must contain exactly the bounded records.');

  for (let i = 0; i < Math.min(count, 256); i++) {
    assert.equal(upload.data[i * 12], dynamic[i].x, 'Dynamic objects must precede static objects.');
    assert.equal(upload.data[i * 12 + 10], 8, 'Dynamic material must survive numerical packing.');
  }
  for (let i = 0; i < expectedStatic; i++) {
    assert.equal(upload.data[(count + i) * 12], renderer._selection[i].entry.object.x,
      'Every selected static primitive must fit and reach the upload.');
  }

  const stableSelection = renderer._selection;
  renderer._uploadObjects(sim, eye);
  assert.equal(renderer._selection, stableSelection,
    'Stationary camera with unchanged dynamic count should reuse selection.');
  assert.equal(dynamic.length, count, 'Selection must not mutate simulation primitives.');
  assert.equal(staticObjects.length, 300, 'Selection must not mutate world primitives.');
  passed++;
  console.log(`PASS dynamic=${count}, selected static=${expectedStatic}, uploaded=${upload.height}`);
}

// Detail LOD must free records for scenery, then return when approaching again.
const detail={...primitive(0),x:10,z:0,detail:true,lod:70,info:3};
const silhouette={...primitive(1),x:10,z:0,material:25};
renderer.staticObjects=[detail,silhouette].map(object=>({object,radius:Math.sqrt(3)}));
renderer._selectionPosition=null;dynamic=[];
renderer._uploadObjects(sim,eye);
assert.equal(renderer.objectCount,2);
assert(renderer._selection.some(candidate=>candidate.entry.object===detail));
assert.equal(renderer.objectData[11],3,'Per-object detail metadata must survive the upload.');
renderer._uploadObjects(sim,[110,5,0]);
assert.equal(renderer.objectCount,1,'Distant decorative detail must leave the scene budget.');
assert.equal(renderer._selection[0].entry.object,silhouette,'The building silhouette must remain.');
renderer._uploadObjects(sim,eye);
assert.equal(renderer.objectCount,2,'Returning close must restore detail after cache invalidation.');
passed++;console.log('PASS close/far/close detail LOD preserves silhouettes and metadata');
console.log(`${passed}/6 renderer budget/cache transitions passed.`);
