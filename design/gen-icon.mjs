// gen-icon.mjs - one painted icon in the style of the app's own pictures (public/img/f-*.png as the reference).
// node gen-icon.mjs <prompt-file> <out.png>
import fs from 'fs';
const key = (fs.readFileSync('c:/workspace/BoostMind/scripts/design.env', 'utf8').match(/^OPENAI_API_KEY=(.*)$/m) || [])[1]?.trim();
const [pf, out, model = 'gpt-image-2.6-flare'] = process.argv.slice(2);
const fd = new FormData();
fd.append('model', model); fd.append('prompt', fs.readFileSync(pf, 'utf8')); fd.append('size', '1024x1024'); fd.append('quality', 'medium'); fd.append('background', 'transparent');
for (const f of ['f-scale.png', 'f-bowl.png', 'f-tape.png']) fd.append('image[]', new Blob([fs.readFileSync(new URL('../public/img/' + f, import.meta.url))], { type: 'image/png' }), f);
const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: 'Bearer ' + key }, body: fd });
const j = await r.json();
if (!r.ok) { console.error(r.status, JSON.stringify(j.error || j).slice(0, 400)); process.exit(1); }
fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', out);
