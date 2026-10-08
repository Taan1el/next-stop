// Branch-line service, gentle firing and a portable driver's ledger. No DOM/GL.
class NSRailway {
  constructor(world){
    this.world=world;this.service='freight';this.cargo='mixed';this.assisted=false;
    this.engine={fire:.72,pressure:9.2,coal:100,water:100};
    this.overspeed=0;this.earnings=0;this.stops=[];this.whistled=new Set();this.missed=new Set();
    this.whistleUntil=-1;this.lastStoke=-10;this.dwell=null;
    this.sections=[{id:'lake-crossing',name:'Lake bridge',s:world.routeLength*.37,radius:35,limit:4.45},
      {id:'farm-crossing',name:'Farm crossing',s:world.routeLength*.76,radius:24,limit:5}];
  }
  configure(sim){if(this.service==='explore')Object.assign(sim.delivery,{started:true,finished:true,index:0,completed:3});this.apply(sim);}
  apply(sim){const load=this.service==='freight'&&this.cargo==='timber'?.92:1;sim.tractionScale=(this.assisted?1:Math.max(.36,Math.min(1,this.engine.pressure/8.8)))*load;sim.steamFire=this.engine.fire;}
  instruction(sim){
    if(sim.player.mode!=='train')return null;
    const length=this.world.routeLength,direction=Math.abs(sim.train.speed)>.025?Math.sign(sim.train.speed):sim.train.direction;
    let next=null;
    for(const section of this.sections){const signed=((((section.s-sim.train.s)*direction+length/2)%length+length)%length)-length/2;
      const inside=Math.abs(signed)<section.radius;
      if(inside||(signed>=0&&signed<115)){const distance=Math.max(0,signed-section.radius);if(!next||distance<next.distance)next={...section,distance,inside,whistled:this.whistled.has(section.id)};}
    }
    return next;
  }
  step(dt,sim){
    const e=this.engine,aboard=sim.player.mode==='train';
    if(this.assisted){e.fire=.74;e.pressure=9.2;}
    else{
      e.fire=Math.max(.10,e.fire-dt*.0019);
      e.pressure=Math.max(3.2,Math.min(11.8,e.pressure+dt*(e.fire*.075-.023-(aboard?sim.train.throttle*.035:0))));
      e.water=Math.max(0,e.water-dt*(.006+(aboard?sim.train.throttle*.008:0)));
      if(e.water<5)e.pressure=Math.min(e.pressure,6);
    }
    const instruction=this.instruction(sim);
    if(instruction?.inside&&Math.abs(sim.train.speed)>instruction.limit+.25)this.overspeed+=dt;
    const direction=Math.abs(sim.train.speed)>.025?Math.sign(sim.train.speed):sim.train.direction;
    for(const section of this.sections){const delta=((((sim.train.s-section.s)*direction+this.world.routeLength/2)%this.world.routeLength+this.world.routeLength)%this.world.routeLength)-this.world.routeLength/2;
      if(delta>section.radius&&delta<section.radius+12&&!this.whistled.has(section.id))this.missed.add(section.id);
    }
    const station=this.world.stationAt(sim.train.s);
    if(aboard&&station&&Math.abs(sim.train.speed)<.22){if(!this.dwell||this.dwell.index!==station.index)this.dwell={index:station.index,since:sim.time};}else this.dwell=null;
    this.apply(sim);
  }
  action(name,sim){
    if(sim.player.mode!=='train')return 'Board the locomotive first.';
    if(name==='stoke'){
      if(this.assisted)return 'Automatic fireman is tending the boiler.';
      if(this.engine.fire>.94)return 'The fire is already bright.';
      if(sim.time-this.lastStoke<2)return 'Give the fresh coal a moment.';
      if(this.engine.coal<3)return 'Coal is low. Replenish at the next station.';
      this.engine.coal-=3;this.engine.fire=Math.min(1,this.engine.fire+.28);this.lastStoke=sim.time;
      return 'Coal on the fire. Watch the steam pressure.';
    }
    if(name==='whistle'){
      this.whistleUntil=sim.time+1.4;this.engine.pressure=Math.max(3.2,this.engine.pressure-.18);
      const instruction=this.instruction(sim);if(instruction){this.whistled.add(instruction.id);this.missed.delete(instruction.id);}
      this.apply(sim);return instruction?`Whistle sounded for ${instruction.name.toLowerCase()}.`:'Whistle sounded across the valley.';
    }
    return '';
  }
  waiting(sim){
    if(this.service!=='passenger'||!this.dwell||sim.delivery.finished||!sim.delivery.started||this.dwell.index!==sim.delivery.index)return null;
    const remaining=Math.max(0,Math.ceil(4-(sim.time-this.dwell.since)));
    return remaining?`Passengers boarding · ${remaining} s · keep the brake on`:null;
  }
  job(sim){
    const index=Math.min(2,sim.delivery.completed);
    if(this.service==='explore')return 'Free running · stop wherever you like';
    if(sim.delivery.finished)return `Service finished · ${this.grade()} · ${this.earnings} shillings`;
    if(this.service==='freight'&&this.cargo==='timber')return ['Pine logs for Bellweather','Boards for Stonehaven','Empty timber wagons home'][index];
    if(this.service==='freight'&&this.cargo==='mail')return ['Morning post for Bellweather','Express bags for Stonehaven','Evening letters for Pinebank'][index];
    return this.service==='passenger'?['Morning workers · 14 aboard','Market local · 18 aboard','Homeward local · 11 aboard'][index]:['Milk churns for Bellweather','Post bags for Stonehaven','Coal sacks for Pinebank'][index];
  }
  grade(){const score=Math.max(0,100-this.overspeed*.9-this.missed.size*7);return score>=90?'Careful driver':score>=70?'Steady service':'Room to improve';}
  recordStop(sim,index){
    const station=this.world.stations[index],base=this.service==='passenger'?24:this.cargo==='timber'?20:this.cargo==='mail'?22:18;
    const promptPost=this.service==='freight'&&this.cargo==='mail'&&sim.time<(this.stops.length+1)*120?4:0;
    this.earnings+=Math.max(8,Math.round(base+promptPost-Math.min(10,this.overspeed*.1)));
    this.stops.push({station:station.name,time:sim.time});this.engine.coal=100;this.engine.water=100;
    return `${this.service==='passenger'?'Passengers served':'Freight handed over'} at ${station.name}. Supplies topped up. ${this.earnings} shillings earned.`;
  }
  serialize(){return{version:1,service:this.service,cargo:this.cargo,assisted:this.assisted,engine:{...this.engine},overspeed:this.overspeed,earnings:this.earnings,stops:this.stops.map(s=>({...s})),whistled:[...this.whistled],missed:[...this.missed],whistleUntil:this.whistleUntil,lastStoke:this.lastStoke,dwell:this.dwell?{...this.dwell}:null};}
  restore(data,sim){
    if(data===undefined){this.assisted=true;this.apply(sim);return;}
    const fail=()=>{throw new Error('Invalid save: railway service or boiler data is unsupported.');};
    const num=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
    if(!data||Array.isArray(data)||data.version!==1||!['freight','passenger','explore'].includes(data.service)||typeof data.assisted!=='boolean')fail();
    const cargo=data.cargo??'mixed';if(!['mixed','timber','mail'].includes(cargo))fail();
    const e=data.engine;if(!e||!num(e.fire,.10,1)||!num(e.pressure,3.2,11.8)||!num(e.coal,0,100)||!num(e.water,0,100)||!num(data.overspeed,0,1e9)||!num(data.earnings,0,1000))fail();
    if(!Array.isArray(data.stops)||data.stops.length>3||data.stops.some(s=>!s||!this.world.stations.some(st=>st.name===s.station)||!num(s.time,0,sim.time)))fail();
    const list=a=>Array.isArray(a)&&a.length<=2&&new Set(a).size===a.length&&a.every(id=>this.sections.some(s=>s.id===id));
    if(!list(data.whistled)||!list(data.missed)||!num(data.whistleUntil,-1,sim.time+1.4)||!num(data.lastStoke,-10,sim.time))fail();
    if(data.dwell!==null&&(!data.dwell||!Number.isInteger(data.dwell.index)||data.dwell.index<0||data.dwell.index>2||!num(data.dwell.since,0,sim.time)))fail();
    if(data.service==='explore'&&!sim.delivery.finished)fail();
    if(data.service!=='explore'&&data.stops.length>sim.delivery.completed)fail();
    Object.assign(this,{service:data.service,cargo,assisted:data.assisted,engine:{fire:e.fire,pressure:e.pressure,coal:e.coal,water:e.water},overspeed:data.overspeed,earnings:data.earnings,stops:data.stops.map(s=>({station:s.station,time:s.time})),whistled:new Set(data.whistled),missed:new Set(data.missed),whistleUntil:data.whistleUntil,lastStoke:data.lastStoke,dwell:data.dwell?{index:data.dwell.index,since:data.dwell.since}:null});
    this.apply(sim);
  }
}
