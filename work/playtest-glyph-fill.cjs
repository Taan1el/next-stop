'use strict';
// Fixed renderer comparisons, followed by actual walking/driving inputs.
const {launchBrowser,fileURL}=require('./browser.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),name=process.argv[2]||'glyph-fill',htmlPath=path.resolve(root,process.argv[3]||'outputs/next-stop.html');
if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid evidence name');
const directory=path.join(root,'.omx/evidence/cycles',name);fs.mkdirSync(directory,{recursive:true});
(async()=>{
 const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1280,height:720},offline:true}),page=await context.newPage();page.setDefaultTimeout(60000);
 const issues=[],requests=[],html=fs.readFileSync(htmlPath),result={status:'running',browser:browser.version(),bytes:html.length,sha256:crypto.createHash('sha256').update(html).digest('hex'),views:[],issues,requests};
 page.on('pageerror',e=>issues.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))issues.push(m.text());});page.on('request',r=>requests.push(r.url()));
 try{
  await page.goto(fileURL(htmlPath),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.nextStopGame||!document.getElementById('fatal').hidden);
  if(await page.locator('#fatal').isVisible())throw Error(await page.locator('#fatal-detail').textContent());
  await page.getByRole('button',{name:'Start journey',exact:true}).click();await page.keyboard.press('Escape');
  const saved=await page.evaluate(()=>nextStopGame.serialize());
  await page.evaluate(()=>{window.fillCamera=nextStopGame.sim.camera;nextStopGame.el.menu.hidden=true;for(const n of document.querySelectorAll('#hud,#toast,#status,header'))n.hidden=true;});
  for(const view of ['engine','station','lake','ridge','woodland','name','night','night-cab']){
   await page.evaluate(view=>{
    const g=nextStopGame,p=g.world.routeAt(0),rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw),fx=Math.sin(p.yaw),fz=Math.cos(p.yaw);let position,target;
    if(view==='engine'||view==='night'){position=[p.x-rx*8+fx*3,p.y+2.7,p.z-rz*8+fz*3];target=[p.x,p.y+1.7,p.z];}
    else if(view==='station'){position=[p.x+rx*3-fx*12,p.y+2.3,p.z+rz*3-fz*12];target=[p.x+rx*11,p.y+3.4,p.z+rz*11];}
    else if(view==='name'){position=[p.x+rx*3,p.y+3.3,p.z+rz*3];target=[p.x+rx*6.5,p.y+3.3,p.z+rz*6.5];}
    else if(view==='night-cab'){Object.assign(g.sim.player,{x:p.x,y:p.y,z:p.z,mode:'train',yaw:p.yaw,pitch:-.04});g.sim.cameraMode='cab';g.sim.renderAlpha=1;g.sim._camera=null;const actual=fillCamera.call(g.sim,0);position=actual.position;target=actual.target;}
    else if(view==='lake'){position=[55,12,-245];target=[55,0,-150];}
    else if(view==='ridge'){position=[260,55,230];target=[g.world.size*.46,110,g.world.size*.46];}
    else{const tree=g.world.objects.filter(o=>o.material===12)[30];position=[tree.x-10,g.world.heightAt(tree.x-10,tree.z-12)+3,tree.z-12];target=[tree.x,tree.y,tree.z];}
    g.sim.time=view.startsWith('night')?420:90;g.sim.weather={rain:0,fog:.04};g.sim.settings.reducedMotion=true;g.sim.player.mode=view==='night-cab'?'train':'foot';const camera={position,target};g.sim.camera=()=>camera;g.renderer.render(g.sim,camera,{quality:g.sim.settings.quality,reducedMotion:true});
   },view);
   await page.screenshot({path:path.join(directory,view+'.png')});
   const metric=await page.evaluate(()=>{
    const g=nextStopGame,r=g.renderer,gl=r.gl; r.render(g.sim,g.sim.camera(),{quality:g.sim.settings.quality,reducedMotion:true});
    const arrays=[0,1,2].map(i=>{const a=new Uint8Array(r.columns*r.rows*4);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,r.framebuffer);gl.readBuffer(gl.COLOR_ATTACHMENT0+i);gl.readPixels(0,0,r.columns,r.rows,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,a);return a;});gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);
    const width=gl.canvas.width,height=gl.canvas.height,pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const materials={},ids=[],display={gradientCells:0,signInk:[],signFace:[],gaugeCells:0};
    for(let i=0;i<arrays[0].length;i+=4){const m=arrays[0][i+1],v=materials[m]||(materials[m]={cells:0,foreground:0,background:0});const luminance=a=>a[i]*.2126+a[i+1]*.7152+a[i+2]*.0722,fg=luminance(arrays[1]),bg=luminance(arrays[2]);v.cells++;v.foreground+=fg;v.background+=bg;ids.push(arrays[0][i]);
     if(m===0||m===19)continue;const cell=i/4,cx=cell%r.columns,cy=Math.floor(cell/r.columns);let low=Infinity,high=-Infinity,ink=0,total=0,count=0;
     for(let y=Math.ceil(cy*height/r.rows);y<(cy+1)*height/r.rows;y++)for(let x=Math.ceil(cx*width/r.columns);x<(cx+1)*width/r.columns;x++){const p=(y*width+x)*4,l=pixels[p]*.2126+pixels[p+1]*.7152+pixels[p+2]*.0722;total+=l;count++;if(l>(fg+bg)*.5&&fg>bg+12&&fg>24&&fg<215){ink++;low=Math.min(low,l);high=Math.max(high,l);}}
     if(ink>=5&&high-low>2)display.gradientCells++;if(m===35){if(arrays[0][i]===35)display.signInk.push(total/count);else if(arrays[0][i]===32)display.signFace.push(total/count);}if(m===36)display.gaugeCells++;
    }
    for(const v of Object.values(materials)){v.foreground/=v.cells;v.background/=v.cells;}
    const mean=a=>a.length?a.reduce((sum,n)=>sum+n,0)/a.length:null;display.signInkMean=mean(display.signInk);display.signFaceMean=mean(display.signFace);delete display.signInk;delete display.signFace;return{materials,ids,display,gl:gl.getError()};
   });assert.equal(metric.gl,0);result.views.push({view,...metric});
  }
  // Return to the unmodified save before exercising real player controls.
  await page.evaluate(saved=>{const g=nextStopGame;g.sim.camera=fillCamera;g.restore(saved);for(const n of document.querySelectorAll('#hud,#toast,#status,header'))n.hidden=false;g.resume();},saved);
  const foot=await page.evaluate(()=>({...nextStopGame.sim.player}));await page.keyboard.down('KeyW');await page.waitForTimeout(500);await page.keyboard.up('KeyW');const moved=await page.evaluate(()=>({...nextStopGame.sim.player}));assert(Math.hypot(moved.x-foot.x,moved.z-foot.z)>1);
  await page.keyboard.down('KeyS');await page.waitForTimeout(500);await page.keyboard.up('KeyS');await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>nextStopGame.sim.player.mode),'train');await page.keyboard.press('KeyC');const boiler=await page.evaluate(()=>({...nextStopGame.railway.engine}));await page.keyboard.press('KeyB');const fired=await page.evaluate(()=>({...nextStopGame.railway.engine}));assert(fired.coal<boiler.coal&&fired.fire>boiler.fire,'Firing must consume coal and brighten the fire');
  await page.keyboard.down('KeyW');await page.waitForTimeout(2600);await page.keyboard.up('KeyW');await page.waitForTimeout(1500);assert(await page.evaluate(()=>nextStopGame.sim.train.speed)>0);await page.screenshot({path:path.join(directory,'actual-drive.png')});
  await page.keyboard.down('Space');await page.waitForFunction(()=>nextStopGame.sim.train.speed===0);await page.keyboard.up('Space');await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>JSON.stringify(nextStopGame.serialize()));await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>JSON.stringify(nextStopGame.serialize())),frozen);
  result.play={walked:true,boarded:true,fired:true,drove:true,braked:true,paused:true};
  result.performanceInspection='600 presented frames, paused engine camera; not another playthrough';
  await page.evaluate(()=>{const g=nextStopGame,p=g.world.routeAt(0),rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw),fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),camera={position:[p.x-rx*8+fx*3,p.y+2.7,p.z-rz*8+fz*3],target:[p.x,p.y+1.7,p.z]};g.sim.time=90;g.sim.weather={rain:0,fog:.04};g.sim.settings.reducedMotion=true;g.sim.camera=()=>camera;});
  result.stats=await page.evaluate(async()=>{const samples=[];await new Promise((resolve,reject)=>{let previous=0;const timer=setTimeout(()=>reject(Error('600-frame sample timed out')),45000);function sample(now){if(previous&&now-previous>0)samples.push(now-previous);previous=now;if(samples.length>=600){clearTimeout(timer);resolve();}else requestAnimationFrame(sample);}requestAnimationFrame(sample);});samples.sort((a,b)=>a-b);return{...nextStopGame.diagnostics(),frames:samples.length,medianMs:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1),over50ms:samples.filter(n=>n>50).length};});
  if(process.argv[4]){
   const baseline=JSON.parse(fs.readFileSync(path.resolve(root,process.argv[4]),'utf8'));assert.equal(baseline.status,'passed');result.comparison={unchangedGlyphCells:false,gains:[]};
   for(const view of result.views){const before=baseline.views.find(v=>v.view===view.view);assert(before,'Missing comparison camera');assert.deepEqual(view.ids,before.ids,'Fill must preserve glyph records: '+view.view);for(const material of [1,2,3,12]){const a=before.materials[material],b=view.materials[material];if(!a||a.cells<25)continue;assert.equal(b.cells,a.cells);assert(b.background>a.background*1.15,'Surface fill did not improve: '+view.view+'/'+material);assert(b.foreground>b.background,'Glyphs lost contrast');result.comparison.gains.push({view:view.view,material,cells:b.cells,backgroundRatio:b.background/a.background});}}
   assert(result.comparison.gains.some(g=>g.material===3),'Lake camera must show water');assert(result.comparison.gains.some(g=>g.material===12),'Woodland camera must show leaves');
   result.comparison.unchangedGlyphCells=true;assert(result.views.some(v=>v.display.gradientCells>10),'Displayed glyph ink must show a gradient');
   const name=result.views.find(v=>v.view==='name').display,cab=result.views.find(v=>v.view==='night-cab');assert(Number.isFinite(name.signInkMean)&&Number.isFinite(name.signFaceMean),'Nameboard camera must include lettering and its face');assert(name.signFaceMean>name.signInkMean*1.3+2,'Nameboard lettering must contrast with its face');assert(cab.display.gaugeCells>0,'Use the production camera with visible cab gauges');
   assert(result.stats.p95Ms<=baseline.stats.p95Ms*1.4+2,'Fill caused a frame-time regression');
  }
  assert.deepEqual(issues,[]);assert(requests.every(url=>url.startsWith('file:')));result.status='passed';
 }catch(error){result.status='failed';result.error=error.stack;process.exitCode=1;await page.screenshot({path:path.join(directory,'failure.png')}).catch(()=>{});}
 finally{fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,bytes:result.bytes,play:result.play,error:result.error,issues}));await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
