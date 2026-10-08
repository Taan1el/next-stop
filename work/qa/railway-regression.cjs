'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),sandbox={};vm.createContext(sandbox);
vm.runInContext(['world.js','railway.js'].map(n=>fs.readFileSync(path.join(root,'work/src',n),'utf8')).join('\n')+'\nthis.QA={NSWorld,NSSimulation,NSRailway};',sandbox);
const {NSWorld,NSSimulation,NSRailway}=sandbox.QA,world=new NSWorld('NEXT-STOP');let count=0;
const plain=v=>JSON.parse(JSON.stringify(v));
function test(name,run){run();count++;console.log('PASS '+name);}
function fresh(){const sim=new NSSimulation(world),rail=new NSRailway(world);sim.action('interact');return{sim,rail};}
test('Original generation remains checksum-compatible while new scenery is deterministic',()=>{
  const old=new NSWorld('NEXT-STOP',1);assert.equal(old.checksum(),'4bd6b452');assert.equal(new NSWorld('NEXT-STOP').checksum(),world.checksum());
  assert.notEqual(old.checksum(),world.checksum());assert(world.maxHeight>180);assert(world.objects.filter(o=>o.material===12).length>=400);assert.equal(world.lamps.length,3);
  assert.throws(()=>new NSWorld('NEXT-STOP',99));
});
test('Firing is an aboard action consuming coal, bounded and rate limited',()=>{
  const {sim,rail}=fresh();sim.player.mode='foot';const before=JSON.stringify(rail.serialize());rail.action('stoke',sim);assert.equal(JSON.stringify(rail.serialize()),before);
  sim.player.mode='train';rail.engine.fire=.35;rail.action('stoke',sim);assert.equal(rail.engine.coal,97);assert(Math.abs(rail.engine.fire-.63)<1e-10);
  const fired=JSON.stringify(rail.serialize());rail.action('stoke',sim);assert.equal(JSON.stringify(rail.serialize()),fired);
});
test('Pressure controls traction and brighter fire rebuilds steam',()=>{
  const {sim,rail}=fresh();rail.engine.fire=.9;rail.engine.pressure=6;rail.apply(sim);const low=sim.tractionScale;
  for(let i=0;i<600;i++){rail.step(1/60,sim);sim.step(1/60,{brake:true});}
  assert(rail.engine.pressure>6);assert(sim.tractionScale>low);assert(rail.engine.water<100);assert(rail.engine.fire<.9);
  rail.assisted=true;rail.step(1/60,sim);assert.equal(sim.tractionScale,1);assert.equal(rail.engine.pressure,9.2);
});
test('Steam state and fixed-step motion agree under different presentation schedules',()=>{
  const run=rate=>{const {sim,rail}=fresh();let acc=0;for(let frame=0;frame<rate*20;frame++){acc+=1/rate;while(acc+1e-12>=1/60){rail.step(1/60,sim);sim.step(1/60,{forward:true});acc-=1/60;}}return{sim:plain(sim.serialize()),rail:plain(rail.serialize())};};
  assert.deepEqual(run(30),run(60));assert.deepEqual(run(144),run(60));
});
test('Crossing warnings work forward, reverse and across the route seam',()=>{
  const {sim,rail}=fresh(),section=rail.sections[0];sim.train.s=section.s-65;assert.equal(rail.instruction(sim).id,section.id);
  sim.train.direction=-1;sim.train.s=section.s+65;assert.equal(rail.instruction(sim).id,section.id);
  rail.sections[0].s=15;sim.train.direction=1;sim.train.s=world.routeLength-20;assert.equal(rail.instruction(sim).id,section.id);
});
test('Whistle satisfies the nearby crossing and speeding changes service rating',()=>{
  const {sim,rail}=fresh();sim.train.s=rail.sections[0].s;sim.train.speed=6.5;rail.step(1,sim);assert.equal(rail.overspeed,1);
  rail.action('whistle',sim);assert(rail.whistled.has('lake-crossing'));assert(rail.whistleUntil>sim.time);assert(rail.engine.pressure<9.2);
  rail.overspeed=40;assert.equal(rail.grade(),'Room to improve');
});
test('Passenger boarding waits at a stopped destination and clears when moving',()=>{
  const {sim,rail}=fresh();rail.service='passenger';sim.train.s=world.stations[1].s;sim.train.speed=0;rail.step(1/60,sim);assert.match(rail.waiting(sim),/4 s/);
  sim.time+=4.1;assert.equal(rail.waiting(sim),null);sim.train.speed=2;rail.step(1/60,sim);assert.equal(rail.dwell,null);
});
test('Freight manifests, earned fares and station resupply follow actual stops',()=>{
  const {sim,rail}=fresh();assert.match(rail.job(sim),/Milk/);sim.train.s=world.stations[1].s;sim.train.speed=0;sim.action('interact');rail.engine.coal=15;rail.engine.water=15;rail.recordStop(sim,1);
  assert.equal(rail.stops.length,1);assert(rail.earnings>0);assert.equal(rail.engine.coal,100);assert.equal(rail.engine.water,100);assert.match(rail.job(sim),/Post/);
});
test('Free running leaves station interactions available without delivery obligations',()=>{
  const {sim,rail}=fresh();rail.service='explore';rail.configure(sim);assert(sim.delivery.finished);assert.equal(rail.stops.length,0);assert.match(rail.job(sim),/Free/);sim.train.speed=0;sim.action('interact');assert.equal(sim.player.mode,'foot');
});
test('Railway save round trip preserves operational state and legacy saves use assistance',()=>{
  const {sim,rail}=fresh();rail.action('stoke',sim);rail.action('whistle',sim);const saved=plain(rail.serialize()),restored=new NSRailway(world);restored.restore(saved,sim);assert.deepEqual(plain(restored.serialize()),saved);
  const legacy=new NSRailway(world);legacy.restore(undefined,sim);assert(legacy.assisted);assert.equal(sim.tractionScale,1);
});
test('Invalid railway saves reject without changing operational state or drive scale',()=>{
  const {sim,rail}=fresh(),valid=plain(rail.serialize());rail.apply(sim);const before=JSON.stringify(rail.serialize()),scale=sim.tractionScale;
  for(const bad of [null,[],{...valid,version:99},{...valid,service:'unknown'},{...valid,engine:{...valid.engine,pressure:NaN}},{...valid,engine:{...valid.engine,coal:-1}},{...valid,whistled:['fake']},{...valid,stops:[{station:'fake',time:0}]},{...valid,dwell:{index:4,since:0}},{...valid,lastStoke:9999}]){assert.throws(()=>rail.restore(bad,sim),/Invalid save/);assert.equal(JSON.stringify(rail.serialize()),before);assert.equal(sim.tractionScale,scale);}
});
console.log(`${count}/${count} railway/world-version regressions passed.`);
