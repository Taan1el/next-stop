'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),box=vm.createContext({});
vm.runInContext(['world','exploration','railway'].map(name=>fs.readFileSync(path.join(root,'work/src',name+'.js'),'utf8')).join('\n')+'\nthis.api={NSWorld,NSSimulation,NSExploration,NSRailway};',box);
const {NSWorld,NSSimulation,NSExploration,NSRailway}=box.api;
for(const [file,version,checksum] of [['world1-completed.json',1,'4bd6b452'],['world1-exploration.json',1,'4bd6b452'],['world3-completed.json',3,'0d37a594']]){
  const saved=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',file),'utf8')),world=new NSWorld(saved.world.seed,saved.world.version),sim=new NSSimulation(world),journal=new NSExploration(world),railway=new NSRailway(world);
  assert.equal(world.version,version);assert.equal(world.checksum(),checksum);sim.restore(saved);journal.restore(saved.exploration);railway.restore(saved.railway,sim);
  assert(sim.delivery.finished&&sim.delivery.completed===3);assert.equal(sim.train.speed,0);
  if(file==='world1-completed.json')assert.equal(journal.visited.size,0);
  if(file==='world1-exploration.json')assert(journal.visited.has('bellweather-tower'));
  console.log('PASS portable save fixture '+file);
}
console.log('3/3 committed save fixtures validated.');
