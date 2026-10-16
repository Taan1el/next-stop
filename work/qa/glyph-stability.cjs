'use strict';
// Measures letter flicker: render each viewpoint, nudge the camera by a few
// centimetres, and count cells whose glyph changes while the material stays put.
const path=require('node:path'),{launchBrowser,fileURL}=require('../browser.cjs');
const root=path.resolve(__dirname,'../..'),limit=Number(process.env.GLYPH_FLICKER_LIMIT||.05);
(async()=>{
  const browser=await launchBrowser();
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.goto(fileURL(path.join(root,'outputs/next-stop.html')));
    await page.waitForFunction(()=>window.nextStopGame&&window.nextStopGame.renderer);
    const results=await page.evaluate(()=>{
      const game=window.nextStopGame,renderer=game.renderer,sim=game.sim,world=game.world;
      const views=[];
      const route=s=>world.routeAt(s);
      for(const s of [40,260,640,980,1400]){
        const p=route(s),ahead=route(s+30);
        views.push({name:'chase '+s,position:[p.x-Math.sin(p.yaw)*16,p.y+6,p.z-Math.cos(p.yaw)*16],target:[ahead.x,ahead.y+1.5,ahead.z]});
        views.push({name:'foot '+s,position:[p.x+Math.cos(p.yaw)*6,world.heightAt(p.x+Math.cos(p.yaw)*6,p.z-Math.sin(p.yaw)*6)+1.68,p.z-Math.sin(p.yaw)*6],target:[ahead.x+Math.cos(p.yaw)*40,p.y+1,ahead.z-Math.sin(p.yaw)*40]});
      }
      const out=[];
      for(const view of views){
        const frame=offset=>{const dir=view.target.map((v,i)=>v-view.position[i]),len=Math.hypot(...dir),step=dir.map(v=>v/len*offset);
          renderer.render(sim,{position:view.position.map((v,i)=>v+step[i]),target:view.target.map((v,i)=>v+step[i])},{quality:'standard'});return renderer.inspectCells();};
        const a=frame(0),b=frame(.05);let same=0,changed=0;
        for(let i=0;i<a.ids.length;i++)if(a.materials[i]!==0&&a.materials[i]===b.materials[i]){same++;if(a.ids[i]!==b.ids[i])changed++;}
        out.push({view:view.name,cells:same,flicker:same?changed/same:0});
      }
      return out;
    });
    let total=0;for(const r of results){total+=r.flicker;console.log(`${r.view.padEnd(10)} ${(r.flicker*100).toFixed(1).padStart(5)}% of ${r.cells} lit cells changed glyph for a 5 cm move`);}
    const mean=total/results.length;console.log(`Mean flicker ${(mean*100).toFixed(2)}%`);
    if(limit&&mean>limit){console.error(`FAIL glyph flicker ${(mean*100).toFixed(2)}% exceeds ${(limit*100).toFixed(2)}%`);process.exitCode=1;}
    else console.log('PASS glyph stability measured');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
