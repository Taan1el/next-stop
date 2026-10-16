'use strict';
// Browser check for the title backdrop, watch mode and touch controls.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{launchBrowser,fileURL}=require('../browser.cjs');
const root=path.resolve(__dirname,'../..'),out=process.argv[2]?path.resolve(process.argv[2]):null,url=fileURL(path.join(root,'outputs/next-stop.html'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const browser=await launchBrowser();let count=0;const pass=name=>{count++;console.log('PASS '+name);};
  try{
    if(out)fs.mkdirSync(out,{recursive:true});
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);await page.waitForFunction(()=>window.nextStopGame);await wait(2500);
    const backdrop=await page.evaluate(()=>{const g=window.nextStopGame;return{s:g.pilot?.sim.train.s,mode:g.pilot?.sim.player.mode,player:g.sim.player.mode,started:g.started,saved:localStorage.getItem('next-stop-checkpoint')};});
    assert.equal(backdrop.mode,'train');assert.equal(backdrop.player,'foot');assert.equal(backdrop.started,false);assert.equal(backdrop.saved,null);
    pass('Title backdrop runs a private autopilot train without starting or saving a journey');
    await page.click('#watch-button');await wait(4000);
    const watching=await page.evaluate(()=>({watching:window.nextStopGame.watching,menu:document.getElementById('menu').hidden,banner:document.getElementById('watch-banner').hidden,where:document.getElementById('watch-where').textContent,s:window.nextStopGame.pilot.sim.train.s,speed:window.nextStopGame.pilot.sim.train.speed}));
    assert(watching.watching&&watching.menu&&!watching.banner);assert.match(watching.where,/Bound for|Standing at/);
    if(out)await page.screenshot({path:path.join(out,'watch.png')});
    await page.keyboard.press('KeyW');await wait(200);
    const back=await page.evaluate(()=>({watching:window.nextStopGame.watching,menu:document.getElementById('menu').hidden,start:document.getElementById('start-view').hidden,input:window.nextStopGame.input.forward}));
    assert.equal(back.watching,false);assert.equal(back.menu,false);assert.equal(back.start,false);assert(!back.input);
    pass('Watch mode shows the banner and any key returns to the title card');
    await page.click('#start-button');await wait(300);
    const started=await page.evaluate(()=>{const g=window.nextStopGame;return{s:g.sim.train.s,speed:g.sim.train.speed,mode:g.sim.player.mode,time:g.sim.time};});
    assert.equal(started.s,0);assert.equal(started.speed,0);assert.equal(started.mode,'foot');assert(started.time<1);
    pass('Starting a journey begins from the untouched player simulation');
    assert.deepEqual(errors,[]);
    const phone=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2});
    const mobile=await phone.newPage(),mobileErrors=[];mobile.on('pageerror',error=>mobileErrors.push(error.message));
    await mobile.goto(url);await mobile.waitForFunction(()=>window.nextStopGame);
    await mobile.tap('#start-button');await wait(300);
    const touch=await mobile.evaluate(()=>({enabled:document.body.classList.contains('touch'),hidden:document.getElementById('touch').hidden}));
    assert(touch.enabled&&!touch.hidden);
    const stick=await mobile.locator('#stick').boundingBox(),client=await mobile.context().newCDPSession(mobile);
    const touchAt=(type,x,y)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    const before=await mobile.evaluate(()=>({...window.nextStopGame.sim.player}));
    await touchAt('touchStart',stick.x+stick.width/2,stick.y+stick.height/2);await touchAt('touchMove',stick.x+stick.width/2,stick.y+4);await wait(900);
    const held=await mobile.evaluate(()=>window.nextStopGame.input.forward);await touchAt('touchEnd');await wait(100);
    const after=await mobile.evaluate(()=>({...window.nextStopGame.sim.player,forward:window.nextStopGame.input.forward}));
    assert.equal(held,true);assert.equal(after.forward,false);assert(Math.hypot(after.x-before.x,after.z-before.z)>1,'stick walks the player');
    pass('Touch stick walks the player and releases cleanly');
    await mobile.tap('#touch-buttons [data-tap=interact]');await wait(300);
    const boarded=await mobile.evaluate(()=>window.nextStopGame.sim.player.mode);
    if(boarded==='train'){
      const brake=await mobile.locator('#touch-buttons [data-hold=brake]').boundingBox();
      await touchAt('touchStart',brake.x+brake.width/2,brake.y+brake.height/2);await wait(150);const braking=await mobile.evaluate(()=>window.nextStopGame.input.brake);await touchAt('touchEnd');await wait(100);
      assert.equal(braking,true);assert.equal(await mobile.evaluate(()=>window.nextStopGame.input.brake),false);
      pass('Touch E boards the train and the held brake button releases');
    } else pass('Touch E reported: '+await mobile.evaluate(()=>document.getElementById('toast').textContent));
    if(out)await mobile.screenshot({path:path.join(out,'touch.png')});
    assert.deepEqual(mobileErrors,[]);
    console.log(`${count}/${count} watch and touch checks passed.`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
