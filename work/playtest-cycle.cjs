'use strict';
// Real-time cycles use player inputs only. Simulation state is read for assertions.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
module.exports=async function runCycle(page,{directory,name,htmlPath,pastCentre=false,visitJournal=false,allDiscoveries=false,operateEngine=false,overshootAndReverse=false,orbitCamera=false,issues=[],requests=[]}){
  fs.mkdirSync(directory,{recursive:true});
  const html=fs.readFileSync(htmlPath);
  const result={name,status:'running',stops:[],cues:[],discoveries:[],operations:[],start:Date.now(),bytes:html.length,sha256:crypto.createHash('sha256').update(html).digest('hex')};
  module.exports.active=result;
  try{
    await page.getByRole('button',{name:'Start journey',exact:true}).click();
    await page.keyboard.press('KeyE');await page.waitForTimeout(250);
    if(await page.evaluate(()=>nextStopGame.sim.player.mode)!=='train')throw Error('Boarding failed');
    for(let stage=0;stage<3;stage++){
      await page.keyboard.up('Space');await page.keyboard.down('KeyW');await page.waitForTimeout(2700);await page.keyboard.up('KeyW');
      let braking=false,arrival=null,zoneBrake=false,slowed=null;const deadline=Date.now()+240000;
      while(Date.now()<deadline){
        const state=await page.evaluate(()=>{const g=nextStopGame,t=g.sim.train,d=g.world.stations[g.sim.delivery.index],L=g.world.routeLength;return{s:t.s,distance:((d.s-t.s)%L+L)%L,signed:((d.s-t.s+L/2)%L+L)%L-L/2,speed:t.speed,name:d.name,time:g.sim.time,running:g.running,approach:g.approach,hint:document.getElementById('hint').textContent,engine:g.railway?.engine,route:g.railway?.instruction(g.sim)};});
        result.current=state;if(!state.running)throw Error('Unexpected pause');
        if(!braking&&state.approach?.phase==='brake'){result.cues.push(state);await page.screenshot({path:path.join(directory,'braking-'+(stage+1)+'.png'),scale:'css'});await page.keyboard.down('Space');braking=true;}
        if(braking&&Math.abs(state.speed)<.025){arrival=state;break;}
        if(operateEngine){
          if(state.engine.fire<.50){await page.keyboard.press('KeyB');result.operations.push({action:'stoke',time:state.time,fire:state.engine.fire});}
          if(state.route&&!state.route.whistled){await page.keyboard.press('KeyV');result.operations.push({action:'whistle',time:state.time,route:state.route.name});}
          if(!braking){
            if(state.route&&state.route.distance<45){
              if(slowed!==state.route.id){await page.keyboard.down('KeyS');await page.waitForTimeout(1700);await page.keyboard.up('KeyS');slowed=state.route.id;result.operations.push({action:'ease-power',time:state.time,route:state.route.name});}
              if(state.speed>state.route.limit-.1&&!zoneBrake){await page.keyboard.down('Space');zoneBrake=true;}
              if(state.speed<state.route.limit-.35&&zoneBrake){await page.keyboard.up('Space');zoneBrake=false;}
            }else if(slowed&&!state.route){if(zoneBrake){await page.keyboard.up('Space');zoneBrake=false;}await page.keyboard.down('KeyW');await page.waitForTimeout(1700);await page.keyboard.up('KeyW');result.operations.push({action:'restore-power',time:state.time});slowed=null;}
          }
        }
        await page.waitForTimeout(250);
      }
      if(!arrival)throw Error('Station timeout');
      if(pastCentre&&stage===0){
        await page.keyboard.up('Space');let past=false;const deadline=Date.now()+15000;
        while(Date.now()<deadline){const state=await page.evaluate(()=>{const g=nextStopGame,L=g.world.routeLength,d=g.world.stations[g.sim.delivery.index];return{signed:((d.s-g.sim.train.s+L/2)%L+L)%L-L/2,speed:g.sim.train.speed};});if(!past&&state.signed<-.7){await page.keyboard.down('Space');past=true;}if(past&&Math.abs(state.speed)<.025)break;await page.waitForTimeout(100);}
        await page.waitForTimeout(200);
        result.platformPastCentre=await page.evaluate(()=>({hint:document.getElementById('hint').textContent,station:nextStopGame.world.stationAt(nextStopGame.sim.train.s)?.name,speed:nextStopGame.sim.train.speed,approach:nextStopGame.approach}));
        if(result.platformPastCentre.approach?.phase!=='ready'||result.platformPastCentre.hint.includes('m ahead'))throw Error('Platform readiness regressed');
        await page.screenshot({path:path.join(directory,'past-platform-centre.png'),scale:'css'});
      }
      if(overshootAndReverse&&stage===0){
        await page.keyboard.up('Space');let past=false;const deadline=Date.now()+20000;
        while(Date.now()<deadline){const state=await page.evaluate(()=>{const g=nextStopGame,L=g.world.routeLength,d=g.world.stations[g.sim.delivery.index];return{signed:((d.s-g.sim.train.s+L/2)%L+L)%L-L/2,speed:g.sim.train.speed};});if(!past&&state.signed< -36){await page.keyboard.down('Space');past=true;}if(past&&Math.abs(state.speed)<.025)break;await page.waitForTimeout(100);}
        await page.waitForTimeout(200);result.overshoot=await page.evaluate(()=>nextStopGame.approach);
        if(result.overshoot?.phase!=='passed')throw Error('Missed platform cue missing');
        await page.screenshot({path:path.join(directory,'overshoot.png'),scale:'css'});
        await page.keyboard.press('KeyR');await page.keyboard.up('Space');await page.keyboard.down('KeyW');await page.waitForTimeout(2700);await page.keyboard.up('KeyW');let braking=false;const reverseDeadline=Date.now()+30000;
        while(Date.now()<reverseDeadline){const state=await page.evaluate(()=>({cue:nextStopGame.approach,speed:nextStopGame.sim.train.speed}));if(!braking&&state.cue?.phase==='brake'){await page.keyboard.down('Space');braking=true;}if(braking&&Math.abs(state.speed)<.025)break;await page.waitForTimeout(100);}
        await page.waitForTimeout(200);result.reverseRecovery=await page.evaluate(()=>({cue:nextStopGame.approach,direction:nextStopGame.sim.train.direction,speed:nextStopGame.sim.train.speed}));
        if(result.reverseRecovery.cue?.phase!=='ready'||result.reverseRecovery.direction!==-1)throw Error('Reverse arrival failed');
        await page.screenshot({path:path.join(directory,'reverse-arrival.png'),scale:'css'});await page.keyboard.press('KeyR');
      }
      if(orbitCamera&&stage===0){
        await page.keyboard.down('ArrowRight');let clear=true;
        for(let sample=0;sample<60;sample++){await page.waitForTimeout(150);const blocked=await page.evaluate(()=>{const g=nextStopGame,p=g.sim._camera.position;return g.world.objects.some(o=>o.solid&&g.world._inside(o,p[0],p[2],.25)&&p[1]>o.y-o.hy-.1&&p[1]<o.y+o.hy+.1);});if(blocked)clear=false;}
        await page.keyboard.up('ArrowRight');result.cameraOrbitClear=clear;if(!clear)throw Error('Camera clips a station solid');
        await page.screenshot({path:path.join(directory,'camera-orbit.png'),scale:'css'});
      }
      await page.keyboard.press('KeyE');await page.waitForTimeout(250);
      const delivered=await page.evaluate(()=>({delivery:{...nextStopGame.sim.delivery},objective:document.getElementById('objective').textContent}));
      if(delivered.delivery.completed!==stage+1)throw Error('Delivery failed');
      result.stops.push({arrival,delivered});await page.screenshot({path:path.join(directory,'station-'+(stage+1)+'.png'),scale:'css'});
      if(visitJournal){
        await page.keyboard.up('Space');await page.keyboard.press('KeyE');await page.waitForTimeout(200);
        const records=await page.evaluate(all=>{const g=nextStopGame,p=g.sim.world.routeAt(g.sim.train.s),closest=g.exploration.records.reduce((a,b)=>Math.hypot(a.anchor.x-p.x,a.anchor.z-p.z)<Math.hypot(b.anchor.x-p.x,b.anchor.z-p.z)?a:b);return all?g.exploration.records.filter(r=>r.station===closest.station):[closest];},allDiscoveries);
        for(const record of records){const walked=await walkTo(page,record.anchor,Math.max(1,record.radius-1));
        await page.waitForTimeout(200);
        const discovered=await page.evaluate(id=>nextStopGame.exploration.visited.has(id),record.id);
        if(!discovered)throw Error('Landmark was not discovered on foot: '+record.id);
        result.discoveries.push({id:record.id,walked});
        await page.screenshot({path:path.join(directory,'discovery-'+(stage+1)+'.png'),scale:'css'});
        }
        if(stage<2){const train=await page.evaluate(()=>{const g=nextStopGame,p=g.world.routeAt(g.sim.train.s);return{x:p.x+Math.cos(p.yaw)*4.4,z:p.z-Math.sin(p.yaw)*4.4};});await walkTo(page,train,2);await page.keyboard.press('KeyE');await page.waitForTimeout(200);if(await page.evaluate(()=>nextStopGame.sim.player.mode)!=='train')throw Error('Reboarding failed');}
      }
    }
    await page.keyboard.up('Space');
    if(!visitJournal){await page.keyboard.press('KeyE');await page.waitForTimeout(250);}
    if(visitJournal){await page.keyboard.press('KeyJ');await page.waitForTimeout(200);await page.screenshot({path:path.join(directory,'completed-journal.png'),scale:'css'});}
    result.final=await page.evaluate(()=>({mode:nextStopGame.sim.player.mode,delivery:{...nextStopGame.sim.delivery},exploration:nextStopGame.exploration?.serialize(),totalPlaces:nextStopGame.exploration.total,railway:nextStopGame.railway?.serialize(),sound:{...nextStopGame.soundCounters},save:nextStopGame.serialize(),stats:nextStopGame.diagnostics(),gl:nextStopGame.renderer.gl.getError()}));
    if(!result.final.delivery.finished||result.final.mode!=='foot'||result.final.gl||issues.length||requests.some(u=>!u.startsWith('file:')))throw Error('Final playthrough gate failed');
    if(visitJournal&&result.final.exploration.visited.length!==(allDiscoveries?result.final.totalPlaces:3))throw Error('Journal incomplete');
    if(result.final.sound.bells!==3||result.final.sound.chuffs===0||result.final.sound.joints===0)throw Error('Train sound and station-bell feedback incomplete');
    result.status='passed';result.wallSeconds=(Date.now()-result.start)/1000;result.issues=issues;result.requests=requests;
  }catch(error){result.status='failed';result.error=error.stack;result.failureState=await page.evaluate(()=>nextStopGame.serialize()).catch(()=>null);}
  fs.writeFileSync(path.join(directory,'circuit.json'),JSON.stringify(result,null,2));return result;
};
async function walkTo(page,target,radius){
  const start=await page.evaluate(()=>({...nextStopGame.sim.player}));const deadline=Date.now()+70000;
  // Inspect authoritative surfaces to plan a route around station buildings.
  // Only real turn/walk keys move the player; no state is changed by planning.
  const waypoints=await page.evaluate(({target,radius})=>{
    const g=nextStopGame,start=g.sim.player,step=2,range=75,size=2*range+1;
    const node=(ix,iz)=>({ix,iz,x:start.x+ix*step,z:start.z+iz*step});
    const key=(ix,iz)=>(ix+range)*size+iz+range;
    const safe=(x,z,y)=>{const s=g.world.surfaceAt(x,z);return s.walkable&&s.height-y<=.55&&y-s.height<=1.8&&!g.world.blocked(x,s.height,z,.48)&&!g.sim._blockedByTrain(x,s.height,z);};
    const segment=(a,b)=>{let y=g.world.surfaceAt(a.x,a.z).height;const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.15);for(let i=1;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;if(!safe(x,z,y))return false;y=g.world.surfaceAt(x,z).height;}return true;};
    const first={...node(0,0),cost:0,parent:null},open=[first],best=new Map([[key(0,0),first]]);let found=null;
    for(let count=0;open.length&&count<12000;count++){
      open.sort((a,b)=>b.cost+Math.hypot(b.x-target.x,b.z-target.z)-a.cost-Math.hypot(a.x-target.x,a.z-target.z));
      const cur=open.pop();if(cur.closed)continue;cur.closed=true;
      if(Math.hypot(cur.x-target.x,cur.z-target.z)<Math.max(.8,radius-.2)){found=cur;break;}
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const ix=cur.ix+dx,iz=cur.iz+dz;if(Math.abs(ix)>range||Math.abs(iz)>range)continue;
        const next=node(ix,iz),id=key(ix,iz),cost=cur.cost+Math.hypot(dx,dz)*step,old=best.get(id);
        if(old&&old.cost<=cost||!segment(cur,next))continue;
        const candidate={...next,cost,parent:cur};best.set(id,candidate);open.push(candidate);
      }
    }
    if(!found)throw Error('No walkable route to landmark');
    const path=[];for(let p=found;p;p=p.parent)path.unshift({x:p.x,z:p.z});
    const smooth=[];let a=0;while(a<path.length-1){let b=path.length-1;while(b>a+1&&!segment(path[a],path[b]))b--;smooth.push(path[b]);a=b;}return smooth;
  },{target,radius});
  let waypoint=0;
  while(Date.now()<deadline){
    const p=await page.evaluate(()=>({...nextStopGame.sim.player}));if(p.mode!=='foot')throw Error('Walking requires foot mode');
    const dx=target.x-p.x,dz=target.z-p.z;if(Math.hypot(dx,dz)<=radius)return{from:start,to:p};
    module.exports.lastWalk={from:start,target,last:p,remaining:Math.hypot(dx,dz),running:await page.evaluate(()=>nextStopGame.running)};
    while(waypoint<waypoints.length-1&&Math.hypot(waypoints[waypoint].x-p.x,waypoints[waypoint].z-p.z)<.8)waypoint++;
    const next=waypoints[waypoint]||target,angle=Math.atan2(next.x-p.x,next.z-p.z),delta=Math.atan2(Math.sin(angle-p.yaw),Math.cos(angle-p.yaw));
    if(Math.abs(delta)>.025){const key=delta>0?'ArrowRight':'ArrowLeft';await page.keyboard.down(key);await page.waitForTimeout(Math.min(350,Math.max(12,Math.abs(delta)/1.45*1000)));await page.keyboard.up(key);}
    else{await page.keyboard.down('KeyW');await page.waitForTimeout(100);await page.keyboard.up('KeyW');}
  }
  throw Error('Could not reach landmark with walking controls: '+JSON.stringify(module.exports.lastWalk));
}
module.exports.walkTo=walkTo;
