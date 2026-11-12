// gen-ref.mjs - a GPT Image screen that keeps the picked concept (A, Flare) as its design reference.
// node gen-ref.mjs <prompt-file> <out.png> [model] [quality]
import fs from 'fs';
const envTxt = fs.readFileSync('c:/workspace/BoostMind/scripts/design.env', 'utf8');
const key = (envTxt.match(/^OPENAI_API_KEY=(.*)$/m) || [])[1]?.trim();
if (!key) { console.error('no key'); process.exit(1); }
const [pf, out, model = 'gpt-image-2.6-flare', quality = 'medium'] = process.argv.slice(2);
const fd = new FormData();
fd.append('model', model);
fd.append('prompt', fs.readFileSync(pf, 'utf8'));
fd.append('size', '1024x1536');
fd.append('quality', quality);
fd.append('image[]', new Blob([fs.readFileSync(new URL('./concept-A-flare.jpg', import.meta.url))], { type: 'image/jpeg' }), 'concept-A.jpg');
const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: 'Bearer ' + key }, body: fd });
const j = await r.json();
if (!r.ok) { console.error(r.status, JSON.stringify(j.error || j).slice(0, 400)); process.exit(1); }
fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', out, model, j.usage ? JSON.stringify(j.usage) : '');
