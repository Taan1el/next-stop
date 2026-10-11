/* Next Stop numerical world and simulation. No DOM or graphics dependencies.
   Terrain: row-major vertex heights; bilinear interpolation over [-500,500].
   Route coordinates are metres of arc length; +Y up, yaw 0 faces +Z. */
class NSWorld {
  constructor(seed = 'Next Stop', version = 4) {
    if (![1,2,3,4].includes(version)) throw new Error('Unsupported valley generation version.');
    this.seed = String(seed).trim().slice(0, 80) || 'Next Stop';
    this.version = version;
    this.size = 1000;
    this.resolution = 129;
    this.waterLevel = 0;
    this.heights = new Float32Array(this.resolution * this.resolution);
    this.objects = [];
    this.route = [];
    this.stations = [];
    this.lamps = [];
    this.chimneys = [];
    this._seedHash = NSWorld.hash(this.seed);
    this._rngState = this._seedHash || 1;
    this._phase = this.random() * Math.PI * 2;
    this._a = 302 + this.random() * 16;
    this._b = 231 + this.random() * 12;
    this._buildRoute();
    this._buildTerrain();
    this._buildRailway();
    this._buildStations();
    this._buildScenery();
    if(this.version>=4)this._buildDetails();
    this.maxHeight = this.heights.reduce((a, b) => Math.max(a, b), -Infinity);
    this.minHeight = this.heights.reduce((a, b) => Math.min(a, b), Infinity);
    this._checksum = this._makeChecksum();
  }
  static hash(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  random() {
    let x = this._rngState;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this._rngState = x >>> 0;
    return this._rngState / 4294967296;
  }
  _noise(x, z, scale) {
    x /= scale; z /= scale;
    const ix = Math.floor(x), iz = Math.floor(z);
    let u = x - ix, v = z - iz;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const sample = (a, b) => {
      let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ this._seedHash;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const a = sample(ix, iz), b = sample(ix + 1, iz);
    const c = sample(ix, iz + 1), d = sample(ix + 1, iz + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  _buildRoute() {
    const count = 512;
    let distance = 0;
    for (let i = 0; i <= count; i++) {
      const t = i / count * Math.PI * 2;
      const ripple = 1 + .025 * Math.sin(3 * t + this._phase);
      const p = { x: Math.sin(t) * this._a * ripple,
        z: Math.cos(t) * this._b * ripple,
        y: 2.65 + .8 * Math.sin(t + this._phase * .3) + .32 * Math.sin(2 * t), s: 0 };
      if (i) {
        const prev = this.route[i - 1];
        distance += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
      }
      p.s = distance;
      this.route.push(p);
    }
    this.routeLength = distance;
    for (let i = 0; i < count; i++) {
      const p = this.route[i], n = this.route[i + 1];
      p.yaw = Math.atan2(n.x - p.x, n.z - p.z);
      p.grade = (n.y - p.y) / (n.s - p.s);
    }
    Object.assign(this.route[count], { yaw: this.route[0].yaw, grade: this.route[0].grade });
  }
  routeAt(distance) {
    const s = ((distance % this.routeLength) + this.routeLength) % this.routeLength;
    let lo = 0, hi = this.route.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.route[mid].s <= s) lo = mid; else hi = mid;
    }
    const a = this.route[lo], b = this.route[lo + 1];
    const u = (s - a.s) / (b.s - a.s);
    const yawDelta = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u,
      z: a.z + (b.z - a.z) * u, yaw: a.yaw + yawDelta * u, grade: a.grade + (b.grade - a.grade) * u, s };
  }
  _nearestRoute(x, z) {
    let index = 0, best = Infinity;
    for (let i = 0; i < 512; i += 8) {
      const p = this.route[i], d = (x - p.x) ** 2 + (z - p.z) ** 2;
      if (d < best) { best = d; index = i; }
    }
    let height = 0;
    for (let j = -8; j <= 8; j++) {
      const i = (index + j + 512) % 512, a = this.route[i], b = this.route[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
      const d = (x - a.x - dx * u) ** 2 + (z - a.z - dz * u) ** 2;
      if (d <= best) { best = d; height = a.y + (b.y - a.y) * u; }
    }
    return { distance: Math.sqrt(best), height };
  }
  _buildTerrain() {
    const n = this.resolution, half = this.size / 2;
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const wx = x / (n - 1) * this.size - half, wz = z / (n - 1) * this.size - half;
      const noise = (this._noise(wx, wz, 185) - .5) * 7 + (this._noise(wx, wz, 65) - .5) * 3;
      const edge = Math.max(0, (Math.max(Math.abs(wx), Math.abs(wz)) / half - .65) / .35);
      let h = 4.5 + noise + edge * edge * (57 + this._noise(wx, wz, 110) * 24);
      if (this.version>=2) {
        const radius=Math.hypot(wx/430,wz/355),angle=Math.atan2(wz,wx);
        const foothill=Math.max(0,Math.min(1,(radius-.70)/.65));
        const ridge=Math.max(0,Math.min(1,(radius-.86)/.53));
        const crest=.58+.42*(.5+.5*Math.cos(angle*5+this._phase));
        h=6+noise*1.6+Math.sin(wx*.016+this._phase)*Math.cos(wz*.013)*4;
        h+=foothill*foothill*22+Math.pow(ridge,1.15)*(95+this._noise(wx,wz,72)*92)*crest;
      }
      const lake = ((wx - 55) / 188) ** 2 + ((wz + 157) / 121) ** 2;
      if (lake < 1.24) {
        const basin = -3.5 + Math.min(lake, 1) * 2 + this._noise(wx, wz, 36) * .25;
        const blend = Math.max(0, Math.min(1, (lake - 1) / .24));
        h = basin + (h - basin) * blend * blend * (3 - 2 * blend);
      }
      const rail = this._nearestRoute(wx, wz);
      // Preserve the water basin under bridge spans; elsewhere cut a rail shelf.
      if (rail.distance < 23 && lake >= 1.10) {
        let blend = Math.max(0, Math.min(1, (23 - rail.distance) / 16));
        blend = blend * blend * (3 - 2 * blend);
        h += (rail.height - .43 - h) * blend;
      }
      this.heights[z * n + x] = h;
    }
  }
  heightAt(x, z) {
    const n = this.resolution, k = (n - 1) / this.size;
    const gx = Math.max(0, Math.min(n - 1, (x + this.size / 2) * k));
    const gz = Math.max(0, Math.min(n - 1, (z + this.size / 2) * k));
    const ix = Math.min(n - 2, Math.floor(gx)), iz = Math.min(n - 2, Math.floor(gz));
    const u = gx - ix, v = gz - iz, i = iz * n + ix, h = this.heights;
    return h[i] * (1 - u) * (1 - v) + h[i + 1] * u * (1 - v) +
      h[i + n] * (1 - u) * v + h[i + n + 1] * u * v;
  }
  _object(x, y, z, hx, hy, hz, yaw, material, type = 0, flags = {}) {
    const object = { x, y, z, hx, hy, hz, yaw, material, type, ...flags };
    this.objects.push(object);
    return object;
  }
  _buildRailway() {
    const segments = 96, step = this.routeLength / segments;
    for (let i = 0; i < segments; i++) {
      const a = this.routeAt(i * step), b = this.routeAt((i + 1) * step);
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, z = (a.z + b.z) / 2;
      const yaw = Math.atan2(b.x - a.x, b.z - a.z), length = Math.hypot(b.x - a.x, b.z - a.z);
      const bridge = this.heightAt(x, z) < this.waterLevel + .15;
      this._object(x, y - .27, z, 1.55, .20, length / 2 + .33, yaw, bridge ? 13 : 6, 0, { support: true, rail: true });
      for (const offset of [-.78, .78]) this._object(x + Math.cos(yaw) * offset, y - .015,
        z - Math.sin(yaw) * offset, .075, .075, length / 2 + .34, yaw, 7, 0, { rail: true });
      if (bridge && i % 3 === 0) {
        const ground = this.heightAt(x, z), bottom = Math.max(-4, ground);
        this._object(x, (y - .48 + bottom) / 2, z, .6, (y - .48 - bottom) / 2, .8, yaw, 13, 0, { solid: true });
      }
    }
  }
  _buildStations() {
    const names = ['Pinebank', 'Bellweather', 'Stonehaven'];
    for (let i = 0; i < 3; i++) {
      const p = this.routeAt(this.routeLength * i / 3), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const station = { name: names[i], s: p.s, x: p.x, y: p.y, z: p.z, yaw: p.yaw, radius: 25,
        platformX: p.x + rx * 4.4, platformZ: p.z + rz * 4.4 };
      this.stations.push(station);
      this._object(p.x + rx * 4.8, p.y - .12, p.z + rz * 4.8, 2.25, .22, 27, p.yaw, 10, 0, { support: true });
      const bx = p.x + rx * 11, bz = p.z + rz * 11, floor = this.heightAt(bx, bz);
      this._object(bx, floor + 2.8, bz, 3.5, 2.8, 8, p.yaw, 4, 0, { solid: true, station: true });
      this._object(bx, floor + (this.version>=3?6.9:5.9), bz, 4.0, this.version>=3?1.3:.35, 8.7, p.yaw, 5,this.version>=3?2:0);
      for (const along of [-4, 4]) this._object(bx - rx * 3.54 + Math.sin(p.yaw) * along,
        floor + 2.8, bz - rz * 3.54 + Math.cos(p.yaw) * along, .06, .85, 1.2, p.yaw, 9);
      this._object(p.x + rx * 6.5, p.y + 2.3, p.z + rz * 6.5, .08, 2.2, .08, p.yaw, 7, 0, { solid: true });
      this._object(p.x + rx * 6.5, p.y + 3.3, p.z + rz * 6.5, .18, .50, 1.7, p.yaw, 6);
      if (i === 1) {
        const tx = bx + Math.sin(p.yaw) * 12, tz = bz + Math.cos(p.yaw) * 12;
        this._object(tx, floor + 7, tz, 2, 7, 2, p.yaw, 4, 0, { solid: true });
        this._object(tx, floor + 14.4, tz, 2.5, .5, 2.5, p.yaw, 5);
      }
      if (i === 2) {
        this._object(bx + rx * 7, floor + 1.8, bz + rz * 7, 4, 1.8, 4, p.yaw, 2, 0, { solid: true });
      }
      if(this.version>=2){
        const lx=p.x+rx*6.7+Math.sin(p.yaw)*17,lz=p.z+rz*6.7+Math.cos(p.yaw)*17;
        this._object(lx,p.y+1.9,lz,.10,1.8,.10,p.yaw,7,0,{solid:true});
        this._object(lx,p.y+3.65,lz,.25,.30,.25,p.yaw,17);
        this.lamps.push({x:lx,y:p.y+3.65,z:lz});
        this._object(bx+rx*1.8,floor+6.9,bz,.55,1.2,.55,p.yaw,2);
        this.chimneys.push({x:bx+rx*1.8,y:floor+8.2,z:bz});
        this._object(bx-rx*3.56,floor+1.9,bz,.08,.55,.7,p.yaw,18);
      }
    }
  }
  _buildScenery() {
    for (let s = 0; s < 3; s++) {
      const station = this.stations[s], p = this.routeAt(station.s), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      for (let i = 0; i < 5; i++) {
        const along = (i - 2) * 19 + (this.random() - .5) * 5, side = 26 + this.random() * 21;
        const x = p.x + rx * side + Math.sin(p.yaw) * along;
        const z = p.z + rz * side + Math.cos(p.yaw) * along;
        const y = this.heightAt(x, z), h = 2.8 + this.random() * 1.5, width = 4 + this.random() * 2;
        this._object(x, y + h, z, width, h, 5, p.yaw, 4, 0, { solid: true });
        this._object(x, y + h * 2 + (this.version>=3?1:.45), z, width + .4, this.version>=3?1:.45, 5.7, p.yaw, 5,this.version>=3?2:0);
        this._object(x - rx * (width + .025), y + h, z - rz * (width + .025), .06, .8, 1.0, p.yaw, 9);
      }
    }
    let trees = 0, tries = 0;
    const target=this.version===1?32:220;
    while (trees < target && tries++ < (this.version===1?250:2200)) {
      let x = (this.random() - .5) * (this.version===1?780:920), z = (this.random() - .5) * (this.version===1?780:920);
      if(this.version>=2&&trees<154&&tries<1000){
        const p=this.routeAt(((tries%7)/7+.045)*this.routeLength),side=35+Math.abs(x)*.07,along=z/8;
        x=p.x-Math.cos(p.yaw)*side+Math.sin(p.yaw)*along;
        z=p.z+Math.sin(p.yaw)*side+Math.cos(p.yaw)*along;
      }
      const y = this.heightAt(x, z);
      const railDistance=this._nearestRoute(x,z).distance;
      if (y < 1 || railDistance < 13) continue;
      if(this.version>=2&&(y>125||this._noise(x+130,z-70,105)<.36))continue;
      if (this.objects.some(o => o.solid && Math.hypot(o.x - x, o.z - z) < 12)) continue;
      const height = this.version===1?7+this.random()*5:8+this.random()*9;
      this._object(x, y + height * .3, z, .45, height * .3, .45, 0, 11, 0, { solid: true });
      this._object(x, y + height * .65, z, height * .27, height * .35, height * .27, 0, 12, 1);
      this._object(x, y + height * .91, z, height * .17, height * .22, height * .17, 0, 12, 1);
      trees++;
    }
    if(this.version>=2){
      // Small rural fences define field edges without covering the railway.
      for(const station of this.stations){const p=this.routeAt(station.s),rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw);
        for(let i=0;i<7;i++){const side=24,along=-72+i*5,x=p.x+rx*side+Math.sin(p.yaw)*along,z=p.z+rz*side+Math.cos(p.yaw)*along,y=this.heightAt(x,z);
          if(y<1||this.blocked(x,y,z,2))continue;
          this._object(x,y+.7,z,.10,.7,.10,p.yaw,11,0,{solid:true});
          this._object(x+Math.sin(p.yaw)*2.5,y+.95,z+Math.cos(p.yaw)*2.5,.08,.09,2.5,p.yaw,11);
        }
      }
    }
  }
  _buildDetails(){
    // Added after original generation, so old layouts and RNG order stay exact.
    const buildings=this.objects.filter(o=>o.material===4);
    const attach=(b,side,up,along,hx,hy,hz,material,type=0,flags={})=>this._object(
      b.x+Math.cos(b.yaw)*side+Math.sin(b.yaw)*along,b.y+up,
      b.z-Math.sin(b.yaw)*side+Math.cos(b.yaw)*along,hx,hy,hz,b.yaw,material,type,{detail:true,lod:70,...flags});
    for(const o of this.objects){
      if(o.material===5){o.material=31;if(o.type===2)o.type=7;}
      if(o.material===9){o.material=26;o.detail=true;o.lod=90;}
    }
    // The former orange wall patch becomes a proper framed door.
    this.objects=this.objects.filter(o=>o.material!==18);
    for(const b of buildings){
      b.material=b.station||b.hy>5?24:25;
      const floor=-b.hy,front=-b.hx-.10;
      if(b.hy>5){attach(b,front,b.hy*.65,0,.07,1.1,1.1,34,0,{lod:130});continue;}
      attach(b,front,floor+1.15,0,.08,1.15,.65,33);
      attach(b,front-.025,floor+2.34,0,.10,.10,.77,32);
      for(const z of [-.74,.74])attach(b,front-.025,floor+1.15,z,.10,1.18,.08,32);
      attach(b,front-.12,floor+1.08,-.40,.075,.075,.075,27,1);
      attach(b,front+.10,floor+.14,0,.43,.14,.86,13,0,{solid:true});
      const windows=b.station?[-4,4]:[-2.35,2.35];
      for(const z of windows){
        attach(b,front-.02,0,z,.075,.80,.92,26);
        for(const edge of [-1,1])attach(b,front-.08,0,z+edge*.99,.11,.91,.085,32);
        for(const edge of [-1,1])attach(b,front-.08,edge*.88,z,.11,.085,1.06,32);
        attach(b,front-.17,-.98,z,.26,.12,1.15,13);
      }
      attach(b,front+.08,b.hy+.05,0,.16,.13,b.hz+.25,32,0,{lod:105});
      if(!b.station){
        attach(b,b.hx+.05,b.hy+.05,0,.14,.13,b.hz+.25,32,0,{lod:105});
        const chimney=attach(b,b.hx*.45,b.hy+1.4,1.3,.35,.90,.35,24,0,{lod:110});
        this.chimneys.push({x:chimney.x,y:chimney.y+chimney.hy+.05,z:chimney.z});
      }
    }
    for(let i=0;i<this.stations.length;i++){
      const station=this.stations[i],p=this.routeAt(station.s);
      const at=(side,up,along,hx,hy,hz,material,type=0,flags={})=>attach(p,side,up,along,hx,hy,hz,material,type,flags);
      at(5.8,4.1,0,1.9,.13,7.5,31,0,{lod:105});
      at(3.9,3.97,0,.10,.21,7.7,32,0,{lod:105});
      for(const along of [-6,6]){at(6.8,2.1,along,.075,2.0,.075,28,5,{solid:true});at(5.4,3.8,along,1.50,.10,.10,32);}
      // Seat, back and legs read as one bench from a distance.
      at(6.20,.52,-11,.48,.10,1.50,30);
      at(6.65,.99,-11,.08,.43,1.5,30);
      for(const along of [-12.1,-9.9])at(6.20,.22,along,.35,.23,.08,28,0,{solid:true});
      at(6.45,.48,10,.43,.45,.43,30,5,{solid:true});
      at(6.45,.15,12.2,.54,.15,.54,30,0,{solid:true});
      at(6.45,.65,12.2,.42,.35,.42,30,0,{solid:true});
      at(6.50,3.3,0,.20,.50,2.4,35,0,{info:i,lod:100});
      at(6.7,4.01,17,.32,.08,.32,28,5);
      at(6.7,3.4,17,.29,.06,.29,27,5);
    }
  }
  _inside(object, x, z, margin = 0) {
    const dx = x - object.x, dz = z - object.z, c = Math.cos(object.yaw), s = Math.sin(object.yaw);
    return Math.abs(dx * c - dz * s) < object.hx + margin && Math.abs(dx * s + dz * c) < object.hz + margin;
  }
  surfaceAt(x, z) {
    let height = this.heightAt(x, z), material = height > 27 ? 2 : 1, support = false;
    for (const o of this.objects) if (o.support && this._inside(o, x, z)) {
      const top = o.y + o.hy;
      if (top > height) { height = top; material = o.material; support = true; }
    }
    return { height, material, walkable: height > this.waterLevel + .08 || support, support };
  }
  blocked(x, y, z, radius = .36, bodyHeight = 1.7) {
    return this.objects.some(o => o.solid && this._inside(o, x, z, radius) &&
      y + bodyHeight > o.y - o.hy + .08 && y < o.y + o.hy - .08);
  }
  stationAt(distance) {
    for (let i = 0; i < this.stations.length; i++) {
      const station = this.stations[i];
      let delta = Math.abs(distance - station.s) % this.routeLength;
      delta = Math.min(delta, this.routeLength - delta);
      if (delta < station.radius) return { ...station, index: i, distance: delta };
    }
    return null;
  }
  _makeChecksum() {
    let h = this._seedHash;
    const update = value => { h = Math.imul(h ^ Math.round(value * 1000), 16777619) >>> 0; };
    this.heights.forEach(update);
    for (const o of this.objects){for (const key of ['x', 'y', 'z', 'hx', 'hy', 'hz', 'yaw', 'material', 'type']) update(o[key]);if(this.version>=4)update(o.info||0);}
    for (const p of this.route) for (const key of ['x', 'y', 'z', 's']) update(p[key]);
    return h.toString(16).padStart(8, '0');
  }
  checksum() { return this._checksum; }
}

class NSSimulation {
  constructor(world) {
    this.world = world;
    this.time = 0;
    this.weather = { rain: 0, fog: .08 };
    this.weatherTarget = 'clear';
    this.train = { s: 0, speed: 0, throttle: 0, brake: 1, direction: 1 };
    if(world.version>=4)this.train.wheelTravel=0;
    this.player = { x: 0, y: 0, z: 0, yaw: 0, pitch: -.05, mode: 'foot' };
    this.cameraMode = 'chase';
    this.delivery = { index: 0, completed: 0, started: false, finished: false };
    this.settings = { quality: 'standard', reducedMotion: false, weatherMode: 'auto', highContrast: false, nightBrightness:1, lantern:true };
    this.maxSpeed = 6.5;
    this._camera = null;
    this._lastRouteYaw = world.routeAt(0).yaw;
    this._spawnFoot(0);
    this.renderAlpha = 1;
    this._previousS = 0;
    this._previousPlayer = { ...this.player };
  }
  static angle(value) { return value>=-Math.PI&&value<=Math.PI?value:Math.atan2(Math.sin(value),Math.cos(value)); }
  _spawnFoot(distance) {
    const p = this.world.routeAt(distance), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    let chosen = null;
    for (const offset of [4.4, -4.4, 2.2, -2.2]) {
      const x = p.x + rx * offset, z = p.z + rz * offset, surface = this.world.surfaceAt(x, z);
      if (surface.walkable && !this.world.blocked(x, surface.height, z)) { chosen = { x, y: surface.height, z }; break; }
    }
    if (!chosen) return false;
    Object.assign(this.player, chosen, { mode: 'foot', yaw: Math.atan2(p.x - chosen.x, p.z - chosen.z), pitch: -.05 });
    this._camera = null;
    return true;
  }
  step(dt, input = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 1 / 15);
    this._previousS = this.train.s;
    this._previousWheelTravel=this.train.wheelTravel;
    this._previousPlayer = { ...this.player };
    this.time += dt;
    const mode = this.settings.weatherMode;
    this.weatherTarget = mode === 'auto' ? ['clear', 'rain', 'clear', 'fog'][Math.floor(this.time / 160) % 4] : mode;
    if (!['clear', 'rain', 'fog'].includes(this.weatherTarget)) this.weatherTarget = 'clear';
    const rain = this.weatherTarget === 'rain' ? 1 : 0;
    const fog = this.weatherTarget === 'fog' ? .88 : this.weatherTarget === 'rain' ? .43 : .08;
    const weatherBlend = 1 - Math.exp(-dt / 8);
    this.weather.rain += (rain - this.weather.rain) * weatherBlend;
    this.weather.fog += (fog - this.weather.fog) * weatherBlend;
    const lookX = Number.isFinite(input.lookX) ? Math.max(-2000, Math.min(2000, input.lookX)) : 0;
    const lookY = Number.isFinite(input.lookY) ? Math.max(-2000, Math.min(2000, input.lookY)) : 0;
    this.player.yaw = NSSimulation.angle(this.player.yaw + lookX * .0022 +
      ((input.lookRight ? 1 : 0) - (input.lookLeft ? 1 : 0)) * dt * 1.45);
    this.player.pitch = Math.max(-1.15, Math.min(1.15, this.player.pitch - lookY * .0022 +
      ((input.lookUp ? 1 : 0) - (input.lookDown ? 1 : 0)) * dt));
    if (this.player.mode === 'train') {
      this.train.throttle = Math.max(0, Math.min(1, this.train.throttle +
        ((input.forward ? 1 : 0) - (input.backward ? 1 : 0)) * dt * .42));
      this.train.brake = input.brake ? 1 : 0;
    } else {
      // An unattended locomotive stays safely braked.
      this.train.throttle = 0; this.train.brake = 1;
      this._walk(dt, input);
    }
    this._trainStep(dt);
    if (this.player.mode === 'train') {
      const p = this.world.routeAt(this.train.s);
      this.player.yaw = NSSimulation.angle(this.player.yaw + NSSimulation.angle(p.yaw - this._lastRouteYaw));
      Object.assign(this.player, { x: p.x, y: p.y, z: p.z });
      this._lastRouteYaw = p.yaw;
    }
  }
  _walk(dt, input) {
    let f = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
    let r = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const norm = Math.hypot(f, r);
    if (!norm) return;
    f /= norm; r /= norm;
    const speed = 4.2 * (this.walkScale || 1), yaw = this.player.yaw;
    const dx = (Math.sin(yaw) * f + Math.cos(yaw) * r) * speed * dt;
    const dz = (Math.cos(yaw) * f - Math.sin(yaw) * r) * speed * dt;
    const attempt = (x, z) => {
      const limit = this.world.size / 2 - 8;
      if (Math.abs(x) > limit || Math.abs(z) > limit) return false;
      const surface = this.world.surfaceAt(x, z);
      if (!surface.walkable || surface.height - this.player.y > .55 || this.player.y - surface.height > 1.8) return false;
      if (this.world.blocked(x, surface.height, z) || this._blockedByTrain(x, surface.height, z)) return false;
      Object.assign(this.player, { x, y: surface.height, z });
      return true;
    };
    if (!attempt(this.player.x + dx, this.player.z + dz)) {
      attempt(this.player.x + dx, this.player.z);
      attempt(this.player.x, this.player.z + dz);
    }
  }
  _blockedByTrain(x, y, z, distance = this.train.s) {
    for (let carriage = 0; carriage <= 2; carriage++) {
      const p = this.world.routeAt(distance - carriage * 11.3);
      const dx = x - p.x, dz = z - p.z, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
      if (Math.abs(dx * c - dz * s) < 1.55 && Math.abs(dx * s + dz * c) < 4.85 &&
          y + 1.7 > p.y + .1 && y < p.y + 3.75) return true;
    }
    return false;
  }
  _trainStep(dt) {
    const t = this.train, p = this.world.routeAt(t.s), mass = 52000;
    const speed = t.speed, sign = Math.sign(speed), abs = Math.abs(speed);
    const traction = t.direction * 34000 * t.throttle * Math.max(.18, 1 - abs / 9)*(this.tractionScale??1);
    const gradeForce = -9.81 * p.grade * mass;
    const brakeForce = 100000 * t.brake;
    const rolling = 1350, drag = 90 * speed * speed;
    const drive = traction + gradeForce;
    // Static resistance and applied brake hold the train on a slope.
    if (abs < .025 && Math.abs(drive) <= brakeForce + 4200) { t.speed = 0; return; }
    const motionSign = sign || Math.sign(drive);
    const force = drive - motionSign * (brakeForce + rolling + drag);
    let next = speed + force / mass * dt;
    // Brake and friction cannot propel a train through rest into reverse.
    if (speed && Math.sign(next) !== sign && Math.abs(drive) <= brakeForce + rolling + drag) next = 0;
    if (!speed && Math.sign(next) !== Math.sign(drive)) next = 0;
    next = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, next));
    t.speed = next;
    const travelled=(speed+next)*.5*dt;
    if(Number.isFinite(t.wheelTravel))t.wheelTravel+=travelled;
    t.s = ((t.s + travelled) % this.world.routeLength + this.world.routeLength) % this.world.routeLength;
  }
  stoppingDistance() {
    if (this.train.speed === 0) return 0;
    // Predict only a private train descriptor. Reuse the exact force model and
    // sample route grade as the train moves, without advancing the live world.
    const prediction = { world: this.world, maxSpeed: this.maxSpeed, tractionScale:this.tractionScale??1, train: { ...this.train, brake: 1 } };
    const length = this.world.routeLength;
    let distance = 0;
    for (let step = 0; step < 600 && prediction.train.speed !== 0; step++) {
      const before = prediction.train.s;
      this._trainStep.call(prediction, 1 / 60);
      let delta = prediction.train.s - before;
      if (delta > length / 2) delta -= length;
      if (delta < -length / 2) delta += length;
      distance += Math.abs(delta);
    }
    return distance;
  }
  action(name) {
    if (name === 'recover') return this.recover();
    if (name === 'camera') {
      this.cameraMode = this.cameraMode === 'cab' ? 'chase' : 'cab'; this._camera = null;
      return this.player.mode === 'train' ? `${this.cameraMode === 'cab' ? 'Cab' : 'Chase'} camera.` : 'Camera setting saved for boarding.';
    }
    if (name === 'recenter') {
      if(this.player.mode!=='train')return 'Camera centre is available aboard the train.';
      this.player.yaw=this.world.routeAt(this.train.s).yaw;this.player.pitch=-.04;this._camera=null;
      return 'Camera centred on the railway.';
    }
    if (name === 'reverse') {
      if (this.player.mode !== 'train') return 'Board the locomotive first.';
      if (Math.abs(this.train.speed) > .12) return 'Stop fully before changing direction.';
      this.train.speed = 0; this.train.throttle = 0; this.train.direction *= -1;
      return this.train.direction === 1 ? 'Forward selected.' : 'Reverse selected.';
    }
    if (name !== 'interact') return '';
    const p = this.world.routeAt(this.train.s);
    if (this.player.mode === 'foot') {
      if (Math.hypot(this.player.x - p.x, this.player.z - p.z) > 8) return 'Move beside the locomotive to board.';
      if (Math.abs(this.train.speed) > .12) return 'Wait for the train to stop.';
      Object.assign(this.player, { mode: 'train', x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: -.04 });
      this._lastRouteYaw = p.yaw; this._camera = null;
      if (!this.delivery.started && this.world.stationAt(this.train.s)?.index === 0) {
        Object.assign(this.delivery, { started: true, index: 1 });
        return `Cargo loaded. Next stop: ${this.world.stations[1].name}. Hold W to add throttle.`;
      }
      return 'Aboard. Hold W to add throttle; Space applies the brake.';
    }
    if (Math.abs(this.train.speed) > .22) return 'Apply the brake and stop before delivering or leaving.';
    const station = this.world.stationAt(this.train.s);
    if (station && station.index === this.delivery.index && !this.delivery.finished) {
      if (!this.delivery.started && station.index === 0) {
        Object.assign(this.delivery, { started: true, index: 1 });
        return `Cargo loaded. Next stop: ${this.world.stations[1].name}.`;
      }
      if (this.delivery.started) {
        this.delivery.completed++;
        this.delivery.index = this.delivery.completed === 1 ? 2 : 0;
        if (this.delivery.completed >= 3) {
          this.delivery.finished = true;
          return 'Circuit complete. Three deliveries made. Explore freely or begin a new seed.';
        }
        return `Delivery ${this.delivery.completed}/3 complete. Next stop: ${this.world.stations[this.delivery.index].name}.`;
      }
    }
    if (!this._spawnFoot(this.train.s)) return 'Bridge crossing. Leave at a station or dry ground.';
    this.train.speed = 0; this.train.throttle = 0; this.train.brake = 1;
    return station ? `On foot at ${station.name}.` : 'On foot. E boards the locomotive.';
  }
  recover() {
    Object.assign(this.train, { s: 0, speed: 0, throttle: 0, brake: 1, direction: 1 });
    this._lastRouteYaw = this.world.routeAt(0).yaw;
    this._spawnFoot(0);
    this._previousS = 0; this._previousPlayer = { ...this.player };
    return 'Recovered to Pinebank. Delivery progress preserved.';
  }
  objective() {
    if (this.delivery.finished) return 'Circuit complete: 3/3 deliveries. The valley is yours to explore.';
    if (!this.delivery.started) return 'Board the locomotive at Pinebank to collect your first delivery.';
    return `Next stop: ${this.world.stations[this.delivery.index].name}. Stop at its platform, then press E to deliver (${this.delivery.completed}/3).`;
  }
  hint() {
    if (this.player.mode === 'foot') {
      const p = this.world.routeAt(this.train.s);
      return Math.hypot(this.player.x - p.x, this.player.z - p.z) < 8 ? 'E: board locomotive · WASD: walk · Arrows: look' : 'WASD: explore · Arrows: look · Recovery returns to Pinebank';
    }
    const station = this.world.stationAt(this.train.s);
    if (Math.abs(this.train.speed) > .22) return 'W/S: throttle · Space: brake · C: camera';
    if (station && station.index === this.delivery.index && !this.delivery.finished) return this.delivery.started ? `E: deliver at ${station.name} · W: depart` : 'E: collect cargo · W: depart';
    return 'E: leave train · W/S: throttle · R: direction · C: camera';
  }
  camera(dt = 1 / 60) {
    let position, target;
    const alpha = Math.max(0, Math.min(1, Number.isFinite(this.renderAlpha) ? this.renderAlpha : 1));
    const p = { ...this.player };
    if (p.mode === 'foot' && this._previousPlayer.mode === 'foot') {
      for (const key of ['x', 'y', 'z']) p[key] = this._previousPlayer[key] + (p[key] - this._previousPlayer[key]) * alpha;
    }
    const rail = this._presentationRoute();
    if (p.mode === 'train') p.yaw += NSSimulation.angle(rail.yaw - this.world.routeAt(this.train.s).yaw);
    const cp = Math.cos(p.pitch), sx = Math.sin(p.yaw), cz = Math.cos(p.yaw);
    if (p.mode === 'foot') {
      position = [p.x, p.y + 1.68, p.z];
      target = [p.x + sx * cp * 12, p.y + 1.68 + Math.sin(p.pitch) * 12, p.z + cz * cp * 12];
    } else {
      if (this.cameraMode === 'cab') {
        // Eye ahead of the enclosed cabin, above the numerical boiler.
        const along=this.world.version>=3?-2.7:2.9;
        position = [rail.x + Math.sin(rail.yaw) * along, rail.y + (this.world.version>=3?3.0:3.55), rail.z + Math.cos(rail.yaw) * along];
        target = [position[0] + sx * cp * 14, position[1] + Math.sin(p.pitch) * 14, position[2] + cz * cp * 14];
      } else {
        position = [rail.x - sx * 16, rail.y + Math.max(4, 8 - p.pitch * 9), rail.z - cz * 16];
        position[1] = Math.max(position[1], this.world.heightAt(position[0], position[2]) + 2.3);
        for (const o of this.world.objects) if (o.solid && this.world._inside(o, position[0], position[2], .5)) position[1] = Math.max(position[1], o.y + o.hy + 1.1);
        target = [rail.x + Math.sin(rail.yaw) * 3, rail.y + (this.world.version>=3?4.2:1.9), rail.z + Math.cos(rail.yaw) * 3];
      }
    }
    if (!this._camera || this.settings.reducedMotion || p.mode === 'foot' || this.cameraMode === 'cab') this._camera = { position: position.slice(), target: target.slice() };
    else {
      const blend = 1 - Math.exp(-Math.max(0, Math.min(.1, dt)) / .13);
      for (let i = 0; i < 3; i++) {
        this._camera.position[i] += (position[i] - this._camera.position[i]) * blend;
        this._camera.target[i] += (target[i] - this._camera.target[i]) * blend;
      }
      this._camera.position[1] = Math.max(this._camera.position[1], this.world.heightAt(this._camera.position[0], this._camera.position[2]) + 1.9);
      // Interpolation can cross a solid even when its desired endpoint is clear.
      for (const o of this.world.objects) if (o.solid && this.world._inside(o, this._camera.position[0], this._camera.position[2], .5))
        this._camera.position[1] = Math.max(this._camera.position[1], o.y + o.hy + 1.1);
    }
    return this._camera;
  }
  _presentationRoute(offset = 0) {
    const length = this.world.routeLength;
    let delta = this.train.s - this._previousS;
    if (delta > length / 2) delta -= length;
    if (delta < -length / 2) delta += length;
    const alpha = Math.max(0, Math.min(1, Number.isFinite(this.renderAlpha) ? this.renderAlpha : 1));
    return this.world.routeAt(this._previousS + delta * alpha + offset);
  }
  dynamicObjects() {
    const objects = [], add = (p, along, up, hx, hy, hz, material, type = 0, side = 0) => {
      objects.push({ x: p.x + Math.sin(p.yaw) * along + Math.cos(p.yaw) * side, y: p.y + up,
        z: p.z + Math.cos(p.yaw) * along - Math.sin(p.yaw) * side, hx, hy, hz, yaw: p.yaw, material, type, train: true });
    };
    const loco = this._presentationRoute();
    if(this.world.version>=4)objects.push(...this._detailedTrainObjects(loco));
    else{
    const engineMaterial=this.world.version>=3?23:8;
    add(loco, 0, .58, 1.13, .42, 4.5, 7);
    add(loco, 1.2, 1.7, 1.03, 1.03, 2.75, engineMaterial, 1);
    if(this.world.version>=3){
      for(const side of [-1.19,1.19]){
        add(loco,-2.85,1.10,.08,.35,1.55,engineMaterial,0,side);
        for(const along of [-4.25,-1.45])add(loco,along,2.15,.08,1.3,.08,7,0,side);
      }
      add(loco,-4.35,1.9,1.1,1.15,.08,engineMaterial);
    }else add(loco, -2.85, 2.15, 1.19, 1.4, 1.55, 8);
    add(loco, -2.85, 3.62, 1.28, .16, 1.72, 7);
    add(loco, 3.7, 2.55, .26, .75, .26, 7);
    add(loco, 4.0, 1.68, .32, .30, .12, 9);
    if(this.world.version<3)for (const side of [-1.205, 1.205]) add(loco, -2.4, 2.65, .035, .65, .8, 9, 0, side);
    for (const side of [-1.06, 1.06]) for (const along of [-3.1, 2.5]) add(loco, along, .43, .18, .4, .4, 7, 1, side);
    for (let carriage = 1; carriage <= 2; carriage++) {
      const p = this._presentationRoute(-carriage * 11.3);
      add(p, 0, .58, 1.15, .40, 4.55, 7);
      add(p, 0, 2.1, 1.19, 1.23, 4.55, 8);
      add(p, 0, 3.37, 1.29, .15, 4.7, 7);
      for (const side of [-1.205, 1.205]) add(p, 0, 2.42, .035, .64, 3.8, 9, 0, side);
      for (const side of [-1.06, 1.06]) for (const along of [-3.2, 3.2]) add(p, along, .43, .18, .4, .4, 7, 1, side);
    }
    }
    if(this.world.version>=2){
      add(loco,-4.43,1.18,.22,.22,.10,20);
      add(loco,-1.7,1.42,.42,.20+.18*(this.steamFire??.72),.12,18);
      const puff=(x,y,z,age,scale)=>objects.push({x:x+age*.75,y:y+age*.8,z:z-age*.22,hx:scale+age*.19,hy:scale*.7+age*.25,hz:scale+age*.18,yaw:0,material:19,type:1});
      for(let i=0;i<4;i++){const age=((this.time+i*1.2)%4.8),p=this.world.routeAt(this.train.s-this.train.speed*age);puff(p.x+Math.sin(p.yaw)*3.7,p.y+3.4,p.z+Math.cos(p.yaw)*3.7,age,.28);}
      const chimneys=this.world.version>=4?this.world.chimneys.filter(c=>Math.hypot(c.x-this.player.x,c.z-this.player.z)<110).sort((a,b)=>Math.hypot(a.x-this.player.x,a.z-this.player.z)-Math.hypot(b.x-this.player.x,b.z-this.player.z)).slice(0,3):this.world.chimneys;
      for(const chimney of chimneys)if(Math.hypot(chimney.x-this.player.x,chimney.z-this.player.z)<110)
        for(let i=0;i<3;i++)puff(chimney.x,chimney.y,chimney.z,(this.time*.7+i*1.5)%4.5,.35);
    }
    return objects;
  }
  _detailedTrainObjects(loco){
    const objects=[],add=(p,along,up,hx,hy,hz,material,type=0,side=0,info=0)=>{
      const o={x:p.x+Math.sin(p.yaw)*along+Math.cos(p.yaw)*side,y:p.y+up,z:p.z+Math.cos(p.yaw)*along-Math.sin(p.yaw)*side,hx,hy,hz,yaw:p.yaw,material,type,info,train:true};objects.push(o);return o;
    };
    const alpha=Math.max(0,Math.min(1,this.renderAlpha??1));
    const previous=this._previousWheelTravel??this.train.wheelTravel??0;
    const travel=previous+((this.train.wheelTravel??0)-previous)*alpha,phase=travel/.72;
    add(loco,0,.85,1.08,.18,4.5,28);
    add(loco,1.20,2.05,.97,.97,2.72,23,3);
    add(loco,3.96,2.05,.91,.91,.12,28,3);
    add(loco,4.10,2.05,.22,.22,.055,27,3);
    add(loco,3.70,3.30,.23,.46,.23,28,5);
    add(loco,3.70,3.80,.34,.09,.34,28,5);
    add(loco,.35,3.02,.32,.29,.32,27,1);
    add(loco,1.65,3.05,.29,.32,.29,23,1);
    for(const side of [-1.04,1.04])add(loco,1.2,2.28,.045,.045,2.5,27,3,side);
    add(loco,4.00,2.47,.27,.27,.16,26,3);
    for(const side of [-1.20,1.20]){
      add(loco,-2.85,1.34,.075,.36,1.50,23,0,side);
      for(const along of [-4.2,-1.45])add(loco,along,2.49,.075,1.10,.075,28,5,side);
      add(loco,-2.85,.94,.34,.06,1.10,28,0,side*1.07);
    }
    add(loco,-4.28,2.1,1.13,.96,.06,23);
    add(loco,-2.85,3.67,1.29,.15,1.68,28);
    add(loco,-1.58,2.06,.87,.78,.12,28,3);
    for(const side of [-.35,.35])add(loco,-1.77,2.55,.20,.20,.055,36,3,side,(this.steamPressure??9.2)/11.8);
    add(loco,-1.83,1.63,.52,.48,.06,28);
    add(loco,-1.91,2.00,.42,.07,.08,27);
    add(loco,-2.05,2.20,.05,.30,.05,39,5,-.76);
    add(loco,-2.05,2.53,.16,.07,.16,27,5,-.76);
    add(loco,-2.3,1.17,.35,.08,.45,42,0,.73);
    // Three coupled drivers. Quartered crank pins and rods follow wheel travel.
    for(const side of [-1,1]){
      const q=phase+(side<0?Math.PI/2:0),dy=Math.cos(q)*.22,dz=Math.sin(q)*.22;
      for(const along of [-1.60,.30,2.20]){
        add(loco,along,.72,.13,.72,.72,29,4,side*1.16,NSSimulation.angle(q));
        add(loco,along+dz,.72+dy,.065,.10,.10,27,4,side*1.35);
      }
      add(loco,.30+dz,.72+dy,.065,.065,1.95,38,0,side*1.37);
      add(loco,3.40,.69,.25,.22,.63,28,3,side*1.02);
      add(loco,3.40+dz*.6,.70,.055,.055,.82,38,3,side*1.30);
      const z0=2.20+dz,z1=3.43+dz*.6,y0=.72+dy,y1=.70;
      add(loco,(z0+z1)/2,(y0+y1)/2,.055,.055,Math.hypot(z1-z0,y1-y0)/2,38,6,side*1.39,Math.atan2(y1-y0,z1-z0));
      for(const along of [-3.80,3.70])add(loco,along,.37,.12,.37,.37,29,4,side*1.04,NSSimulation.angle(travel/.37));
    }
    const buffers=(p,end)=>{
      add(p,end*4.57,.92,1.25,.18,.13,8);
      for(const side of [-.83,.83])add(p,end*4.83,.94,.21,.21,.19,28,3,side);
      add(p,end*5.15,.72,.12,.12,.34,28,3);
    };
    buffers(loco,1);buffers(loco,-1);
    for(let carriage=1;carriage<=2;carriage++){
      const p=this._presentationRoute(-carriage*11.3),passenger=this.serviceMode==='passenger'||this.serviceMode==='explore',timber=this.cargoKind==='timber'&&!passenger;
      Object.assign(add(p,0,.85,1.13,.20,4.45,28),{part:'carriage-frame',carriage});
      if(passenger){
        add(p,0,2.10,1.18,1.02,4.25,8);
        add(p,0,3.20,1.23,.30,4.40,28,3);
        for(const side of [-1.20,1.20]){add(p,0,2.48,.055,.55,3.80,26,0,side);add(p,0,1.73,.06,.07,4.12,27,0,side);}
      }else{
        for(const side of [-1.14,1.14])add(p,0,timber?1.20:1.52,.08,timber?.23:.54,4.33,30,0,side);
        for(const along of [-4.32,4.32])add(p,along,timber?1.20:1.52,1.15,timber?.23:.54,.08,30);
        if(timber){for(const side of [-.65,0,.65])add(p,0,1.66,.29,.29,3.88,40,3,side);}
        else if(this.cargoKind==='mail'){add(p,0,2.28,1.13,1.16,4.13,25);add(p,0,3.48,1.20,.22,4.25,28,3);}
        else if(carriage===1){add(p,-1.1,1.60,.67,.53,.82,30);add(p,1.1,1.60,.67,.53,.82,30);add(p,0,1.70,.44,.60,.44,27,5,.55);}
        else add(p,0,1.76,1.02,.56,3.84,37,1);
      }
      for(const side of [-1.08,1.08])for(const along of [-3.05,3.05])add(p,along,.45,.13,.45,.45,29,4,side,NSSimulation.angle(travel/.45));
      buffers(p,1);buffers(p,-1);
    }
    return objects;
  }
  serialize() {
    return { version: 1, world: { seed: this.world.seed, version: this.world.version, checksum: this.world.checksum() },
      time: this.time, weather: { ...this.weather }, weatherTarget: ['clear', 'rain', 'fog'].includes(this.weatherTarget) ? this.weatherTarget : 'clear',
      train: { ...this.train }, player: { ...this.player }, cameraMode: this.cameraMode,
      delivery: { ...this.delivery }, settings: { ...this.settings } };
  }
  restore(input) {
    // Validate into an isolated snapshot; no live state changes until every check passes.
    let data;
    try {
      const json = typeof input === 'string' ? input : JSON.stringify(input);
      if (!json || json.length > 65536) throw new Error('Save exceeds the 64 KB limit.');
      data = JSON.parse(json);
    } catch (error) { throw new Error(`Invalid save JSON: ${error.message}`); }
    const fail = message => { throw new Error(`Invalid save: ${message}`); };
    const object = (value, name) => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} is missing.`); return value; };
    const number = (value, min, max, name) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${name} is out of range.`); return value; };
    const bool = (value, name) => { if (typeof value !== 'boolean') fail(`${name} must be true or false.`); return value; };
    const choice = (value, choices, name) => { if (!choices.includes(value)) fail(`${name} is unsupported.`); return value; };
    object(data, 'save');
    if (data.version !== 1) fail('unsupported format version.');
    const w = object(data.world, 'world');
    if (typeof w.seed !== 'string' || w.seed.length < 1 || w.seed.length > 80 || w.seed !== this.world.seed || w.version !== this.world.version || w.checksum !== this.world.checksum()) fail('world seed, version, or checksum does not match.');
    const time = number(data.time, 0, 1e9, 'time');
    const weather = object(data.weather, 'weather');
    const restoredWeather = { rain: number(weather.rain, 0, 1, 'rain'), fog: number(weather.fog, 0, 1, 'fog') };
    const weatherTarget = choice(data.weatherTarget, ['clear', 'rain', 'fog'], 'weather target');
    const t = object(data.train, 'train');
    const train = { s: number(t.s, 0, this.world.routeLength - 1e-8, 'route distance'), speed: number(t.speed, -this.maxSpeed, this.maxSpeed, 'speed'),
      throttle: number(t.throttle, 0, 1, 'throttle'), brake: number(t.brake, 0, 1, 'brake'), direction: choice(t.direction, [-1, 1], 'direction') };
    if(this.world.version>=4)train.wheelTravel=t.wheelTravel===undefined?0:number(t.wheelTravel,-1e10,1e10,'wheel travel');
    const p = object(data.player, 'player'), half = this.world.size / 2;
    const player = { x: number(p.x, -half + 4, half - 4, 'player x'), y: number(p.y, -10, Math.max(150,this.world.maxHeight+12), 'player y'), z: number(p.z, -half + 4, half - 4, 'player z'),
      yaw: NSSimulation.angle(number(p.yaw, -1e6, 1e6, 'yaw')), pitch: number(p.pitch, -1.15, 1.15, 'pitch'), mode: choice(p.mode, ['foot', 'train'], 'player mode') };
    if (player.mode === 'foot') {
      const surface = this.world.surfaceAt(player.x, player.z);
      if (!surface.walkable || Math.abs(player.y - surface.height) > .6 || this.world.blocked(player.x, surface.height, player.z) ||
          this._blockedByTrain(player.x, surface.height, player.z, train.s)) fail('walking position is unsafe.');
      player.y = surface.height;
    } else {
      const rail = this.world.routeAt(train.s);
      if (Math.hypot(player.x - rail.x, player.y - rail.y, player.z - rail.z) > 1) fail('player and locomotive positions disagree.');
      Object.assign(player, { x: rail.x, y: rail.y, z: rail.z });
    }
    if (player.mode === 'foot' && Math.abs(train.speed) > .22) fail('unattended train is moving.');
    const cameraMode = choice(data.cameraMode, ['cab', 'chase'], 'camera mode');
    const d = object(data.delivery, 'delivery');
    const delivery = { index: choice(d.index, [0, 1, 2], 'station index'), completed: choice(d.completed, [0, 1, 2, 3], 'completed deliveries'),
      started: bool(d.started, 'delivery started'), finished: bool(d.finished, 'delivery finished') };
    const expected = delivery.completed === 0 ? (delivery.started ? 1 : 0) : delivery.completed === 1 ? 2 : 0;
    if (delivery.index !== expected || delivery.finished !== (delivery.completed === 3) || (!delivery.started && delivery.completed !== 0)) fail('delivery progression is inconsistent.');
    const s = object(data.settings, 'settings');
    const settings = { quality: choice(s.quality, ['coarse', 'standard', 'fine'], 'quality'), reducedMotion: bool(s.reducedMotion, 'reduced motion'),
      weatherMode: choice(s.weatherMode, ['auto', 'clear', 'rain', 'fog'], 'weather mode'), highContrast: s.highContrast === undefined ? false : bool(s.highContrast, 'high contrast') };
    if(s.nightBrightness!==undefined)settings.nightBrightness=number(s.nightBrightness,.7,1.4,'night brightness');
    if(s.lantern!==undefined)settings.lantern=bool(s.lantern,'hand lantern');
    Object.assign(this, { time, weather: restoredWeather, weatherTarget, train, player, cameraMode, delivery, settings });
    this._lastRouteYaw = this.world.routeAt(train.s).yaw; this._camera = null;
    this._previousS = train.s; this._previousPlayer = { ...player }; this.renderAlpha = 1;
    this._previousWheelTravel=train.wheelTravel;
    return 'Journey restored.';
  }
}
