'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const sandbox={};vm.createContext(sandbox);
vm.runInContext(['world.js','journey.js'].map(n=>fs.readFileSync(path.join(root,'work/src',n),'utf8')).join('\n')+'\nthis.QA={NSWorld,NSSimulation,NSJourney};',sandbox);
const {NSWorld,NSSimulation,NSJourney}=sandbox.QA;
const world=new NSWorld('NEXT-STOP');
let passed=0;
function test(name,run){run();passed++;console.log('PASS '+name);}
function place(sim,s,speed=0,direction=1){const p=world.routeAt(s);Object.assign(sim.train,{s:p.s,speed,direction,throttle:1,brake:0});Object.assign(sim.player,{mode:'train',x:p.x,y:p.y,z:p.z});Object.assign(sim.delivery,{index:1,started:true,completed:0,finished:false});}

test('Stopped platform guidance stays valid before and after its centre',()=>{
  for(const direction of [-1,1])for(const offset of [-20,-1,0,1,20]){
    const sim=new NSSimulation(world);place(sim,world.stations[1].s+offset,0,direction);
    const cue=NSJourney.approach(sim);
    assert(cue.inside);assert.equal(cue.phase,'ready');assert.equal(cue.distance,0);
    assert.match(cue.hint,/E: deliver/);assert(!cue.hint.includes('m ahead'));
  }
});
test('Braking cue and missed-platform recovery respond to travel direction',()=>{
  const sim=new NSSimulation(world);place(sim,world.stations[1].s-25,6.5);
  assert.equal(NSJourney.approach(sim).phase,'brake');
  place(sim,world.stations[1].s-250,6.5);assert.equal(NSJourney.approach(sim).phase,'cruise');
  place(sim,world.stations[1].s+50,0);assert.equal(NSJourney.approach(sim).phase,'passed');
  sim.train.direction=-1;const cue=NSJourney.approach(sim);assert.equal(cue.phase,'approach');assert(Math.abs(cue.distance-50)<1e-6);
});
test('Home platform guidance handles the closed-route seam in both directions',()=>{
  for(const direction of [-1,1])for(const s of [8,world.routeLength-8]){
    const sim=new NSSimulation(world);place(sim,s,0,direction);Object.assign(sim.delivery,{index:0,completed:2});
    const cue=NSJourney.approach(sim);assert.equal(cue.phase,'ready');assert.equal(cue.station,'Pinebank');
  }
});
test('Changing direction clearly requests fresh power before a reverse recovery',()=>{
  const sim=new NSSimulation(world);place(sim,world.stations[1].s+45,0);sim.action('reverse');
  const cue=NSJourney.approach(sim);assert.equal(cue.phase,'departure');assert.match(cue.hint,/Hold W to add power/);assert.equal(sim.train.throttle,0);
  for(let i=0;i<60;i++)sim.step(1/60,{forward:true});assert(sim.train.speed<0);
});
test('Current foot location names the station actually being explored',()=>{
  const sim=new NSSimulation(world),station=world.stations[1];Object.assign(sim.player,{x:station.x+4,z:station.z,mode:'foot'});
  assert.match(NSJourney.label(sim),/Bellweather/);assert.equal(NSJourney.approach(sim),null);
});
test('Guidance and stopping estimates do not mutate saved gameplay',()=>{
  const sim=new NSSimulation(world);place(sim,world.stations[1].s-80,6.5,-1);
  const before=JSON.stringify(sim.serialize());for(let i=0;i<10;i++){NSJourney.approach(sim);NSJourney.label(sim);}
  assert.equal(JSON.stringify(sim.serialize()),before);
});
test('After deliveries, an optional sightseeing target retains guidance without changing cargo',()=>{
  const sim=new NSSimulation(world);place(sim,world.stations[1].s-250,6.5);Object.assign(sim.delivery,{index:0,completed:3,finished:true});
  const before=JSON.stringify(sim.serialize());const cue=NSJourney.approach(sim,1);assert.equal(cue.kind,'exploration');assert.equal(cue.station,'Bellweather');assert.equal(cue.phase,'cruise');assert.equal(JSON.stringify(sim.serialize()),before);
  place(sim,world.stations[1].s,0);Object.assign(sim.delivery,{index:0,completed:3,finished:true});assert.match(NSJourney.approach(sim,1).hint,/E: leave train/);
});
test('Following the displayed braking cue completes three deliveries using physics',()=>{
  const sim=new NSSimulation(world);sim.action('interact');
  for(let leg=0;leg<3;leg++){
    let braking=false,arrived=false,cue=null;
    for(let tick=0;tick<36000;tick++){
      if(tick%9===0)cue=NSJourney.approach(sim);
      if(cue.phase==='brake')braking=true;
      sim.step(1/60,{forward:!braking,brake:braking});
      if(braking&&sim.train.speed===0){assert.equal(NSJourney.approach(sim).phase,'ready');arrived=true;break;}
    }
    assert(arrived);sim.action('interact');assert.equal(sim.delivery.completed,leg+1);
  }
  assert(sim.delivery.finished);assert(sim.time<600);
});
console.log(`${passed}/${passed} journey guidance checks passed.`);
