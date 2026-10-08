'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),sandbox={};vm.createContext(sandbox);
vm.runInContext(['world.js','exploration.js'].map(n=>fs.readFileSync(path.join(root,'work/src',n),'utf8')).join('\n')+'\nthis.QA={NSWorld,NSSimulation,NSExploration};',sandbox);
const {NSWorld,NSSimulation,NSExploration}=sandbox.QA;
let passed=0;function test(name,run){run();passed++;console.log('PASS '+name);}
const normalize=v=>JSON.parse(JSON.stringify(v));
test('Anchors are deterministic and safe across several procedural seeds',()=>{
  for(const seed of ['NEXT-STOP','QA-NEXT-STOP','VALLEY-2','RAINY-HOME']){
    const world=new NSWorld(seed),journal=new NSExploration(world),same=new NSExploration(new NSWorld(seed));
    assert.deepEqual(normalize(journal.records),normalize(same.records));assert.equal(journal.total,3);
    for(const r of journal.records){const surface=world.surfaceAt(r.anchor.x,r.anchor.z);assert(surface.walkable);assert(!world.blocked(r.anchor.x,surface.height,r.anchor.z));}
  }
});
test('Passing on the train does not discover walking landmarks',()=>{
  const journal=new NSExploration(new NSWorld('NEXT-STOP'));
  for(const r of journal.records)assert.equal(journal.discover({...r.anchor,mode:'train'}),null);
  assert.equal(journal.count,0);
});
test('Walking discovers each landmark once and exhausts the next-target list',()=>{
  const journal=new NSExploration(new NSWorld('NEXT-STOP'));
  for(const r of journal.records){const player={...r.anchor,mode:'foot'};assert.equal(journal.discover(player).id,r.id);assert.equal(journal.discover(player),null);}
  assert.equal(journal.count,3);assert.equal(journal.nextTarget(journal.records[0].anchor),null);
});
test('Every default landmark is reachable by actual walking along its platform',()=>{
  const world=new NSWorld('NEXT-STOP');
  for(const r of new NSExploration(world).records){
    const sim=new NSSimulation(world),station=world.stations.find(s=>s.name===r.station);sim.train.s=station.s;assert(sim._spawnFoot(station.s));
    for(let tick=0;tick<600;tick++){const dx=r.anchor.x-sim.player.x,dz=r.anchor.z-sim.player.z;if(Math.hypot(dx,dz)<7)break;sim.player.yaw=Math.atan2(dx,dz);sim.step(1/60,{forward:true});}
    assert(Math.hypot(sim.player.x-r.anchor.x,sim.player.z-r.anchor.z)<7,'Walk must reach '+r.name);
  }
});
test('Journal save round trip and legacy saves preserve explicit version semantics',()=>{
  const world=new NSWorld('NEXT-STOP'),journal=new NSExploration(world);journal.discover({...journal.records[1].anchor,mode:'foot'});
  const save=normalize(journal.serialize()),restored=new NSExploration(world);restored.restore(save);assert.deepEqual(normalize(restored.serialize()),save);
  restored.restore(undefined);assert.equal(restored.count,0);
});
test('Selected destinations persist, guide a distant place and clear on discovery',()=>{
  const world=new NSWorld('NEXT-STOP'),journal=new NSExploration(world),record=journal.records[1];
  journal.select(record.id);assert.equal(journal.target(journal.records[0].anchor).record.id,record.id);
  const restored=new NSExploration(world);restored.restore(normalize(journal.serialize()));assert.equal(restored.selected,record.id);
  restored.discover({...record.anchor,mode:'foot'});assert.equal(restored.selected,null);assert.throws(()=>restored.select(record.id));
});
test('Invalid journal restores preserve current discoveries atomically',()=>{
  const journal=new NSExploration(new NSWorld('NEXT-STOP'));journal.discover({...journal.records[0].anchor,mode:'foot'});const before=JSON.stringify(journal.serialize());
  for(const bad of [null,[],{}, {version:99,visited:[]},{version:1,visited:'x'},{version:1,visited:['unknown']},{version:1,visited:[1]},{version:1,visited:[journal.records[0].id,journal.records[0].id]},{version:1,visited:[...journal.records.map(r=>r.id),'extra']},{version:1,visited:[],selected:'unknown'},{version:1,visited:[],selected:3},{version:1,visited:[journal.records[0].id],selected:journal.records[0].id}]){
    assert.throws(()=>journal.restore(bad),/Invalid save/);assert.equal(JSON.stringify(journal.serialize()),before);
  }
});
console.log(`${passed}/${passed} exploration checks passed.`);
