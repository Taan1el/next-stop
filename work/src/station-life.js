// Optional station rituals. Transient activities never change world descriptors.
class NSStationLife {
  static get CRANE_ALONG(){return -14;}
  constructor(world,village,railway){
    this.world=world;this.village=village;this.railway=railway;this.projects=new Set();this.fishRecords=[];this.manualWater=false;this.touched=false;
    this.indoor=null;this.refill=null;this.fishing=null;this.casts=0;
    const anchor=(station,along,side=4.4)=>{
      for(const offset of [side,5.2,3.8,-4.4]){
        const x=station.x+Math.cos(station.yaw)*offset+Math.sin(station.yaw)*along,z=station.z-Math.sin(station.yaw)*offset+Math.cos(station.yaw)*along,surface=world.surfaceAt(x,z);
        if(surface.walkable&&!world.blocked(x,surface.height,z))return{x,y:surface.height,z};
      }
      throw Error('No safe station-life position at '+station.name);
    };
    this.sites=world.stations.map((station,index)=>{
      const x=station.x+Math.cos(station.yaw)*11,z=station.z-Math.sin(station.yaw)*11;
      return{index,station,crane:anchor(station,NSStationLife.CRANE_ALONG),door:anchor(station,0,6.5),project:anchor(station,23),fish:null,room:{x,y:world.heightAt(x,z)+.08,z,yaw:station.yaw}};
    });
    // Find actual water from the nearest lake-side platform; no fishing on land.
    const lake=world.lake,site=this.sites.slice().sort((a,b)=>Math.hypot(a.station.x-lake.x,a.station.z-lake.z)-Math.hypot(b.station.x-lake.x,b.station.z-lake.z))[0];
    for(const along of [-25,-23,25,0]){
      const start=anchor(site.station,along),length=Math.hypot(lake.x-start.x,lake.z-start.z),dx=(lake.x-start.x)/length,dz=(lake.z-start.z)/length;let previous=start;
      for(let distance=.4;distance<Math.min(length,100);distance+=.4){
        const x=start.x+dx*distance,z=start.z+dz*distance,surface=world.surfaceAt(x,z);
        if(!surface.walkable){if(world.heightAt(x+dx*3,z+dz*3)<world.waterLevel&&previous.y>.08)site.fish={...previous,dx,dz};break;}
        if(world.blocked(x,surface.height,z)||surface.height-previous.y>.55||previous.y-surface.height>1.8)break;
        previous={x,y:surface.height,z};
      }
      if(site.fish)break;
    }
  }
  near(sim,point,radius=1.8){const p=sim.player;return !!point&&p.mode==='foot'&&Math.hypot(p.x-point.x,p.z-point.z)<=radius&&Math.abs(p.y-point.y)<1.5;}
  setManualWater(value){if(typeof value!=='boolean')throw Error('Choose automatic or manual station water.');this.manualWater=value;this.railway.manualWater=value;this.touched=true;}
  get spending(){return [...this.projects].reduce((sum,id)=>sum+(id.startsWith('fence-')?12:18),0);}
  validProject(id){return typeof id==='string'&&/^(fence|fireplace)-[0-2]$/.test(id);}
  canRepair(id,sim){if(this.indoor||sim.player.mode!=='foot'||!this.validProject(id)||this.projects.has(id)||this.village.wallet<(id.startsWith('fence-')?12:18))return false;return this.near(sim,this.sites[Number(id.slice(-1))].project);}
  repair(id,sim){
    if(!this.validProject(id))return 'Unknown station restoration.';
    if(this.projects.has(id))return 'This restoration is already complete.';
    if(!this.canRepair(id,sim))return 'Visit the station restoration bench with '+(id.startsWith('fence-')?12:18)+' shillings in the shared purse.';
    this.projects.add(id);this.village.stationSpending=this.spending;this.touched=true;
    return id.startsWith('fence-')?'Fence repaired. Fresh timber will welcome every future arrival.':'Fireplace restored. The waiting room now has a warm hearth.';
  }
  context(sim){
    if(sim.player.mode!=='foot')return null;
    if(this.indoor){const site=this.sites[this.indoor.index],p=this.indoor;
      if(Math.hypot(p.x+2.7,p.z)<1.25)return{kind:'exit',site,hint:'T · return to the platform'};
      if(Math.hypot(p.x-1,p.z+3)<1.65)return{kind:'bench',site,hint:p.seated?'T · stand from the bench':'T · sit and watch the weather'};
      return null;
    }
    if(this.village.carrying||this.village.sorting||this.village.repair)return null;
    let nearest=null;
    for(const site of this.sites)for(const kind of ['crane','door','project','fish']){
      const point=site[kind];if(!this.near(sim,point,kind==='fish'?1.65:1.8))continue;
      const distance=Math.hypot(sim.player.x-point.x,sim.player.z-point.z);
      const hint=kind==='crane'?this.canRefill(sim,site)?`Hold T · water crane · ${Math.round(this.railway.engine.water)}%`:this.stoppedAt(sim,site)?'Water crane · draw the train up alongside the crane':'Water crane · stop the locomotive at this station':kind==='door'?'T · enter the waiting room':kind==='project'?'T · repair fence · 12 shillings · J for fireplace':this.fishing?.phase==='bite'?'T · reel in!':this.fishing?'T · lift the line early':'T · cast a line by the lake';
      if(!nearest||distance<nearest.distance)nearest={kind,site,hint,distance};
    }
    return nearest;
  }
  stoppedAt(sim,site){return Math.abs(sim.train.speed)<.025&&this.world.stationAt(sim.train.s)?.index===site.index;}
  // Locomotive plus two carriages span about 28 m behind train.s; the crane must sit within that span.
  alongside(sim,site){const length=this.world.routeLength;let delta=((site.station.s+NSStationLife.CRANE_ALONG-sim.train.s)%length+length)%length;if(delta>length/2)delta-=length;return delta>=-28&&delta<=5;}
  canRefill(sim,site){return !this.indoor&&this.near(sim,site.crane)&&this.stoppedAt(sim,site)&&this.alongside(sim,site);}
  static clock(sim){return(8+(Number(sim.time)||0)/30)%24;}
  // Deterministic per world and cast, so imports replay identically, but varied cast to cast.
  roll(salt){return NSWorld.hash(this.world.seed+'|fish|'+this.casts+'|'+salt)/4294967296;}
  fishWeights(sim){
    const clock=NSStationLife.clock(sim),night=clock<6||clock>=20,dusk=!night&&(clock<8||clock>=17),rain=Math.max(0,Math.min(1,sim.weather?.rain||0)),fog=Math.max(0,Math.min(1,sim.weather?.fog||0));
    return{Perch:night?.15:dusk?.35:.55,Roach:night?.6:dusk?.5:.3,Trout:.1+rain*.55+fog*.25};
  }
  pickSpecies(sim){const weights=this.fishWeights(sim),total=Object.values(weights).reduce((a,b)=>a+b,0);let roll=this.roll('species')*total;for(const [species,weight] of Object.entries(weights)){roll-=weight;if(roll<0)return species;}return 'Perch';}
  interact(sim){
    const context=this.context(sim);if(!context)return null;const {kind,site}=context;
    if(kind==='exit'){this.leave(sim);return 'Back on the platform.';}
    if(kind==='bench'){const p=this.indoor;p.seated=!p.seated;p.x=p.seated?.55:-.1;p.z=-3;sim.player.yaw=NSSimulation.angle(site.room.yaw-Math.PI/2);return p.seated?'Resting on the waiting-room bench. T or walk to stand.':'Back on your feet.';}
    if(kind==='door'){this.cancelActivities();this.indoor={index:site.index,x:-2,z:0,seated:false};Object.assign(sim.player,site.door,{yaw:NSSimulation.angle(site.room.yaw+Math.PI/2),pitch:-.04});sim._camera=null;return 'Waiting room. Walk to the bench to rest; T by the door to leave.';}
    if(kind==='project')return this.repair('fence-'+site.index,sim);
    if(kind==='crane'){
      if(!this.canRefill(sim,site))return this.stoppedAt(sim,site)?'Stop the train alongside the crane: ease forward or back until the tender is beside it.':'Stop the locomotive at this station before using the water crane.';
      if(this.railway.engine.water>=100)return 'The water tank is full.';
      this.refill={index:site.index,progress:0};this.fishing=null;return 'Keep T held beside the crane. A full tank takes six seconds.';
    }
    if(this.fishing){const catchable=this.fishing.phase==='bite'&&this.fishing.index===site.index;this.fishing=null;
      if(!catchable)return 'The line comes up empty. Cast again when you feel ready.';
      const species=this.pickSpecies(sim);let record=this.fishRecords.find(r=>r.species===species);const first=!record;
      if(!record){record={species,count:0};this.fishRecords.push(record);}record.count=Math.min(9999,record.count+1);this.touched=true;
      const lore={Perch:'Perch bite best in bright daylight.',Roach:'Roach feed at dusk and after dark.',Trout:'Trout rise in rain and mist.'}[species];
      return species+' caught and released.'+(first?' New entry in your nature journal. '+lore:' Entered in your nature journal.');
    }
    this.casts=Math.min(1e6,this.casts+1);this.fishing={index:site.index,phase:'waiting',elapsed:0,biteAt:2.5+this.roll('bite')*4.5};this.refill=null;return 'Line cast. Watch for a bite; T to reel when the float dips.';
  }
  cancelActivities(){this.refill=null;this.fishing=null;}
  cancel(sim){if(this.indoor?.seated){this.indoor.seated=false;this.indoor.x=-.1;this.indoor.z=-3;return 'Back on your feet.';}if(this.indoor){this.leave(sim);return 'Back on the platform.';}const message=this.fishing?'Rod put away.':this.refill?'Crane shut off.':null;this.cancelActivities();return message;}
  leave(sim){if(!this.indoor)return;const site=this.sites[this.indoor.index];Object.assign(sim.player,site.door);this.indoor=null;this.cancelActivities();sim._camera=null;}
  step(dt,sim,input={}){
    if(!Number.isFinite(dt)||dt<=0)return null;dt=Math.min(dt,1/15);
    if(this.refill){const site=this.sites[this.refill.index];if(!input.work||!this.canRefill(sim,site)||this.village.carrying||this.village.sorting){this.refill=null;}else{this.refill.progress+=dt;this.railway.engine.water=Math.min(100,this.railway.engine.water+dt*100/6);if(this.railway.engine.water>=100){this.refill=null;return 'Water tank full. Crane shut off.';}}}
    if(this.fishing){const site=this.sites[this.fishing.index];if(this.indoor||!this.near(sim,site.fish,1.65)||this.village.carrying||this.village.sorting){this.fishing=null;return 'Line put away.';}
      const f=this.fishing;f.elapsed+=dt;if(f.elapsed>=f.biteAt+5){this.fishing=null;return 'The fish slipped away. Cast again whenever you like.';}if(f.elapsed>=f.biteAt&&f.phase!=='bite'){f.phase='bite';return 'A bite! The float dips. Press T within five seconds to reel in.';}}
    return null;
  }
  walk(dt,input,sim){
    if(!this.indoor)return;let f=(input.forward?1:0)-(input.backward?1:0),r=(input.right?1:0)-(input.left?1:0),norm=Math.hypot(f,r);if(!norm)return;
    const p=this.indoor,yaw=sim.player.yaw-this.sites[p.index].room.yaw,speed=3*dt;if(p.seated){p.seated=false;p.x=-.1;p.z=-3;}f/=norm;r/=norm;
    const x=Math.max(-2.8,Math.min(2.8,p.x+(Math.sin(yaw)*f+Math.cos(yaw)*r)*speed)),z=Math.max(-6.5,Math.min(6.5,p.z+(Math.cos(yaw)*f-Math.sin(yaw)*r)*speed));
    const blocked=(x,z)=>Math.abs(x-.2)<.85&&Math.abs(z-3.9)<.85||x>.25&&x<1.9&&z>-4.8&&z<-1.2;
    if(!blocked(x,z)){p.x=x;p.z=z;}else{if(!blocked(x,p.z))p.x=x;if(!blocked(p.x,z))p.z=z;}
  }
  camera(sim){const p=this.indoor;if(!p)return null;const room=this.sites[p.index].room,c=Math.cos(room.yaw),s=Math.sin(room.yaw),eye=p.seated?1.1:1.68,position=[room.x+c*p.x+s*p.z,room.y+eye,room.z-s*p.x+c*p.z],cp=Math.cos(sim.player.pitch);return{position,target:[position[0]+Math.sin(sim.player.yaw)*cp*12,position[1]+Math.sin(sim.player.pitch)*12,position[2]+Math.cos(sim.player.yaw)*cp*12]};}
  // Report the jetty only when it is audible; elsewhere the ambience scans the terrain for any shore.
  acoustics(sim){const jetty=Math.min(Infinity,...this.sites.filter(s=>s.fish).map(s=>Math.hypot(sim.player.x-s.fish.x,sim.player.z-s.fish.z)));return{insideRoom:!!this.indoor,fireplace:!!this.indoor&&this.projects.has('fireplace-'+this.indoor.index),...(jetty<70?{waterDistance:jetty}:{})};}
  serialize(){return this.touched?{version:1,manualWater:this.manualWater,projects:[...this.projects].sort(),fishRecords:this.fishRecords.map(r=>({...r}))}:undefined;}
  restore(data){
    const fail=()=>{throw Error('Invalid save: station life data is unsupported or unaffordable.');};
    if(data===undefined){this.projects=new Set();this.fishRecords=[];this.casts=0;this.manualWater=false;this.railway.manualWater=false;this.village.stationSpending=0;this.touched=false;this.indoor=null;this.cancelActivities();return;}
    if(!data||Array.isArray(data)||data.version!==1||typeof data.manualWater!=='boolean'||!Array.isArray(data.projects)||data.projects.length>6||new Set(data.projects).size!==data.projects.length||data.projects.some(id=>!this.validProject(id))||!Array.isArray(data.fishRecords)||data.fishRecords.length>3)fail();
    const seen=new Set();for(const r of data.fishRecords){if(!r||!['Perch','Roach','Trout'].includes(r.species)||seen.has(r.species)||!Number.isInteger(r.count)||r.count<1||r.count>9999)fail();seen.add(r.species);}
    const spending=data.projects.reduce((sum,id)=>sum+(id.startsWith('fence-')?12:18),0),available=this.village.wallet+this.village.stationSpending;if(spending>available)fail();
    this.projects=new Set(data.projects);this.fishRecords=data.fishRecords.map(r=>({species:r.species,count:r.count}));this.casts=this.fishRecords.reduce((sum,r)=>sum+r.count,0);this.manualWater=data.manualWater;this.railway.manualWater=data.manualWater;this.village.stationSpending=spending;this.touched=true;this.indoor=null;this.cancelActivities();
  }
}
