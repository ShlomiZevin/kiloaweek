// End-to-end check of the app on seeded data (mock store) + the real server in the emulator (real AI).
//   firebase emulators:start --only functions --project kiloaweek-app     (keys from functions/.secret.local)
//   VITE_MOCK=1 npx vite --port 5190
//   node tests/e2e.mjs [--no-ai] [--shots <dir>]
// Checks, on a small phone (360x640) and a big one (390x844): the header stays at the top and the tab bar at the bottom on
// every screen, home fits one screen with no scrolling, nothing scrolls sideways, no console errors, no banned words;
// then the flows: account menu -> its pages, before/after with drinks (saved while it runs), food from a saved meal and from
// a sentence, the coach's log cards (meal + weight) added with one tap.
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const BASE = 'http://localhost:5190';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const AI = !process.argv.includes('--no-ai');
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const ROUTES = ['/', '/journal', '/measure', '/food', '/insights', '/coach', '/goals', '/reminders', '/foods', '/install'];
const BANNED = ['פיפי', 'קקי', 'אקסל', 'לא דיאטה', 'ייבוא', 'ייצוא', 'השיטה - קילו בשבוע'];

let failed = 0, passed = 0;
const ok = (cond, what) => { if (cond) { passed++; console.log('  ✓', what); } else { failed++; console.log('  ✗', what); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', ignoreDefaultArgs: ['--hide-scrollbars'] });
async function phone(w, h) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource.*(404|net::)/.test(m.text())) p.errors.push(m.text().slice(0, 200)); });
  return p;
}
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png` }); };
const clickText = async (p, sel, text) => {
  const ok = await p.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find(e => e.textContent.includes(text)); if (el) { el.click(); return true; } return false; }, sel, text);
  if (!ok) throw new Error(`no ${sel} with "${text}"`);
};
const layout = p => p.evaluate(() => {
  const top = document.querySelector('.top').getBoundingClientRect(), nav = document.querySelector('.nav').getBoundingClientRect(), main = document.querySelector('.main');
  return { top: top.top, navBottom: nav.bottom, h: innerHeight, sideways: Math.max(document.documentElement.scrollWidth - innerWidth, ...[...document.querySelectorAll('.page *')].filter(e => !e.closest('.scroll-x, .again, .sheet')).map(e => e.getBoundingClientRect()).map(r => Math.max(-r.left, r.right - innerWidth))), mainScroll: main.scrollHeight - main.clientHeight, docScroll: document.documentElement.scrollHeight - innerHeight };
});

for (const [w, h] of [[360, 640], [390, 844]]) {
  console.log(`\n== ${w}x${h} ==`);
  const p = await phone(w, h);
  await p.goto(`${BASE}/?fresh`, { waitUntil: 'networkidle0' });
  await sleep(600);
  for (const r of ROUTES) {
    await p.evaluate(r => { history.pushState(null, '', r); dispatchEvent(new PopStateEvent('popstate')); }, r);
    await sleep(500);
    await p.evaluate(() => { const m = document.querySelector('.main'); m.scrollTop = m.scrollHeight; document.querySelector('.chat')?.scrollTo(0, 1e6); });
    await sleep(200);
    const L = await layout(p);
    ok(Math.abs(L.top) < 1 && Math.abs(L.navBottom - L.h) < 1 && L.docScroll <= 0, `${r}: header at the top, tab bar at the bottom after scrolling`);
    ok(L.sideways <= 0, `${r}: nothing scrolls sideways`);
    if (r === '/') ok(L.mainScroll <= 1, `/: home fits one screen (overflow ${L.mainScroll}px)`);
    const text = await p.evaluate(() => document.body.innerText);
    const bad = BANNED.filter(b => text.includes(b));
    ok(!bad.length, `${r}: no banned words${bad.length ? ' - found ' + bad.join(', ') : ''}`);
    await p.evaluate(() => document.querySelector('.main').scrollTo(0, 0));
    await shot(p, `${w}${r === '/' ? '-home' : r.replace('/', '-')}`);
  }
  ok(!(await p.evaluate(() => document.querySelectorAll('.starters, .chip').length && location.pathname === '/coach')), 'coach: no suggested questions');
  ok(!p.errors.length, `no console errors${p.errors.length ? ': ' + p.errors.join(' | ') : ''}`);
  await p.close();

  // a brand-new user: the "how to start" home still fits
  const e = await phone(w, h);
  await e.goto(`${BASE}/?empty`, { waitUntil: 'networkidle0' });
  await sleep(500);
  const LE = await layout(e);
  ok(LE.mainScroll <= 1, `new user: home fits one screen (overflow ${LE.mainScroll}px)`);
  await shot(e, `${w}-home-new`);
  await e.close();
}

console.log('\n== flows (390x844) ==');
const p = await phone(390, 844);
await p.goto(`${BASE}/?fresh`, { waitUntil: 'networkidle0' });
await sleep(500);

// account menu
await p.click('.avatar-btn'); await sleep(300);
const rows = await p.$$eval('.menu-row b', els => els.map(e => e.textContent));
ok(rows.includes('היעדים שלי') && rows.includes('תזכורות לשקילה') && rows.includes('הארוחות השמורות שלי'), `account menu: ${rows.join(' / ')}`);
ok(!!(await p.$('.logout')), 'account menu: sign out');
await shot(p, 'flow-menu');
await clickText(p, '.menu-row', 'היעדים שלי'); await sleep(300);
ok((await p.$eval('.page-head h1', e => e.textContent)) === 'היעדים שלי', 'menu -> goals page');
await p.click('.page-head .icon-btn'); await sleep(300);

// before / after with drinks
await clickText(p, '.nav button', 'לפני/אחרי'); await sleep(300);
const acts = await p.$$eval('.act-c', els => els.map(e => e.getAttribute('aria-label')));
ok(acts.slice(-2).every(a => a === 'שירותים') && acts[0] === 'ריצה', `activities: toilet ones last, no words (${acts.join(',')})`);
await p.click('.act-c'); await sleep(100);
await p.$eval('.wpad-num input', el => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, '82.1'); el.dispatchEvent(new Event('input', { bubbles: true })); });
await clickText(p, '.btn', 'התחלה'); await sleep(400);
await clickText(p, '.drinks .chip', '250'); await sleep(200);
await clickText(p, '.drinks .chip', '250'); await sleep(200);
await shot(p, 'flow-measure-live');
await p.reload({ waitUntil: 'networkidle0' }); await sleep(500);
const drink = await p.$eval('.drink-total', e => e.textContent).catch(() => '');
ok(drink.includes('500'), `drinks saved while it runs, even after reload (${drink})`);
await p.$eval('.wpad-num input', el => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, '81.4'); el.dispatchEvent(new Event('input', { bubbles: true })); });
await clickText(p, '.btn', 'סיימתי'); await sleep(400);
const net = await p.$eval('.result3 .v', e => e.textContent).catch(() => '');
ok(net.replace(/\D/g, '') === '1200', `result: 82.1 -> 81.4 + 500 ml = 1,200 g (${net})`);

// food from a saved meal
await clickText(p, '.nav button', 'אוכל'); await sleep(300);
const before = await p.$$eval('.card.meal', els => els.length);
await p.click('.again-chip'); await sleep(400);
ok((await p.$$eval('.card.meal', els => els.length)) === before + 1, 'food: a saved meal is added in one tap');

if (AI) {
  // food from a sentence (real AI, never asks back)
  await clickText(p, '.way', 'לכתוב'); await sleep(300);
  await p.type('.sheet textarea', 'חביתה וסלט');
  await clickText(p, '.sheet .btn', 'לספור');
  await p.waitForSelector('.sheet .macro3', { timeout: 60000 }).catch(() => {});
  const macros = await p.$$eval('.sheet .macro3 b', els => els.map(e => +e.textContent)).catch(() => []);
  ok(macros.length === 3 && macros[0] > 0, `food AI: protein / carbs / sugars = ${macros.join(' / ')}`);
  await shot(p, 'flow-food-ai');
  await clickText(p, '.sheet .btn', 'שמירה'); await sleep(400);
  ok((await p.$$eval('.card.meal b', els => els.map(e => e.textContent))).some(t => t.length), 'food AI: saved to the day');

  // the coach: log cards
  await clickText(p, '.top-actions .icon-btn', ''); await sleep(400);
  await p.type('.composer textarea', 'אכלתי לצהריים שקשוקה עם פרוסה');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.log-card .btn', { timeout: 60000 }).catch(() => {});
  ok(!!(await p.$('.log-card .btn')), 'coach: offers a meal card with "הוסף"');
  const reply = await p.$$eval('.msg.assistant', els => els.at(-1)?.textContent || '');
  ok(!/\?\s*$/.test(reply.trim()), `coach: doesn't end with a question ("${reply.slice(0, 80)}")`);
  await p.click('.log-card .btn'); await sleep(500);
  ok(!!(await p.$('.lc-done')), 'coach: the card is added in one tap');
  await p.type('.composer textarea', 'שקלתי עכשיו 81.4, שקילת ערב');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => [...document.querySelectorAll('.log-card')].some(c => c.textContent.includes('81.4')), { timeout: 60000 }).catch(() => {});
  ok(await p.evaluate(() => [...document.querySelectorAll('.log-card')].some(c => c.textContent.includes('81.4'))), 'coach: offers a weight card');
  await shot(p, 'flow-coach');
  await p.evaluate(() => [...document.querySelectorAll('.log-card')].find(c => c.textContent.includes('81.4'))?.querySelector('.btn')?.click()); await sleep(500);
  const ev = await p.evaluate(() => { const db = JSON.parse(localStorage.getItem('kaw-mock-v2')); const t = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()); return db.days.find(d => d.date === t)?.evening; });
  ok(ev === 81.4, `coach: weight card saved today's evening weight (${ev})`);
  const lib = await p.evaluate(() => JSON.parse(localStorage.getItem('kaw-mock-v2')).foods.map(f => f.he));
  ok(lib.length >= 4, `meal library has the new meals (${lib.join(', ')})`);
}
ok(!p.errors.length, `flows: no console errors${p.errors.length ? ': ' + p.errors.join(' | ') : ''}`);
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
