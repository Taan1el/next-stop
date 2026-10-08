// Optional walking discoveries from existing, authoritative station geometry.
class NSExploration {
  constructor(world) {
    this.world=world;this.visited=new Set();this.selected=null;
    const notes=[
      ['pinebank-outlook','Pinebank outlook','From the end of this platform, the first departure feels smaller than the valley around it.'],
      ['bellweather-tower','Bellweather tower','The tower watches the bend. A good place to leave the cab and see the railway from the ground.'],
      ['stonehaven-storehouse','Stonehaven storehouse','Warm windows beside the last delivery. Stay a while before taking the letters home.']
    ];
    this.records=world.stations.map((station,index)=>{
      let anchor=null;
      for(const along of [18,-18,12,-12,0]){
        const x=station.platformX+Math.sin(station.yaw)*along;
        const z=station.platformZ+Math.cos(station.yaw)*along;
        const surface=world.surfaceAt(x,z);
        if(surface.walkable&&!world.blocked(x,surface.height,z)){
          anchor={x,y:surface.height,z};break;
        }
      }
      if(!anchor)throw new Error(`No safe field-note position at ${station.name}.`);
      const [id,name,description]=notes[index];
      return {id,name,description,station:station.name,anchor,radius:8};
    });
    if(world.version===2){
      const extra=[['pinebank-meadow','Pinebank meadow','The meadow fence follows the old branch line. Milk churns begin their morning journey here.'],
        ['bellweather-ridge','Bellweather ridge path','Woodland moves in the valley wind; pale ridges stand beyond the roofs and the crossing.'],
        ['stonehaven-fields','Stonehaven field gate','Post and passengers pass the field gate. Beyond the platform, the countryside carries on.']];
      world.stations.forEach((station,index)=>{
        let anchor=null;
        for(const [side,along] of [[8,-42],[7,-36],[4.4,-23]]){const x=station.x+Math.cos(station.yaw)*side+Math.sin(station.yaw)*along,z=station.z-Math.sin(station.yaw)*side+Math.cos(station.yaw)*along,surface=world.surfaceAt(x,z);
          if(surface.walkable&&!world.blocked(x,surface.height,z)){anchor={x,y:surface.height,z};break;}
        }
        if(anchor){const [id,name,description]=extra[index];this.records.push({id,name,description,station:station.name,anchor,radius:6});}
      });
    }
  }
  get total(){return this.records.length;}
  get count(){return this.visited.size;}
  static bearing(player,target){
    const angle=Math.atan2(target.x-player.x,target.z-player.z)-player.yaw;
    const delta=Math.atan2(Math.sin(angle),Math.cos(angle));
    return Math.abs(delta)<.6?'ahead':Math.abs(delta)>2.4?'behind':delta>0?'right':'left';
  }
  discover(player){
    if(player.mode!=='foot')return null;
    for(const record of this.records){
      if(!this.visited.has(record.id)&&Math.hypot(player.x-record.anchor.x,player.z-record.anchor.z)<=record.radius&&Math.abs(player.y-record.anchor.y)<2){
        this.visited.add(record.id);if(this.selected===record.id)this.selected=null;return record;
      }
    }
    return null;
  }
  nextTarget(player){
    let result=null;
    for(const record of this.records){
      if(this.visited.has(record.id))continue;
      const distance=Math.hypot(player.x-record.anchor.x,player.z-record.anchor.z);
      if(!result||distance<result.distance)result={record,distance};
    }
    return result;
  }
  select(id){
    if(id!==null&&(!this.records.some(r=>r.id===id)||this.visited.has(id)))throw new Error('Choose an undiscovered journal place.');
    this.selected=id;
  }
  target(player){
    const selected=this.records.find(r=>r.id===this.selected);
    return selected?{record:selected,distance:Math.hypot(player.x-selected.anchor.x,player.z-selected.anchor.z)}:this.nextTarget(player);
  }
  serialize(){return{version:1,visited:this.records.filter(r=>this.visited.has(r.id)).map(r=>r.id),selected:this.selected};}
  restore(data){
    if(data===undefined){this.visited=new Set();this.selected=null;return;}
    const fail=()=>{throw new Error('Invalid save: field journal is unsupported or contains invalid discoveries.');};
    if(!data||typeof data!=='object'||Array.isArray(data)||data.version!==1||!Array.isArray(data.visited)||data.visited.length>this.total)fail();
    const allowed=new Set(this.records.map(r=>r.id)),candidate=new Set();
    for(const id of data.visited){if(typeof id!=='string'||!allowed.has(id)||candidate.has(id))fail();candidate.add(id);}
    const selected=data.selected===undefined?null:data.selected;
    if(selected!==null&&(typeof selected!=='string'||!allowed.has(selected)||candidate.has(selected)))fail();
    this.visited=candidate;this.selected=selected;
  }
}
