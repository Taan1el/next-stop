'use strict';
// Test GPU ownership and failure evidence without pretending to render pixels.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const code = fs.readFileSync(path.join(root, 'work/src/renderer.js'), 'utf8');
function fixture(failFragment=0, unavailable=false) {
  let nextConstant=1, nextResource=1, fragments=0;
  const constants={}, resources=new Map(), deleted=new Set(), listeners=new Map(), logs=[];
  const make=kind=>{const value={kind,id:nextResource++};resources.set(value,kind);return value;};
  const remove=value=>{if(value)deleted.add(value);};
  const methods={
    createShader:type=>{const value=make('shader');value.type=type;if(type===gl.FRAGMENT_SHADER)value.fragment=++fragments;return value;},
    getShaderParameter:value=>!(value.fragment&&value.fragment===failFragment),
    getShaderInfoLog:()=>{logs.push('deliberate fragment compile failure');return 'deliberate fragment compile failure';},
    deleteShader:remove,createProgram:()=>make('program'),deleteProgram:remove,getProgramParameter:()=>true,
    createTexture:()=>make('texture'),deleteTexture:remove,
    createVertexArray:()=>make('vertex-array'),deleteVertexArray:remove,
    createFramebuffer:()=>make('framebuffer'),deleteFramebuffer:remove,
    getUniformLocation:()=>({}),getParameter:()=>4096,
    checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE,getError:()=>gl.NO_ERROR
  };
  const gl=new Proxy(methods,{get(target,key){if(key in target)return target[key];if(/^[A-Z0-9_]+$/.test(key))return constants[key]??(constants[key]=nextConstant++);return()=>{};}});
  const canvas={clientWidth:320,clientHeight:180,getContext:()=>unavailable?null:gl,
    addEventListener:(type,handler)=>listeners.set(type,handler),
    removeEventListener:(type,handler)=>{if(listeners.get(type)===handler)listeners.delete(type);}};
  const context={performance:{now:()=>0}};
  vm.createContext(context);vm.runInContext(code,context,{filename:'renderer.js'});
  const world=vm.runInContext('({resolution:2,size:10,waterLevel:0,heights:new Float32Array([0,0,0,0]),objects:[]})',context);
  return {create:()=>new context.NSGlyphRenderer(canvas,world),resources,deleted,listeners,logs};
}
const results=[];
function test(name,run){try{run();results.push(true);console.log(`PASS ${name}`);}catch(error){results.push(false);console.error(`FAIL ${name}\n${error.stack}`);}}
test('Normal renderer destruction releases every created GPU object and context listener once',()=>{
  const f=fixture(),renderer=f.create();renderer.destroy();renderer.destroy();
  assert.equal(f.listeners.size,0);
  for(const [resource,kind]of f.resources)assert(f.deleted.has(resource),`Leaked ${kind} on destroy.`);
});
for(const [fragment,name]of [[1,'scene'],[2,'display']])test(`${name} shader failure retains diagnostic and releases partial GPU/listener ownership`,()=>{
  const f=fixture(fragment);assert.throws(f.create,/deliberate fragment compile failure/);assert.equal(f.logs.length,1);
  for(const [resource,kind]of f.resources)assert(f.deleted.has(resource),`Leaked ${kind} on ${name} failure.`);
  assert.equal(f.listeners.size,0,'Failed constructor must detach context listeners.');
});
test('Restoration shader failure releases new partial resources and reports original diagnostic',()=>{
  const f=fixture(3),renderer=f.create();let reported=null;
  renderer.onError=error=>{reported=error;};
  // The browser discards all old GPU handles when the context is lost.
  for(const resource of f.resources.keys())f.deleted.add(resource);
  f.listeners.get('webglcontextlost')({preventDefault(){}});
  f.listeners.get('webglcontextrestored')();
  assert.match(reported?.message||'',/deliberate fragment compile failure/);
  for(const [resource,kind]of f.resources)assert(f.deleted.has(resource),`Leaked ${kind} on restoration failure.`);
  assert.equal(f.listeners.size,0,'Fatal restoration failure must detach renderer listeners.');
});
test('Unavailable WebGL2 reports requirement without registering listeners or resources',()=>{
  const f=fixture(0,true);assert.throws(f.create,/requires WebGL2/);assert.equal(f.resources.size,0);assert.equal(f.listeners.size,0);
});
const passed=results.filter(Boolean).length;
console.log(`${passed}/${results.length} renderer ownership/failure checks passed.`);
if(passed!==results.length)process.exitCode=1;
