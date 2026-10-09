// Input, host lifecycle and HTML interface. Simulation remains independent of DOM.
class NSGame {
  constructor({canvas,host={}}={}) {
    if (!canvas) throw new Error('A canvas is required.');
    this.canvas=canvas; this.host=host; this.listeners=[]; this.input={}; this.frames=[];
    this.destroyed=false; this.started=false; this.running=false; this.debug=false;
    this.soundVolume=.55;this.soundMuted=false;
    this.soundCounters={chuffs:0,joints:0,bells:0};this.lastSoundBeat=null;this.lastJoint=null;
    this.lastCheckpoint=0;this.localSaveAvailable=false;
    this.world=new NSWorld('NEXT-STOP'); this.sim=new NSSimulation(this.world);this.exploration=new NSExploration(this.world);
    this.railway=new NSRailway(this.world);
    this.renderer=new NSGlyphRenderer(canvas,this.world);
    this.accumulator=0; this.previous=0; this.lastUI=0; this.toastUntil=0;
    this.width=window.innerWidth; this.height=window.innerHeight;
    this.el={};
    for(const id of ['menu','start-view','pause-view','help-view','settings-view','journal-view','journal-count','journal-list','field-hint','journey-ticket','journey-label','objective','hint','speed','throttle','brake','status','toast','diagnostics','menu-status','quality','weather','seed','reduced-motion','high-contrast','debug','pause-button']) this.el[id]=document.getElementById(id);
    this.bindControls(); this.resize(this.width,this.height); this.syncSettings();this.syncJournal();
    document.getElementById('start-button').focus();
    this.readLocalCheckpoint();
    this.renderer.onContextLost=()=>{this.wasRunning=this.running;this.pause();this.notify('Graphics interrupted. Waiting for restoration.');};
    this.renderer.onContextRestored=()=>{this.notify('Graphics restored. Your journey is safe.');if(this.wasRunning)this.resume();};
    this.renderer.onError=error=>{this.pause();this.showFatal(error);this.host.onError?.(error);};
    this.tick=this.tick.bind(this); this.raf=requestAnimationFrame(this.tick);
  }
  listen(target,type,handler,options) { target.addEventListener(type,handler,options);this.listeners.push(()=>target.removeEventListener(type,handler,options)); }
  click(id,handler) { const node=document.getElementById(id);if(node)this.listen(node,'click',handler); }
  bindControls() {
    this.click('start-button',()=>this.start());
    this.click('continue-button',()=>{try{const text=localStorage.getItem('next-stop-checkpoint');if(!text)throw Error('Local progress is unavailable. Import your exported save instead.');this.restore(text);this.start();this.notify('Last local journey restored.');}catch(error){this.notify(error.message||'Local progress could not be restored.');}});
    this.click('pause-button',()=>this.running?this.openMenu('pause'):this.closeMenu());
    this.click('help-button',()=>this.openMenu('help'));this.click('start-help',()=>this.openMenu('help'));
    this.click('journal-button',()=>this.openMenu('journal'));
    this.listen(this.el['journal-list'],'click',event=>{const button=event.target.closest('button[data-landmark]');if(!button)return;this.exploration.select(button.dataset.landmark);this.syncJournal();const target=this.exploration.target(this.sim.player).record;this.notify(`Journal destination: ${target.name} at ${target.station}.`);this.el['journal-view'].querySelector('.close-menu').focus();});
    this.click('settings-button',()=>this.openMenu('settings'));this.click('pause-settings',()=>this.openMenu('settings'));
    this.listen(document.querySelector('.service-choice'),'change',()=>{document.getElementById('cargo-choice').hidden=document.querySelector('input[name=service]:checked').value!=='freight';});
    for(const button of document.querySelectorAll('.resume-button,.close-menu'))this.listen(button,'click',()=>this.closeMenu());
    this.listen(this.el.quality,'change',()=>{this.sim.settings.quality=this.el.quality.value;this.resize(this.width,this.height);});
    this.listen(this.el.weather,'change',()=>{this.sim.settings.weatherMode=this.el.weather.value;if(this.el.weather.value!=='auto')this.sim.weatherTarget=this.el.weather.value;});
    this.listen(this.el['reduced-motion'],'change',()=>{this.sim.settings.reducedMotion=this.el['reduced-motion'].checked;this.syncSettings();});
    this.listen(this.el['high-contrast'],'change',()=>{this.sim.settings.highContrast=this.el['high-contrast'].checked;this.syncSettings();});
    this.listen(document.getElementById('fire-assist'),'change',event=>{this.railway.assisted=event.target.checked;this.railway.apply(this.sim);});
    this.listen(document.getElementById('sound-volume'),'input',event=>{this.soundVolume=Number(event.target.value)/100;this.syncAudio();});
    this.listen(document.getElementById('sound-muted'),'change',event=>{this.soundMuted=event.target.checked;this.syncAudio();});
    this.listen(this.el.debug,'change',()=>{this.debug=this.el.debug.checked;this.el.diagnostics.hidden=!this.debug;});
    this.click('regenerate',()=>{try{this.regenerate(this.el.seed.value);this.notify('New valley ready. Start beside your train.');}catch(error){this.report(error);}});
    this.click('recover',()=>{this.notify(this.sim.recover()||'Returned to a safe station.');});
    this.click('export',()=>this.exportSave());this.click('import',async()=>{if(!this.host.readSave){document.getElementById('save-file').click();return;}try{this.restore(await this.host.readSave());this.notify('Host save restored.');}catch(error){this.report(error);}});
    this.listen(document.getElementById('save-file'),'change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>1048576)throw new Error('Save is too large (maximum 1 MB).');this.restore(JSON.parse(await file.text()));this.notify('Save imported. Journey restored.');}catch(error){this.report(error);}finally{event.target.value='';}});
    const held={KeyW:'forward',KeyS:'backward',KeyA:'left',KeyD:'right',Space:'brake',ArrowLeft:'lookLeft',ArrowRight:'lookRight',ArrowUp:'lookUp',ArrowDown:'lookDown'};
    this.listen(window,'keydown',event=>{
      if(event.code==='Tab'&&!this.el.menu.hidden){const items=this.menuItems(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}return;}
      const editing=['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName);
      if(event.code==='Escape'){event.preventDefault();if(!event.repeat){if(this.el.menu.hidden)this.openMenu('pause');else this.closeMenu();}return;}
      if(editing)return;
      if(event.code==='KeyJ'&&!event.repeat){event.preventDefault();this.openMenu('journal');return;}
      if(event.code==='KeyH'&&!event.repeat){event.preventDefault();this.openMenu('help');return;}
      if(event.code==='F3'&&!event.repeat){event.preventDefault();this.debug=!this.debug;this.el.debug.checked=this.debug;this.el.diagnostics.hidden=!this.debug;return;}
      if(!this.running)return;
      if(held[event.code]){event.preventDefault();this.input[held[event.code]]=true;}
      if(!event.repeat){const action={KeyE:'interact',KeyC:'camera',KeyF:'recenter',KeyR:'reverse',KeyB:'stoke',KeyV:'whistle'}[event.code];if(action){event.preventDefault();this.act(action);}}
    });
    this.listen(window,'keyup',event=>{if(held[event.code])this.input[held[event.code]]=false;});
    this.listen(window,'blur',()=>{this.input={};if(this.running)this.openMenu('pause');});
    this.listen(document,'visibilitychange',()=>{if(document.hidden){this.input={};this.pause();}});
    this.listen(window,'resize',()=>this.resize(window.innerWidth,window.innerHeight));
    this.listen(this.canvas,'click',()=>{if(!this.running)return;this.canvas.focus({preventScroll:true});if(!document.pointerLockElement&&this.canvas.requestPointerLock){try{const result=this.canvas.requestPointerLock();if(result?.catch)result.catch(()=>this.notify('Mouse capture unavailable. Drag or use arrow keys to look.'));}catch{this.notify('Drag or use arrow keys to look.');}}});
    this.listen(document,'pointerlockerror',()=>this.notify('Drag or use arrow keys to look.'));
    this.listen(this.canvas,'pointerdown',event=>{if(event.button===0&&this.running){this.dragging=true;this.lastPointer=[event.clientX,event.clientY];}});
    this.listen(window,'pointerup',()=>{this.dragging=false;this.lastPointer=null;});
    this.listen(window,'pointermove',event=>{if(!this.running)return;let dx=0,dy=0;if(document.pointerLockElement===this.canvas){dx=event.movementX;dy=event.movementY;}else if(this.dragging&&this.lastPointer){dx=event.clientX-this.lastPointer[0];dy=event.clientY-this.lastPointer[1];this.lastPointer=[event.clientX,event.clientY];}this.input.lookX=(this.input.lookX||0)+dx;this.input.lookY=(this.input.lookY||0)+dy;});
  }
  start(){if(this.destroyed)return;if(!this.started&&!this.restored){this.railway.service=document.querySelector('input[name=service]:checked').value;this.railway.cargo=document.getElementById('cargo').value;this.railway.configure(this.sim);}this.started=true;this.resume();this.ensureAudio();this.notify('E · board the locomotive. H opens the driver’s guide.');}
  act(action){
    if(action==='stoke'||action==='whistle'){const message=this.railway.action(action,this.sim);this.notify(message);if(action==='whistle'&&this.sim.player.mode==='train')this.soundWhistle();return;}
    const before=this.sim.delivery.completed,index=this.sim.delivery.index,mode=this.sim.player.mode;
    if(action==='interact'&&mode==='train'&&Math.abs(this.sim.train.speed)<=.22){const waiting=this.railway.waiting(this.sim);if(waiting){this.notify(waiting);return;}}
    let message=this.sim.action(action);
    if(this.sim.delivery.completed>before){const earnings=this.railway.earnings;this.railway.recordStop(this.sim,index);message=`${this.world.stations[index].name} served · +${this.railway.earnings-earnings} shillings · ${this.railway.grade()}. Coal and water replenished.`;this.soundBell();this.el.toast.classList.add('service-reward');}
    else this.el.toast.classList.remove('service-reward');
    if(action==='interact'&&mode==='foot'&&this.sim.player.mode==='train')message=this.railway.job(this.sim)+' · B: fire · V: whistle';
    this.notify(message);
  }
  soundWhistle(){
    if(!this.ensureAudio())return;
    const gain=this.audio.createGain(),now=this.audio.currentTime;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.045,now+.12);gain.gain.linearRampToValueAtTime(0,now+1.3);gain.connect(this.audioTransport);
    for(let i=0;i<3;i++){const tone=this.audio.createOscillator();tone.type='sine';tone.frequency.setValueAtTime(264+i*132,now);tone.connect(gain);tone.start(now);tone.stop(now+1.35);tone.onended=()=>{tone.disconnect();if(i===2)gain.disconnect();};}
  }
  ensureAudio(){
    if(this.soundMuted||this.soundVolume===0||this.destroyed)return false;
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
    try{if(!this.audio){this.audio=new Audio();this.audioMaster=this.audio.createGain();this.audioMaster.connect(this.audio.destination);this.audioTransport=this.audio.createGain();this.audioTransport.connect(this.audioMaster);this.syncAudio();
      this.steamBuffer=this.audio.createBuffer(1,Math.ceil(this.audio.sampleRate*.22),this.audio.sampleRate);const samples=this.steamBuffer.getChannelData(0);let seed=17137,soft=0;for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;soft=soft*.58+((seed/4294967296)*2-1)*.42;samples[i]=soft;}}
      if(this.audio.state==='suspended')this.audio.resume().catch(()=>{});this.audioTransport.gain.value=this.running?1:0;return this.audio.state!=='closed';
    }catch{return false;}
  }
  soundPulse(kind){
    if(!this.audio||this.soundMuted||this.soundVolume===0||!this.running)return;
    const source=this.audio.createBufferSource(),gain=this.audio.createGain(),now=this.audio.currentTime;
    source.buffer=this.steamBuffer;source.playbackRate.value=kind==='joint'?2.1:1.0;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(kind==='joint'?.09:.045*(.6+this.sim.train.throttle*.4),now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+(kind==='joint'?.055:.18));
    source.connect(gain);gain.connect(this.audioTransport);source.start(now);source.stop(now+.22);source.onended=()=>{source.disconnect();gain.disconnect();};
    this.soundCounters[kind==='joint'?'joints':'chuffs']++;
  }
  soundBell(){
    if(!this.ensureAudio())return;this.soundCounters.bells++;
    for(let i=0;i<2;i++){const tone=this.audio.createOscillator(),gain=this.audio.createGain(),when=this.audio.currentTime+i*.16;tone.type='sine';tone.frequency.value=i?1320:880;gain.gain.setValueAtTime(.04,when);gain.gain.exponentialRampToValueAtTime(.0001,when+.65);tone.connect(gain);gain.connect(this.audioTransport);tone.start(when);tone.stop(when+.67);tone.onended=()=>{tone.disconnect();gain.disconnect();};}
  }
  updateTrainSound(){
    if(!this.audio||!this.running||this.sim.player.mode!=='train'||Math.abs(this.sim.train.speed)<.15){this.lastSoundBeat=null;this.lastJoint=null;return;}
    const distance=this.sim.train.wheelTravel??this.sim.train.s,beat=Math.floor(distance/(Math.PI*.72/2)),joint=Math.floor(distance/11.3);
    if(this.lastSoundBeat!==null&&beat!==this.lastSoundBeat)this.soundPulse('chuff');
    if(this.lastJoint!==null&&joint!==this.lastJoint)this.soundPulse('joint');
    this.lastSoundBeat=beat;this.lastJoint=joint;
  }
  syncAudio(){if(this.audioMaster){this.audioMaster.gain.cancelScheduledValues(0);this.audioMaster.gain.value=this.soundMuted?0:this.soundVolume;}}
  pause(){if(this.started&&!this.destroyed)this.checkpoint();this.running=false;if(this.audioTransport)this.audioTransport.gain.value=0;this.input={};this.dragging=false;this.lastPointer=null;this.accumulator=0;if(document.pointerLockElement===this.canvas)document.exitPointerLock();if(this.el['pause-button'])this.el['pause-button'].textContent='Resume';}
  resume(){if(this.destroyed)return;this.started=true;this.running=true;if(this.audioTransport)this.audioTransport.gain.value=1;this.lastSoundBeat=null;this.lastJoint=null;this.accumulator=0;this.previous=performance.now();this.el.menu.hidden=true;this.el['pause-button'].textContent='Pause';this.canvas.focus({preventScroll:true});}
  menuItems(root=this.el.menu){return[...root.querySelectorAll('button,input,select,summary')].filter(n=>!n.closest('[hidden]')&&!n.hidden&&!n.disabled&&(n.type!=='radio'||n.checked));}
  openMenu(view){this.pause();this.el.menu.hidden=false;for(const name of ['start','pause','help','settings','journal'])this.el[name+'-view'].hidden=name!==view;const heading=this.el[view+'-view'].querySelector('h1,h2');heading.id=view+'-heading';this.el.menu.querySelector('.card').setAttribute('aria-labelledby',heading.id);this.syncSettings();this.syncJournal();this.menuItems(this.el[view+'-view'])[0]?.focus();}
  closeMenu(){if(this.started)this.resume();else this.openMenu('start');}
  resize(width,height){this.width=Math.max(1,width);this.height=Math.max(1,height);this.renderer.resize(this.width,this.height,this.sim.settings.quality||'standard');}
  setInput(state){this.input={...this.input,...state};}
  tick(now){
    if(this.destroyed)return;const elapsed=this.previous?Math.max(0,(now-this.previous)/1000):0;this.previous=now;
    if(this.running&&!document.hidden){this.accumulator+=Math.min(elapsed,.15);let steps=0;while(this.accumulator>=1/60&&steps<9){this.railway.step(1/60,this.sim);this.sim.step(1/60,this.input);this.input.lookX=0;this.input.lookY=0;this.accumulator-=1/60;steps++;}}
    this.sim.renderAlpha=this.running?this.accumulator*60:1;
    this.updateTrainSound();
    if(this.running&&now-this.lastCheckpoint>10000){this.checkpoint();this.lastCheckpoint=now;}
    try{if(!this.renderer.lost){this.renderer.render(this.sim,this.sim.camera(Math.min(elapsed,.05)),{quality:this.sim.settings.quality,debug:this.debug,reducedMotion:this.sim.settings.reducedMotion});}}catch(error){this.pause();this.showFatal(error);return;}
    if(this.running&&elapsed>0&&elapsed<.25){this.frames.push(elapsed*1000);if(this.frames.length>600)this.frames.shift();}
    if(now-this.lastUI>150){this.updateUI(now);this.lastUI=now;}this.raf=requestAnimationFrame(this.tick);
  }
  updateUI(now){
    const train=this.sim.train;document.body.dataset.mode=this.sim.player.mode;
    this.el.objective.textContent=this.sim.delivery.finished?'The valley is yours':this.sim.delivery.started?this.world.stations[this.sim.delivery.index].name:'Pinebank departure';this.el.hint.textContent=this.sim.hint();
    this.el['journey-label'].textContent=this.sim.player.mode==='train'?`${this.sim.delivery.finished?'Free running':`${this.railway.service==='passenger'?'Passenger local':'Goods train'} · ${this.sim.delivery.completed}/3 stops`} · ${this.sim.train.direction===1?'forward':'reverse'}`:NSJourney.label(this.sim);
    const target=this.exploration.target(this.sim.player);
    const explorationStation=this.sim.delivery.finished&&target?this.world.stations.findIndex(s=>s.name===target.record.station):null;
    this.approach=NSJourney.approach(this.sim,explorationStation);
    this.el['journey-ticket'].dataset.approach=this.approach?.phase||'';
    if(this.approach){const a=this.approach;this.el.hint.textContent=a.phase==='cruise'?`${Math.ceil(a.distance)} m to platform`:a.phase==='approach'?`Platform ${Math.ceil(a.distance)} m · ease power`:a.phase==='ready'?(a.kind==='delivery'?(this.railway.waiting(this.sim)||`E · ${this.railway.service==='passenger'?'serve passengers':'hand over freight'}`):'E · leave train'):a.phase==='departure'?'W · open the regulator':a.hint;}
    const route=this.railway.instruction(this.sim),work=document.getElementById('work-hint');work.hidden=this.sim.player.mode!=='train';
    work.textContent=route?`${route.name} · ${Math.round(route.limit*3.6)} km/h${route.whistled?'':' · V: whistle'}`:!this.railway.assisted&&this.railway.engine.fire<.50?`Fire ${Math.round(this.railway.engine.fire*100)}% · B: add coal`:this.railway.job(this.sim);
    document.getElementById('pressure').textContent=this.railway.engine.pressure.toFixed(1);document.getElementById('fire').textContent=Math.round(this.railway.engine.fire*100);
    document.getElementById('service-ledger').textContent=`${this.railway.job(this.sim)}. Coal ${Math.round(this.railway.engine.coal)}%, water ${Math.round(this.railway.engine.water)}%. ${this.railway.grade()}. Stops served ${this.railway.stops.length}/3. Earnings ${this.railway.earnings} shillings.`;
    const discovery=this.running?this.exploration.discover(this.sim.player):null;
    if(discovery)this.notify(`Field note: ${discovery.name} · ${this.exploration.count}/${this.exploration.total} places discovered. J opens your journal.`);
    this.syncJournal();
    const next=this.exploration.target(this.sim.player);
    this.el['field-hint'].hidden=this.sim.player.mode!=='foot';
    this.el['field-hint'].textContent=next&&next.distance<80?`${next.record.name} · ${Math.ceil(next.distance)} m ${NSExploration.bearing(this.sim.player,next.record.anchor)} · J: journal`:`Field journal ${this.exploration.count}/${this.exploration.total} · J: read notes`;
    if(this.sim.delivery.finished&&next)this.el.objective.textContent=next.record.name;
    this.el.speed.textContent=(Math.abs(train.speed)*3.6).toFixed(1);this.el.throttle.textContent=Math.round(train.throttle*100);this.el.brake.textContent=Math.round((this.input.brake?1:train.brake||0)*100);
    document.getElementById('instruments').style.setProperty('--needle',`${-115+Math.min(40,Math.abs(train.speed)*3.6)/40*230}deg`);
    const weather=this.sim.weather;const w=(weather.rain||0)>.45?'RAIN':(weather.fog||0)>.45?'FOG':'CLEAR';const clock=(8+this.sim.time/30)%24;this.el.status.textContent=`${String(Math.floor(clock)).padStart(2,'0')}:${String(Math.floor(clock%1*60)).padStart(2,'0')} · ${w} · ${this.world.seed}`;
    if(now>this.toastUntil)this.el.toast.classList.remove('visible');
    if(this.debug){const d=this.renderer.diagnostics(),sorted=this.frames.slice().sort((a,b)=>a-b),mid=sorted[Math.floor(sorted.length/2)]||0,p95=sorted[Math.floor(sorted.length*.95)]||0;this.el.diagnostics.textContent=`DIRECT GLYPH CELLS\n${JSON.stringify(d,null,2)}\nFrame median ${mid.toFixed(1)} ms / p95 ${p95.toFixed(1)} ms\nSeed checksum ${this.world.checksum()}\nF3 toggles diagnostics`;}
  }
  syncSettings(){document.getElementById('sound-volume').value=Math.round(this.soundVolume*100);document.getElementById('sound-muted').checked=this.soundMuted;this.el.quality.value=this.sim.settings.quality||'standard';this.el.weather.value=this.sim.settings.weatherMode||'auto';this.el.seed.value=this.world.seed;this.el['reduced-motion'].checked=!!this.sim.settings.reducedMotion;this.el['high-contrast'].checked=!!this.sim.settings.highContrast;document.body.classList.toggle('reduced-motion',!!this.sim.settings.reducedMotion);document.body.classList.toggle('high-contrast',!!this.sim.settings.highContrast);}
  syncJournal(){
    const signature=this.world.seed+'|'+this.exploration.serialize().visited.join(',')+'|'+this.exploration.selected;
    if(signature===this.journalSignature)return;this.journalSignature=signature;
    this.el['journal-count'].textContent=`${this.exploration.count} of ${this.exploration.total} places discovered`;
    this.el['journal-list'].replaceChildren();
    for(const record of this.exploration.records){
      const visited=this.exploration.visited.has(record.id),item=document.createElement('li'),name=document.createElement('strong'),note=document.createElement('p');
      item.className=visited?'discovered':'';name.textContent=`${visited?'✓':'○'} ${record.name}`;
      note.textContent=visited?record.description:`Walk along ${record.station}'s platform to find this place. The cab cannot collect field notes.`;
      item.append(name,note);
      if(!visited){const button=document.createElement('button');button.className='small';button.dataset.landmark=record.id;button.textContent=this.exploration.selected===record.id?'Destination selected':'Set destination';button.disabled=this.exploration.selected===record.id;button.setAttribute('aria-label',`Set destination: ${record.name}`);item.append(button);}
      this.el['journal-list'].append(item);
    }
  }
  notify(message){if(!message)return;this.el.toast.textContent=message;this.el.toast.classList.add('visible');this.toastUntil=performance.now()+4500;if(!this.el.menu.hidden)this.el['menu-status'].textContent=message;}
  readLocalCheckpoint(){try{const text=localStorage.getItem('next-stop-checkpoint');this.localSaveAvailable=!!text&&text.length<=65536;}catch{this.localSaveAvailable=false;}const button=document.getElementById('continue-button');button.hidden=!this.localSaveAvailable;}
  checkpoint(){try{localStorage.setItem('next-stop-checkpoint',JSON.stringify(this.serialize()));this.localSaveAvailable=true;}catch{this.localSaveAvailable=false;}const status=document.getElementById('local-save-status');status.textContent=this.localSaveAvailable?'Local progress saved. Continue last journey after reopening this file.':'Local storage unavailable. Export a JSON save to keep progress.';}
  report(error){console.error(error);this.notify(error.message||String(error));this.host.onError?.(error);}
  serialize(){return{...this.sim.serialize(),exploration:this.exploration.serialize(),railway:this.railway.serialize()};}
  restore(value){
    const data=typeof value==='string'?JSON.parse(value):value;
    if(!data||!data.world||typeof data.world.seed!=='string'||data.world.seed.length>64)throw new Error('Save contains an invalid world seed.');
    const candidateWorld=new NSWorld(data.world.seed,data.world.version),candidate=new NSSimulation(candidateWorld),candidateExploration=new NSExploration(candidateWorld),candidateRailway=new NSRailway(candidateWorld);candidate.restore(data);candidateExploration.restore(data.exploration);candidateRailway.restore(data.railway,candidate);
    this.renderer.setWorld(candidateWorld);this.world=candidateWorld;this.sim=candidate;this.exploration=candidateExploration;this.railway=candidateRailway;this.restored=true;this.input={};this.accumulator=0;this.syncSettings();this.syncJournal();document.getElementById('fire-assist').checked=this.railway.assisted;this.resize(this.width,this.height);
  }
  regenerate(seed){const value=String(seed).trim();if(!value||value.length>64)throw new Error('Use a world seed between 1 and 64 characters.');const candidateWorld=new NSWorld(value),candidate=new NSSimulation(candidateWorld),candidateExploration=new NSExploration(candidateWorld),candidateRailway=new NSRailway(candidateWorld);candidate.settings={...this.sim.settings};candidateRailway.service=this.railway.service;candidateRailway.cargo=this.railway.cargo;candidateRailway.assisted=this.railway.assisted;candidateRailway.configure(candidate);this.renderer.setWorld(candidateWorld);this.world=candidateWorld;this.sim=candidate;this.exploration=candidateExploration;this.railway=candidateRailway;this.restored=false;this.input={};this.accumulator=0;this.syncSettings();this.syncJournal();}
  diagnostics(){const sorted=this.frames.slice().sort((a,b)=>a-b);return{frames:sorted.length,medianMs:sorted[Math.floor(sorted.length/2)]||0,p95Ms:sorted[Math.floor(sorted.length*.95)]||0,renderer:this.renderer.diagnostics(),seed:this.world.seed,checksum:this.world.checksum(),running:this.running};}
  async exportSave(){try{const data=this.serialize(),text=JSON.stringify(data,null,2);if(this.host.writeSave)await this.host.writeSave(text);else{const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='next-stop-save.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}try{localStorage.setItem('next-stop-save',text);}catch{this.notify('Save exported. Browser storage unavailable; keep your JSON file.');return;}this.notify('Save exported. Keep it for your next journey.');}catch(error){this.report(error);}}
  showFatal(error){document.getElementById('fatal').hidden=false;document.getElementById('fatal-message').textContent=error.message||'The renderer could not start.';document.getElementById('fatal-detail').textContent=error.stack||'';console.error(error);}
  destroy(){if(this.destroyed)return;this.pause();this.destroyed=true;cancelAnimationFrame(this.raf);for(const remove of this.listeners)remove();this.listeners=[];this.renderer.destroy();if(this.audio&&this.audio.state!=='closed')this.audio.close().catch(error=>this.host.onError?.(error));}
}
window.NextStop={create:options=>new NSGame(options)};
try{window.nextStopGame=window.NextStop.create({canvas:document.getElementById('world')});}catch(error){document.getElementById('fatal').hidden=false;document.getElementById('fatal-message').textContent=error.message;document.getElementById('fatal-detail').textContent=error.stack||'';console.error(error);}
