'use strict';
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const channels=new Set(['chrome','msedge','chromium']);

async function launchBrowser(){
  const options={headless:true,channel:'chromium'};
  if(process.env.NEXT_STOP_BROWSER_PATH)options.executablePath=process.env.NEXT_STOP_BROWSER_PATH;
  else if(process.env.NEXT_STOP_BROWSER_CHANNEL){
    const channel=process.env.NEXT_STOP_BROWSER_CHANNEL;
    if(!channels.has(channel))throw Error('NEXT_STOP_BROWSER_CHANNEL must be chromium, chrome or msedge.');
    options.channel=channel;
  }
  try{return await chromium.launch(options);}
  catch(error){throw new Error('Browser launch failed. Run npm ci and npx playwright install chromium, or set NEXT_STOP_BROWSER_CHANNEL / NEXT_STOP_BROWSER_PATH. '+error.message,{cause:error});}
}

module.exports={launchBrowser,fileURL:file=>pathToFileURL(file).href};
