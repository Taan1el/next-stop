'use strict';
const {launchBrowser,fileURL}=require('./browser.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),name=process.argv[2]||'night';if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid evidence name');
const directory=path.join(root,'.omx/evidence/cycles',name);fs.mkdirSync(directory,{recursive:true});
(async()=>{
 const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1280,height:720},offline:true}),page=await context.newPage(),issues=[],requests=[];page.setDefaultTimeout(60000);
 page.on('pageerror',e=>issues.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))issues.push(m.text());});page.on('request',r=>requests.push(r.url()));
 const result={status:'running',browser:browser.version(),inspection:'Fixed 22:00/clear and rainy cameras for visibility comparison, not full night journeys',sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'outputs/next-stop.html'))).digest('hex'),views:[]};
 try{
  await page.goto(fileURL(path.join(root,'outputs/next-stop.html')),{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('button',{name:'Start journey',exact:true}).click();await page.keyboard.press('Escape');
  for(const [label,location,lantern,rain] of [['platform','platform',true,false],['meadow-lantern','meadow',true,false],['meadow-moonlight','meadow',false,false],['rainy-platform','platform',true,true],['night-cab','cab',true,false]]){
   await page.evaluate(({location,lantern,rain})=>{const g=nextStopGame,st=g.world.stations[0],r=g.world.routeAt(0);g.sim.time=420;g.sim.weather={rain:rain?1:0,fog:rain?.43:.08};g.sim.settings.lantern=lantern;g.sim.settings.nightBrightness=1;g.el.menu.hidden=true;g.sim.train.s=0;g.sim.train.speed=0;
    if(location==='cab'){Object.assign(g.sim.player,{x:r.x,y:r.y,z:r.z,mode:'train',yaw:r.yaw,pitch:-.04});g.sim.cameraMode='cab';}
    else{const p=location==='meadow'?g.exploration.records.find(r=>r.id==='pinebank-meadow').anchor:{x:st.platformX,y:g.world.surfaceAt(st.platformX,st.platformZ).height,z:st.platformZ};Object.assign(g.sim.player,p,{mode:'foot',yaw:st.yaw,pitch:-.16});}
    g.sim._previousPlayer={...g.sim.player};g.sim.renderAlpha=1;g.sim._camera=null;g.renderer.render(g.sim,g.sim.camera());
   },{location,lantern,rain});
   await page.screenshot({path:path.join(directory,label+'.png')});
   const metric=await page.evaluate(()=>{const r=nextStopGame.renderer,gl=r.gl,buffers=[0,1,2].map(i=>{const a=new Uint8Array(r.columns*r.rows*4);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,r.framebuffer);gl.readBuffer(gl.COLOR_ATTACHMENT0+i);gl.readPixels(0,0,r.columns,r.rows,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,a);return a;});gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);const samples=[];let background=0;
    for(let i=0;i<buffers[0].length;i+=4){const m=buffers[0][i+1];if(m===0||m===19||buffers[0][i+2]>13)continue;const fg=buffers[1],bg=buffers[2];samples.push(fg[i]*.2126+fg[i+1]*.7152+fg[i+2]*.0722);background+=bg[i]*.2126+bg[i+1]*.7152+bg[i+2]*.0722;}
    samples.sort((a,b)=>a-b);return{nearCells:samples.length,foregroundMedian:samples[Math.floor(samples.length/2)],backgroundMean:background/Math.max(1,samples.length),gl:gl.getError()};});assert.equal(metric.gl,0);assert(metric.nearCells>100);result.views.push({label,...metric});
  }
  if(!process.argv.includes('--baseline')){for(const view of result.views){assert(view.foregroundMedian>=(view.label==='night-cab'?24:40),'Night surfaces too dark: '+view.label);assert(view.backgroundMean>=10,'Night surface silhouettes too dark: '+view.label);}assert(result.views[1].foregroundMedian>result.views[2].foregroundMedian*1.15,'Lantern must noticeably light nearby ground');}
  assert.deepEqual(issues,[]);assert(requests.every(u=>u.startsWith('file:')));result.issues=issues;result.status='passed';
 }catch(error){result.status='failed';result.error=error.stack;process.exitCode=1;}
 finally{fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
