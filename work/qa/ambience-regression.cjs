'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/ambience.js'),'utf8')+'\nthis.NSAmbience=NSAmbience;',sandbox);
class Parameter {
  constructor(){this.value=0;this.events=[];}
  setTargetAtTime(value,time,constant){assert(Number.isFinite(value));assert(Number.isFinite(time));assert(constant>0);this.value=value;this.events.push({value,time,constant});}
}
class Node {
  constructor(kind){this.kind=kind;this.connections=[];this.disconnects=0;this.starts=0;this.stops=0;this.gain=new Parameter();this.frequency=new Parameter();this.Q=new Parameter();}
  connect(other){this.connections.push(other);}
  disconnect(){this.disconnects++;}
  start(){this.starts++;}
  stop(){this.stops++;}
}
class RecordingContext {
  constructor(){this.currentTime=0;this.sampleRate=48000;this.nodes=[];this.buffers=[];this.resumeCalls=0;this.destination=new Node('destination');}
  node(kind){const n=new Node(kind);this.nodes.push(n);return n;}
  createGain(){return this.node('gain');}
  createBufferSource(){return this.node('buffer');}
  createBiquadFilter(){return this.node('filter');}
  createOscillator(){return this.node('oscillator');}
  createBuffer(channels,length,rate){const data=new Float32Array(length),buffer={channels,length,rate,getChannelData:()=>data};this.buffers.push(buffer);return buffer;}
  resume(){this.resumeCalls++;}
}
let checks=0;
function test(name,run){run();checks++;console.log('PASS '+name);}
function fresh(){const context=new RecordingContext(),transport=new Node('transport'),ambience=new sandbox.NSAmbience(context,transport);const sim={time:0,player:{mode:'foot',x:0,z:0},weather:{rain:1},cameraMode:'chase',world:{waterLevel:0,heightAt:(x,z)=>x>10?-1:5}};return{context,transport,ambience,sim};}
test('All ambience routes exclusively through the supplied transport',()=>{
  const {context,transport,ambience}=fresh();assert.equal(ambience.output.connections[0],transport);
  for(const node of context.nodes)for(const connection of node.connections)assert.notEqual(connection,context.destination);
  assert.equal(context.buffers.length,4);assert.equal(context.nodes.filter(n=>n.kind==='buffer').length,4);assert.equal(context.nodes.filter(n=>n.kind==='oscillator').length,1);
  for(const buffer of context.buffers){assert.equal(buffer.channels,1);assert.equal(buffer.rate,22050);const samples=buffer.getChannelData(0);assert.equal(Math.abs(samples[0]),0);assert.equal(Math.abs(samples.at(-1)),0);assert(samples.some(n=>n!==0));assert(samples.every(n=>Number.isFinite(n)&&Math.abs(n)<=1));}
  ambience.destroy();
});
test('Cab and waiting room muffle rain; restored room enables fireplace',()=>{
  const {context,ambience,sim}=fresh();ambience.update(sim,null,true);const outside=ambience.diagnostics().rainCutoff;
  sim.player.mode='train';sim.cameraMode='cab';context.currentTime=1;ambience.update(sim,null,true);const cab=ambience.diagnostics().rainCutoff;
  sim.player.mode='foot';context.currentTime=2;ambience.update(sim,{acoustics:()=>({insideRoom:true,fireplace:true,waterDistance:80})},true);const room=ambience.diagnostics().rainCutoff;
  assert(outside>cab&&cab>room);assert(ambience.voices.fire.target>0);assert(ambience.voices.rain.target>0);assert.equal(ambience.voices.water.target,0);
  context.currentTime=3;ambience.update(sim,{acoustics:()=>({insideRoom:true,fireplace:false,waterDistance:80})},true);assert.equal(ambience.voices.fire.target,0);ambience.destroy();
});
test('Water follows actual shoreline or the supplied fishing distance',()=>{
  const {context,ambience,sim}=fresh();ambience.update(sim,null,true);assert.equal(ambience.waterDistance,24);assert(ambience.voices.water.target>0);
  sim.world={waterLevel:0,heightAt:()=>4};context.currentTime=1;ambience.update(sim,null,true);assert.equal(ambience.waterDistance,96);assert.equal(ambience.voices.water.target,0);
  context.currentTime=2;ambience.update(sim,{acoustics:()=>({waterDistance:2})},true);assert(ambience.voices.water.target>.07);ambience.destroy();
});
test('Long updates reuse fixed voices, throttle automation and never resume audio',()=>{
  const {context,ambience,sim}=fresh(),nodeCount=context.nodes.length;let heightQueries=0;sim.world.heightAt=()=>{heightQueries++;return 5;};
  for(let frame=0;frame<7200;frame++){context.currentTime=frame/60;sim.time=frame/60;ambience.update(sim,null,true);}
  assert.equal(context.nodes.length,nodeCount);assert.equal(context.buffers.length,4);assert.equal(context.resumeCalls,0);assert(heightQueries<6000);
  for(const source of ambience.sources){assert.equal(source.starts,1);assert.equal(source.stops,0);}
  assert(ambience.voices.rain.gain.gain.events.length<1500);
  ambience.update(sim,null,false);for(const voice of Object.values(ambience.voices))assert.equal(voice.target,0);assert.equal(ambience.birdGain.gain.value,0);ambience.destroy();
});
test('Destroy stops every source and disconnects every node exactly once',()=>{
  const {context,ambience,sim}=fresh(),nodes=context.nodes.slice(),sources=ambience.sources.slice();ambience.destroy();ambience.destroy();ambience.update(sim,null,true);
  for(const node of nodes)assert.equal(node.disconnects,1);for(const source of sources)assert.equal(source.stops,1);assert.equal(ambience.diagnostics().destroyed,true);assert.equal(context.resumeCalls,0);
});
test('Partial construction failure cleans the existing graph',()=>{
  const context=new RecordingContext(),original=context.createBiquadFilter;let count=0;context.createBiquadFilter=function(){if(++count===2)throw Error('Audio device lost');return original.call(this);};
  assert.throws(()=>new sandbox.NSAmbience(context,new Node('transport')),/Audio device lost/);for(const node of context.nodes)assert.equal(node.disconnects,1);assert.equal(context.nodes.filter(n=>n.kind==='buffer'&&n.starts===1)[0].stops,1);
});
console.log(`PASS ${checks} ambience regression checks.`);
