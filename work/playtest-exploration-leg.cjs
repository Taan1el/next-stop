'use strict';
const {launchBrowser,fileURL}=require('./browser.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {walkTo}=require('./playtest-cycle.cjs');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'.omx/evidence/cycles/06-legacy-night-exploration');fs.mkdirSync(directory,{recursive:true});
(async()=>{
  const browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width:1280,height:720},offline:true,acceptDownloads:true});
  const page=await context.newPage();page.setDefaultTimeout(60000);
  const issues=[],requests=[];page.on('pageerror',e=>issues.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push(m.text());});page.on('request',r=>requests.push(r.url()));
  const result={status:'running',browser:browser.version(),start:Date.now()};let timer;
  try{
    const html=fs.readFileSync(path.join(root,'outputs/next-stop.html'));result.bytes=html.length;result.sha256=crypto.createHash('sha256').update(html).digest('hex');
    await page.goto(fileURL(path.join(root,'outputs/next-stop.html')),{waitUntil:'domcontentloaded',timeout:60000});
    await page.getByRole('button',{name:'Start journey',exact:true}).click();await page.getByRole('button',{name:'Settings',exact:true}).first().click();
    const legacy=JSON.parse(fs.readFileSync(path.join(root,'work/qa/fixtures/world1-completed.json'),'utf8'));
    const legacyFile=path.join(directory,'legacy-save.json');fs.writeFileSync(legacyFile,JSON.stringify(legacy));
    const chooser=page.waitForEvent('filechooser');await page.locator('#import').click();await(await chooser).setFiles(legacyFile);await page.waitForTimeout(250);
    result.imported=await page.evaluate(()=>nextStopGame.serialize());if(!result.imported.delivery.finished||result.imported.exploration.visited.length)throw Error('Legacy save did not import');
    await page.keyboard.press('Escape');await page.keyboard.press('KeyJ');await page.getByRole('button',{name:'Set destination: Bellweather tower',exact:true}).click();await page.keyboard.press('Enter');await page.keyboard.press('KeyE');await page.waitForTimeout(250);
    result.selected=await page.evaluate(()=>({mode:nextStopGame.sim.player.mode,selected:nextStopGame.exploration.selected,approach:nextStopGame.approach}));if(result.selected.mode!=='train'||result.selected.approach.kind!=='exploration')throw Error('Selected station guidance unavailable');
    await page.keyboard.press('KeyC');await page.keyboard.down('KeyW');await page.waitForTimeout(2700);await page.keyboard.up('KeyW');
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);await page.keyboard.up('ArrowRight');await page.keyboard.press('KeyF');await page.waitForTimeout(100);
    result.recenter=await page.evaluate(()=>{const g=nextStopGame,delta=g.sim.player.yaw-g.world.routeAt(g.sim.train.s).yaw;return{yawError:Math.atan2(Math.sin(delta),Math.cos(delta)),pitch:g.sim.player.pitch,message:document.getElementById('toast').textContent};});
    if(Math.abs(result.recenter.yawError)>.01||result.recenter.pitch!==-.04)throw Error('Camera did not recenter');
    await page.screenshot({path:path.join(directory,'night-cab.png'),scale:'css'});await page.keyboard.press('KeyC');await page.screenshot({path:path.join(directory,'night-chase.png'),scale:'css'});
    timer=setInterval(()=>console.log(JSON.stringify({phase:'legacy-night-exploration',current:result.current})),30000);
    let braking=false,arrived=false;const deadline=Date.now()+180000;
    while(Date.now()<deadline){const state=await page.evaluate(()=>({cue:nextStopGame.approach,speed:nextStopGame.sim.train.speed,running:nextStopGame.running}));result.current=state;if(!state.running)throw Error('Unexpected pause');if(!braking&&state.cue?.phase==='brake'){await page.keyboard.down('Space');braking=true;}if(braking&&Math.abs(state.speed)<.025){arrived=true;break;}await page.waitForTimeout(250);}
    if(!arrived)throw Error('Selected station timeout');await page.keyboard.press('KeyE');await page.keyboard.up('Space');await page.waitForTimeout(200);
    const target=await page.evaluate(()=>nextStopGame.exploration.records.find(r=>r.id==='bellweather-tower'));result.walk=await walkTo(page,target.anchor,target.radius-1);await page.waitForTimeout(200);
    await page.keyboard.press('KeyJ');await page.waitForTimeout(200);await page.screenshot({path:path.join(directory,'discovered-journal.png'),scale:'css'});
    result.final=await page.evaluate(()=>({save:nextStopGame.serialize(),stats:nextStopGame.diagnostics(),gl:nextStopGame.renderer.gl.getError()}));
    if(result.final.save.delivery.completed!==3||!result.final.save.exploration.visited.includes('bellweather-tower')||result.final.save.exploration.selected!==null||result.final.gl||issues.length||requests.some(u=>!u.startsWith('file:')))throw Error('Night exploration gate failed');
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Settings',exact:true}).first().click();const download=page.waitForEvent('download');await page.locator('#export').click();await(await download).saveAs(path.join(directory,'discovered-save.json'));
    result.status='passed';result.seconds=(Date.now()-result.start)/1000;result.issues=issues;result.requests=requests;
  }catch(error){result.status='failed';result.error=error.stack;process.exitCode=1;}
  finally{if(timer)clearInterval(timer);fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,seconds:result.seconds,browser:result.browser,exploration:result.final?.save.exploration,error:result.error}));await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
