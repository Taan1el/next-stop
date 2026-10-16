'use strict';
// Static GitHub Pages site: the same single-file game as index.html, with
// link-preview metadata and the preview image. Nothing else is required to play.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');

function makePages(directory=root,{siteUrl=process.env.PAGES_URL||''}={}){
  const html=fs.readFileSync(path.join(directory,'outputs/next-stop.html'),'utf8');
  const license=fs.readFileSync(path.join(directory,'LICENSE'),'utf8').trim();
  if(!html.includes(license))throw Error('HTML is missing the current license notice. Run npm run build first.');
  const {version}=JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8'));
  const base=siteUrl.replace(/\/?$/,'/'),image=siteUrl?base+'preview.png':'preview.png';
  const description='A small rural railway game made of coloured letters. Drive a steam train through fields, woods and mountain weather, or explore on foot. Plays offline in one HTML file.';
  const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const meta=[
    `<meta name="description" content="${escape(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="Next Stop · A world in letters">`,
    `<meta property="og:description" content="${escape(description)}">`,
    `<meta property="og:image" content="${escape(image)}">`,
    ...(siteUrl?[`<meta property="og:url" content="${escape(base)}">`]:[]),
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="generator" content="Next Stop ${escape(version)}">`
  ].join('\n');
  const title='<title>Next Stop · A world in letters</title>';
  if(!html.includes(title))throw Error('Built HTML title changed; update the Pages packager.');
  const out=path.join(directory,'dist/pages');
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'index.html'),html.replace(title,title+'\n'+meta));
  fs.copyFileSync(path.join(directory,'outputs/NEXT_STOP_PREVIEW.png'),path.join(out,'preview.png'));
  fs.writeFileSync(path.join(out,'.nojekyll'),'');
  return {directory:out,files:fs.readdirSync(out).sort()};
}

if(require.main===module){
  const {directory,files}=makePages();
  console.log(`Pages site ready in ${path.relative(root,directory)}: ${files.join(', ')}`);
  console.log('Open index.html#watch for the self-driving title view, e.g. inside a portfolio iframe.');
}
module.exports={makePages};
