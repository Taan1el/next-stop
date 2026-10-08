'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'work/src/world.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source + '\nthis.QA = { NSWorld, NSSimulation };', sandbox, { filename: 'world.js' });
const { NSWorld, NSSimulation } = sandbox.QA;
const normalize = value => JSON.parse(JSON.stringify(value));
const clone = value => normalize(value);
const near = (actual, expected, tolerance = 1e-8, message = '') => assert(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected} (±${tolerance})`);
const world = new NSWorld('QA-NEXT-STOP');
const results = [];
function test(name, run) {
  try { run(); results.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, pass: false }); console.error(`FAIL ${name}\n${error.stack}`); }
}
const snapshots = w => ({ seed: w.seed, version: w.version, waterLevel: w.waterLevel, size: w.size,
  resolution: w.resolution, heights: Array.from(w.heights), objects: normalize(w.objects), route: normalize(w.route), stations: normalize(w.stations) });
function board(sim) { sim.action('interact'); assert.equal(sim.player.mode, 'train'); }
function trainAt(sim, distance) {
  const p = world.routeAt(distance);
  Object.assign(sim.train, { s: p.s, speed: 0, throttle: 0, brake: 1 });
  Object.assign(sim.player, { mode: 'train', x: p.x, y: p.y, z: p.z, yaw: p.yaw });
}

test('Seed/version reproduces all authoritative descriptors and different seeds alter terrain', () => {
  const same = new NSWorld('QA-NEXT-STOP'), other = new NSWorld('QA-DIFFERENT');
  assert.deepEqual(snapshots(same), snapshots(world));
  assert.equal(same.checksum(), world.checksum());
  assert.notEqual(other.checksum(), world.checksum());
  assert.notDeepEqual(Array.from(other.heights), Array.from(world.heights));
  assert.notDeepEqual(normalize(other.objects), normalize(world.objects));
});

test('CPU height sampler reproduces vertices and bilinear interiors including bounded edges', () => {
  const n = world.resolution, step = world.size / (n - 1), half = world.size / 2;
  for (let row = 0; row < n; row += 7) for (let col = 0; col < n; col += 9)
    near(world.heightAt(col * step - half, row * step - half), world.heights[row * n + col], 1e-9, 'grid vertex');
  for (const [row, col, u, v] of [[2, 8, .27, .61], [35, 53, .5, .5], [94, 101, .91, .17], [127, 127, .75, .33]]) {
    const i = row * n + col, h = world.heights;
    const expected = (1-v)*((1-u)*h[i]+u*h[i+1])+v*((1-u)*h[i+n]+u*h[i+n+1]);
    near(world.heightAt((col + u) * step - half, (row + v) * step - half), expected, 1e-9, 'bilinear interior');
  }
  near(world.heightAt(-half - 100, half + 100), world.heightAt(-half, half));
  for (const [x,z] of [[-half,-half],[half,half],[-half,half],[half,-half]]) assert(Number.isFinite(world.heightAt(x,z)));
});

test('Route closes, remains periodic and has physically feasible grades and curvature', () => {
  const first = world.route[0], last = world.route.at(-1);
  near(first.x,last.x);near(first.y,last.y);near(first.z,last.z);
  assert(world.routeLength > 0 && Number.isFinite(world.routeLength));
  let maxGrade=0, maxCurvature=0;
  for(let i=0;i<world.route.length-1;i++) {
    const a=world.route[i],b=world.route[i+1],length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
    assert(length>0);near(b.s-a.s,length,1e-9,'arc length');
    near(a.grade,(b.y-a.y)/length,1e-10,'grade');
    maxGrade=Math.max(maxGrade,Math.abs(a.grade));
    const next=world.route[(i+1)%(world.route.length-1)];
    const turn=Math.abs(Math.atan2(Math.sin(next.yaw-a.yaw),Math.cos(next.yaw-a.yaw)));
    maxCurvature=Math.max(maxCurvature,turn/length);
  }
  const sim=new NSSimulation(world), speed=sim.maxSpeed;
  const fullTraction=34000*Math.max(.18,1-speed/9), opposing=1350+90*speed*speed+52000*9.81*maxGrade;
  assert(fullTraction>opposing,'Declared top speed must be reachable uphill under full traction.');
  // No mathematical cusp: tangent change must be below 90 degrees at each dense route sample.
  for(let i=0;i<world.route.length-1;i++) {
    const a=world.route[i],b=world.route[(i+1)%(world.route.length-1)];
    assert(Math.abs(Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw)))<Math.PI/2,'Route has a cusp.');
  }
  for(const s of [0,world.routeLength/3,world.routeLength*.998,7.5]) {
    const p=world.routeAt(s),plus=world.routeAt(s+world.routeLength),minus=world.routeAt(s-world.routeLength);
    for(const key of ['x','y','z','yaw','grade']) {near(p[key],plus[key],1e-9,key);near(p[key],minus[key],1e-9,key);}
  }
  console.log(`  Route ${world.routeLength.toFixed(1)} m; max grade ${(maxGrade*100).toFixed(3)}%; max lateral acceleration ${(speed*speed*maxCurvature).toFixed(3)} m/s² at limit.`);
});

test('Platforms/bridge supports provide visible tops; solid bounds reject walking bodies', () => {
  const supports=world.objects.filter(o=>o.support), bridges=supports.filter(o=>o.material===13), solids=world.objects.filter(o=>o.solid);
  assert(bridges.length>0,'World needs bridge spans.');
  for(const o of supports) {
    const surface=world.surfaceAt(o.x,o.z);
    assert(surface.height>=o.y+o.hy-1e-8,'Support top missing from walking surface.');
    assert(surface.walkable,'Support must be walkable.');
  }
  for(const o of solids) assert(world.blocked(o.x,o.y,o.z),'Solid object centre must block a body.');
  const lake=world.surfaceAt(55,-157);assert(!lake.walkable,'Open lake must reject walking.');
  for(const st of world.stations) {
    const sim=new NSSimulation(world);sim._spawnFoot(st.s);
    assert.equal(sim.player.mode,'foot');assert(world.surfaceAt(sim.player.x,sim.player.z).walkable);
    assert(!world.blocked(sim.player.x,sim.player.y,sim.player.z),'Station spawn must be clear.');
  }
});

test('Walking advances through open space but cannot enter a solid station wall', () => {
  const sim=new NSSimulation(world), building=world.objects.find(o=>o.station&&o.solid), c=Math.cos(building.yaw),s=Math.sin(building.yaw);
  const offset=building.hx+.7;
  const x=building.x+c*offset,z=building.z-s*offset,surface=world.surfaceAt(x,z);
  Object.assign(sim.player,{x,y:surface.height,z,yaw:Math.atan2(-c,s),mode:'foot'});
  assert(!world.blocked(x,surface.height,z),'Test starts outside wall.');
  for(let i=0;i<120;i++)sim.step(1/60,{forward:true});
  const travelled=Math.hypot(sim.player.x-x,sim.player.z-z);
  assert(travelled>0,'Walking input must advance before collision.');
  assert(!world.blocked(sim.player.x,sim.player.y,sim.player.z),'Walking must not penetrate solid.');
  assert(travelled<1,'Station wall must prevent walking through entire building.');
});

test('Full brake stops forward/reverse motion without reversal and holds every route slope', () => {
  for(const direction of [-1,1]) {
    const sim=new NSSimulation(world);board(sim);sim.train.speed=direction*4;sim.train.direction=direction;sim.train.throttle=0;
    for(let i=0;i<600;i++) {sim.step(1/60,{brake:true});assert(sim.train.speed*direction>=0,'Braking reversed velocity.');}
    assert.equal(sim.train.speed,0,'Brakes must stop train.');
  }
  for(let i=0;i<world.route.length-1;i+=13) {
    const sim=new NSSimulation(world);trainAt(sim,world.route[i].s);
    const before=sim.train.s;
    for(let j=0;j<180;j++)sim.step(1/60,{brake:true});
    assert.equal(sim.train.speed,0);near(sim.train.s,before,1e-10,'static braked route distance');
  }
});

test('Stopping guidance matches full-brake travel across power, grade, direction and route seams without mutating state', () => {
  const steepestUp = world.route.reduce((a, b) => a.grade > b.grade ? a : b);
  const steepestDown = world.route.reduce((a, b) => a.grade < b.grade ? a : b);
  const positions = [.02, world.routeLength - .02, steepestUp.s, steepestDown.s];
  for (const direction of [-1, 1]) for (const throttle of [0, 1]) for (const distance of positions) {
    const sim = new NSSimulation(world); trainAt(sim, distance);
    Object.assign(sim.train, { speed: direction * sim.maxSpeed, direction, throttle, brake: 0 });
    const saved = normalize(sim.serialize()), previousS = sim._previousS;
    const predicted = sim.stoppingDistance();
    assert(Number.isFinite(predicted) && predicted > 0 && predicted < 30, 'Moving braking guidance must be bounded and useful.');
    assert.deepEqual(normalize(sim.serialize()), saved, 'Guidance changed live saved state.');
    assert.equal(sim._previousS, previousS, 'Guidance changed interpolation history.');
    const start = sim.train.s;
    for (let ticks = 0; ticks < 600 && sim.train.speed !== 0; ticks++) sim.step(1 / 60, { brake: true });
    assert.equal(sim.train.speed, 0, 'Actual full brake must reach rest within prediction bound.');
    const actual = ((sim.train.s - start) * direction + world.routeLength) % world.routeLength;
    near(predicted, actual, 1e-7, 'Predicted full-brake route distance');
  }
  const stopped = new NSSimulation(world), before = normalize(stopped.serialize());
  assert.equal(stopped.stoppingDistance(), 0, 'A stopped train needs no braking distance.');
  assert.deepEqual(normalize(stopped.serialize()), before);
});

test('Traction accelerates, bounded speed remains finite, and fixed steps agree across presentation schedules', () => {
  function run(fps) {
    const sim=new NSSimulation(world);board(sim);let accumulator=0,totalSteps=0;
    for(let frame=0;frame<fps*30;frame++) {
      accumulator+=1/fps;
      while(accumulator+1e-12>=1/60) {sim.step(1/60,{forward:totalSteps<900,brake:totalSteps>=1200});accumulator-=1/60;totalSteps++;}
    }
    assert.equal(totalSteps,1800);assert(Number.isFinite(sim.train.s));assert(Math.abs(sim.train.speed)<=sim.maxSpeed);
    return sim.serialize();
  }
  assert.deepEqual(normalize(run(30)),normalize(run(60)));assert.deepEqual(normalize(run(60)),normalize(run(144)));
  const sim=new NSSimulation(world);board(sim);
  for(let i=0;i<900;i++)sim.step(1/60,{forward:true});
  assert(sim.train.speed>0,'Full traction must depart station.');assert(sim.train.s>0,'Moving train must advance route distance.');
});

test('Carriage centres and yaw use separate arc-length positions through curved graded route', () => {
  const sim=new NSSimulation(world);
  for(const distance of [0,world.routeLength/3,world.routeLength*.57,world.routeLength-4]) {
    sim.train.s=distance;
    // Numerical body boxes are distinguished by the documented carriage body half-length/height.
    const bodies=sim.dynamicObjects().filter(o=>o.material===8&&Math.abs(o.hz-4.55)<1e-10&&Math.abs(o.hy-1.23)<1e-10);
    assert.equal(bodies.length,2);
    for(let i=0;i<2;i++) {
      const expected=world.routeAt(distance-(i+1)*11.3),actual=bodies[i];
      near(actual.x,expected.x);near(actual.z,expected.z);near(actual.y-2.1,expected.y);near(actual.yaw,expected.yaw);
    }
  }
});

test('Presentation interpolation crosses route seam locally without changing simulation state', () => {
  const sim=new NSSimulation(world);board(sim);trainAt(sim,world.routeLength-.03);sim.train.speed=6;
  sim.step(1/60,{});
  const before=normalize(sim.serialize()),current=sim.train.s;
  assert(current<1,'Test step must cross the route seam.');
  const previous=world.routeLength-.03,delta=(current-previous+world.routeLength)%world.routeLength;
  for(const alpha of [0,.25,.5,.75,1]) {
    sim.renderAlpha=alpha;
    const p=world.routeAt(previous+delta*alpha);
    const locomotive=sim.dynamicObjects()[0];
    near(locomotive.x,p.x);near(locomotive.z,p.z);near(locomotive.y-.58,p.y);
    const camera=sim.camera(1/60);assert(camera.position.every(Number.isFinite));
    assert.deepEqual(normalize(sim.serialize()),before,'Presentation must not mutate saved simulation state.');
  }
});

test('Chase camera remains outside station solids during smoothed or reduced-motion orbits', () => {
  // Bellweather's tower sits beside the orbit path. A clear desired camera can
  // still interpolate into that tower before its vertical movement catches up.
  const orbitWorld = new NSWorld('NEXT-STOP');
  for (const reducedMotion of [false, true]) for (const station of orbitWorld.stations) {
    const sim = new NSSimulation(orbitWorld), rail = orbitWorld.routeAt(station.s);
    Object.assign(sim.train, { s: station.s });
    Object.assign(sim.player, { mode: 'train', x: rail.x, y: rail.y, z: rail.z, yaw: rail.yaw });
    sim._previousS = station.s;
    sim.settings.reducedMotion = reducedMotion;
    for (let degree = 0; degree < 720; degree++) {
      sim.player.yaw = rail.yaw + degree * Math.PI / 180;
      sim.player.pitch = degree < 360 ? -.05 : .65;
      const camera = sim.camera(1 / 60), [x, y, z] = camera.position;
      assert(camera.position.every(Number.isFinite), 'Orbit camera must remain finite.');
      assert(y >= orbitWorld.heightAt(x, z) + 1.9 - 1e-8, 'Orbit camera penetrated terrain.');
      const penetrated = orbitWorld.objects.find(o => o.solid && orbitWorld._inside(o, x, z, .25) &&
        y > o.y - o.hy - .25 && y < o.y + o.hy + .25);
      assert(!penetrated, `Camera clipped ${station.name} solid at ${degree} degrees (reduced motion: ${reducedMotion}).`);
    }
  }
});

test('Delivery actions obey safe speed, station order and one-action priority through full circuit', () => {
  const sim=new NSSimulation(world);board(sim);
  assert.deepEqual(normalize(sim.delivery),{index:1,completed:0,started:true,finished:false});
  sim.train.speed=1;const before=normalize(sim.delivery);sim.action('interact');assert.deepEqual(normalize(sim.delivery),before);assert.equal(sim.player.mode,'train');
  const selected=sim.train.direction;sim.action('reverse');assert.equal(sim.train.direction,selected,'Cannot change direction while moving.');
  trainAt(sim,world.stations[2].s);sim.action('interact');assert.equal(sim.delivery.completed,0,'Wrong station cannot deliver.');assert.equal(sim.player.mode,'foot','Wrong station stopped interaction may disembark.');
  for(const [stationIndex,completed,nextIndex] of [[1,1,2],[2,2,0],[0,3,0]]) {
    trainAt(sim,world.stations[stationIndex].s);sim.action('interact');
    assert.equal(sim.delivery.completed,completed);assert.equal(sim.delivery.index,nextIndex);
    assert.equal(sim.player.mode,'train','Delivery and disembark must not occur together.');
  }
  assert(sim.delivery.finished);sim.action('interact');assert.equal(sim.player.mode,'foot','After completion player can disembark.');
  assert(world.surfaceAt(sim.player.x,sim.player.z).walkable);assert(!world.blocked(sim.player.x,sim.player.y,sim.player.z));
  const progress=normalize(sim.delivery);sim.recover();assert.deepEqual(normalize(sim.delivery),progress);assert.equal(sim.train.speed,0);
});

test('Normal throttle and braking complete the entire playable circuit without teleportation', () => {
  const sim=new NSSimulation(world);board(sim);
  for(const index of [1,2,0]) {
    let stopped=false;
    for(let ticks=0;ticks<60*600;ticks++) {
      const target=world.stations[index].s;
      const remaining=(target-sim.train.s+world.routeLength)%world.routeLength;
      const braking=remaining<30;
      sim.step(1/60,{forward:!braking,brake:braking});
      if(braking&&sim.train.speed===0) {stopped=true;break;}
    }
    assert(stopped,'Train must be stoppable at each destination.');
    assert.equal(world.stationAt(sim.train.s)?.index,index,'Train must stop inside target platform zone.');
    sim.action('interact');
  }
  assert(sim.delivery.finished);assert.equal(sim.delivery.completed,3);
  assert(sim.time<600,'Playable circuit should fit the intended 5–10 minute scope.');
  console.log(`  Circuit completed in ${sim.time.toFixed(2)} simulation seconds (${(sim.time/60).toFixed(2)} minutes), using traction and braking only.`);
});

test('Valid JSON save restores world-linked state and every user-facing setting', () => {
  const sim=new NSSimulation(world);board(sim);sim.settings.quality='coarse';sim.settings.reducedMotion=true;sim.settings.weatherMode='rain';sim.settings.highContrast=true;
  for(let i=0;i<120;i++)sim.step(1/60,{forward:true,lookRight:true});
  const save=normalize(sim.serialize()),restored=new NSSimulation(world);restored.restore(JSON.stringify(save));
  const actual=normalize(restored.serialize());
  near(actual.player.yaw,save.player.yaw,1e-12,'Yaw normalization');
  actual.player.yaw=save.player.yaw;
  assert.deepEqual(actual,save);
});

test('Invalid saves reject atomically across schema, numeric, world, route and progression errors', () => {
  const sim=new NSSimulation(world);board(sim);for(let i=0;i<120;i++)sim.step(1/60,{forward:true});
  const saved=normalize(sim.serialize());
  const mutations=[
    d=>d.version=99,d=>d.world.version=99,d=>d.world.seed='other',d=>d.world.checksum='bad',
    d=>d.time=-1,d=>d.time=Infinity,d=>d.weather.rain=2,d=>d.weather.fog=NaN,d=>d.weatherTarget='snow',
    d=>d.train.s=world.routeLength,d=>d.train.s=-1,d=>d.train.speed=sim.maxSpeed+1,d=>d.train.throttle=2,d=>d.train.brake=-1,d=>d.train.direction=0,
    d=>d.player.x=99999,d=>d.player.y=999,d=>d.player.pitch=2,d=>d.player.mode='flight',d=>d.player.x+=10,
    d=>d.cameraMode='orbit',d=>d.delivery.index=99,d=>d.delivery.completed=1,d=>d.delivery.started=false,d=>d.delivery.finished=true,
    d=>d.settings.quality='ultra',d=>d.settings.reducedMotion='yes',d=>d.settings.weatherMode='snow',d=>d.settings.highContrast='yes',d=>delete d.train,
    d=>{const rail=world.routeAt(d.train.s);Object.assign(d.player,{mode:'foot',x:rail.x,y:world.surfaceAt(rail.x,rail.z).height,z:rail.z});d.train.speed=0;},
    d=>d.extra='x'.repeat(70000)
  ];
  for(const change of mutations) {const invalid=clone(saved);change(invalid);assert.throws(()=>sim.restore(invalid),/Invalid save/);assert.deepEqual(normalize(sim.serialize()),saved,'Failed restore changed live state.');}
  for(const invalid of ['{',null,[],{}]) {assert.throws(()=>sim.restore(invalid),/Invalid save/);assert.deepEqual(normalize(sim.serialize()),saved);}
});

const failed=results.filter(result=>!result.pass);
console.log(`${results.length-failed.length}/${results.length} focused numerical/gameplay regressions passed.`);
if(failed.length)process.exitCode=1;
