'use strict';
const {launchBrowser,fileURL}=require('./browser.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'.omx/evidence/cycles/08-final-host');fs.mkdirSync(directory,{recursive:true});
(async()=>{
  const browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width:1280,height:720},offline:true});
  const page=await context.newPage();page.setDefaultTimeout(60000);
  const issues=[],requests=[];page.on('pageerror',e=>issues.push({type:'pageerror',text:e.message}));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push({type:m.type(),text:m.text()});});page.on('request',r=>requests.push(r.url()));
  const html=fs.readFileSync(path.join(root,'outputs/next-stop.html')),save=JSON.parse(fs.readFileSync(path.join(root,'work/qa/fixtures/world1-exploration.json'),'utf8'));
  const result={status:'running',bytes:html.length,sha256:crypto.createHash('sha256').update(html).digest('hex'),browser:browser.version()};
  try{
    await page.goto(fileURL(path.join(root,'outputs/next-stop.html')),{waitUntil:'domcontentloaded',timeout:60000});
    await page.evaluate(save=>{
      window.oldGame=nextStopGame;oldGame.destroy();window.oldFrames=oldGame.renderer.frames;
      window.hostSource=JSON.stringify(save);window.hostWrites=[];window.hostErrors=[];
      window.nextStopGame=NextStop.create({canvas:document.getElementById('world'),host:{readSave:async()=>hostSource,writeSave:async text=>hostWrites.push(text),onError:error=>hostErrors.push(error.message)}});
      nextStopGame.restore(save);nextStopGame.start();nextStopGame.openMenu('journal');
    },save);
    await page.waitForTimeout(250);
    result.recreated=await page.evaluate(()=>({oldDestroyed:oldGame.destroyed,oldListeners:oldGame.listeners.length,oldFramesUnchanged:oldGame.renderer.frames===oldFrames,newFrames:nextStopGame.renderer.frames,save:nextStopGame.serialize(),journalVisible:!nextStopGame.el['journal-view'].hidden}));
    assert(result.recreated.oldDestroyed&&result.recreated.oldListeners===0&&result.recreated.oldFramesUnchanged&&result.recreated.newFrames>0&&result.recreated.journalVisible);
    // This historical fixture predates steam/service fields. Restore adds the
    // documented assisted-freight defaults while preserving every old field.
    const upgraded={...save,railway:{version:1,service:'freight',cargo:'mixed',assisted:true,engine:{fire:.72,pressure:9.2,coal:100,water:100},lastStoke:-10,whistleUntil:-1,whistled:[],missed:[],overspeed:0,dwell:null,earnings:0,stops:[]}};
    assert.deepEqual(result.recreated.save,upgraded);
    const before=await page.evaluate(()=>JSON.stringify(nextStopGame.serialize()));
    const supported=await page.evaluate(()=>{window.lossExtension=nextStopGame.renderer.gl.getExtension('WEBGL_lose_context');if(!lossExtension)return false;lossExtension.loseContext();return true;});assert(supported,'Context loss extension unavailable');
    await page.waitForFunction(()=>nextStopGame.renderer.lost);await page.waitForTimeout(150);
    result.lost=await page.evaluate(()=>({running:nextStopGame.running,lost:nextStopGame.renderer.lost,save:JSON.stringify(nextStopGame.serialize())}));assert(!result.lost.running&&result.lost.lost);assert.equal(result.lost.save,before);
    await page.evaluate(()=>lossExtension.restoreContext());await page.waitForFunction(()=>!nextStopGame.renderer.lost);await page.waitForTimeout(350);
    result.restored=await page.evaluate(()=>({running:nextStopGame.running,save:JSON.stringify(nextStopGame.serialize()),gl:nextStopGame.renderer.gl.getError(),journalVisible:!nextStopGame.el['journal-view'].hidden}));assert(!result.restored.running&&result.restored.journalVisible&&result.restored.gl===0);assert.equal(result.restored.save,before);
    await page.screenshot({path:path.join(directory,'restored-journal.png'),scale:'css'});
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Settings',exact:true}).click();
    const expectedHost=await page.evaluate(()=>nextStopGame.serialize());await page.locator('#export').click();await page.waitForFunction(()=>hostWrites.length===1);
    result.hostExport=await page.evaluate(()=>{hostSource=hostWrites[0];return JSON.parse(hostWrites[0]);});assert.deepEqual(result.hostExport,expectedHost);
    await page.locator('#high-contrast').check();await page.locator('#import').click();await page.waitForFunction(()=>document.getElementById('menu-status').textContent==='Host save restored.');
    result.hostImport=await page.evaluate(()=>({save:nextStopGame.serialize(),errors:hostErrors,gl:nextStopGame.renderer.gl.getError()}));assert.deepEqual(result.hostImport.save,expectedHost);assert.deepEqual(result.hostImport.errors,[]);assert.equal(result.hostImport.gl,0);
    result.issues=issues;result.requests=requests;assert.deepEqual(issues,[]);assert(requests.every(u=>u.startsWith('file:')));
    result.status='passed';
  }catch(error){result.status='failed';result.error=error.stack;result.issues=issues;process.exitCode=1;}
  finally{fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,bytes:result.bytes,browser:result.browser,issues:result.issues,error:result.error}));await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
