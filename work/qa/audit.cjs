'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const htmlPath = path.resolve(root, process.argv[2] || 'outputs/next-stop.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
assert.equal(scripts.length, 1, 'Exactly one inline runtime script is expected.');
assert(!/\bsrc\s*=/i.test(scripts[0][1]), 'Runtime script must be inline.');
assert(!html.includes('/*__CODE__*/'), 'Build placeholder must be replaced.');
assert(!/<(?:img|image|svg|video|audio|iframe|object|embed)\b/i.test(html), 'No imported visual or embedded runtime elements.');
assert(!/<link\b[^>]*\b(?:href|rel)\s*=/i.test(html), 'No companion stylesheets, fonts or preload assets.');
assert(!/\b(?:src|srcset)\s*=\s*["'][^"']+["']/i.test(html), 'No companion source resources.');
assert(!/data:(?:image|video|audio|font)\//i.test(html), 'No encoded media or fonts.');
assert(!/@import\b|@font-face\b|\burl\s*\(/i.test(html), 'CSS must not request external assets.');
const code = scripts[0][2];
new vm.Script(code, { filename: htmlPath });
// These tokens correspond to runtime dependency/network/image entry points.
// The audit is deliberately a focused source check, not a security sandbox.
for (const [name, pattern] of [
  ['module imports', /(?:^|[;\n])\s*(?:import\b|export\b)|\bimport\s*\(/],
  ['CommonJS runtime dependencies', /\brequire\s*\(/],
  ['network APIs', /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/],
  ['image decode/drawing APIs', /\b(?:drawImage|createImageBitmap|ImageBitmap|ImageData|OffscreenCanvas)\b|\bnew\s+Image\s*\(/],
  ['rendering/physics engines', /\b(?:THREE|BABYLON|PIXI|Phaser|CANNON|Ammo|UnityLoader|Godot)\b/],
  ['external runtime URLs', /https?:\/\//]
]) assert(!pattern.test(code), `${name} found in runtime source.`);
assert(/connect-src\s+'none'/.test(html), 'Offline connection policy must be present.');
assert(/img-src\s+'none'/.test(html), 'Image request policy must be present.');
console.log(`PASS standalone packaging/source audit: ${htmlPath}`);
console.log(`Inline runtime parses; ${Buffer.byteLength(html)} bytes; no detected dependency, media, network, import or engine entry points.`);
console.log('Direct glyph pipeline, numerical texture contents and bounded scene queries require independent renderer review and browser evidence.');
