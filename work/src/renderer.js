/* Next Stop: numerical world -> integer character records -> numeric glyph masks.
 * This renderer never creates a conventional world-colour image or samples fonts.
 */
(function (global) {
  'use strict';

  const MAX_OBJECTS = 256;
  const CELL_PRESETS = Object.freeze({ coarse: [12, 18], standard: [8, 12], fine: [6, 9] });
  const VERTEX = `#version 300 es
  precision highp float;
  out vec2 v_uv;
  void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    v_uv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const SCENE = `#version 300 es
  precision highp float;
  precision highp int;
  precision highp sampler2D;
  layout(location=0) out uvec4 out_record;
  layout(location=1) out uvec4 out_foreground;
  layout(location=2) out uvec4 out_background;

  uniform sampler2D u_terrain;
  uniform sampler2D u_objects;
  uniform int u_resolution;
  uniform int u_objectCount;
  uniform int u_shadowCount;
  uniform float u_size;
  uniform float u_water;
  uniform vec2 u_heightRange;
  uniform vec2 u_viewport;
  uniform vec2 u_cellSize;
  uniform vec3 u_eye;
  uniform vec3 u_forward;
  uniform vec3 u_right;
  uniform vec3 u_up;
  uniform vec3 u_sun;
  uniform vec3 u_headPosition;
  uniform vec3 u_headDirection;
  uniform float u_time;
  uniform vec2 u_weather;
  uniform float u_motion;
  uniform float u_far;
  uniform vec3 u_lamps[3];
  uniform vec4 u_lantern;
  uniform vec4 u_stationGlow;
  uniform float u_shelter;
  uniform float u_nightBrightness;
  uniform int u_paint;
  uniform vec3 u_lampCare;
  uniform highp usampler2D u_labels;
  uniform vec4 u_stars[64];

  struct Hit { float t; vec3 p; vec3 n; int material; vec3 local; vec3 extent; float info; };

  float hash21(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float fieldNoise(vec2 p) {
    vec2 cell=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(hash21(cell),hash21(cell+vec2(1,0)),f.x),
               mix(hash21(cell+vec2(0,1)),hash21(cell+vec2(1,1)),f.x),f.y);
  }
  float clouds(vec3 rd, out float thickness) {
    vec2 p=rd.xz/max(.10,rd.y)*.72+vec2(u_time*.005*u_motion,u_time*.0015*u_motion);
    float shape=fieldNoise(p)*.52+fieldNoise(p*2.13+7.1)*.28+fieldNoise(p*4.31-3.7)*.14+fieldNoise(p*8.1)*.06;
    float threshold=.47-u_weather.x*.07;
    thickness=clamp((shape-threshold)/max(0.01,.72-threshold),0.0,1.0);
    return smoothstep(threshold,.69,shape)*smoothstep(.025,.13,rd.y);
  }
  float clouds(vec3 rd) {
    float thickness;
    return clouds(rd, thickness);
  }
  float heightAt(vec2 p) {
    vec2 q = clamp((p + u_size * 0.5) / u_size * float(u_resolution - 1),
                   vec2(0.0), vec2(float(u_resolution - 1) - 0.00001));
    ivec2 c = ivec2(floor(q));
    vec2 f = fract(q);
    float a = texelFetch(u_terrain, c, 0).r;
    float b = texelFetch(u_terrain, c + ivec2(1,0), 0).r;
    float d = texelFetch(u_terrain, c + ivec2(0,1), 0).r;
    float e = texelFetch(u_terrain, c + ivec2(1,1), 0).r;
    return mix(mix(a,b,f.x), mix(d,e,f.x), f.y);
  }
  vec3 safeInverse(vec3 direction) {
    return 1.0 / mix(vec3(0.000001), direction,
      greaterThan(abs(direction), vec3(0.000001)));
  }
  vec2 boxInterval(vec3 ro, vec3 rd, vec3 lo, vec3 hi) {
    vec3 a = (lo - ro) * safeInverse(rd);
    vec3 b = (hi - ro) * safeInverse(rd);
    vec3 m = min(a,b), n = max(a,b);
    return vec2(max(max(m.x,m.y),m.z), min(min(n.x,n.y),n.z));
  }

  // Exact bilinear heightfield intersection. Traverse XZ cells, then solve the
  // quadratic ray/height equation inside each cell. Vertical height error is
  // never interpreted as a distance estimate, so steep slopes are not skipped.
  bool terrainHit(vec3 ro, vec3 rd, float limit, int budget, out Hit hit) {
    float halfSize = u_size * 0.5;
    vec2 interval = boxInterval(ro, rd,
      vec3(-halfSize,u_heightRange.x-0.1,-halfSize),
      vec3(halfSize,u_heightRange.y+0.1,halfSize));
    float t = max(0.025, interval.x);
    float end = min(limit, interval.y);
    if (end < t) return false;
    float spacing = u_size / float(u_resolution - 1);
    vec3 entry = ro + rd * (t + 0.0001);
    ivec2 c = clamp(ivec2(floor((entry.xz + halfSize) / spacing)),
                   ivec2(0), ivec2(u_resolution-2));
    ivec2 stepCell = ivec2(rd.x >= 0.0 ? 1 : -1, rd.z >= 0.0 ? 1 : -1);
    vec2 cellOrigin = vec2(c) * spacing - halfSize;
    vec2 boundary = cellOrigin + vec2(rd.x >= 0.0 ? spacing : 0.0,
                                    rd.z >= 0.0 ? spacing : 0.0);
    vec2 nextT = vec2(abs(rd.x) > 0.000001 ? (boundary.x-ro.x)/rd.x : 1e9,
                      abs(rd.z) > 0.000001 ? (boundary.y-ro.z)/rd.z : 1e9);
    vec2 deltaT = vec2(abs(rd.x) > 0.000001 ? spacing/abs(rd.x) : 1e9,
                       abs(rd.z) > 0.000001 ? spacing/abs(rd.z) : 1e9);
    vec2 velocity = rd.xz / spacing;
    for (int iteration=0; iteration<192; iteration++) {
      if (iteration >= budget || t > end || c.x < 0 || c.y < 0 ||
          c.x >= u_resolution-1 || c.y >= u_resolution-1) break;
      float stop = min(end, min(nextT.x,nextT.y));
      float extent = max(0.0,stop-t);
      float h00 = texelFetch(u_terrain,c,0).r;
      float h10 = texelFetch(u_terrain,c+ivec2(1,0),0).r;
      float h01 = texelFetch(u_terrain,c+ivec2(0,1),0).r;
      float h11 = texelFetch(u_terrain,c+ivec2(1,1),0).r;
      float maxH = max(max(h00,h10),max(h01,h11));
      float minRayY = min(ro.y+rd.y*t, ro.y+rd.y*stop);
      if (minRayY <= maxH + 0.0001) {
        vec2 origin = (ro.xz + rd.xz*t - (vec2(c)*spacing-halfSize))/spacing;
        float hx=h10-h00, hz=h01-h00, crossH=h00-h10-h01+h11;
        float A = -crossH*velocity.x*velocity.y;
        float B = rd.y-hx*velocity.x-hz*velocity.y-
                  crossH*(origin.x*velocity.y+origin.y*velocity.x);
        float C = ro.y+rd.y*t-h00-hx*origin.x-hz*origin.y-crossH*origin.x*origin.y;
        float root = 1e9;
        if (abs(A)<0.0000001) {
          if (abs(B)>0.000001) root=-C/B;
        } else {
          float discriminant=B*B-4.0*A*C;
          if (discriminant>=0.0) {
            float q = sqrt(discriminant);
            float r0=(-B-q)/(2.0*A), r1=(-B+q)/(2.0*A);
            if (r0>r1) { float swap=r0; r0=r1; r1=swap; }
            if (r0>=-0.0001 && r0<=extent+0.0001) root=r0;
            else if (r1>=-0.0001 && r1<=extent+0.0001) root=r1;
          }
        }
        if (root>=-0.0001 && root<=extent+0.0001) {
          hit.t=t+clamp(root,0.0,extent);
          hit.p=ro+rd*hit.t;
          vec2 f=clamp(origin+velocity*clamp(root,0.0,extent),0.0,1.0);
          hit.n=normalize(vec3(-(hx+crossH*f.y)/spacing,1.0,-(hz+crossH*f.x)/spacing));
          hit.material=(hit.n.y<0.88 || hit.p.y<u_water+1.3 || hit.p.y>85.0) ? 2 : 1;
          hit.local=hit.p;
          return true;
        }
      }
      bool advanceX=nextT.x<=nextT.y;
      bool advanceZ=nextT.y<=nextT.x;
      t=stop;
      if (advanceX) { c.x+=stepCell.x; nextT.x+=deltaT.x; }
      if (advanceZ) { c.y+=stepCell.y; nextT.y+=deltaT.y; }
      if (stop>=end) break;
    }
    return false;
  }

  bool objectHit(vec3 ro, vec3 rd, int index, float limit, out Hit hit) {
    vec4 centre = texelFetch(u_objects,ivec2(0,index),0);
    vec4 shape=texelFetch(u_objects,ivec2(1,index),0);
    vec4 data=texelFetch(u_objects,ivec2(2,index),0);
    // Sparse vapour cells allow the ordinary world query through between wisps.
    if(int(data.z+.5)==19 && hash21(floor(gl_FragCoord.xy)+vec2(float(index)*3.1,floor(u_time*2.0)))<.78)return false;
    float treeSpecies=0.0;
    if(int(data.z+.5)==12){
      treeSpecies=hash21(centre.xz*0.04+0.13);
      float wind=u_time*.9+centre.x*.043+centre.z*.061;
      float sway=(treeSpecies>.68 ? .56 : .38)*u_motion;
      centre.x+=sin(wind)*sway;
      centre.z+=sin(wind*.73+2.1)*sway*.65;
      centre.w+=.6;
    }
    vec3 offset=centre.xyz-ro;
    float along=dot(offset,rd);
    if (along+centre.w<0.025 || along-centre.w>limit ||
        dot(offset,offset)-along*along>centre.w*centre.w) return false;
    vec3 p=ro-centre.xyz;
    vec3 localRo=vec3(data.x*p.x-data.y*p.z,p.y,data.y*p.x+data.x*p.z);
    vec3 localRd=vec3(data.x*rd.x-data.y*rd.z,rd.y,data.y*rd.x+data.x*rd.z);
    float pitch=shape.w>5.5&&shape.w<6.5?data.w:0.0;
    if(pitch!=0.0){mat2 turn=mat2(cos(pitch),sin(pitch),-sin(pitch),cos(pitch));localRo.yz=turn*localRo.yz;localRd.yz=turn*localRd.yz;}
    float t; vec3 normal;
    if (shape.w>0.5 && shape.w<1.5) {
      vec3 a=localRo/shape.xyz, b=localRd/shape.xyz;
      float A=dot(b,b), B=dot(a,b), C=dot(a,a)-1.0;
      float disc=B*B-A*C;
      if (disc<0.0) return false;
      float q=sqrt(disc);
      t=(-B-q)/A;
      if (t<0.025) t=(-B+q)/A;
      if (t<0.025 || t>limit) return false;
      normal=normalize((localRo+localRd*t)/(shape.xyz*shape.xyz));
    } else if(shape.w>2.5&&shape.w<5.5){
      // Finite elliptical cylinders: boiler Z, wheel X and chimney Y.
      int axis=2;if(shape.w>3.5&&shape.w<4.5)axis=0;else if(shape.w>4.5)axis=1;
      vec3 a=localRo/shape.xyz,b=localRd/shape.xyz;
      vec2 radialA=a.xy,radialB=b.xy;
      if(axis==0){radialA=a.yz;radialB=b.yz;}else if(axis==1){radialA=a.xz;radialB=b.xz;}
      float A=dot(radialB,radialB),B=dot(radialA,radialB),C=dot(radialA,radialA)-1.0;
      vec2 radial=vec2(-1e9,1e9);
      if(A<.0000001){if(C>0.0)return false;}
      else{float disc=B*B-A*C;if(disc<0.0)return false;float root=sqrt(disc);radial=vec2((-B-root)/A,(-B+root)/A);}
      vec2 cap=vec2(-1e9,1e9);
      if(abs(b[axis])<.0000001){if(abs(a[axis])>1.0)return false;}
      else{float t0=(-1.0-a[axis])/b[axis],t1=(1.0-a[axis])/b[axis];cap=vec2(min(t0,t1),max(t0,t1));}
      float nearT=max(radial.x,cap.x),farT=min(radial.y,cap.y);
      if(nearT>farT||farT<.025)return false;t=nearT>=.025?nearT:farT;if(t>limit)return false;
      vec3 point=localRo+localRd*t;
      normal=vec3(0.0);
      if(abs(point[axis]/shape[axis])>.9999)normal[axis]=sign(point[axis]);
      else{normal=point/(shape.xyz*shape.xyz);normal[axis]=0.0;normal=normalize(normal);}
    } else {
      vec2 interval=boxInterval(localRo,localRd,-shape.xyz,shape.xyz);
      // A gable is a bounded convex prism; clip the two roof planes directly.
      if((shape.w>1.5&&shape.w<2.5)||shape.w>6.5){
        float slope=shape.y/shape.x;if(shape.w>6.5)slope*=2.0;
        for(int side=-1;side<=1;side+=2){
          vec3 plane=vec3(float(side)*slope,1.0,0.0);
          float numerator=shape.y-dot(plane,localRo),denominator=dot(plane,localRd);
          if(abs(denominator)<.000001){if(numerator<0.0)return false;}
          else{float crossing=numerator/denominator;if(denominator<0.0)interval.x=max(interval.x,crossing);else interval.y=min(interval.y,crossing);}
        }
      }
      if (interval.x>interval.y || interval.y<0.025) return false;
      t=interval.x>=0.025 ? interval.x : interval.y;
      if (t>limit) return false;
      vec3 localP=localRo+localRd*t;
      vec3 ratio=abs(localP/shape.xyz);
      // Explicit branches avoid ANGLE D3D11 draw-time compilation failure for
      // nested vector ternaries while preserving the same nearest-face normal.
      normal=vec3(0.0,sign(localP.y),0.0);
      if (ratio.x>ratio.y && ratio.x>ratio.z) {
        normal=vec3(sign(localP.x),0.0,0.0);
      } else if (ratio.z>ratio.y) {
        normal=vec3(0.0,0.0,sign(localP.z));
      }
      if((shape.w>1.5&&shape.w<2.5)||shape.w>6.5){float slope=shape.y/shape.x;if(shape.w>6.5)slope*=2.0;vec3 roofNormal=vec3(sign(localP.x)*slope,1.0,0.0);if(abs(dot(roofNormal,localP)-shape.y)<.002)normal=normalize(roofNormal);}
    }
    if(pitch!=0.0){mat2 untilt=mat2(cos(pitch),-sin(pitch),sin(pitch),cos(pitch));normal.yz=untilt*normal.yz;}
    hit.t=t; hit.p=ro+rd*t;
    hit.n=normalize(vec3(data.x*normal.x+data.y*normal.z,normal.y,
                        -data.y*normal.x+data.x*normal.z));
    hit.local=localRo+localRd*t;
    hit.extent=shape.xyz;
    hit.info=data.w;
    if(int(data.z+.5)==12)hit.info=treeSpecies;
    else if(int(data.z+.5)==11)hit.info=hash21(centre.xz*0.04+0.13);
    hit.material=int(data.z+0.5);
    return true;
  }

  bool sceneHit(vec3 ro,vec3 rd,float limit,bool waterAllowed,int objectBudget,int terrainBudget,out Hit hit) {
    Hit ground; bool found=terrainHit(ro,rd,limit,terrainBudget,ground);
    if (found) { hit=ground; limit=ground.t; }
    if (waterAllowed && abs(rd.y)>0.000001) {
      float t=(u_water-ro.y)/rd.y;
      vec3 p=ro+rd*t;
      if (t>0.025 && t<limit && abs(p.x)<u_size*0.5 && abs(p.z)<u_size*0.5 &&
          heightAt(p.xz)<u_water-0.025) {
        hit.t=t; hit.p=p; hit.material=3; hit.local=p;
        hit.n=normalize(vec3(0.045*cos(p.x*0.19+u_time*1.2)+0.02*cos(p.z*.37-u_time*.6),
          1.0,0.035*sin(p.z*.22+u_time*.8)+0.02*cos(p.x*.32-u_time*.7)));
        limit=t; found=true;
      }
    }
    for (int i=0;i<256;i++) {
      if (i>=u_objectCount || i>=objectBudget) break;
      Hit object;
      if (objectHit(ro,rd,i,limit,object)) { hit=object; limit=object.t; found=true; }
    }
    return found;
  }

  vec3 sky(vec3 rd) {
    float day=smoothstep(-0.18,0.25,u_sun.y);
    vec3 zenith=mix(vec3(.023,.026,.085),vec3(.10,.32,.49),day);
    vec3 horizon=mix(vec3(.085,.065,.14),vec3(.68,.72,.67),day);
    vec3 colour=mix(horizon,zenith,pow(clamp(rd.y+0.12,0.0,1.0),0.55));
    float dusk=1.0-smoothstep(0.05,0.42,abs(u_sun.y));
    colour+=vec3(.20,.074,.028)*dusk*pow(1.0-max(rd.y,0.0),5.0);
    float sunward=.5+.5*dot(normalize(vec3(rd.x,0.0,rd.z)+vec3(.0001,0,.0001)),normalize(vec3(u_sun.x,0.0,u_sun.z)));
    colour=mix(colour,vec3(.72,.39,.30),dusk*sunward*pow(1.0-max(rd.y,0.0),4.0)*.42);
    colour=mix(colour,vec3(.24,.25,.43),dusk*(1.0-sunward)*max(rd.y,0.0)*.22);
    float thickness=0.0;
    float cloud=clouds(rd,thickness);
    if(cloud>.01){
      float baseShade=mix(.68,1.08,pow(max(.01,thickness),.7));
      vec3 cloudBase=mix(vec3(.11,.13,.17),vec3(.52,.57,.60),day)*baseShade;
      vec3 cloudSunlit=mix(vec3(.15,.18,.23),vec3(.82,.85,.86),day);
      vec3 cloudCol=mix(cloudBase,cloudSunlit,clamp(rd.y*2.5,0.0,1.0));
      float sunAngle=max(0.0,dot(rd,u_sun));
      float sunRim=pow(sunAngle,6.0)*dusk;
      vec3 rimCol=mix(vec3(.95,.62,.32),vec3(1.0,.84,.52),sunAngle);
      cloudCol+=rimCol*sunRim*(1.0-thickness*.5)*1.4;
      colour=mix(colour,cloudCol,cloud*(.75+u_weather.x*.18));
    }
    colour=mix(colour,mix(vec3(.07,.085,.11),vec3(.35,.43,.45),day),u_weather.x*.48);
    float sunDisc=pow(max(0.0,dot(rd,u_sun)),900.0);
    colour+=vec3(1.0,.70,.24)*sunDisc*day;
    return colour;
  }
  vec3 palette(Hit h) {
    int material=h.material; vec3 p=h.p;
    if (material==1) {
      float field=fieldNoise(p.xz*.016);
      float slope=1.0-h.n.y;
      float heightRel=clamp((p.y-u_water)/35.0,0.0,1.0);
      vec3 hollowGrass=vec3(.11,.22,.08);
      vec3 pasture=mix(vec3(.18,.31,.12),vec3(.28,.37,.15),field);
      vec3 sunRidge=mix(vec3(.36,.38,.16),vec3(.52,.44,.20),field);
      vec3 soil=mix(vec3(.36,.26,.16),vec3(.46,.34,.20),fieldNoise(p.xz*.08));
      vec3 grass=mix(hollowGrass,pasture,smoothstep(0.0,0.25,heightRel));
      grass=mix(grass,sunRidge,smoothstep(0.35,0.85,heightRel));
      float sunFacing=max(0.0,dot(h.n,vec3(u_sun.x,0.2,u_sun.z)));
      grass=mix(grass,sunRidge*1.08,sunFacing*smoothstep(0.3,0.8,heightRel)*0.35);
      float soilExposure=smoothstep(0.05,0.16,slope)+(1.0-smoothstep(.2,1.8,p.y-u_water))*.6;
      grass=mix(grass,soil,clamp(soilExposure,0.0,0.75));
      vec3 grain=mix(vec3(.41,.36,.17),vec3(.57,.46,.22),.5+.5*sin(p.x*.48+p.z*.12));
      return mix(grass,grain,smoothstep(.60,.66,field)*smoothstep(0.5,4.0,p.y));
    }
    if (material==2) {
      float alt=smoothstep(20.0,160.0,p.y);
      float graniteNoise=fieldNoise(p.xz*0.04+vec2(p.y*0.06,0.0));
      vec3 valleyRock=mix(vec3(.34,.32,.29),vec3(.42,.39,.34),graniteNoise);
      vec3 highRock=mix(vec3(.45,.46,.45),vec3(.78,.81,.78),smoothstep(123.0,166.0,p.y));
      vec3 rock=mix(valleyRock,highRock,alt);
      float strata=sin(p.y*0.45+graniteNoise*3.0);
      rock=mix(rock,vec3(.52,.41,.31),smoothstep(0.7,0.95,strata)*0.45);
      return rock;
    }
    if (material==3) return vec3(.065,.24,.28);
    if (material==4) return vec3(.64,.48,.31);
    if (material==5) return vec3(.50,.23,.18);
    if (material==6) return vec3(.40,.28,.16);
    if (material==7) return vec3(.64,.67,.65);
    if (material==8) return vec3(.73,.15,.095);
    if (material==9) return vec3(1.0,.73,.22);
    if (material==10) return vec3(.54,.51,.42);
    if (material==11) {
      float treeHash=h.info;
      vec3 pineBark=vec3(.38,.22,.14);
      vec3 oakBark=vec3(.32,.25,.18);
      float birchGrain=step(.84,fract(h.local.y*3.2+hash21(floor(h.local.yy*3.2))*0.3));
      vec3 birchBark=mix(vec3(.72,.71,.66),vec3(.20,.18,.16),birchGrain);
      vec3 bark=treeHash<.35 ? pineBark : (treeHash<.70 ? oakBark : birchBark);
      float fissure=step(.88,fract(atan(h.local.z,h.local.x)*3.5));
      return mix(bark,bark*0.65,fissure*0.35);
    }
    if (material==12) {
      float treeHash=h.info;
      vec3 pineFoliage=mix(vec3(.06,.20,.12),vec3(.12,.27,.16),.5+.5*sin(p.y*.9+p.x*.4));
      vec3 oakFoliage=mix(vec3(.09,.26,.11),vec3(.24,.37,.14),.5+.5*sin(p.y*.8+p.x*.3));
      vec3 birchFoliage=mix(vec3(.16,.33,.12),vec3(.32,.44,.18),.5+.5*sin(p.y*1.1+p.z*.5));
      vec3 foliage=treeHash<.35 ? pineFoliage : (treeHash<.70 ? oakFoliage : birchFoliage);
      float crownTop=clamp(h.local.y/max(.1,h.extent.y)*.5+.5,0.0,1.0);
      return mix(foliage*0.82,foliage*1.16,crownTop);
    }
    if (material==13) return vec3(.36,.39,.40);
    if (material==17) return vec3(1.0,.72,.26);
    if (material==18) return vec3(1.0,.32,.035);
    if (material==19) return vec3(.32,.34,.31);
    if (material==20) return vec3(1.0,.075,.025);
    if (material==23){if(u_paint==1)return vec3(.10,.34,.23);if(u_paint==2)return vec3(.59,.35,.13);return vec3(.19,.22,.16);}
    if (material==24) return vec3(.46,.29,.20);
    if (material==25) return vec3(.51,.55,.43);
    if (material==26) return vec3(.16,.30,.34);
    if (material==27) return vec3(.74,.55,.22);
    if (material==28||material==29) return vec3(.11,.14,.13);
    if (material==30) return vec3(.39,.28,.16);
    if (material==31) return vec3(.24,.30,.32);
    if (material==32) return vec3(.76,.75,.61);
    if (material==33) return vec3(.17,.27,.21);
    if (material==34||material==35||material==36) return vec3(.76,.72,.57);
    if (material==37) return vec3(.075,.085,.08);
    if (material==38) return vec3(.61,.63,.56);
    if (material==39) return vec3(.66,.34,.16);
    if (material==40) return vec3(.52,.38,.23);
    if (material==42) return vec3(.24,.28,.17);
    return vec3(.55);
  }
  bool labelInk(Hit h){
    int id=int(h.info+.5),length=8;if(id==1)length=11;else if(id==2)length=10;
    const int pine[8]=int[8](80,73,78,69,66,65,78,75);
    const int bell[11]=int[11](66,69,76,76,87,69,65,84,72,69,82);
    const int stone[10]=int[10](83,84,79,78,69,72,65,86,69,78);
    float horizontal=h.local.z*sign(h.local.x)+float(length)*.195;
    int x=int(floor(horizontal/.065)),row=int(floor((.2275-h.local.y)/.065));
    if(x<0||x>=length*6||row<0||row>6)return false;
    int letter=x/6,column=x%6;if(column==5)return false;
    int glyph=pine[min(letter,7)];if(id==1)glyph=bell[min(letter,10)];else if(id==2)glyph=stone[min(letter,9)];
    uint bits=texelFetch(u_labels,ivec2(glyph,row),0).r;return (bits>>uint(4-column)&1u)!=0u;
  }
  float handDistance(vec2 p,float angle,float reach){vec2 axis=vec2(sin(angle),cos(angle));return length(p-axis*clamp(dot(p,axis),0.0,reach));}
  vec3 detailColour(Hit h,vec3 base){
    vec3 p=h.local;
    if(h.material==23){float band=step(.935,fract((p.z+2.72)*.66));base=mix(base,vec3(.33,.36,.29),band);float rivet=step(.91,fract(p.z*3.3))*step(.90,fract(atan(p.y,p.x)*3.0));return mix(base,vec3(.43,.44,.36),rivet);}
    if(h.material==24){float row=floor(p.y*3.5);float mortar=step(.91,fract(p.y*3.5))+step(.94,fract((p.z+p.x)*1.4+mod(row,2.0)*.5));return mix(base*(.90+.16*hash21(floor(p.zy*vec2(1.4,3.5)))),vec3(.56,.53,.44),clamp(mortar,0.0,1.0));}
    if(h.material==25||h.material==30){float joint=step(.93,fract(p.y*4.1));return mix(base*(.86+.20*hash21(vec2(floor(p.y*4.1),floor(p.z*.8)))),base*.48,joint);}
    if(h.material==26){float divider=step(.91,fract((p.z+h.extent.z)*1.45))+step(.91,fract((p.y+h.extent.y)*1.70));float day=smoothstep(-.15,.25,u_sun.y);return mix(mix(vec3(.69,.44,.17),vec3(.12,.26,.30),day),vec3(.68,.65,.48),clamp(divider,0.0,1.0));}
    if(h.material==29){vec2 uv=p.zy/h.extent.zy;float r=length(uv),angle=atan(uv.x,uv.y)-h.info;float spoke=step(.94,abs(cos(angle*5.0)));return mix(base,vec3(.57,.58,.49),max(spoke*step(.19,r),max(step(.88,r),1.0-step(.18,r))));}
    if(h.material==31){float tile=step(.92,fract(p.z*2.8))+step(.91,fract(p.x*2.0));return mix(base*(.87+.16*hash21(floor(p.xz*vec2(2.0,2.8)))),base*.47,clamp(tile,0.0,1.0));}
    if(h.material==33)return mix(base,base*.48,step(.93,fract(p.z*6.0)));
    if(h.material==35)return labelInk(h)?vec3(.10,.15,.12):base;
    if(h.material==34||h.material==36){
      vec2 uv=p.zy/h.extent.zy;if(h.material==36)uv=p.xy/h.extent.xy;
      float r=length(uv),angle=atan(uv.x,uv.y),dial=step(.85,r)+step(.91,abs(cos(angle*6.0)))*step(.66,r);
      float needle=0.0;
      if(h.material==34){float minutes=480.0+u_time*2.0;needle=max(1.0-smoothstep(.018,.042,handDistance(uv,minutes*6.283185/60.0,.70)),1.0-smoothstep(.028,.055,handDistance(uv,minutes*6.283185/720.0,.43)));}
      else needle=1.0-smoothstep(.020,.060,handDistance(uv,-2.25+clamp(h.info,0.0,1.0)*4.5,.72));
      return mix(base,vec3(.12,.16,.13),clamp(dial+needle,0.0,1.0));
    }
    if(h.material==37)return base*(.75+.5*hash21(floor(p.xz*5.0)));
    if(h.material==40){float rings=step(.63,fract(length(p.xy)*15.0));return mix(base,base*.63,rings*step(.85,abs(p.z/h.extent.z)));}
    return base;
  }

  float shadow(Hit hit) {
    if (u_sun.y<=.025 || dot(hit.n,u_sun)<=0.0 || hit.t>140.0) return 1.0;
    vec3 ro=hit.p+hit.n*.10;
    for (int i=0;i<48;i++) {
      if (i>=u_shadowCount) break;
      Hit blocker;
      if (objectHit(ro,u_sun,i,26.0,blocker)) return .46;
    }
    // One short terrain query is budgeted only for nearby non-water surfaces.
    if (hit.t<45.0 && hit.material!=3) {
      Hit ground;
      if (terrainHit(ro,u_sun,18.0,12,ground)) return .65;
    }
    return 1.0;
  }
  vec3 illuminate(Hit hit,bool allowShadow) {
    vec3 base=palette(hit);if(hit.material>=23)base=detailColour(hit,base);
    float day=smoothstep(-.15,.25,u_sun.y);
    float night=1.0-day;
    float ambient=mix(.37,.49,day)*(1.0-u_weather.x*.12);
    float diffuse=max(0.0,dot(hit.n,u_sun))*max(0.0,u_sun.y)*.92*(1.0-u_weather.x*.45);
    if (allowShadow) diffuse*=shadow(hit);
    float heightShade=1.0;
    if(hit.material>=23&&hit.material!=26&&hit.material!=35)heightShade=mix(.78,1.12,clamp(hit.local.y/max(.02,hit.extent.y)*.5+.5,0.0,1.0));
    float contactAO=1.0;
    if(hit.material!=3 && hit.material!=19 && hit.material!=18) {
      if(hit.material==1 || hit.material==2) {
        if(hit.p.y < u_water + 0.35) contactAO *= mix(0.76, 1.0, clamp((hit.p.y - u_water)/0.35, 0.0, 1.0));
      } else if(hit.extent.y > 0.12) {
        float baseDist = (hit.local.y + hit.extent.y) / max(0.05, hit.extent.y * 2.0);
        contactAO *= mix(0.78, 1.0, smoothstep(0.0, 0.35, baseDist));
      }
    }
    vec3 ambientTint=mix(vec3(.80,.72,.53),vec3(.61,.78,1.0),clamp(hit.n.y*.5+.5,0.0,1.0));
    vec3 colour=base*heightShade*contactAO*(ambientTint*ambient+vec3(1.0,.84,.59)*diffuse);
    vec3 moon=normalize(vec3(-u_sun.x,max(.25,-u_sun.y),-u_sun.z));
    colour+=base*heightShade*contactAO*vec3(.51,.67,.94)*max(0.0,dot(hit.n,moon))*.26*night;
    if(day>.1&&hit.material!=3)colour+=base*vec3(.20,.14,.07)*max(0.0,-hit.n.y)*day*.20;
    vec3 lampToSurface=hit.p-u_headPosition;
    float lampDistance=length(lampToSurface);
    float beam=smoothstep(.89,.978,dot(lampToSurface/max(.001,lampDistance),u_headDirection));
    float lamp=beam*max(0.0,1.0-lampDistance/95.0);
    lamp*=lamp*max(.08,dot(hit.n,-lampToSurface/max(.001,lampDistance)))*mix(1.9,.32,day);
    colour+=base*vec3(1.0,.83,.49)*lamp;
    vec3 toLantern=u_lantern.xyz-hit.p;float lanternDistance=length(toLantern);
    float lanternGlow=pow(max(0.0,1.0-lanternDistance/15.0),2.0)*u_lantern.w;
    colour+=base*vec3(1.0,.76,.39)*lanternGlow*max(.26,dot(hit.n,toLantern/max(.01,lanternDistance)))*mix(2.5,.35,day);
    vec3 toHearth=u_stationGlow.xyz-hit.p;float hearthDistance=length(toHearth);
    float hearthGlow=pow(max(0.0,1.0-hearthDistance/12.0),2.0)*u_stationGlow.w;
    hearthGlow*=.96+.04*sin(u_time*5.3);
    colour+=base*vec3(1.0,.62,.24)*hearthGlow*max(.30,dot(hit.n,toHearth/max(.01,hearthDistance)));
    if (hit.material==9) colour=base*mix(1.12,.62,day);
    for(int i=0;i<3;i++){
      vec3 toLamp=u_lamps[i]-hit.p;float d=length(toLamp);
      float glow=max(0.0,1.0-d/22.0);glow*=glow*mix(2.2,.12,day);
      glow*=.95+.05*sin(u_time*2.7+float(i)*2.1);
      glow*=1.0+u_lampCare[i]*.30;
      colour+=base*vec3(1.0,.66,.25)*glow*max(.16,dot(hit.n,toLamp/max(.01,d)));
    }
    if(hit.material==17)colour=base*(1.15+.06*sin(u_time*3.1));
    if(hit.material==20)colour=base*1.1;
    if(hit.material==18){float flame=.65+.35*sin(hit.local.y*11.0-u_time*8.0+hit.local.x*7.0);colour=mix(vec3(.73,.12,.01),vec3(1.0,.72,.12),flame);}
    if(hit.material==26)colour=base*mix(.83,.72,day);
    if(hit.material==27||hit.material==38||hit.material==39){float glint=pow(max(0.0,dot(reflect(-u_sun,hit.n),normalize(u_eye-hit.p))),16.0);colour+=base*glint*.4*day;}
    // Lift dark midtones before glyph encoding, preserving warm lamps and cool
    // moonlight rather than applying a bright overlay to the displayed scene.
    colour=mix(colour,sqrt(max(colour,vec3(0.0)))*.67,night*.38);
    colour*=mix(u_nightBrightness,1.0,day);
    return colour;
  }

  uint glyphFor(Hit h,float light) {
    float objPattern=hash21(floor(h.local.xz*2.4)+floor(h.local.y)*5.0);
    float pattern=hash21(floor(h.p.xz*1.6)+floor(h.p.y)*7.0);
    bool side=abs(h.n.y)<.5;
    if (h.material==1) {
      float distFade=smoothstep(35.0,120.0,h.t);
      if (distFade>0.7) return pattern>.48 ? 44u : 46u;
      return pattern>.80 ? 34u : pattern>.56 ? 39u : pattern>.30 ? 44u : 46u;
    }
    if (h.material==2) {
      float distRock=smoothstep(80.0,260.0,h.t);
      if (distRock>0.65) return h.n.y<.6 ? (h.n.x*h.n.z>0.0 ? 47u : 92u) : 58u;
      return h.n.y<.6 ? (h.n.x*h.n.z>0.0 ? 47u : 92u) : pattern>.55 ? 37u : 58u;
    }
    if (h.material==3) return pattern>.67 ? 126u : pattern>.31 ? 61u : 45u;
    if (h.material==4) return side ? (fract(h.local.y*.60)>.7 ? 45u : 124u) : 58u;
    if (h.material==5) return h.n.x>0.1 ? 47u : h.n.x<-.1 ? 92u : 61u;
    if (h.material==6) return side ? 124u : 61u;
    if (h.material==7) return side ? 124u : 61u;
    if (h.material==8) return side ? (objPattern>.60 ? 72u : 35u) : 61u;
    if (h.material==9) return light>.65 ? 35u : 43u;
    if (h.material==10) return side ? 45u : pattern>.5 ? 58u : 46u;
    if (h.material==11) {
      if (!side) return 43u;
      float knothole=hash21(floor(h.local.yy*1.8)+h.info*13.0);
      return knothole>.85 ? 35u : knothole>.65 ? 58u : 124u;
    }
    if (h.material==12) {
      float folPattern=hash21(floor(h.local.xz*1.8)+floor(h.local.y*1.8)+h.info*19.0);
      float facing=abs(dot(h.n,normalize(u_eye-h.p)));
      if (facing<.22) return folPattern>.5 ? 34u : 46u;
      if (h.info<.35) return folPattern>.68 ? 42u : folPattern>.32 ? 94u : 43u;
      if (h.info<.70) return folPattern>.70 ? 64u : folPattern>.36 ? 37u : 42u;
      return folPattern>.65 ? 42u : folPattern>.32 ? 43u : 46u;
    }
    if (h.material==13) return side ? 72u : 61u;
    if (h.material==17) return 42u;
    if (h.material==18){float fire=hash21(floor(h.local.xy*5.0)+vec2(floor(u_time*9.0),floor(u_time*4.0)));return fire>.65 ? 94u : fire>.30 ? 42u : 58u;}
    if (h.material==19) return pattern>.7 ? 126u : pattern>.3 ? 58u : 46u;
    if (h.material==20) return 42u;
    if (h.material==23) return side ? (objPattern>.6 ? 35u : 72u) : 61u;
    if (h.material==24) return fract(h.local.y*3.5)>.87?45u:objPattern>.7?58u:35u;
    if (h.material==25||h.material==30) return fract(h.local.y*4.1)>.88?45u:124u;
    if (h.material==26) return light>.40?43u:34u;
    if (h.material==27||h.material==38||h.material==39) return side?124u:61u;
    if (h.material==28) return objPattern>.6?35u:61u;
    if (h.material==29){float a=atan(h.local.z/h.extent.z,h.local.y/h.extent.y)-h.info;return abs(cos(a*5.0))>.85?43u:46u;}
    if (h.material==31) return h.n.y>.6?61u:h.n.x>0.0?47u:92u;
    if (h.material==32) return side?124u:45u;
    if (h.material==33) return 124u;
    if (h.material==34||h.material==36) return 46u;
    if (h.material==35) return labelInk(h)?35u:32u;
    if (h.material==37) return objPattern>.5?35u:42u;
    if (h.material==40) return abs(h.local.z/h.extent.z)>.85?64u:61u;
    if (h.material==42) return 58u;
    return 63u;
  }
  uvec4 colourRecord(vec3 c) { return uvec4(round(clamp(c,0.0,1.0)*255.0),255u); }

  void main() {
    vec2 logicalCentre=gl_FragCoord.xy*u_cellSize;
    vec2 screen=logicalCentre/u_viewport*2.0-1.0;
    vec3 rd=normalize(u_forward+u_right*screen.x*(u_viewport.x/u_viewport.y)*.64+u_up*screen.y*.64);
    Hit hit;
    bool found=sceneHit(u_eye,rd,u_far,true,256,192,hit);
    vec3 skyColour=sky(rd);
    vec3 foreground, background;
    uint glyph=46u;
    int material=0;
    float distance=u_far;
    if (!found) {
      float thickness=0.0;
      float cloud=clouds(rd,thickness);
      glyph=32u;
      if(cloud>.15)glyph=thickness>.62 ? 35u : thickness>.38 ? 61u : 126u;
      background=skyColour*.82;
      foreground=skyColour*.98;
      if(u_sun.y<-.08&&cloud<.32){ivec2 cell=ivec2(gl_FragCoord.xy);for(int i=0;i<64;i++){if(all(equal(cell,ivec2(u_stars[i].xy)))){glyph=u_stars[i].z>.83?42u:46u;foreground=mix(vec3(.64,.78,1.0),vec3(1.0,.83,.62),u_stars[i].w)*u_stars[i].z;break;}}}
      if (dot(rd,u_sun)>.996) { glyph=64u; foreground=vec3(1.0,.87,.45); }
    } else {
      material=hit.material; distance=hit.t;
      vec3 colour=illuminate(hit,true);
      if (material==3) {
        // Exactly one secondary scene query, no recursive reflections. It can
        // see analytical moving carriages and the same authoritative shoreline.
        vec3 reflected=reflect(rd,hit.n);
        Hit reflectedHit;
        vec3 reflection=sky(reflected);
        bool reflectionFound=sceneHit(hit.p+hit.n*.12,reflected,185.0,false,160,80,reflectedHit);
        if (reflectionFound) {
          reflection=illuminate(reflectedHit,false);
          reflection=mix(reflection,sky(reflected),1.0-exp(-reflectedHit.t*(.0015+u_weather.y*.018)));
        }
        float fresnel=.30+.64*pow(1.0-max(0.0,dot(-rd,hit.n)),3.0);
        colour=mix(colour,reflection,fresnel);
        if (reflectionFound && reflectedHit.material==8) colour+=vec3(.045,.0,.0);
        if (u_sun.y<.25) {
          float nightFactor=1.0-smoothstep(-.15,.25,u_sun.y);
          for (int i=0; i<3; i++) {
            vec3 toLamp=u_lamps[i]-hit.p; float lampD=length(toLamp);
            if (lampD<120.0) {
              vec3 halfL=normalize(toLamp/lampD-rd);
              float specL=pow(max(0.0,dot(hit.n,halfL)),28.0);
              float wave=0.7+0.3*sin(hit.p.x*0.7+hit.p.z*0.35+u_time*2.5);
              colour+=vec3(1.0,.72,.30)*specL*wave*max(0.0,1.0-lampD/120.0)*(1.0+u_lampCare[i]*.35)*nightFactor*2.4;
            }
          }
          vec3 toHead=u_headPosition-hit.p; float headD=length(toHead);
          if (headD<110.0) {
            vec3 halfH=normalize(toHead/headD-rd);
            float specH=pow(max(0.0,dot(hit.n,halfH)),24.0);
            colour+=vec3(1.0,.85,.55)*specH*max(0.0,1.0-headD/110.0)*nightFactor*1.8;
          }
        }
      }
      float light=dot(colour,vec3(.2126,.7152,.0722));
      glyph=glyphFor(hit,light);
      // The lit material fills the cell; its glyph carries finer surface detail.
      // Keep fill constant within a cell so adjoining letters have no tile seams.
      float fill=.64;
      if(material==1)fill=.70;
      if(material==2)fill=.68;
      if(material==3)fill=.74;
      if(material==12)fill=.60;
      if(material==26)fill=.48;
      if(material==7)fill=.42;
      if(material==9||material==17||material==18||material==20)fill=.50;
      if(material==35)fill=.32;
      foreground=colour*1.25+vec3(.024);
      background=colour*fill;
      if (material==7) foreground+=vec3(.11,.12,.12);
      if (material==4||material==8||material==27||material==30||material==35) {
        foreground*=1.10;
      }
      if (material==19){foreground=mix(skyColour,vec3(.57,.58,.53),.35);background=skyColour*.82;}
      float fogDensity=.00115+u_weather.y*u_weather.y*.012+u_weather.x*.0009;
      float fog=1.0-exp(-distance*fogDensity);
      float valleyAltitude=max(0.0,hit.p.y-u_water);
      float valleyMistDensity=exp(-valleyAltitude*0.09)*(.0028+u_weather.y*.035);
      float valleyMist=1.0-exp(-distance*valleyMistDensity);
      vec3 mistColour=mix(vec3(.12,.16,.24),vec3(.74,.78,.80),smoothstep(-.15,.25,u_sun.y));
      mistColour=mix(mistColour,vec3(.78,.62,.52),(1.0-smoothstep(0.05,0.42,abs(u_sun.y)))*0.35);
      float aerial=smoothstep(65.0,380.0,distance)*.20;vec3 air=mix(vec3(.12,.12,.22),vec3(.39,.52,.62),smoothstep(-.15,.25,u_sun.y));
      foreground=mix(foreground,air,aerial);background=mix(background,air*.78,aerial);
      foreground=mix(foreground,mistColour*1.08,valleyMist);
      background=mix(background,mistColour*.82,valleyMist);
      foreground=mix(foreground,skyColour*.90,fog);
      background=mix(background,skyColour*.86,fog);
    }
    // Sparse rain records live in cell state. Near surfaces occlude drops;
    // depth and deterministic column phase prevent a uniform full-screen veil.
    if (u_weather.x>.02 && distance>mix(4.0,22.0,u_shelter)) {
      vec2 cell=floor(gl_FragCoord.xy);
      float fall=floor(u_time*16.0*u_motion);
      float rain=hash21(vec2(cell.x+floor(fall*.25),floor((cell.y+fall)/3.0)));
      if (rain>1.0-u_weather.x*.075 && mod(cell.y+fall,3.0)<1.0) {
        glyph=47u;
        foreground=mix(foreground,vec3(.57,.70,.75),.61);
      }
    }
    out_record=uvec4(glyph,uint(material),uint(clamp(distance/u_far*255.0,0.0,255.0)),255u);
    out_foreground=colourRecord(foreground);
    out_background=colourRecord(background);
  }`;

  const DISPLAY = `#version 300 es
  precision highp float;
  precision highp int;
  precision highp usampler2D;
  out vec4 out_colour;
  uniform usampler2D u_records;
  uniform usampler2D u_foreground;
  uniform usampler2D u_background;
  uniform usampler2D u_masks;
  uniform vec2 u_viewport;
  uniform vec2 u_cellSize;
  uniform vec2 u_physical;
  uniform ivec2 u_grid;
  uniform bool u_debug;
  void main() {
    vec2 logical=gl_FragCoord.xy/u_physical*u_viewport;
    ivec2 cell=clamp(ivec2(floor(logical/u_cellSize)),ivec2(0),u_grid-ivec2(1));
    vec2 inside=fract(logical/u_cellSize);
    uvec4 record=texelFetch(u_records,cell,0);
    uint glyph=record.r;
    vec3 foreground=vec3(texelFetch(u_foreground,cell,0).rgb)/255.0;
    vec3 background=vec3(texelFetch(u_background,cell,0).rgb)/255.0;
    vec2 ink=(inside-vec2(.15,.18))/vec2(.70,.64);
    bool on=false;
    if (ink.x>=0.0 && ink.x<1.0 && ink.y>=0.0 && ink.y<1.0) {
      ivec2 bit=ivec2(floor(ink*vec2(5.0,7.0)));
      uint mask=texelFetch(u_masks,ivec2(int(glyph),6-bit.y),0).r;
      on=(mask & (1u << uint(4-bit.x)))!=0u;
    }
    // A small vertical ink gradient adds relief without changing any glyph bits.
    // Sky, nameboards and self-lit materials retain their flat readable colour.
    uint material=record.g;
    float inkShade=1.0;
    if(material!=0u&&material!=9u&&material!=17u&&material!=18u&&material!=20u&&material!=26u&&material!=35u)
      inkShade=mix(.94,1.08,clamp(ink.y,0.0,1.0));
    vec3 colour=on ? foreground*inkShade : background;
    if (u_debug && inside.x<.045 && inside.y<.065)
      colour=vec3(float(glyph&7u)/7.0,float((glyph>>3)&7u)/7.0,float(glyph>>6));
    out_colour=vec4(colour,1.0);
  }`;

  // Five bits per row, top row first. Numeric tables are data, not image assets.
  const GLYPHS = Object.freeze({
    ' ': [0,0,0,0,0,0,0], '.': [0,0,0,0,0,12,12], ',': [0,0,0,0,12,12,8],
    ':': [0,12,12,0,12,12,0], ';': [0,12,12,0,12,12,8],
    '-': [0,0,0,31,0,0,0], '=': [0,0,31,0,31,0,0], '+': [0,4,4,31,4,4,0],
    '*': [0,21,14,31,14,21,0], '#': [10,31,10,10,31,10,0],
    '%': [25,26,2,4,8,11,19], '@': [14,17,23,21,23,16,14],
    '/': [1,2,2,4,8,8,16], '\\': [16,8,8,4,2,2,1], '|': [4,4,4,4,4,4,4],
    '_': [0,0,0,0,0,0,31], '~': [0,0,9,22,0,0,0], '"': [10,10,10,0,0,0,0],
    '!': [4,4,4,4,4,0,4], '?': [14,17,1,2,4,0,4], '<': [2,4,8,16,8,4,2],
    '>': [8,4,2,1,2,4,8], '[': [14,8,8,8,8,8,14], ']': [14,2,2,2,2,2,14],
    '(': [2,4,8,8,8,4,2], ')': [8,4,2,2,2,4,8], '^': [4,10,17,0,0,0,0],
    '0': [14,17,19,21,25,17,14], '1': [4,12,4,4,4,4,14],
    '2': [14,17,1,2,4,8,31], '3': [30,1,1,14,1,1,30], '4': [2,6,10,18,31,2,2],
    '5': [31,16,16,30,1,1,30], '6': [14,16,16,30,17,17,14],
    '7': [31,1,2,4,8,8,8], '8': [14,17,17,14,17,17,14], '9': [14,17,17,15,1,1,14],
    'A': [14,17,17,31,17,17,17], 'B': [30,17,17,30,17,17,30],
    'C': [14,17,16,16,16,17,14], 'D': [30,17,17,17,17,17,30],
    'E': [31,16,16,30,16,16,31], 'F': [31,16,16,30,16,16,16],
    'G': [14,17,16,23,17,17,15], 'H': [17,17,17,31,17,17,17],
    'I': [14,4,4,4,4,4,14], 'J': [7,2,2,2,18,18,12], 'K': [17,18,20,24,20,18,17],
    'L': [16,16,16,16,16,16,31], 'M': [17,27,21,21,17,17,17],
    'N': [17,25,21,19,17,17,17], 'O': [14,17,17,17,17,17,14],
    'P': [30,17,17,30,16,16,16], 'Q': [14,17,17,17,21,18,13],
    'R': [30,17,17,30,20,18,17], 'S': [15,16,16,14,1,1,30],
    'T': [31,4,4,4,4,4,4], 'U': [17,17,17,17,17,17,14],
    'V': [17,17,17,17,17,10,4], 'W': [17,17,17,21,21,21,10],
    'X': [17,17,10,4,10,17,17], 'Y': [17,17,10,4,4,4,4],
    'Z': [31,1,2,4,8,16,31]
  });

  function shader(gl, type, source) {
    const value = gl.createShader(type);
    gl.shaderSource(value, source);
    gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
      const reason = gl.getShaderInfoLog(value) || 'Unknown compilation error';
      gl.deleteShader(value);
      throw new Error('Next Stop glyph shader failed: ' + reason);
    }
    return value;
  }
  function program(gl, source) {
    const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX);
    let fragment = null, value = null;
    try {
      fragment = shader(gl, gl.FRAGMENT_SHADER, source);
      value = gl.createProgram();
      gl.attachShader(value, vertex); gl.attachShader(value, fragment); gl.linkProgram(value);
      if (!gl.getProgramParameter(value, gl.LINK_STATUS)) {
        const reason = gl.getProgramInfoLog(value) || 'Unknown link error';
        throw new Error('Next Stop glyph program failed: ' + reason);
      }
      return value;
    } catch (error) {
      if (value) gl.deleteProgram(value);
      throw error;
    } finally {
      gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    }
  }
  function uniforms(gl, value, names) {
    const result = Object.create(null);
    for (const name of names) result[name] = gl.getUniformLocation(value, 'u_' + name);
    return result;
  }
  function texture(gl) {
    const value = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, value);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return value;
  }
  function unit(gl, index, value) {
    gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, value);
  }
  function normalise(v) {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0]/length,v[1]/length,v[2]/length];
  }

  class NSGlyphRenderer {
    constructor(canvas, world) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, powerPreference: 'high-performance'
      });
      if (!this.gl) throw new Error('Next Stop requires WebGL2. Enable hardware acceleration or use a browser with WebGL2 support.');
      this.width = 1; this.height = 1; this.quality = 'standard';
      this.columns = 1; this.rows = 1; this.frames = 0; this.lost = false;
      this.destroyed = false; this.objectCount = 0; this.shadowCount = 0;
      this.frameTimes = []; this.objectData = new Float32Array(MAX_OBJECTS * 12);
      this._lost = event => {
        event.preventDefault(); this.lost = true;
        if (typeof this.onContextLost === 'function') this.onContextLost();
      };
      this._restored = () => {
        if (this.destroyed) return;
        try {
          this.lost = false;
          this._initialise(); this.setWorld(this.world);
          this.resize(this.width,this.height,this.quality);
          if (typeof this.onContextRestored === 'function') this.onContextRestored();
        } catch (error) {
          this.destroy();
          this.lost = true;
          if (typeof this.onError === 'function') this.onError(error);
        }
      };
      canvas.addEventListener('webglcontextlost', this._lost);
      canvas.addEventListener('webglcontextrestored', this._restored);
      try {
        this._initialise(); this.setWorld(world);
        this.resize(canvas.clientWidth || 1280,canvas.clientHeight || 720,'standard');
      } catch (error) {
        this.destroy();
        throw error;
      }
    }

    _initialise() {
      const gl = this.gl;
      // Context restoration has already invalidated old handles. Track each
      // fresh allocation immediately so a partial failure can release it.
      this.sceneProgram = null; this.displayProgram = null; this.vao = null;
      this.terrainTexture = null; this.objectTexture = null; this.maskTexture = null;
      this.cellTextures = []; this.framebuffer = null; this._selection = [];
      this.sceneProgram = program(gl,SCENE);
      this.displayProgram = program(gl,DISPLAY);
      this.sceneUniforms = uniforms(gl,this.sceneProgram,[
        'terrain','objects','resolution','objectCount','shadowCount','size','water',
        'heightRange','viewport','cellSize','eye','forward','right','up','sun',
        'headPosition','headDirection','time','weather','motion','far','lamps','labels','stars','lantern','stationGlow','shelter','nightBrightness','paint','lampCare'
      ]);
      this.displayUniforms = uniforms(gl,this.displayProgram,[
        'records','foreground','background','masks','viewport','cellSize','physical','grid','debug'
      ]);
      this.vao = gl.createVertexArray();
      this.starRecords=new Float32Array(64*4);
      this.starCatalogue=Array.from({length:64},(_,i)=>{const a=Math.sin(i*127.1+31.7)*43758.5453,b=Math.sin(i*311.7+7.3)*24634.6345,y=.045+(a-Math.floor(a))*.94,az=(b-Math.floor(b))*Math.PI*2,r=Math.sqrt(1-y*y);return{x:r*Math.sin(az),y,z:r*Math.cos(az),brightness:.65+(i%7)/20,warm:(i%5)/4};});
      this.terrainTexture = texture(gl); this.objectTexture = texture(gl);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,3,MAX_OBJECTS,0,gl.RGBA,gl.FLOAT,null);
      this.maskTexture = texture(gl);
      const masks = new Uint8Array(128 * 7);
      for (const [character,rows] of Object.entries(GLYPHS)) {
        for (let y=0;y<7;y++) masks[y*128+character.charCodeAt(0)] = rows[y];
      }
      gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.R8UI,128,7,0,gl.RED_INTEGER,gl.UNSIGNED_BYTE,masks);
      this.cellTextures = [texture(gl),texture(gl),texture(gl)];
      this.framebuffer = gl.createFramebuffer();
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.useProgram(this.sceneProgram);
      gl.uniform1i(this.sceneUniforms.terrain,0); gl.uniform1i(this.sceneUniforms.objects,1);
      gl.uniform1i(this.sceneUniforms.labels,2);
      gl.useProgram(this.displayProgram);
      gl.uniform1i(this.displayUniforms.records,0); gl.uniform1i(this.displayUniforms.foreground,1);
      gl.uniform1i(this.displayUniforms.background,2); gl.uniform1i(this.displayUniforms.masks,3);
      this._selection = []; this._selectionPosition = null; this._selectionCapacity=-1; this._validated=false;
    }

    setWorld(world) {
      if (!world || !(world.heights instanceof Float32Array) ||
          world.heights.length !== world.resolution * world.resolution)
        throw new Error('Renderer needs a square Float32Array authoritative heightfield.');
      this.world = world;
      let min = Infinity, max = -Infinity;
      for (const height of world.heights) { min=Math.min(min,height); max=Math.max(max,height); }
      this.heightRange = [min,max];
      this.lampPositions=new Float32Array(9).fill(100000);
      for(let i=0;i<Math.min(3,world.lamps?.length||0);i++){const p=world.lamps[i];this.lampPositions.set([p.x,p.y,p.z],i*3);}
      this.staticObjects = (world.objects || []).map(object => ({
        object, radius: Math.hypot(object.hx,object.hy,object.hz)
      }));
      this._selectionPosition = null; this._selectionCapacity=-1;
      if (this.lost) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D,this.terrainTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,world.resolution,world.resolution,0,gl.RED,gl.FLOAT,world.heights);
    }

    resize(width,height,quality=this.quality) {
      this.width = Math.max(1,Math.round(Number(width) || 1));
      this.height = Math.max(1,Math.round(Number(height) || 1));
      this.quality = CELL_PRESETS[quality] ? quality : 'standard';
      this.cellSize = CELL_PRESETS[this.quality];
      this.columns = Math.max(1,Math.ceil(this.width/this.cellSize[0]));
      this.rows = Math.max(1,Math.ceil(this.height/this.cellSize[1]));
      this.dpr = Math.min(2,Math.max(1,global.devicePixelRatio || 1));
      this.canvas.width = Math.max(1,Math.round(this.width*this.dpr));
      this.canvas.height = Math.max(1,Math.round(this.height*this.dpr));
      if (this.lost || this.destroyed) return;
      const gl = this.gl;
      if (this.columns>gl.getParameter(gl.MAX_TEXTURE_SIZE) || this.rows>gl.getParameter(gl.MAX_TEXTURE_SIZE))
        throw new Error('Character grid exceeds this browser GPU texture limit.');
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);
      for (let i=0;i<3;i++) {
        gl.bindTexture(gl.TEXTURE_2D,this.cellTextures[i]);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8UI,this.columns,this.rows,0,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,this.cellTextures[i],0);
      }
      gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2]);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)
        throw new Error('Character-record framebuffer is incomplete. This WebGL2 implementation cannot render RGBA8UI cells.');
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }

    _uploadObjects(sim,eye) {
      const life=sim.stationLife,indoor=life?.indoor,room=indoor?life.sites[indoor.index].room:null;
      const stationObjects=typeof NSStationScenery!=='undefined'?NSStationScenery.objects(life,sim):[];
      const ordinary=[...(typeof sim.dynamicObjects==='function' ? sim.dynamicObjects() : []),...(sim.village?.objects(sim)||[])];
      // Indoor shell must be written first, leaving nearby room furniture intact
      // under the fixed GPU record cap. Outdoors all train/village props retain
      // priority; reserve 32 records for static silhouettes and rails.
      const dynamic=indoor?[...stationObjects,...ordinary].slice(0,224):[...ordinary,...stationObjects.slice(0,Math.max(0,224-ordinary.length))];
      const staticCapacity=Math.max(0,MAX_OBJECTS-dynamic.length);
      const previous=this._selectionPosition;
      const roomKey=indoor?indoor.index:-1;
      if (!previous || this._selectionRoom!==roomKey || this._selectionCapacity!==staticCapacity ||
          Math.hypot(eye[0]-previous[0],eye[2]-previous[1])>5) {
        const prevSelected = new Set((this._selection || []).map(s => s.entry.object));
        const candidates=[];
        for (const entry of this.staticObjects) {
          const o=entry.object;
          if(room){
            const dx=o.x-room.x,dz=o.z-room.z,side=dx*Math.cos(room.yaw)-dz*Math.sin(room.yaw),along=dx*Math.sin(room.yaw)+dz*Math.cos(room.yaw);
            // Replace only the existing station shell and its attached trim.
            // World descriptors, collisions, terrain and distant scenery stay exact.
            if(Math.abs(side)<4.5&&Math.abs(along)<9.5)continue;
          }
          const distance=Math.hypot(o.x-eye[0],o.z-eye[2]);
          if (distance-entry.radius>420) continue;
          const wasSelected=prevSelected.has(o);
          const lodLimit=(o.lod||70)+(wasSelected ? 10 : 0);
          if(o.detail&&distance-entry.radius>lodLimit)continue;
          // Distance hysteresis prevents abrupt detail popping near selection thresholds
          const hysteresisBias=wasSelected ? -3 : 0;
          candidates.push({ entry,distance,score:distance+(o.material===7 ? 28 : 0)+hysteresisBias });
        }
        candidates.sort((a,b)=>a.score-b.score);
        this._selection=candidates.slice(0,staticCapacity);
        this._selection.sort((a,b)=>{
          const aRail=a.entry.object.material===7 || a.entry.object.material===13;
          const bRail=b.entry.object.material===7 || b.entry.object.material===13;
          return Number(aRail)-Number(bRail) || a.distance-b.distance;
        });
        this._selectionPosition=[eye[0],eye[2]];
        this._selectionCapacity=staticCapacity;
        this._selectionRoom=roomKey;
      }
      let count=0;
      const write=object => {
        if (count>=MAX_OBJECTS) return;
        const i=count++*12;
        this.objectData[i]=object.x; this.objectData[i+1]=object.y; this.objectData[i+2]=object.z;
        this.objectData[i+3]=Math.hypot(object.hx,object.hy,object.hz);
        this.objectData[i+4]=Math.max(.015,object.hx); this.objectData[i+5]=Math.max(.015,object.hy);
        this.objectData[i+6]=Math.max(.015,object.hz); this.objectData[i+7]=object.type || 0;
        this.objectData[i+8]=Math.cos(object.yaw || 0); this.objectData[i+9]=Math.sin(object.yaw || 0);
        this.objectData[i+10]=object.material; this.objectData[i+11]=object.info||0;
      };
      for (const object of dynamic) write(object);
      for (const candidate of this._selection) write(candidate.entry.object);
      this.objectCount=count;
      this.shadowCount=Math.min(48,count);
      const gl=this.gl;
      gl.bindTexture(gl.TEXTURE_2D,this.objectTexture);
      if (count) gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,3,count,gl.RGBA,gl.FLOAT,this.objectData.subarray(0,count*12));
    }

    render(sim,camera,options={}) {
      if (this.lost || this.destroyed || !this.world) return;
      if (options.quality && options.quality!==this.quality) this.resize(this.width,this.height,options.quality);
      const begin=performance.now();
      const eye=camera.position || [0,5,0];
      let forward;
      if (camera.target) forward=normalise(camera.target.map((value,i)=>value-eye[i]));
      else {
        const yaw=camera.yaw || 0,pitch=camera.pitch || 0;
        forward=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
      }
      const right=normalise([forward[2],0,-forward[0]]);
      const up=normalise([
        forward[1]*right[2]-forward[2]*right[1],
        forward[2]*right[0]-forward[0]*right[2],
        forward[0]*right[1]-forward[1]*right[0]
      ]);
      // Fixed celestial directions, projected once per frame. Eye position is
      // deliberately absent: translation cannot drag the stars through the sky.
      for(let i=0;i<64;i++){const star=this.starCatalogue[i],v=[star.x,star.y,star.z],dot=a=>v[0]*a[0]+v[1]*a[1]+v[2]*a[2],depth=dot(forward),j=i*4;
        this.starRecords[j]=depth>.001?Math.floor((dot(right)/depth/(this.width/this.height*.64)*.5+.5)*this.width/this.cellSize[0]):-10000;
        this.starRecords[j+1]=depth>.001?Math.floor((dot(up)/depth/.64*.5+.5)*this.height/this.cellSize[1]):-10000;
        this.starRecords[j+2]=star.brightness;this.starRecords[j+3]=star.warm;}
      this._uploadObjects(sim,eye);
      const time=Number(sim.time) || 0;
      const angle=1.05+time*Math.PI*2/720;
      const sun=normalise([Math.cos(angle)*.67,Math.sin(angle),.36]);
      const train=sim.train || {s:0,direction:1};
      const pose=this.world.routeAt(train.s || 0);
      const direction=train.direction===-1 ? -1 : 1;
      const headDirection=[Math.sin(pose.yaw)*direction,-.035,Math.cos(pose.yaw)*direction];
      const headPosition=[pose.x+headDirection[0]*4.7,pose.y+2.1,pose.z+headDirection[2]*4.7];
      const weather=sim.weather || {};
      const rain=typeof weather==='string' ? Number(weather==='rain') : Math.max(0,Math.min(1,weather.rain || 0));
      const fog=typeof weather==='string' ? Number(weather==='fog') : Math.max(0,Math.min(1,weather.fog || 0));
      const gl=this.gl,u=this.sceneUniforms;
      gl.bindVertexArray(this.vao);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);
      gl.viewport(0,0,this.columns,this.rows); gl.useProgram(this.sceneProgram);
      unit(gl,0,this.terrainTexture); unit(gl,1,this.objectTexture);unit(gl,2,this.maskTexture);
      gl.uniform1i(u.resolution,this.world.resolution); gl.uniform1i(u.objectCount,this.objectCount);
      gl.uniform1i(u.shadowCount,this.shadowCount); gl.uniform1f(u.size,this.world.size);
      gl.uniform1f(u.water,this.world.waterLevel); gl.uniform2fv(u.heightRange,this.heightRange);
      gl.uniform2f(u.viewport,this.width,this.height); gl.uniform2fv(u.cellSize,this.cellSize);
      gl.uniform3fv(u.eye,eye); gl.uniform3fv(u.forward,forward); gl.uniform3fv(u.right,right); gl.uniform3fv(u.up,up);
      gl.uniform3fv(u.sun,sun); gl.uniform3fv(u.headPosition,headPosition); gl.uniform3fv(u.headDirection,headDirection);
      const walker=sim.player,lanternOn=walker?.mode==='foot'&&sim.settings?.lantern!==false;
      gl.uniform4fv(u.lantern,lanternOn?[walker.x+Math.cos(walker.yaw)*.35,walker.y+1.0,walker.z-Math.sin(walker.yaw)*.35,1]:[0,0,0,0]);
      const life=sim.stationLife,roomSite=life?.indoor?life.sites[life.indoor.index]:life?.sites?.find(site=>life.projects.has('fireplace-'+site.index)&&Math.hypot(site.room.x-eye[0],site.room.z-eye[2])<28);
      let stationGlow=[0,0,0,0];
      if(roomSite){const room=roomSite.room,lit=life.projects.has('fireplace-'+roomSite.index);stationGlow=[room.x+Math.sin(room.yaw)*3.8,room.y+1.2,room.z+Math.cos(room.yaw)*3.8,life.indoor?(lit?1.9:.62):.8];}
      gl.uniform4fv(u.stationGlow,stationGlow);
      gl.uniform1f(u.shelter,life?.indoor||walker?.mode==='train'&&sim.cameraMode==='cab'?1:0);
      gl.uniform1f(u.nightBrightness,sim.settings?.nightBrightness??1);
      gl.uniform1i(u.paint,sim.village?.paint==='green'?1:sim.village?.paint==='ochre'?2:0);
      gl.uniform3fv(u.lampCare,[0,1,2].map(index=>sim.village?.completed.has('lamp-'+index)?1:0));
      gl.uniform4fv(u.stars,this.starRecords);
      gl.uniform1f(u.time,time); gl.uniform2f(u.weather,rain,fog);
      gl.uniform1f(u.motion,options.reducedMotion ? .15 : 1); gl.uniform1f(u.far,600);
      gl.uniform3fv(u.lamps,this.lampPositions);
      gl.drawArrays(gl.TRIANGLES,0,3);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.viewport(0,0,this.canvas.width,this.canvas.height); gl.useProgram(this.displayProgram);
      for (let i=0;i<3;i++) unit(gl,i,this.cellTextures[i]);
      unit(gl,3,this.maskTexture);
      const d=this.displayUniforms;
      gl.uniform2f(d.viewport,this.width,this.height); gl.uniform2fv(d.cellSize,this.cellSize);
      gl.uniform2f(d.physical,this.canvas.width,this.canvas.height); gl.uniform2i(d.grid,this.columns,this.rows);
      gl.uniform1i(d.debug,Boolean(options.debug)); gl.drawArrays(gl.TRIANGLES,0,3);
      if (!this._validated) {
        const error=gl.getError();
        if (error!==gl.NO_ERROR) throw new Error('WebGL could not draw the glyph scene (GPU error '+error+').');
        this._validated=true;
      }
      this.frames++;
      this.frameTimes.push(performance.now()-begin);
      if (this.frameTimes.length>180) this.frameTimes.shift();
    }

    diagnostics() {
      const sorted=this.frameTimes.slice().sort((a,b)=>a-b);
      return {
        pipeline:'numerical scene -> RGBA8UI glyph/foreground/background -> 5x7 mask display',
        quality:this.quality, columns:this.columns,rows:this.rows,cells:this.columns*this.rows,
        cellSize:this.cellSize.slice(),viewport:[this.width,this.height],dpr:this.dpr,
        objects:this.objectCount,worldObjects:this.staticObjects.length,maxObjects:MAX_OBJECTS,
        terrainBudget:192,reflectionBudget:{queries:1,distance:185,objects:160,terrainCells:80},
        shadowObjects:this.shadowCount,frames:this.frames,lost:this.lost,
        cpuSubmitMedianMs:sorted.length ? sorted[Math.floor(sorted.length*.5)] : 0,
        cpuSubmitP95Ms:sorted.length ? sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))] : 0
      };
    }

    // Explicit diagnostics only; the normal frame path never reads GPU pixels.
    inspectCells() {
      if (this.lost || this.destroyed) throw new Error('Character records unavailable while renderer context is lost or destroyed.');
      const gl=this.gl;
      const data=new Uint8Array(this.columns*this.rows*4);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.framebuffer);
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.readPixels(0,0,this.columns,this.rows,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,data);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);
      const ids=[],materials=[],samples=[];
      for (let i=0;i<data.length;i+=4) {
        ids.push(data[i]); materials.push(data[i+1]);
        if (samples.length<64 && (i===0 || data[i]!==data[i-4]))
          samples.push({index:i/4,glyph:data[i],character:String.fromCharCode(data[i]),material:data[i+1],depth:data[i+2]});
      }
      return {columns:this.columns,rows:this.rows,ids,materials,distinctGlyphs:[...new Set(ids)],samples};
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed=true;
      this.canvas.removeEventListener('webglcontextlost',this._lost);
      this.canvas.removeEventListener('webglcontextrestored',this._restored);
      if (!this.lost) {
        const gl=this.gl;
        if (this.sceneProgram) gl.deleteProgram(this.sceneProgram);
        if (this.displayProgram) gl.deleteProgram(this.displayProgram);
        if (this.vao) gl.deleteVertexArray(this.vao);
        if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
        for (const value of [this.terrainTexture,this.objectTexture,this.maskTexture,...(this.cellTextures || [])])
          if (value) gl.deleteTexture(value);
      }
      this.frameTimes.length=0;
      if (this._selection) this._selection.length=0;
    }
  }

  global.NSGlyphRenderer=NSGlyphRenderer;
})(typeof window!=='undefined' ? window : globalThis);
