'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),box=vm.createContext({});
vm.runInContext(['world','railway','village'].map(n=>fs.readFileSync(path.join(root,'work/src',n+'.js'),'utf8')).join('\n')+'\nthis.Q={NSWorld,NSSimulation,NSRailway,NSVillage};',box);
const {NSWorld,NSSimulation,NSRailway,NSVillage}=box.Q,world=new NSWorld('NEXT-STOP'),plain=v=>JSON.parse(JSON.stringify(v));let count=0;
function test(name,run){run();console.log('PASS '+name);count++;}
function fresh(){const sim=new NSSimulation(world),rail=new NSRailway(world),village=new NSVillage(world,rail);return{sim,rail,village};}
function finish(sim,rail){sim.train.s=0;sim.train.speed=0;sim.player.mode='foot';sim._spawnFoot(0);sim.action('interact');for(const index of [1,2,0]){sim.time+=90;sim.train.s=world.stations[index].s;sim.train.speed=0;sim.action('interact');rail.recordStop(sim,index);}assert(sim.delivery.finished);}
function stand(sim,point){Object.assign(sim.player,point,{mode:'foot'});}
test('Repeated services keep the world, clock and lifetime earnings without banking twice',()=>{
 const {sim,rail}=fresh(),checksum=world.checksum();finish(sim,rail);const earned=rail.earnings,clock=sim.time;sim.train.wheelTravel=999;
 assert(rail.canBegin(sim));rail.beginService(sim,'passenger','mixed');assert.equal(rail.totalEarnings,earned);assert.equal(rail.earnings,0);assert.equal(rail.completedServices(sim),1);assert.equal(sim.delivery.index,1);assert.equal(sim.delivery.started,true);assert.equal(sim.time,clock);assert.equal(sim.train.wheelTravel,999);assert.equal(world.checksum(),checksum);
 const before=plain(rail.serialize());assert.match(rail.beginService(sim,'freight','mail'),/Finish/);assert.deepEqual(plain(rail.serialize()),before);
 for(const index of [1,2,0]){sim.time+=90;sim.train.s=world.stations[index].s;sim.delivery.completed++;sim.delivery.index=(index+1)%3;sim.delivery.finished=index===0;rail.recordStop(sim,index);}assert.equal(rail.completedServices(sim),2);assert.equal(rail.totalEarnings,earned+72);
 rail.beginService(sim,'freight','mail');assert.equal(rail.totalEarnings,earned+72);assert.equal(rail.completedServices(sim),2);
});
test('A new service requires Pinebank and a stopped train, with no rejected-action mutation',()=>{
 const {sim,rail}=fresh();finish(sim,rail);const snapshot=plain(rail.serialize());sim.train.speed=.1;assert.match(rail.beginService(sim,'passenger','mixed'),/Finish/);sim.train.speed=0;sim.train.s=world.stations[1].s;assert.match(rail.beginService(sim,'passenger','mixed'),/Finish/);assert.deepEqual(plain(rail.serialize()),snapshot);
});
test('Renewed mail deadlines use service time and fares are not paid twice',()=>{
 const {sim,rail}=fresh();finish(sim,rail);sim.time=2000;rail.beginService(sim,'freight','mail');sim.time+=90;sim.delivery.completed=1;rail.recordStop(sim,1);assert.equal(rail.earnings,26);rail.recordStop(sim,1);assert.equal(rail.earnings,26);
});
test('Cross-station parcels survive boarding and only pay at their destination on foot',()=>{
 const {sim,rail,village:v}=fresh(),job=v.job('dispatch-0');stand(sim,job.anchor);assert.match(v.interact(sim),/Bellweather/);assert.equal(v.target(sim.player).record.station,'Bellweather');const saved=plain(v.serialize());sim.action('interact');sim.player.mode='train';Object.assign(sim.player,job.destination);assert.equal(v.interact(sim),null);assert.equal(v.wallet,0);
 const copy=new NSVillage(world,rail);copy.restore(saved,sim);stand(sim,job.destination);sim.time=241;assert.match(copy.interact(sim),/complete/);assert.equal(copy.wallet,18);assert.equal(copy.carrying,null);copy.interact(sim);assert.equal(copy.wallet,18);
});
test('Fares and station rewards fund the same paint and boots, which cannot be charged twice',()=>{
 const {sim,rail,village:v}=fresh();finish(sim,rail);assert.equal(v.wallet,54);v.buyGear('boots');v.apply(sim);assert.equal(v.wallet,14);assert.equal(sim.walkScale,1.12);v.buyGear('boots');assert.equal(v.wallet,14);assert.match(v.buyPaint('green'),/needs/);
 const job=v.job('parcel-0');stand(sim,job.anchor);v.interact(sim);stand(sim,job.destination);v.interact(sim);v.buyPaint('green');assert.equal(v.wallet,4);v.buyPaint('original');v.buyPaint('green');assert.equal(v.wallet,4);
 const saved=plain(v.serialize()),copy=new NSVillage(world,rail);copy.restore(saved,sim);assert.deepEqual(plain(copy.serialize()),saved);assert.equal(copy.wallet,4);
});
test('Work renewal keeps lamp warmth, money and reputation, changes letters, and refuses a second refresh',()=>{
 const {sim,rail,village:v}=fresh(),lamp=v.job('lamp-0'),parcel=v.job('parcel-0');stand(sim,lamp.anchor);v.interact(sim);for(let i=0;i<181;i++)v.step(1/60,sim,{work:true});stand(sim,parcel.anchor);v.interact(sim);stand(sim,parcel.destination);v.interact(sim);const orders=plain(v.orders);assert(!v.canRenew(sim));finish(sim,rail);const wallet=v.wallet;assert(v.canRenew(sim));v.renew(sim);assert.equal(v.round,1);assert.equal(v.wallet,wallet);assert(v.completed.has('lamp-0'));assert(!v.completed.has('parcel-0'));assert.notDeepEqual(plain(v.orders),orders);assert.equal(v.pastCompleted,1);assert(!v.canRenew(sim));const saved=plain(v.serialize());v.renew(sim);assert.deepEqual(plain(v.serialize()),saved);
 rail.beginService(sim,'freight','mixed');assert(!v.canRenew(sim));const copy=new NSVillage(world,rail);copy.restore(saved,sim);assert.deepEqual(plain(copy.serialize()),saved);
});
test('Active work blocks renewal and persists when a new train service starts',()=>{
 const {sim,rail,village:v}=fresh();finish(sim,rail);stand(sim,v.job('dispatch-0').anchor);v.interact(sim);assert(!v.canRenew(sim));const saved=plain(v.serialize());v.renew(sim);assert.deepEqual(plain(v.serialize()),saved);rail.beginService(sim,'freight','timber');assert.deepEqual(plain(v.serialize()),saved);
});
test('Completing all parcels and letters unlocks a round without driving, and can earn again',()=>{
 const {sim,village:v}=fresh();for(const job of v.jobs.filter(j=>j.kind!=='lamp')){stand(sim,job.anchor);v.interact(sim);if(job.kind==='post')for(const address of v.orders[job.index])v.sort(address,sim);else{stand(sim,job.destination);v.interact(sim);}}assert(v.canRenew(sim));const wallet=v.wallet;v.renew(sim);assert.equal(v.wallet,wallet);assert.equal(v.pastCompleted,9);assert.equal(v.completed.size,0);const parcel=v.job('parcel-0');stand(sim,parcel.anchor);v.interact(sim);stand(sim,parcel.destination);v.interact(sim);assert.equal(v.wallet,wallet+10);
});
test('Career saves round-trip, legacy fields remain absent, and rejected imports are atomic',()=>{
 const {sim,rail}=fresh(),legacy=plain(rail.serialize());assert(!('career'in legacy));const copy=new NSRailway(world);copy.restore(legacy,sim);assert.deepEqual(plain(copy.serialize()),legacy);finish(sim,rail);rail.beginService(sim,'passenger','mixed');const saved=plain(rail.serialize());copy.restore(saved,sim);assert.deepEqual(plain(copy.serialize()),saved);
 for(const change of [d=>d.career.startedAt=sim.time+1,d=>d.career.bankedEarnings=-1,d=>d.career.services=1.5,d=>d.career.services=100001]){const bad=plain(saved);change(bad);assert.throws(()=>copy.restore(bad,sim),/Invalid save/);assert.deepEqual(plain(copy.serialize()),saved);}
 copy.restore(legacy,sim);assert(!('career'in copy.serialize()));
});
test('Invalid renewed work and unaffordable equipment reject without altering state or walking speed',()=>{
 const {sim,rail,village:v}=fresh();finish(sim,rail);v.renew(sim);v.buyGear('boots');v.apply(sim);const saved=plain(v.serialize()),copy=new NSVillage(world,rail);copy.restore(saved,sim);
 for(const change of [d=>d.round=-1,d=>d.pastCompleted=10,d=>d.pastEarnings=999,d=>d.renewedServices=2,d=>d.gear=['boots','boots'],d=>d.gear=['rocket']]){const bad=plain(saved);change(bad);assert.throws(()=>copy.restore(bad,sim),/Invalid save/);assert.deepEqual(plain(copy.serialize()),saved);assert.equal(sim.walkScale,1.12);}
 const empty=fresh(),bad=plain(empty.village.serialize());Object.assign(bad,{version:2,round:0,pastEarnings:0,pastCompleted:0,renewedServices:0,gear:['boots']});assert.throws(()=>empty.village.restore(bad,empty.sim),/Invalid save/);
});
test('Interrupted older saves with missing receipts still earn remaining fares and replenish supplies',()=>{
 for(const completed of [1,2])for(const missing of [true,false]){
  const {sim,rail}=fresh();sim.player.mode='train';Object.assign(sim.delivery,{started:true,finished:false,index:(completed+1)%3,completed});sim.time=200;
  if(missing)rail.restore(undefined,sim);else{const data=plain(rail.serialize());if(completed===2)data.stops=[{station:'Bellweather',time:90}];rail.restore(data,sim);}
  const before=rail.earnings;
  while(!sim.delivery.finished){const index=sim.delivery.index;sim.time+=90;sim.train.s=world.stations[index].s;rail.engine.coal=10;rail.engine.water=10;sim.action('interact');rail.recordStop(sim,index);assert.equal(rail.engine.coal,100);assert.equal(rail.engine.water,100);const earned=rail.earnings;rail.recordStop(sim,index);assert.equal(rail.earnings,earned);const saved=plain(rail.serialize()),copy=new NSRailway(world);copy.restore(saved,sim);assert.deepEqual(plain(copy.serialize()),saved);}
  assert.equal(rail.earnings-before,(3-completed)*18);
 }
});
test('Boots affect walking only while preserving the historical base speed',()=>{
 const a=new NSSimulation(world),b=new NSSimulation(world);a._spawnFoot(0);b._spawnFoot(0);b.walkScale=1.12;const beforeA={...a.player},beforeB={...b.player};a.step(1/60,{forward:true});b.step(1/60,{forward:true});const distance=(p,q)=>Math.hypot(p.x-q.x,p.z-q.z);assert(Math.abs(distance(b.player,beforeB)/distance(a.player,beforeA)-1.12)<1e-8);assert.equal(a.train.s,b.train.s);
});
console.log(`${count}/${count} career and repeatable-work checks passed.`);
