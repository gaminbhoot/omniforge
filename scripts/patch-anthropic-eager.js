// Patch @ai-sdk/anthropic to disable eager_input_streaming by default
// Meta endpoint https://api.meta.ai rejects eager_input_streaming:true
// TrueForge 0.1.4 + anthropic SDK defaults to true when streaming — this sets default to false.
import { readFileSync, writeFileSync, existsSync } from 'fs';
const files = [
  'node_modules/@ai-sdk/anthropic/dist/index.js',
  'node_modules/@ai-sdk/anthropic/dist/internal/index.js'
];
let patched = 0;
for (const p of files) {
  if (!existsSync(p)) continue;
  let t = readFileSync(p, 'utf-8');
  const old = 'anthropicOptions.toolStreaming) != null ? _k : true)';
  const nw = 'anthropicOptions.toolStreaming) != null ? _k : false)';
  if (t.includes(old)) {
    t = t.replaceAll(old, nw);
    writeFileSync(p, t);
    console.log(`patched ${p}`);
    patched++;
  }
}
if (patched === 0) console.log('already patched or pattern not found');
else console.log(`patched ${patched} files — Meta endpoint will now accept tool calls`);
