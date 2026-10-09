'use strict';
// Dedicated process keeps real-time control polling alive throughout the circuit.
const {launchBrowser,fileURL}=require('./browser.cjs');
const path=require('node:path');
const runCycle=require('./playtest-cycle.cjs');
const root=path.resolve(__dirname,'..'),name=process.argv[2]||'05-field-journal';
if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid cycle evidence name');
(async()=>{
  const browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width:1280,height:720},offline:true});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const issues=[],requests=[];page.on('pageerror',e=>issues.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push(m.text());});page.on('request',r=>requests.push(r.url()));
  const timer=setInterval(()=>{const r=runCycle.active;if(r)console.log(JSON.stringify({cycle:name,status:r.status,stops:r.stops.length,discoveries:r.discoveries.length,next:r.current?.name,remaining:r.current?.distance,cameraClear:r.cameraOrbitClear}));},30000);
  try{
    await page.goto(fileURL(path.join(root,'outputs/next-stop.html')),{waitUntil:'domcontentloaded',timeout:60000});
    const result=await runCycle(page,{directory:path.join(root,'.omx/evidence/cycles',name),name,htmlPath:path.join(root,'outputs/next-stop.html'),visitJournal:true,allDiscoveries:true,operateEngine:true,overshootAndReverse:true,orbitCamera:true,issues,requests});
    console.log(JSON.stringify({status:result.status,seconds:result.wallSeconds,stops:result.stops.length,discoveries:result.discoveries.length,cameraClear:result.cameraOrbitClear,stats:result.final?.stats,error:result.error}));
    if(result.status!=='passed')process.exitCode=1;
  }finally{clearInterval(timer);await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
