// A fixed audio graph: four reusable noise loops and one quiet bird oscillator.
// Everything passes through the game's transport, so pause and mute stay authoritative.
class NSAmbience {
  constructor(context,transport) {
    this.context=context;this.nodes=[];this.sources=[];this.voices={};this.destroyed=false;this.noiseNames=['wind','rain','water','fire'];
    this.nextUpdate=0;this.nextWaterCheck=0;this.lastRunning=null;this.waterDistance=96;
    this.room=false;this.cab=false;this.fireplace=false;this.world=null;
    try {
      this.output=this._node(context.createGain());this.output.gain.value=1;this.output.connect(transport);
      for(const [index,name] of this.noiseNames.entries()) {
        const source=this._node(context.createBufferSource()),filter=this._node(context.createBiquadFilter()),gain=this._node(context.createGain());
        const rate=Math.min(22050,context.sampleRate),duration=[7.3,4.9,5.7,5.1][index];
        const buffer=context.createBuffer(1,Math.ceil(rate*duration),rate),samples=buffer.getChannelData(0);
        let seed=8371+index*9173,soft=0,crackle=0;
        for(let i=0;i<samples.length;i++) {
          seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
          soft=soft*.985+noise*.015;crackle*=.997;
          if(name==='fire'&&noise>.999)crackle=.3+noise*.4;
          const edge=Math.min(1,i/(rate*.012),(samples.length-1-i)/(rate*.012));
          samples[i]=(name==='wind'?soft*4:name==='water'?soft*3+noise*.08:name==='fire'?noise*(.04+crackle):noise*.35)*edge;
        }
        source.buffer=buffer;source.loop=true;filter.type=name==='fire'?'highpass':'lowpass';
        filter.frequency.value=name==='fire'?550:1800;filter.Q.value=.5;gain.gain.value=0;
        source.connect(filter);filter.connect(gain);gain.connect(this.output);this.sources.push(source);source.start();
        this.voices[name]={source,filter,gain,target:0,cutoff:filter.frequency.value};
      }
      this.bird=this._node(context.createOscillator());this.bird.type='sine';this.bird.frequency.value=1900;
      this.birdGain=this._node(context.createGain());this.birdGain.gain.value=0;
      this.bird.connect(this.birdGain);this.birdGain.connect(this.output);this.sources.push(this.bird);this.bird.start();
    } catch(error) {this.destroy();throw error;}
  }
  _node(node) {this.nodes.push(node);return node;}
  _approach(parameter,value,time,seconds=.3) {parameter.setTargetAtTime(value,time,seconds);}
  update(sim,life,running) {
    if(this.destroyed)return;
    const now=this.context.currentTime;
    if(now<this.nextUpdate&&running===this.lastRunning)return;
    this.nextUpdate=now+.08;this.lastRunning=running;
    const player=sim.player,weather=sim.weather,rain=Math.max(0,Math.min(1,weather?.rain||0));
    const acoustic=typeof life?.acoustics==='function'?life.acoustics(sim):null;
    this.room=!!acoustic?.insideRoom;this.cab=player.mode==='train'&&sim.cameraMode==='cab';this.fireplace=this.room&&!!acoustic?.fireplace;
    if(sim.world!==this.world) {this.world=sim.world;this.nextWaterCheck=0;}
    if(Number.isFinite(acoustic?.waterDistance))this.waterDistance=Math.max(0,acoustic.waterDistance);
    else if(now>=this.nextWaterCheck) {
      this.nextWaterCheck=now+.75;this.waterDistance=96;
      const world=this.world;
      if(typeof world?.heightAt==='function')for(let ring=0;ring<3;ring++)for(let direction=0;direction<12;direction++) {
        const distance=ring===0?8:ring===1?24:52,angle=direction*Math.PI/6,x=player.x+Math.sin(angle)*distance,z=player.z+Math.cos(angle)*distance;
        if(Math.abs(x)<=499&&Math.abs(z)<=499&&world.heightAt(x,z)<world.waterLevel+.02)this.waterDistance=Math.min(this.waterDistance,distance);
      }
    }
    const active=running?1:0,shelter=this.room?.19:this.cab?.40:1;
    const wind=this.voices.wind,wet=this.voices.rain,water=this.voices.water,fire=this.voices.fire;
    wind.target=active*(.026+.025*rain)*shelter*(.84+.16*Math.sin((sim.time||0)*.19));wind.cutoff=this.room?280:this.cab?440:1250;
    wet.target=active*rain*.055*(this.room?.55:this.cab?.70:1);wet.cutoff=this.room?560:this.cab?1000:6200;
    water.target=active*Math.max(0,1-this.waterDistance/70)*.075*shelter;water.cutoff=this.room?460:1800;
    fire.target=active*(this.fireplace?.08:0);fire.cutoff=550;
    for(const name of this.noiseNames) {
      const voice=this.voices[name];this._approach(voice.gain.gain,voice.target,now);this._approach(voice.filter.frequency,voice.cutoff,now,.45);
    }
    // Reuse one oscillator. Two tiny chirps per long phrase, only in fair daylight.
    const time=sim.time||0,phase=(time%19+19)%19,chirp=phase<.22?phase:phase>.38&&phase<.60?phase-.38:-1;
    const daylight=Math.sin(1.05+time*Math.PI*2/720)>.12;
    const birdLevel=active&&daylight&&rain<.45&&chirp>=0?.009*shelter*Math.sin(chirp/.22*Math.PI):0;
    this._approach(this.birdGain.gain,birdLevel,now,.025);
    this._approach(this.bird.frequency,1750+(chirp<0?0:Math.sin(chirp/.22*Math.PI)*1150),now,.025);
  }
  diagnostics() {
    return {destroyed:this.destroyed,loopSources:4,birdOscillators:1,insideRoom:this.room,cab:this.cab,fireplace:this.fireplace,waterDistance:this.waterDistance,rainCutoff:this.voices.rain?.cutoff||0};
  }
  destroy() {
    if(this.destroyed)return;this.destroyed=true;
    if(this.output)this.output.gain.value=0;
    for(const source of this.sources)try{source.stop();}catch{}
    for(const node of this.nodes)try{node.disconnect();}catch{}
    this.nodes.length=0;this.sources.length=0;
  }
}
