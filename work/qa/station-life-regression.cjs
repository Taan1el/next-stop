'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),box=vm.createContext({});
vm.runInContext(['world','railway','village','station-life'].map(name=>fs.readFileSync(path.join(root,'work/src',name+'.js'),'utf8')).join('\n')+'\nthis.Q={NSWorld,NSSimulation,NSRailway,NSVillage,NSStationLife};',box);
const {NSWorld,NSSimulation,NSRailway,NSVillage,NSStationLife}=box.Q,plain=v=>JSON.parse(JSON.stringify(v)),world=new NSWorld('NEXT-STOP');let count=0;
function test(name,run){run();count++;console.log('PASS '+name);}
function fresh(w=world){const sim=new NSSimulation(w),rail=new NSRailway(w),village=new NSVillage(w,rail),life=new NSStationLife(w,village,rail);sim.stationLife=life;return{sim,rail,village,life};}
function stand(sim,point){Object.assign(sim.player,point,{mode:'foot'});}
function steps(life,sim,seconds,input={}){for(let i=0;i<Math.ceil(seconds*60);i++)life.step(1/60,sim,input);}
function funded(amount=100){const state=fresh();state.rail.earnings=amount;return state;}
test('Station anchors are dry, unblocked and distinct from existing station work',()=>{
 for(const version of [1,2,3,4]){const w=new NSWorld('NEXT-STOP',version),{life,village}=fresh(w);for(const site of life.sites)for(const kind of ['crane','door','project']){const point=site[kind];assert(w.surfaceAt(point.x,point.z).walkable);assert(!w.blocked(point.x,point.y,point.z));for(const job of village.jobs)assert(Math.hypot(point.x-job.anchor.x,point.z-job.anchor.z)>2.4);}}
});
test('Fishing uses a genuine reachable lake shore, not a landlocked platform',()=>{
 const {life}=fresh(),site=life.sites.find(s=>s.fish);assert(site);assert.equal(site.station.name,'Bellweather');assert.equal(life.sites.filter(s=>s.fish).length,1);const p=site.fish;assert(world.surfaceAt(p.x,p.z).walkable);assert(!world.blocked(p.x,p.y,p.z));assert(world.heightAt(p.x+p.dx*3,p.z+p.dz*3)<world.waterLevel);
 const sim=new NSSimulation(world),start={x:site.station.x+Math.cos(site.station.yaw)*4.4+Math.sin(site.station.yaw)*-25,z:site.station.z-Math.sin(site.station.yaw)*4.4+Math.cos(site.station.yaw)*-25};stand(sim,{...start,y:world.surfaceAt(start.x,start.z).height});sim.player.yaw=Math.atan2(p.x-sim.player.x,p.z-sim.player.z);for(let i=0;i<900&&Math.hypot(sim.player.x-p.x,sim.player.z-p.z)>.15;i++)sim.step(1/60,{forward:true});assert(Math.hypot(sim.player.x-p.x,sim.player.z-p.z)<.2,'Shore must be reached by actual collision-aware walking');
});
test('Crane needs local on-foot hold and a stopped locomotive at the same station',()=>{
 const {sim,rail,life}=fresh(),site=life.sites[0];rail.engine.water=0;stand(sim,site.crane);sim.train.speed=.1;assert.match(life.interact(sim),/Stop/);assert.equal(life.refill,null);sim.train.speed=0;sim.train.s=world.stations[1].s;assert.match(life.interact(sim),/Stop/);sim.train.s=0;sim.player.mode='train';assert.equal(life.interact(sim),null);sim.player.mode='foot';assert.match(life.interact(sim),/six seconds/);steps(life,sim,3,{work:true});assert(Math.abs(rail.engine.water-50)<1e-8);life.step(1/60,sim,{work:false});assert.equal(life.refill,null);assert(Math.abs(rail.engine.water-50)<1e-8);life.interact(sim);sim.player.x+=10;life.step(1/60,sim,{work:true});assert.equal(life.refill,null);stand(sim,site.crane);life.interact(sim);steps(life,sim,3.1,{work:true});assert.equal(rail.engine.water,100);assert.equal(life.refill,null);assert.equal(life.serialize(),undefined);
});
test('Water cranes stay optional and assisted stops always replenish water',()=>{
 for(const manual of [false,true])for(const assisted of [false,true]){const {sim,rail,life}=fresh();life.setManualWater(manual);rail.assisted=assisted;rail.engine.water=10;sim.delivery.completed=1;rail.recordStop(sim,1);assert.equal(rail.engine.water,manual&&!assisted?10:100);assert.equal(rail.engine.coal,100);assert(!('manualWater' in rail.serialize()));}
});
test('Restorations share the purse with boots and paint and cannot be bought twice or remotely',()=>{
 const {sim,rail,village:v,life}=funded(72),site=life.sites[0];assert(!life.canRepair('fence-0',sim));stand(sim,site.project);assert(life.canRepair('fence-0',sim));life.repair('fence-0',sim);assert.equal(v.wallet,60);life.repair('fence-0',sim);assert.equal(v.wallet,60);life.repair('fireplace-0',sim);assert.equal(v.wallet,42);v.buyGear('boots');assert.equal(v.wallet,2);assert.match(v.buyPaint('green'),/needs/);sim.player.mode='train';assert(!life.canRepair('fence-1',sim));assert.equal(life.spending,30);assert.equal(rail.totalEarnings,72);
});
test('Waiting room movement is bounded, furniture blocks and saves remain outdoors',()=>{
 const {sim,life}=fresh(),site=life.sites[0];stand(sim,site.door);const outdoor={x:sim.player.x,y:sim.player.y,z:sim.player.z};assert.match(life.interact(sim),/Waiting room/);assert(life.indoor);for(let i=0;i<1200;i++)sim.step(1/60,{forward:true,right:true});assert(Math.abs(life.indoor.x)<=2.8&&Math.abs(life.indoor.z)<=6.5);for(const key of ['x','y','z'])assert.equal(sim.player[key],outdoor[key]);
 life.indoor.x=-.1;life.indoor.z=-3;life.interact(sim);assert(life.indoor.seated);assert(Math.abs(life.camera(sim).position[1]-(site.room.y+1.1))<1e-8);life.cancel(sim);assert(life.indoor&&!life.indoor.seated);life.interact(sim);sim.step(1/60,{forward:true});assert(!life.indoor.seated);life.indoor.x=.2;life.indoor.z=2.9;sim.player.yaw=site.room.yaw;for(let i=0;i<60;i++)sim.step(1/60,{forward:true});assert(life.indoor.z<=3.05);life.leave(sim);assert.equal(life.indoor,null);assert(world.surfaceAt(sim.player.x,sim.player.z).walkable);assert.equal(life.serialize(),undefined);
});
test('Fishing has forgiving bite timing, no reward farm and safe early/late/cancel behavior',()=>{
 const {sim,life,village}=fresh(),site=life.sites.find(s=>s.fish);stand(sim,site.fish);life.interact(sim);steps(life,sim,1);assert.match(life.interact(sim),/empty/);assert.equal(life.fishRecords.length,0);life.interact(sim);const bite=life.fishing.biteAt;assert(bite>=2.5&&bite<7);steps(life,sim,bite+.05);assert.equal(life.fishing.phase,'bite');const frozen=plain(life.fishing);assert.deepEqual(plain(life.fishing),frozen,'Paused application does not call step');steps(life,sim,4);assert.match(life.interact(sim),/caught and released/);assert.equal(life.fishRecords[0].count,1);assert.equal(village.wallet,0);life.interact(sim);steps(life,sim,13);assert.equal(life.fishing,null);assert.equal(life.fishRecords[0].count,1);life.interact(sim);sim.player.x+=5;steps(life,sim,1);assert.equal(life.fishing,null);stand(sim,site.fish);life.interact(sim);life.cancel(sim);assert.equal(life.fishing,null);
});
test('Active parcel, sorting and lamp work cannot be interrupted by station activities',()=>{
 for(const field of ['carrying','sorting','repair']){const {sim,life,village}=fresh();stand(sim,life.sites[0].door);village[field]={id:'placeholder'};assert.equal(life.context(sim),null);assert.equal(life.interact(sim),null);assert.equal(life.indoor,null);}
});
test('Station-life exports are optional and old saves remain exact',()=>{
 const {sim,rail,village,life}=fresh(),oldRail=plain(rail.serialize()),oldVillage=plain(village.serialize());assert.equal(life.serialize(),undefined);life.restore(undefined);assert.deepEqual(plain(rail.serialize()),oldRail);assert.deepEqual(plain(village.serialize()),oldVillage);assert.equal(village.stationSpending,0);life.setManualWater(true);const saved=plain(life.serialize()),copy=new NSStationLife(world,village,rail);copy.restore(saved);assert.deepEqual(plain(copy.serialize()),saved);copy.restore(undefined);assert.equal(copy.serialize(),undefined);assert.equal(rail.manualWater,false);assert.equal(village.stationSpending,0);
});
test('Restoration imports validate combined boots, paint and projects without rejected-state mutation',()=>{
 const {sim,rail,village,life}=funded(90);stand(sim,life.sites[0].project);life.repair('fence-0',sim);life.repair('fireplace-0',sim);village.buyGear('boots');village.buyPaint('green');const saved=plain(life.serialize()),wallet=village.wallet;assert.equal(wallet,0);
 const candidateVillage=new NSVillage(world,rail);candidateVillage.restore(plain(village.serialize()),sim);const candidate=new NSStationLife(world,candidateVillage,rail);candidate.restore(saved);assert.equal(candidateVillage.wallet,0);assert.deepEqual(plain(candidate.serialize()),saved);
 for(const change of [d=>d.projects.push('fence-1'),d=>d.projects.push('fence-0'),d=>d.projects=['unknown-0'],d=>d.manualWater='yes',d=>d.fishRecords=[{species:'Goldfish',count:1}],d=>d.fishRecords=[{species:'Perch',count:0}],d=>d.fishRecords=[{species:'Perch',count:10000}],d=>d.version=2]){const bad=plain(saved);change(bad);assert.throws(()=>candidate.restore(bad),/Invalid save/);assert.deepEqual(plain(candidate.serialize()),saved);assert.equal(candidateVillage.wallet,0);}
 assert.equal(village.wallet,wallet);assert.equal(life.indoor,null);
});
test('Seated recovery helpers leave the room and idle cancel stays quiet',()=>{
 const {sim,life}=fresh(),site=life.sites[0];stand(sim,site.door);life.interact(sim);life.indoor.x=1;life.indoor.z=-3;life.interact(sim);assert(life.indoor.seated);life.leave(sim);life.cancelActivities();sim.recover();assert.equal(life.indoor,null);assert.equal(life.cancel(sim),null);
 const shore=life.sites.find(s=>s.fish);stand(sim,shore.fish);life.interact(sim);assert.match(life.cancel(sim),/Rod/);
});
test('Crane refills only with the train drawn up alongside it',()=>{
 const {sim,rail,life}=fresh(),site=life.sites[1];rail.engine.water=20;stand(sim,site.crane);sim.train.speed=0;
 sim.train.s=site.station.s+18;assert(world.stationAt(sim.train.s)?.index===1);assert(!life.canRefill(sim,site));assert.match(life.interact(sim),/alongside/);assert.match(life.context(sim).hint,/alongside/);
 sim.train.s=site.station.s;assert(life.canRefill(sim,site));sim.train.s=site.station.s-5;assert(life.canRefill(sim,site));
});
test('Water ambience defers to the terrain scan away from the jetty',()=>{
 const {sim,life}=fresh(),shore=life.sites.find(s=>s.fish);stand(sim,shore.fish);assert(life.acoustics(sim).waterDistance<1);stand(sim,life.sites[0].door);assert(!('waterDistance' in life.acoustics(sim)));
});
test('Fishing outcomes vary per cast and follow weather and time of day',()=>{
 const {sim,life}=fresh(),shore=life.sites.find(s=>s.fish),catchOne=()=>{life.interact(sim);steps(life,sim,life.fishing.biteAt+.05);return life.interact(sim).split(' ')[0];};stand(sim,shore.fish);
 const bites=new Set();for(let i=0;i<12;i++){life.interact(sim);bites.add(life.fishing.biteAt.toFixed(2));life.cancel(sim);}assert(bites.size>=8,'bite timing varies');
 sim.time=0;sim.weather={rain:0,fog:0};const day=[];for(let i=0;i<60;i++)day.push(catchOne());
 sim.time=14*30;const night=[];for(let i=0;i<60;i++)night.push(catchOne());
 sim.time=0;sim.weather={rain:1,fog:.6};const wet=[];for(let i=0;i<60;i++)wet.push(catchOne());
 const share=(list,name)=>list.filter(x=>x===name).length/list.length;
 assert(share(day,'Perch')>share(night,'Perch'));assert(share(night,'Roach')>share(day,'Roach'));assert(share(wet,'Trout')>share(day,'Trout')+.15);
 const saved=plain(life.serialize()),copy=fresh().life;copy.restore(saved);assert.equal(copy.casts,saved.fishRecords.reduce((n,r)=>n+r.count,0));
});
test('Manual water drains as a real resource and warns once when low',()=>{
 const {sim,rail,life}=fresh();sim.player.mode='train';sim.train.throttle=1;life.setManualWater(true);let warnings=0;for(let i=0;i<60*120;i++){if(rail.step(1/60,sim))warnings++;}assert(rail.engine.water<60&&rail.engine.water>40,'about 0.4%/s at full power');
 for(let i=0;i<60*60;i++){if(rail.step(1/60,sim))warnings++;}assert(rail.engine.water<30);assert.equal(warnings,1);
 const auto=fresh();auto.sim.player.mode='train';auto.sim.train.throttle=1;for(let i=0;i<60*120;i++)assert.equal(auto.rail.step(1/60,auto.sim),null);assert(auto.rail.engine.water>97);
});
console.log(`${count}/${count} station-life checks passed.`);
