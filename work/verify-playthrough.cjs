// Real-time browser circuit using player keyboard controls. State is read, never advanced by tests.
const {launchBrowser,fileURL}=require('./browser.cjs');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const evidence=path.join(root,'.omx','evidence');
fs.mkdirSync(evidence,{recursive:true});
(async()=>{
  const browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width:1280,height:720},offline:true});
  const page=await context.newPage();
  const errors=[],warnings=[],requests=[],stops=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());if(message.type()==='warning')warnings.push(message.text());});
  page.on('request',request=>requests.push(request.url()));
  const started=Date.now();
  try{
    await page.goto(fileURL(path.join(root,'outputs','next-stop.html')));
    await page.getByRole('button',{name:'Start journey',exact:true}).click();
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(350);
    const first=await page.evaluate(()=>({mode:nextStopGame.sim.player.mode,delivery:nextStopGame.sim.delivery,...nextStopGame.diagnostics()}));
    if(first.mode!=='train')throw new Error('Boarding failed.');
    await page.screenshot({path:path.join(evidence,'departure.png'),scale:'css'});
    console.log('Boarded locomotive through E. Beginning real-time B/C/A delivery circuit.');
    for(let stage=0;stage<3;stage++){
      await page.keyboard.up('Space');
      await page.keyboard.down('KeyW');await page.waitForTimeout(2700);await page.keyboard.up('KeyW');
      let braking=false,lastLog=0,arrival=null;
      const stopDeadline=Date.now()+240000;
      while(Date.now()<stopDeadline){
        const state=await page.evaluate(()=>{const g=nextStopGame,t=g.sim.train,d=g.world.stations[g.sim.delivery.index];return{distance:((d.s-t.s)%g.world.routeLength+g.world.routeLength)%g.world.routeLength,speed:t.speed,name:d.name,radius:d.radius,time:g.sim.time,s:t.s,completed:g.sim.delivery.completed,running:g.running}});
        if(!state.running)throw new Error('Journey unexpectedly paused.');
        if(!braking&&state.distance<28){await page.keyboard.down('Space');braking=true;console.log('Braking for '+state.name+' at '+state.distance.toFixed(1)+' m.');}
        if(braking&&Math.abs(state.speed)<.025){arrival=state;break;}
        if(Date.now()-lastLog>25000){console.log('Next '+state.name+': '+Math.round(state.distance)+' m, '+(state.speed*3.6).toFixed(1)+' km/h.');lastLog=Date.now();}
        await page.waitForTimeout(350);
      }
      if(!arrival)throw new Error('Timed out reaching station.');
      await page.keyboard.press('KeyE');await page.waitForTimeout(250);
      const delivered=await page.evaluate(()=>({delivery:{...nextStopGame.sim.delivery},objective:document.getElementById('objective').textContent,train:{...nextStopGame.sim.train},time:nextStopGame.sim.time}));
      if(delivered.delivery.completed!==stage+1)throw new Error('Station interaction did not advance delivery: '+JSON.stringify(delivered));
      stops.push({arrival,delivered});
      await page.screenshot({path:path.join(evidence,'station-'+(stage+1)+'.png'),scale:'css'});
      console.log('Delivery '+(stage+1)+'/3 confirmed through E at '+arrival.name+'.');
    }
    await page.keyboard.up('Space');await page.keyboard.press('KeyE');await page.waitForTimeout(300);
    const final=await page.evaluate(()=>({mode:nextStopGame.sim.player.mode,delivery:{...nextStopGame.sim.delivery},stats:nextStopGame.diagnostics(),save:nextStopGame.serialize(),glError:nextStopGame.renderer.gl.getError(),glyphs:nextStopGame.renderer.inspectCells().distinctGlyphs}));
    if(!final.delivery.finished||final.mode!=='foot')throw new Error('Completion or safe disembark failed.');
    if(errors.length||warnings.some(w=>/GL_INVALID|shader failed/i.test(w))||final.glError)throw new Error('Runtime error during circuit: '+JSON.stringify({errors,warnings,glError:final.glError}));
    if(requests.some(url=>!url.startsWith('file:')))throw new Error('External request observed.');
    const result={passed:true,browser:browser.version(),wallSeconds:(Date.now()-started)/1000,viewport:[1280,720],quality:'standard',requests,errors,warnings,stops,final};
    fs.writeFileSync(path.join(evidence,'circuit.json'),JSON.stringify(result,null,2));
    console.log('PASS full real-time circuit, three deliveries and safe disembark. '+JSON.stringify({seconds:result.wallSeconds,stats:final.stats}));
  }catch(error){fs.writeFileSync(path.join(evidence,'circuit-failure.json'),JSON.stringify({error:error.stack,errors,warnings,stops},null,2));console.error(error);process.exitCode=1;}
  finally{await context.close();await browser.close();}
})();
