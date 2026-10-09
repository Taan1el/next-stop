'use strict';
const {launchBrowser,fileURL}=require('./browser.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'.omx/evidence/cycles/28-legacy3-render');fs.mkdirSync(directory,{recursive:true});
(async()=>{
 const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1280,height:720},offline:true}),page=await context.newPage(),issues=[];
 page.on('pageerror',e=>issues.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))issues.push(m.text());});const html=fs.readFileSync(path.join(root,'outputs/next-stop.html')),saved=JSON.parse(fs.readFileSync(path.join(root,'work/qa/fixtures/world3-completed.json'),'utf8')),saveFile=path.join(directory,'world3.json');fs.writeFileSync(saveFile,JSON.stringify(saved));
 const result={status:'running',bytes:html.length,sha256:crypto.createHash('sha256').update(html).digest('hex'),inspection:'Import of an existing completed world3 save, not a new circuit',issues};
 try{
  await page.goto(fileURL(path.join(root,'outputs/next-stop.html')),{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('button',{name:'Start journey',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Settings',exact:true}).click();const chooser=page.waitForEvent('filechooser');await page.locator('#import').click();await(await chooser).setFiles(saveFile);await page.waitForTimeout(300);
  result.restored=await page.evaluate(()=>({save:nextStopGame.serialize(),version:nextStopGame.world.version,checksum:nextStopGame.world.checksum(),gl:nextStopGame.renderer.gl.getError()}));assert.equal(result.restored.version,3);assert.equal(result.restored.checksum,'0d37a594');assert.deepEqual(result.restored.save,saved);assert.equal(result.restored.gl,0);
  await page.keyboard.press('Escape');await page.waitForTimeout(300);await page.screenshot({path:path.join(directory,'world3.png')});assert.deepEqual(issues,[]);result.status='passed';
 }catch(error){result.status='failed';result.error=error.stack;process.exitCode=1;}
 finally{fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,version:result.restored?.version,error:result.error}));await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
