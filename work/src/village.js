// Optional station work. Pure state; the renderer adds bounded numerical props.
class NSVillage {
  constructor(world){
    this.world=world;this.completed=new Map();this.selected=null;this.carrying=null;this.sorting=null;this.repair=null;
    this.paint='original';this.owned=['original'];this.touched=false;
    const people=['Nell','Edda','Tomas'];
    const anchor=(station,along)=>{
      for(const side of [4.4,5.2,3.8,-4.4]){
        const x=station.x+Math.cos(station.yaw)*side+Math.sin(station.yaw)*along,z=station.z-Math.sin(station.yaw)*side+Math.cos(station.yaw)*along,surface=world.surfaceAt(x,z);
        if(surface.walkable&&!world.blocked(x,surface.height,z))return{x,y:surface.height,z};
      }
      throw Error('No safe station-work position at '+station.name);
    };
    this.jobs=world.stations.flatMap((station,index)=>[
      {id:'parcel-'+index,kind:'parcel',index,station:station.name,person:people[index],name:station.name+' parcel',anchor:anchor(station,-21),destination:anchor(station,10),description:`Carry the crate-side parcel to ${people[index]} along the platform. 8 shillings, plus 2 if delivered within 25 seconds.`},
      {id:'lamp-'+index,kind:'lamp',index,station:station.name,name:station.name+' lamp round',anchor:anchor(station,17),description:'Hold T by the lamp for 3 seconds to replenish its oil. The pool of light grows warmer. 6 shillings.'},
      {id:'post-'+index,kind:'post',index,station:station.name,name:station.name+' post sorting',anchor:anchor(station,-9),description:'T at the noticeboard starts three letters. Match each address: 1 Pinebank, 2 Bellweather, 3 Stonehaven. 5 shillings, plus a careful-sorting bonus.'}
    ]).filter(job=>job.kind!=='lamp'||world.version>=2);
    let hash=0;for(const letter of world.seed)hash=(Math.imul(hash,33)+letter.charCodeAt(0))>>>0;
    const orders=[[0,1,2],[1,2,0],[2,0,1],[0,2,1],[2,1,0],[1,0,2]];
    this.orders=world.stations.map((_,i)=>orders[(hash+i)%orders.length]);
  }
  get earnings(){return[...this.completed.values()].reduce((sum,value)=>sum+value,0);}
  get wallet(){return this.earnings-(this.owned.length-1)*20;}
  get title(){return this.completed.size===this.jobs.length?'Friend of the branch line':this.completed.size>=6?'Trusted neighbour':this.completed.size>=3?'Valley helper':'New arrival';}
  near(player,point,radius=2.5){return player.mode==='foot'&&Math.hypot(player.x-point.x,player.z-point.z)<=radius&&Math.abs(player.y-point.y)<1.5;}
  job(id){return this.jobs.find(job=>job.id===id);}
  target(player){
    const id=this.carrying?.id||this.sorting?.id||this.selected,job=this.job(id);if(!job)return null;
    const point=this.carrying?job.destination:job.anchor;
    return{record:{...job,anchor:point,name:this.carrying?'Parcel for '+job.person:job.name},distance:Math.hypot(player.x-point.x,player.z-point.z)};
  }
  context(player){
    if(player.mode!=='foot')return null;
    if(this.carrying){const job=this.job(this.carrying.id);return this.near(player,job.destination)?{job,hint:`T · hand parcel to ${job.person}`} : null;}
    if(this.sorting){const job=this.job(this.sorting.id);return this.near(player,job.anchor)?{job,hint:this.sortHint()}:null;}
    let nearest=null;
    for(const job of this.jobs){if(this.completed.has(job.id)||!this.near(player,job.anchor))continue;const distance=Math.hypot(player.x-job.anchor.x,player.z-job.anchor.z);if(!nearest||distance<nearest.distance)nearest={job,distance,hint:job.kind==='parcel'?'T · collect local parcel':job.kind==='lamp'?`Hold T · refill lamp${this.repair?.id===job.id?' · '+Math.floor(this.repair.progress/3*100)+'%':''}`:'T · sort today’s letters'};}
    return nearest;
  }
  sortHint(){if(!this.sorting)return'';const job=this.job(this.sorting.id),address=this.world.stations[this.orders[job.index][this.sorting.progress]].name;return`Post for ${address} · ${this.sorting.progress+1}/3 · 1 Pinebank / 2 Bellweather / 3 Stonehaven`;}
  select(id){if(id!==null&&(!this.job(id)||this.completed.has(id)))throw Error('Choose unfinished station work.');if(this.carrying||this.sorting)return'Finish the current parcel or letters first.';this.selected=id;this.touched=true;return id?'Station work selected. Follow the ticket on foot.':'Station work destination cleared.';}
  finish(job,reward){this.completed.set(job.id,reward);this.touched=true;if(this.selected===job.id)this.selected=null;this.repair=null;return`${job.kind==='parcel'?job.person+': Many thanks. ':''}${job.name} complete · +${reward} shillings · ${this.title}. J: noticeboard and workshop.`;}
  interact(sim){
    const context=this.context(sim.player);if(!context)return null;const job=context.job;
    if(this.carrying){const reward=8+(sim.time-this.carrying.started<=25?2:0);this.carrying=null;return this.finish(job,reward);}
    if(job.kind==='parcel'){this.carrying={id:job.id,started:sim.time};this.selected=job.id;this.touched=true;return`Parcel collected. Bring it to ${job.person}, ${Math.ceil(Math.hypot(job.destination.x-job.anchor.x,job.destination.z-job.anchor.z))} m along the platform.`;}
    if(job.kind==='lamp'){this.repair={id:job.id,progress:0};return'Keep T held for 3 seconds to refill the lamp. Stay beside it.';}
    if(this.sorting)return this.sortHint();
    this.sorting={id:job.id,progress:0,streak:0};this.selected=job.id;this.touched=true;return this.sortHint();
  }
  step(dt,sim,input){
    if(!Number.isFinite(dt)||dt<=0)return null;dt=Math.min(dt,1/15);
    if(!this.repair)return null;const job=this.job(this.repair.id);
    if(!input.work||!this.near(sim.player,job.anchor)){this.repair=null;return null;}
    this.repair.progress+=dt;
    return this.repair.progress>=3?this.finish(job,6):null;
  }
  sort(index,sim){
    if(!this.sorting)return null;const job=this.job(this.sorting.id);
    if(!this.near(sim.player,job.anchor))return'Return to the noticeboard to finish sorting.';
    if(index!==this.orders[job.index][this.sorting.progress]){this.sorting.streak=0;return'Wrong sack. Read the address and try again. '+this.sortHint();}
    this.sorting.progress++;this.sorting.streak++;
    if(this.sorting.progress===3){const reward=5+this.sorting.streak;this.sorting=null;return this.finish(job,reward);}
    return'Letter sorted. '+this.sortHint();
  }
  cancel(){this.carrying=null;this.sorting=null;this.repair=null;this.selected=null;this.touched=true;return'Unfinished parcel or letters returned. Completed work and coins kept.';}
  buyPaint(paint){
    if(!['original','green','ochre'].includes(paint))throw Error('Unknown workshop paint.');
    if(!this.owned.includes(paint)){if(this.wallet<20)return'The workshop needs 20 shillings. Earn them through station work.';this.owned.push(paint);}
    this.paint=paint;this.touched=true;return paint==='original'?'Original locomotive paint restored.':`${paint==='green'?'Forest green':'Ochre brass'} boiler paint applied. ${this.wallet} shillings left.`;
  }
  serialize(){return{version:1,completed:this.jobs.filter(job=>this.completed.has(job.id)).map(job=>({id:job.id,reward:this.completed.get(job.id)})),selected:this.selected,carrying:this.carrying?{...this.carrying}:null,sorting:this.sorting?{...this.sorting}:null,paint:this.paint,owned:this.owned.slice()};}
  restore(data,sim){
    if(data===undefined){Object.assign(this,{completed:new Map(),selected:null,carrying:null,sorting:null,repair:null,paint:'original',owned:['original'],touched:false});return;}
    const fail=()=>{throw Error('Invalid save: station work or workshop state is unsupported.');};
    if(!data||Array.isArray(data)||data.version!==1||!Array.isArray(data.completed)||data.completed.length>this.jobs.length)fail();
    const completed=new Map();
    for(const entry of data.completed){const job=this.job(entry?.id);if(!job||completed.has(job.id)||!Number.isInteger(entry.reward)||!(job.kind==='parcel'?[8,10]:job.kind==='lamp'?[6]:[6,7,8]).includes(entry.reward))fail();completed.set(job.id,entry.reward);}
    const valid=id=>typeof id==='string'&&this.job(id)&&!completed.has(id);
    if(data.selected!==null&&!valid(data.selected))fail();
    const carrying=data.carrying,sorting=data.sorting;
    if(carrying!==null&&(!carrying||!valid(carrying.id)||this.job(carrying.id).kind!=='parcel'||typeof carrying.started!=='number'||!Number.isFinite(carrying.started)||carrying.started<0||carrying.started>sim.time))fail();
    if(sorting!==null&&(!sorting||!valid(sorting.id)||this.job(sorting.id).kind!=='post'||!Number.isInteger(sorting.progress)||sorting.progress<0||sorting.progress>2||!Number.isInteger(sorting.streak)||sorting.streak<0||sorting.streak>sorting.progress))fail();
    if(carrying&&sorting||carrying&&data.selected!==carrying.id||sorting&&data.selected!==sorting.id)fail();
    if(!Array.isArray(data.owned)||data.owned.length<1||data.owned.length>3||data.owned[0]!=='original'||new Set(data.owned).size!==data.owned.length||data.owned.some(id=>!['original','green','ochre'].includes(id))||!data.owned.includes(data.paint))fail();
    if((data.owned.length-1)*20>[...completed.values()].reduce((sum,n)=>sum+n,0))fail();
    Object.assign(this,{completed,selected:data.selected,carrying:carrying?{id:carrying.id,started:carrying.started}:null,sorting:sorting?{id:sorting.id,progress:sorting.progress,streak:sorting.streak}:null,paint:data.paint,owned:data.owned.slice(),repair:null,touched:true});
  }
  objects(sim){
    const objects=[];
    const add=(point,dx,y,along,hx,hy,hz,material,type=0)=>{const station=this.world.stations[point.index],yaw=point.yaw??station.yaw;objects.push({x:point.anchor.x+Math.cos(yaw)*dx+Math.sin(yaw)*along,y:point.anchor.y+y,z:point.anchor.z-Math.sin(yaw)*dx+Math.cos(yaw)*along,hx,hy,hz,yaw,material,type});};
    for(const station of this.world.stations){if(Math.hypot(sim.player.x-station.x,sim.player.z-station.z)>110)continue;
      const parcel=this.job('parcel-'+this.world.stations.indexOf(station)),post=this.job('post-'+parcel.index);
      if(!this.completed.has(parcel.id)&&this.carrying?.id!==parcel.id){add(parcel,.95,.38,0,.45,.38,.40,30);add(parcel,.95,.77,0,.48,.035,.43,32);add(parcel,.95,.4,0,.035,.39,.41,27);}
      const centre={x:parcel.destination.x+Math.cos(station.yaw)*.85,y:parcel.destination.y,z:parcel.destination.z-Math.sin(station.yaw)*.85};
      const person={...parcel,anchor:centre,yaw:Math.atan2(sim.player.x-centre.x,sim.player.z-centre.z)},bob=Math.sin(sim.time*1.4+parcel.index)*(sim.settings.reducedMotion?.004:.025);
      add(person,0,1.05+bob,0,.24,.42,.17,33);add(person,0,1.69+bob,0,.18,.20,.17,32,1);add(person,0,1.90+bob,0,.23,.065,.21,8);
      for(const side of [-.13,.13])add(person,side,.35,0,.08,.35,.10,28);
      for(const side of [-.32,.32])add(person,side,1.0+bob,0,.075,.34,.08,33);
      for(const side of [-.07,.07])add(person,side,1.73+bob,.16,.027,.027,.018,28);
      add(person,0,1.59+bob,.16,.065,.018,.018,30);
      for(const along of [-.4,.4])add(post,1.1,.85,along,.065,.85,.065,30);
      add(post,1.1,1.55,0,.07,.50,.50,30);add(post,1.03,1.55,0,.015,.47,.39,32);
      add(post,.9,.6,-.8,.45,.07,.48,30);
      for(const side of [.55,1.25])add(post,side,.28,-.8,.06,.28,.32,30);
      if(!this.completed.has(post.id))add(post,.9,.70,-.8,.30,.03,.30,32);
    }
    return objects;
  }
}
