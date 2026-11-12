// gen.mjs - OpenAI GPT Image generations for KiloAWeek design.
// node gen.mjs <prompt-file> <out.png> [model] [size] [quality]
import fs from 'fs';
const envTxt = fs.readFileSync('c:/workspace/BoostMind/scripts/design.env', 'utf8');
const key = (envTxt.match(/^OPENAI_API_KEY=(.*)$/m) || [])[1]?.trim();
if (!key) { console.error('no key'); process.exit(1); }
const [pf, out, model = 'gpt-image-2.5-flare', size = '1024x1536', quality = 'medium'] = process.argv.slice(2);
const prompt = fs.readFileSync(pf, 'utf8');
const r = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
  body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
});
const j = await r.json();
if (!r.ok) { console.error(r.status, JSON.stringify(j.error || j).slice(0, 400)); process.exit(1); }
fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', out, model, j.usage ? JSON.stringify(j.usage) : '');
