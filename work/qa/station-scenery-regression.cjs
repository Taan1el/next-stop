'use strict';
// Numerical/render-upload checks. Actual shader pixels need the browser suite.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),box=vm.createContext({});
vm.runInContext(['world','railway','village','station-life','station-scenery','renderer'].map(name=>fs.readFileSync(path.join(root,'work/src',name+'.js'),'utf8')).join('\n')+'\nthis.Q={NSWorld,NSSimulation,NSRailway,NSVillage,NSStationLife,NSStationScenery};',box);
const {NSWorld,NSSimulation,NSRailway,NSVillage,NSStationLife,NSStationScenery}=box.Q;
let count=0;const test=(name,run)=>{run();count++;console.log('PASS '+name);};
function create(seed='NEXT-STOP',version=4){const world=new NSWorld(seed,version),sim=new NSSimulation(world),railway=new NSRailway(world),village=new NSVillage(world,railway),life=new NSStationLife(world,village,railway);Object.assign(sim,{village,stationLife:life});return{world,sim,life};}
function stand(sim,site){Object.assign(sim.player,site.door,{mode:'foot'});sim.train.s=site.station.s;}
function renderer(world){return Object.assign(Object.create(box.NSGlyphRenderer.prototype),{staticObjects:world.objects.map(object=>({object,radius:Math.hypot(object.hx,object.hy,object.hz)})),objectData:new Float32Array(256*12),objectTexture:{},_selection:[],_selectionPosition:null,_selectionCapacity:-1,gl:{TEXTURE_2D:1,RGBA:2,FLOAT:3,bindTexture(){},texSubImage2D(){}}});}
const numeric=['x','y','z','hx','hy','hz','yaw','type','material','info'];
test('Station scenery remains finite, bounded and read-only across old worlds',()=>{
  for(const version of [1,2,3,4])for(const seed of ['NEXT-STOP','RAINY-HOME']){
    const {world,sim,life}=create(seed,version),before=world.checksum();
    for(const site of life.sites){stand(sim,site);const state=JSON.stringify({projects:[...life.projects],player:sim.player,train:sim.train,refill:life.refill,fishing:life.fishing});
      for(const indoor of [null,{index:site.index,x:-2,z:0,seated:false}]){life.indoor=indoor;const objects=NSStationScenery.objects(life,sim);assert(objects.length<=48);for(const object of objects){assert(numeric.every(key=>Number.isFinite(object[key])),JSON.stringify(object));assert(object.hx>0&&object.hy>0&&object.hz>0);assert(object.material<=42&&object.type<=7);}}
      life.indoor=null;assert.equal(JSON.stringify({projects:[...life.projects],player:sim.player,train:sim.train,refill:life.refill,fishing:life.fishing}),state);
    }assert.equal(world.checksum(),before);
  }
});
test('Refill, restoration, room and fishing each change numerical presentation',()=>{
  const {sim,life}=create(),site=life.sites[0];stand(sim,site);const scene=()=>JSON.stringify(NSStationScenery.objects(life,sim)),base=scene();
  life.refill={index:0,progress:1};assert.notEqual(scene(),base);const pouring=scene();sim.time+=.2;assert.notEqual(scene(),pouring);life.refill=null;
  life.projects.add('fence-0');assert.notEqual(scene(),base);const fence=scene();life.projects.add('fireplace-0');assert.notEqual(scene(),fence);
  life.indoor={index:0,x:-2,z:0,seated:false};const room=scene();assert.notEqual(room,fence);life.projects.delete('fireplace-0');assert.notEqual(scene(),room);life.indoor=null;
  const shore=life.sites.find(record=>record.fish);assert(shore);Object.assign(sim.player,shore.fish,{mode:'foot'});life.fishing={index:shore.index,phase:'waiting',elapsed:1,biteAt:5};const waiting=scene();life.fishing.phase='bite';assert.notEqual(scene(),waiting);
  assert(NSStationScenery.objects(life,sim).some(object=>object.type===6&&object.material===32),'A sloped line must connect rod and water.');
});
test('Populated train and station scenes retain static budget and room cache changes',()=>{
  const {world,sim,life}=create(),r=renderer(world);
  for(const site of life.sites){stand(sim,site);life.projects.add('fence-'+site.index);life.projects.add('fireplace-'+site.index);life.refill={index:site.index,progress:1};
    const props=NSStationScenery.objects(life,sim),ordinary=sim.dynamicObjects().length+sim.village.objects(sim).length;
    assert(ordinary+props.length<=224,`Station ${site.index} uses ${ordinary}+${props.length} dynamic records.`);
    const eye=[site.room.x,site.room.y+1.68,site.room.z];r._uploadObjects(sim,eye);assert(r.objectCount<=256);assert(r._selectionCapacity>=32);assert.equal(r._selectionRoom,-1);
    life.indoor={index:site.index,x:-2,z:0,seated:false};r._uploadObjects(sim,eye);assert.equal(r._selectionRoom,site.index);assert(r._selectionCapacity>=32);
    const roomProps=NSStationScenery.objects(life,sim);assert.equal(r.objectData[10],roomProps[0].material,'Room shell precedes all ordinary props.');
    assert(!r._selection.some(candidate=>candidate.entry.object.station),'Opaque original station shell is excluded indoors.');
    const selected=r._selection;life.indoor=null;r._uploadObjects(sim,eye);assert.notEqual(r._selection,selected);assert.equal(r._selectionRoom,-1);
  }
});
console.log(count+'/'+count+' station scenery checks passed.');
