'use strict';
const {chromium}=require('C:/Users/crazy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),name=process.argv[2]||'23-colour-feedback';
if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid evidence name');
const directory=path.join(root,'.omx/evidence/cycles',name);fs.mkdirSync(directory,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),context=await browser.newContext({viewport:{width:1280,height:720},offline:true,acceptDownloads:true}),page=await context.newPage();
 page.setDefaultTimeout(15000);const issues=[],requests=[];page.on('pageerror',e=>issues.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push(m.text());});page.on('request',r=>requests.push(r.url()));
 const html=fs.readFileSync(path.join(root,'outputs/next-stop.html')),url='file:///'+path.join(root,'outputs/next-stop.html').replaceAll('\\','/');
 const result={status:'running',bytes:html.length,sha256:crypto.createHash('sha256').update(html).digest('hex'),browser:browser.version(),issues,requests};
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('button',{name:'Start journey',exact:true}).click();await page.keyboard.press('KeyE');await page.keyboard.press('KeyB');await page.keyboard.down('KeyW');await page.waitForTimeout(2600);await page.keyboard.up('KeyW');await page.waitForTimeout(12500);
  result.sound=await page.evaluate(()=>({counters:{...nextStopGame.soundCounters},travel:nextStopGame.sim.train.wheelTravel,state:nextStopGame.audio.state,transport:nextStopGame.audioTransport.gain.value}));
  assert(result.sound.counters.chuffs>10&&result.sound.counters.joints>0);assert.equal(result.sound.state,'running');assert.equal(result.sound.transport,1);console.log('Moving train sound',result.sound);
  await page.keyboard.down('Space');await page.waitForFunction(()=>nextStopGame.sim.train.speed===0);await page.keyboard.up('Space');await page.keyboard.press('KeyJ');
  const stopped=await page.evaluate(()=>({save:nextStopGame.serialize(),counters:{...nextStopGame.soundCounters},transport:nextStopGame.audioTransport.gain.value}));await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>nextStopGame.serialize()),stopped.save);assert.deepEqual(await page.evaluate(()=>nextStopGame.soundCounters),stopped.counters);assert.equal(stopped.transport,0);result.audioPause=true;
  // A fixture inspection isolates sky translation from ordinary camera rotation.
  await page.evaluate(()=>{window.savedCamera=nextStopGame.sim.camera;window.savedTime=nextStopGame.sim.time;window.savedWeather=nextStopGame.sim.weather;nextStopGame.sim.time=420;nextStopGame.sim.weather={rain:0,fog:0};nextStopGame.el.menu.hidden=true;});
  const sky=async(position,yaw)=>page.evaluate(({position,yaw})=>{const g=nextStopGame,camera={position,yaw,pitch:.7};g.sim.camera=()=>camera;g.renderer.render(g.sim,camera);return{records:Array.from(g.renderer.starRecords),cells:g.renderer.inspectCells(),gl:g.renderer.gl.getError()};},{position,yaw});
  const first=await sky([0,250,0],.6);await page.screenshot({path:path.join(directory,'night-sky.png')});const translated=await sky([80,250,60],.6),rotated=await sky([80,250,60],1.0);
  assert.deepEqual(translated.records,first.records);assert.deepEqual(translated.cells.ids,first.cells.ids);assert.notDeepEqual(rotated.records,first.records);assert.equal(first.gl,0);assert.equal(translated.gl,0);assert.equal(rotated.gl,0);
  const stars=first.cells.ids.filter(id=>id===42||id===46).length;assert(stars>0,'Sky inspection must contain visible stars');result.stars={visible:stars,translationPreservesCatalogueAndGlyphs:true,rotationChangesProjection:true,inspection:'Fixed night time and upward camera, not a playthrough'};console.log('Sky translation checked',result.stars);
  for(const [label,time] of [['day',0],['dusk',240],['night',420]]){await page.evaluate(time=>{const g=nextStopGame,p=g.world.routeAt(g.sim.train.s),rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw),camera={position:[p.x-rx*8,p.y+2.7,p.z-rz*8],target:[p.x,p.y+1.7,p.z]};g.sim.time=time;g.sim.camera=()=>camera;g.renderer.render(g.sim,camera);},time);await page.waitForTimeout(150);await page.screenshot({path:path.join(directory,label+'-colours.png')});}
  await page.evaluate(()=>{const g=nextStopGame;g.sim.camera=savedCamera;g.sim.time=savedTime;g.sim.weather=savedWeather;g.openMenu('journal');});
  const checkpoint=await page.evaluate(()=>({save:nextStopGame.serialize(),local:JSON.parse(localStorage.getItem('next-stop-checkpoint'))}));assert.deepEqual(checkpoint.local,checkpoint.save);
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});assert(await page.getByRole('button',{name:'Continue last journey',exact:true}).isVisible());
  // Real DOM action and an immediate menu opening avoid advancing the restored clock.
  await page.evaluate(()=>{document.getElementById('continue-button').click();nextStopGame.openMenu('journal');});assert.deepEqual(await page.evaluate(()=>nextStopGame.serialize()),checkpoint.save);result.continueExact=true;
  const before=await page.evaluate(()=>JSON.stringify(nextStopGame.serialize()));await page.evaluate(()=>{localStorage.setItem('next-stop-checkpoint','{"broken":true}');document.getElementById('continue-button').click();});assert.equal(await page.evaluate(()=>JSON.stringify(nextStopGame.serialize())),before);result.corruptCheckpointAtomic=true;
  // Storage denial must leave the browser game and portable JSON export usable.
  const restricted=await context.newPage();restricted.on('pageerror',e=>issues.push(e.message));await restricted.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage denied','SecurityError');}}));await restricted.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await restricted.getByRole('button',{name:'Start journey',exact:true}).click();await restricted.keyboard.press('KeyE');await restricted.keyboard.press('Escape');await restricted.getByRole('button',{name:'Settings',exact:true}).click();assert.match(await restricted.locator('#local-save-status').textContent(),/Local storage unavailable/);
  const expected=await restricted.evaluate(()=>nextStopGame.serialize()),download=restricted.waitForEvent('download');await restricted.locator('#export').click();const exported=path.join(directory,'storage-denied-save.json');await(await download).saveAs(exported);assert.deepEqual(JSON.parse(fs.readFileSync(exported,'utf8')),expected);result.storageDeniedExport=true;await restricted.close();
  assert.deepEqual(issues,[]);assert(requests.every(u=>u.startsWith('file:')));result.status='passed';
 }catch(error){result.status='failed';result.error=error.stack;process.exitCode=1;console.error(error);}
 finally{fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,bytes:result.bytes,error:result.error,issues}));await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
