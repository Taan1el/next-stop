// Station life stays numerical: bounded props, no world descriptor mutations.
class NSStationScenery {
  static objects(life,sim){
    if(!life?.sites?.length)return[];
    const objects=[],time=Number(sim.time)||0,motion=sim.settings?.reducedMotion ? .15 : 1;
    const add=(origin,side,up,along,hx,hy,hz,material,type=0,info=0)=>{
      const yaw=origin.yaw||0;
      const object={x:origin.x+Math.cos(yaw)*side+Math.sin(yaw)*along,y:origin.y+up,z:origin.z-Math.sin(yaw)*side+Math.cos(yaw)*along,hx,hy,hz,yaw,material,type,info};
      objects.push(object);return object;
    };
    const at=(point,site)=>({...point,yaw:site.station.yaw});
    const repaired=(kind,index)=>life.projects.has(kind+'-'+index);
    if(life.indoor){
      const site=life.sites[life.indoor.index],r=site.room,lit=repaired('fireplace',site.index);
      // Actual openings in a room shell. Camera walking bounds leave clearance
      // from every wall, stove and bench; the world player remains at the door.
      add(r,0,.02,0,3.08,.09,7.08,30);
      add(r,0,3.6,0,3.1,.12,7.1,30);
      for(const along of [-7,7])add(r,0,1.8,along,3.1,1.8,.12,25);
      add(r,3,1.8,0,.12,1.8,7,25);
      // Front wall: central door and two large windows, never opaque glass.
      for(const along of [-6.1,-2.3,2.3,6.1])add(r,-3,1.8,along,.12,1.8,.88,25);
      add(r,-3,3.13,0,.12,.47,1.42,25);
      for(const along of [-4.25,4.25]){
        add(r,-3,.5,along,.12,.5,1.08,25);
        add(r,-3,3.2,along,.12,.4,1.08,25);
        add(r,-3,1.9,along,.15,.85,.035,32);
        add(r,-3,1.9,along,.15,.035,1.08,32);
        add(r,-2.86,.94,along,.24,.09,1.17,30);
      }
      for(const along of [-1.42,1.42])add(r,-2.85,1.35,along,.17,1.35,.09,32);
      add(r,-2.85,2.72,0,.17,.08,1.5,32);
      // Bench faces the stove. Resting eye position is above its seat, clear
      // of the back rest, so seated views never clip through furniture.
      add(r,1,.47,-3,.55,.09,1.28,30);
      add(r,1.55,.94,-3,.08,.40,1.28,30);
      for(const along of [-3.95,-2.05])add(r,1,.22,along,.42,.22,.075,28);
      add(r,.2,.11,3.9,1.05,.1,1.05,13);
      add(r,.2,.57,3.9,.59,.37,.49,28);
      add(r,.2,1.01,3.9,.69,.07,.59,28);
      add(r,.2,2.25,4.08,.12,1.16,.12,28,5);
      add(r,.2,.57,3.39,.43,.24,.03,lit?18:37);
      if(lit){
        add(r,.05,.58+Math.sin(time*7)*.035*motion,3.34,.14,.19,.055,18,1);
        add(r,.35,.56+Math.sin(time*9+2)*.035*motion,3.34,.12,.17,.055,18,1);
      }
      add(r,2.42,1.2,5.8,.35,.05,.6,30);
      add(r,2.42,1.42,5.8,.13,.18,.13,32,5);
      add(r,2.35,2.8,-5.3,.04,.38,.6,34);
      add(r,0,3.13,-1,.19,.19,.19,17,1);
      return objects;
    }
    const eye=sim.player;
    const nearest=life.sites.reduce((best,site)=>!best||Math.hypot(site.station.x-eye.x,site.station.z-eye.z)<Math.hypot(best.station.x-eye.x,best.station.z-eye.z)?site:best,null);
    if(nearest&&Math.hypot(nearest.station.x-eye.x,nearest.station.z-eye.z)<140){
      const site=nearest,c=at(site.crane,site),f=at(site.project,site),door=at(site.door,site),fixed=repaired('fence',site.index),lit=repaired('fireplace',site.index),flow=life.refill?.index===site.index;
      // Cast iron base, turned column, elbow, overhanging spout and valve.
      add(c,0,.10,0,.43,.10,.43,13,5);
      add(c,0,1.75,0,.15,1.60,.15,28,5);
      add(c,0,3.28,0,.25,.12,.25,28,5);
      add(c,-1.15,3.28,0,1.15,.13,.13,28,4);
      add(c,-2.26,2.94,0,.16,.35,.16,28,5);
      add(c,.19,1.30,0,.06,.29,.29,27,4);
      add(c,.21,1.3,0,.07,.045,.30,28);
      add(c,0,2.02,0,.17,.08,.17,27,5);
      if(flow)for(let i=0;i<3;i++){
        const fall=((time*1.7*motion+i/3)%1);
        add(c,-2.26,2.45-fall*1.45,0,.065,.24,.065,3,5);
      }
      for(const along of [-1.6,0,1.6])add(f,0,.57,along,.09,.57,.09,30);
      for(const along of [-.8,.8]){
        add(f,0,fixed?.85:.43,along,.065,.065,.75,30);
        if(fixed)add(f,0,.36,along,.065,.065,.75,30);
      }
      // Porch lantern marks the doorway without adding an overlay or sign UI.
      add(door,.35,2.55,1.06,.11,.13,.20,28);
      add(door,.35,2.35,1.06,.12,.17,.12,17,1);
      if(lit)add(at(site.room,site),-3.56,2.7,4,.035,.64,.78,17);
      if(fixed)for(const along of [-1.25,1.25]){
        add(f,.24,.17,along,.28,.17,.28,39,5);
        add(f,.24,.49,along,.19,.16,.19,along<0?8:32,1);
      }
    }
    // Only real water destinations receive fishing props. Platforms stay dry;
    // bobber/line end at the precomputed water point, never at arbitrary land.
    for(const site of life.sites){const fish=site.fish;if(!fish||Math.hypot(fish.x-eye.x,fish.z-eye.z)>80)continue;
      const point=at(fish,site),active=life.fishing?.index===site.index,bite=active&&life.fishing.phase==='bite';
      const tx=fish.waterX??fish.x+fish.dx*3,tz=fish.waterZ??fish.z+fish.dz*3;
      if(!Number.isFinite(tx)||!Number.isFinite(tz))continue;
      add(point,.5,.17,0,.28,.17,.28,30,5);
      if(active){
        const dx=tx-fish.x,dz=tz-fish.z,yaw=Math.atan2(dx,dz),origin={...fish,yaw};
        const rod=add(origin,0,1.07,.65,.025,.025,.8,30,6,.39);
        rod.y+=Math.sin(time*3)*.025*motion;
        const tip={x:fish.x+Math.sin(yaw)*1.4,y:fish.y+1.4,z:fish.z+Math.cos(yaw)*1.4},dxLine=tx-tip.x,dzLine=tz-tip.z,dyLine=life.world.waterLevel+.08-tip.y;
        const length=Math.hypot(dxLine,dzLine),lineYaw=Math.atan2(dxLine,dzLine);
        add({x:(tip.x+tx)/2,y:(tip.y+life.world.waterLevel+.08)/2,z:(tip.z+tz)/2,yaw:lineYaw},0,0,0,.015,.015,Math.hypot(length,dyLine)/2,32,6,Math.atan2(dyLine,length));
        add({...origin,x:tx,z:tz,y:life.world.waterLevel},0,(bite?-.03:.08)+Math.sin(time*(bite?13:2.8))*.045*motion,0,.085,.10,.085,8,1);
        if(bite)for(const side of [-1,1])add({...origin,x:tx,z:tz,y:life.world.waterLevel},side*(.25+(.5+.5*Math.sin(time*5))*.16),.025,0,.15,.016,.035,32);
      }
    }
    return objects;
  }
}
