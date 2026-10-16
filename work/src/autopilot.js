// A self-driving free-running train for the title backdrop and watch mode.
// It owns a private simulation, so the player's journey and saves are never touched.
class NSAutopilot {
  constructor(world,settings) {
    this.world=world;this.sim=new NSSimulation(world);this.sim.settings=settings||this.sim.settings;
    this.railway=new NSRailway(world);this.railway.service='explore';this.railway.assisted=true;this.railway.configure(this.sim);
    Object.assign(this.sim.player,{mode:'train',pitch:-.08});this.sim.train.direction=1;this.sim.cameraMode='chase';
    this.dwell=0;this.leaving=null;this.shot=0;this.shotTime=0;this.anchor=null;this.time=0;
  }
  ahead(s) {const length=this.world.routeLength;return((s-this.sim.train.s)%length+length)%length;}
  // Distance to the next station stop, skipping the one being left.
  nextStop() {
    let best=Infinity;
    this.world.stations.forEach((station,index)=>{if(index===this.leaving)return;const d=this.ahead(station.s);if(d<best)best=d;});
    return best;
  }
  // Ahead-distance of the station just passed, if any (near the full route length).
  nextStopBehind() {let best=0;this.world.stations.forEach((station,index)=>{if(index===this.leaving)return;const d=this.ahead(station.s);if(d>best)best=d;});return best;}
  input(dt) {
    const train=this.sim.train,speed=Math.abs(train.speed);
    if(this.dwell>0){this.dwell-=dt;return{brake:true,backward:true};}
    if(this.leaving!==null){const past=this.world.routeLength-this.ahead(this.world.stations[this.leaving].s);if(past>40&&past<this.world.routeLength/2)this.leaving=null;}
    const stop=this.nextStop();
    const overshot=this.world.routeLength-this.nextStopBehind();
    if((stop<2.5||overshot<6)&&speed<.12){const station=this.world.stationAt(train.s);this.leaving=station?station.index:null;this.dwell=7;return{brake:true,backward:true};}
    let target=5.4;
    for(const section of this.railway.sections){const d=this.ahead(section.s-section.radius),inside=this.ahead(section.s+section.radius)<section.radius*2;if(inside||d<45)target=Math.min(target,section.limit-.35);}
    // Comfortable braking curve into the platform: v = sqrt(2 a d).
    target=Math.min(target,Math.max(stop>1.2?.45:0,Math.sqrt(2*.9*Math.max(0,stop-1))));
    if(speed>target+.15)return{brake:true,backward:true};
    if(speed<target-.2)return{forward:true};
    if(speed>target)return{backward:true};
    return{};
  }
  step(dt) {
    this.time+=dt;this.shotTime+=dt;
    this.railway.step(dt,this.sim);this.sim.step(dt,this.input(dt));
    if(this.shotTime>13){this.shotTime=0;this.shot=(this.shot+1)%4;this.anchor=null;}
  }
  point(s,side,up) {
    const p=this.world.routeAt(((s%this.world.routeLength)+this.world.routeLength)%this.world.routeLength),x=p.x+Math.cos(p.yaw)*side,z=p.z-Math.sin(p.yaw)*side;
    return[x,Math.max(this.world.heightAt(x,z),this.world.waterLevel)+up,z];
  }
  camera(dt,reducedMotion) {
    const sim=this.sim,s=sim.train.s,loco=this.point(s,0,2.2);
    if(reducedMotion||this.shot===0){sim.cameraMode='chase';return sim.camera(dt);}
    if(this.shot===3){sim.cameraMode='cab';return sim.camera(dt);}
    sim.cameraMode='chase';
    if(this.shot===1){
      // Trackside: wait ahead of the train and watch it roll past.
      if(!this.anchor){const side=(Math.floor(this.time/26)%2?1:-1)*9;this.anchor=this.point(s+55,side,2.6);}
      return{position:this.anchor.slice(),target:loco};
    }
    // High, slowly circling view of the whole train in its valley.
    const angle=this.shotTime*.12+this.time*.01,radius=34,position=[loco[0]+Math.sin(angle)*radius,0,loco[2]+Math.cos(angle)*radius];
    position[1]=Math.max(this.world.heightAt(position[0],position[2]),this.world.waterLevel)+20;
    return{position,target:this.point(s-10,0,1)};
  }
}
