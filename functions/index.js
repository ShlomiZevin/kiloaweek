// KiloAWeek server. It RUNS in the Shlomiverse project (boostmind-b052c, codebase "kiloaweek" - his call 2026-11-12:
// "put it on the same servers the Shlomiverse uses") but works on the app's own project, kiloaweek-app: verifies its
// Google sign-ins and reads/writes its Firestore (the runtime service account has roles/datastore.user there).
// All behind Google sign-in:
//   POST /meal       a plate photo or a sentence -> protein / carbs / sugars / calories per item + a verdict (never asks back)
//   POST /chat       the coach (knows the method + the user's own numbers); offers log cards (meal / weight / water) to add in one tap
//   POST /transcribe a voice message -> Hebrew text (gpt-4o-transcribe)
//   POST /analysis   the multi-day analyst: night burn, day gain, food, sleep and the trend over weeks -> conclusions
//   POST /push/test  a test notification to this user's devices
// and kawReminders, every 15 minutes: the morning / evening weigh-in push for whoever hasn't weighed yet.
// OpenAI: VERSE_SITE_OPENAI_KEY (his rule: a new live feature takes the site key). Push: web-push, private key KAW_VAPID_PRIVATE.
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { BIBLE } from './bible.js';

initializeApp({ projectId: 'kiloaweek-app' });
const db = getFirestore();
const OPENAI_KEY = defineSecret('VERSE_SITE_OPENAI_KEY');
const VAPID_PRIVATE = defineSecret('KAW_VAPID_PRIVATE');
const VAPID_PUBLIC = 'BBXfbmc09kPKkwBl4DkdtCTC-jbBfcF5U0ZxrrgmaxpUFs59dOwCHDHTAuj2VLGpT98_eaVnFCK9a7Nyzpg2LAY';
const MODEL = 'gpt-5.6-terra';
const DAILY_AI_LIMIT = 120; // AI calls per user per day
const REGION = 'me-west1';
const TZ = 'Asia/Jerusalem';

// ── helpers ───────────────────────────────────────────────────────
function israelNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

async function authUid(req) {
  const h = req.get('authorization') || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return null;
  // local emulator only: the dev build's mock user
  if (process.env.FUNCTIONS_EMULATOR === 'true' && m[1].startsWith('dev:')) return m[1].slice(4);
  try { return (await getAuth().verifyIdToken(m[1])).uid; } catch { return null; }
}

async function takeQuota(uid) {
  const { date } = israelNow();
  const ref = db.doc(`users/${uid}/usage/${date}`);
  return db.runTransaction(async t => {
    const s = await t.get(ref);
    const n = (s.exists ? s.data().ai : 0) || 0;
    if (n >= DAILY_AI_LIMIT) return false;
    t.set(ref, { ai: n + 1, at: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
}

async function openai(input, { json = false, effort = 'low', maxTokens = 1500 } = {}) {
  const body = { model: MODEL, input, reasoning: { effort }, max_output_tokens: maxTokens };
  if (json) body.text = { format: { type: 'json_object' } };
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY.value()}` },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`openai ${r.status}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  const text = (j.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n').trim();
  return { text, usage: j.usage };
}

function parseJson(s) {
  try { return JSON.parse(s); } catch {}
  const m = String(s).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

const isImage = v => typeof v === 'string' && /^data:image\/(png|jpe?g|webp|heic|heif);base64,/.test(v) && v.length < 6_000_000;

// ── the prompts (fixed text first, always identical) ──────────────
const MEAL_JSON = '{"he":"<שם קצר לארוחה, 2-5 מילים, בלי כמויות>","items":[{"he":"<פריט + כמות משוערת>","protein":<גרם>,"carbs":<גרם>,"sugar":<גרם>,"calories":<מספר>}],' +
  ' "verdict":"ok|warn|no","why":"<משפט אחד פשוט בעברית: מה טוב בארוחה ומה כדאי לשים לב אליו>"}';
const MEAL_RULES = [
  'סופרים בעיקר חלבון, פחמימות וסוכרים (בגרם) - וגם קלוריות. לכל פריט בנפרד.',
  'sugar = סוכרים (כולל סוכר טבעי של פרי/חלב), והוא חלק מ-carbs.',
  'כמות שהמשתמש ציין - מכבדים אותה. כמות שלא ציין - משלימים מהיגיון למנה ממוצעת ישראלית רגילה, וכותבים את ההנחה בשם הפריט ("חזה עוף (~150 ג׳)").',
  'אף פעם לא שואלים שאלות ולא מבקשים פירוט. תמיד מחזירים הערכה.',
  'ב-why ובכל טקסט למשתמש: אף פעם לא המילים "בשיטה", "לא בשיטה", "מתאים לשיטה" או "השיטה" - המשתמש לא יודע מה זה. אומרים במילים פשוטות מה טוב ומה כדאי לשים לב (למשל "הפרוסה מוסיפה פחמימות").',
  'verdict: ok = מתאים לשיטה. warn = בסדר אבל לשים לב (שמן נסתר, רוטב, כמות גדולה, פרי בכמות, טחינה/תמרים לא במידה, ממתק "דיאטטי" מסחרי).',
  'no = לא בשיטה (סוכר, לחם/פיתה/פסטה/תפוחי אדמה, טיגון בשמן, מאפים, מתוקים עם סוכר).',
  'אם המשתמש כתב שזה צ׳יט דיי - verdict הוא ok ו-why אומר שזה יום חופשי, בלי רגשות אשם.',
];
const MEAL_SYS = [
  'אתה מנתח הארוחות של אפליקציית "קילו בשבוע". זו השיטה שהמשתמש עובד לפיה:',
  BIBLE,
  '',
  '== התפקיד שלך ==',
  'המשתמש שולח תמונה של הצלחת או מספר מה אכל. אתה מחזיר JSON בלבד (בלי טקסט מסביב):',
  MEAL_JSON,
  ...MEAL_RULES,
].join('\n');

const COACH_SYS = [
  'את המאמנת של אפליקציית "קילו בשבוע" - מאמנת AI לשיטה אישית לירידה במשקל. זו השיטה, ואת עובדת רק לפיה:',
  BIBLE,
  '',
  '== איך את מדברת ==',
  '- עברית בלבד, קצר ומעשי: 1-4 משפטים, או רשימה קצרה כשמבקשים תפריט/רעיונות. בלי הקדמות, בלי "שאלה מצוינת".',
  '- חברה שמכירה את השיטה, לא דיאטנית שמטיפה. בלי רגשות אשם, במיוחד על צ׳יט דיי.',
  '- לא נודניקית: אף פעם לא שואלת שאלות הבהרה על כמויות או פרטים - משלימה מהיגיון. אף פעם לא מסיימת בשאלה או בהצעה ("רוצה ש...?", "אם תרצי...") ולא מציעה שאלות המשך.',
  '- כשיש נתונים של המשתמש (למטה) - תשתמשי בהם ובמספרים שלו. אל תמציאי מספרים שאין.',
  '- המשקל היומי עולה ויורד - תמיד להחזיר את המבט למגמה השבועית (יעד: 700 גרם עד קילו בשבוע).',
  '- שריפה לילית = משקל ערב אתמול פחות משקל בוקר היום. אם היא עולה אחרי ימי כוח - הכוח עובד בשבילו; אם אחרי אירובי - האירובי.',
  '- שאלות רפואיות (תרופות, מחלות, הריון, הפרעות אכילה) - משפט אחד שמפנה לרופא, ואז מה שכן אפשר לפי השיטה.',
  '- בארוחות סופרים בעיקר חלבון, פחמימות וסוכרים.',
  '- אף פעם לא המילים "בשיטה", "לא בשיטה", "מתאים לשיטה" - המשתמש לא יודע מה זה. אומרים במילים פשוטות מה טוב ומה כדאי לשים לב (למשל "הפרוסה מוסיפה פחמימות").',
  '',
  '== תיעוד ==',
  'כשהמשתמש מספר שעשה משהו שנרשם באפליקציה - את מציעה לו כרטיס תיעוד (logs), והוא מוסיף אותו בלחיצה. את לא כותבת "רשמתי" - את כותבת שהכנת לו את זה להוספה.',
  'סוגים: ארוחה שאכל (תמונה של צלחת, "אכלתי...", "היה לי לצהריים...") · שקילה ("שקלתי 81.4", slot = morning אם זה בבוקר או נאמר בוקר, evening אם ערב) · מים ששתה (מ״ל, כוס = 250).',
  'שאלה בלבד ("מה לאכול?", "זה בסדר?") או התלבטות לפני שאכל - בלי logs.',
  'ארוחה בלי פירוט - משלימים למנה ממוצעת הגיונית, בלי לשאול.',
  ...MEAL_RULES.slice(0, 3),
  '',
  '== פלט: JSON בלבד ==',
  '{"reply":"<התשובה שלך בעברית>","logs":[]}',
  'כל פריט ב-logs הוא אחד מאלה:',
  '{"kind":"meal","meal":' + MEAL_JSON + '}',
  '{"kind":"weight","slot":"morning|evening","kg":<מספר>}',
  '{"kind":"water","ml":<מספר>}',
  'verdict: ok = בשיטה. warn = לשים לב (שמן נסתר, רוטב, כמות). no = לא בשיטה (סוכר, לחם/פיתה/פסטה/תפו״א, טיגון, מאפים).',
  'מה שכתבת ב-reply וה-verdict חייבים להסכים: אם כתבת שהארוחה טובה - verdict הוא ok.',
].join('\n');

const n0 = v => Math.max(0, Math.round(Number(v) || 0));
/** A meal from the model -> the app's shape (totals = the sum of the items). */
function cleanMeal(p, fallbackName = 'ארוחה') {
  if (!p || typeof p !== 'object') return null;
  const items = (Array.isArray(p.items) ? p.items : []).slice(0, 20).filter(i => i && typeof i.he === 'string')
    .map(i => ({ he: i.he.slice(0, 80), protein: n0(i.protein), carbs: n0(i.carbs), sugar: n0(i.sugar), calories: n0(i.calories) }));
  if (!items.length) return null;
  const sum = k => items.reduce((a, i) => a + i[k], 0);
  return {
    he: String(p.he || fallbackName).slice(0, 80), items,
    protein: sum('protein'), carbs: sum('carbs'), sugar: sum('sugar'), calories: sum('calories'),
    verdict: ['ok', 'warn', 'no'].includes(p.verdict) ? p.verdict : 'warn',
    why: String(p.why || '').slice(0, 240),
  };
}

// ── API ───────────────────────────────────────────────────────────
async function handleMeal(uid, b) {
  const text = typeof b.text === 'string' ? b.text.trim().slice(0, 800) : '';
  const image = isImage(b.image) ? b.image : null;
  if (!text && !image) return [400, { error: 'missing text or image' }];
  const content = [];
  if (image) content.push({ type: 'input_image', image_url: image, detail: 'low' });
  content.push({ type: 'input_text', text: text ? `אכלתי: ${text}${b.cheat ? '\n(היום צ׳יט דיי)' : ''}` : `זו הצלחת שלי.${b.cheat ? ' (היום צ׳יט דיי)' : ''}` });
  const { text: out } = await openai([
    { role: 'system', content: [{ type: 'input_text', text: MEAL_SYS }] },
    { role: 'user', content },
  ], { json: true });
  const meal = cleanMeal(parseJson(out), text || 'ארוחה');
  if (!meal) return [502, { error: 'לא הצלחתי לנתח, נסו שוב' }];
  return [200, { meal }];
}

async function handleChat(uid, b) {
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-16)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .map(m => ({ role: m.role, text: m.text.slice(0, 2000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return [400, { error: 'no question' }];
  const context = typeof b.context === 'string' ? b.context.slice(0, 6000) : '';
  const image = isImage(b.image) ? b.image : null;
  const input = [{ role: 'system', content: [{ type: 'input_text', text: COACH_SYS }] }];
  msgs.forEach((m, i) => {
    const last = i === msgs.length - 1;
    if (m.role === 'assistant') { input.push({ role: 'assistant', content: [{ type: 'output_text', text: m.text }] }); return; }
    const content = [];
    if (last && context) content.push({ type: 'input_text', text: `== הנתונים שלי עכשיו (מהאפליקציה) ==\n${context}\n== עד כאן הנתונים ==` });
    if (last && image) content.push({ type: 'input_image', image_url: image, detail: 'low' });
    content.push({ type: 'input_text', text: m.text });
    input.push({ role: 'user', content });
  });
  const deep = !!b.research;
  const { text } = await openai(input, { json: true, effort: deep ? 'medium' : 'low', maxTokens: deep ? 4000 : 1800 });
  const p = parseJson(text) || { reply: text };
  const logs = [];
  for (const l of (Array.isArray(p.logs) ? p.logs : []).slice(0, 4)) {
    if (l?.kind === 'meal') { const meal = cleanMeal(l.meal); if (meal) logs.push({ kind: 'meal', meal }); }
    else if (l?.kind === 'weight' && Number(l.kg) > 25 && Number(l.kg) < 350) logs.push({ kind: 'weight', slot: l.slot === 'evening' ? 'evening' : 'morning', kg: Math.round(Number(l.kg) * 10) / 10 });
    else if (l?.kind === 'water' && Number(l.ml) > 0) logs.push({ kind: 'water', ml: Math.min(5000, n0(l.ml)) });
  }
  return [200, { reply: String(p.reply || 'לא הצלחתי לענות הפעם, נסו שוב.').slice(0, 6000), logs }];
}

// Voice message -> Hebrew text (the app then sends it to the coach like a typed message).
async function handleTranscribe(uid, b) {
  const m = typeof b.audio === 'string' && b.audio.match(/^data:(audio\/[\w.+-]+)(?:;[^,]*)?;base64,(.+)$/);
  if (!m) return [400, { error: 'no audio' }];
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 8_000_000) return [413, { error: 'ההקלטה ארוכה מדי' }];
  const ext = /mp4|m4a|aac/.test(m[1]) ? 'm4a' : /ogg/.test(m[1]) ? 'ogg' : /wav/.test(m[1]) ? 'wav' : /mpeg|mp3/.test(m[1]) ? 'mp3' : 'webm';
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: m[1].split(';')[0] }), `voice.${ext}`);
  fd.append('model', 'gpt-4o-transcribe');
  fd.append('language', 'he');
  fd.append('prompt', 'קילו בשבוע. שקילה, שריפה לילית, קוטג׳, טחינה, שיבולת שועל, צ׳יט דיי, חזה עוף, סלט, קלוריות.');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${OPENAI_KEY.value()}` }, body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(`transcribe ${r.status}: ${JSON.stringify(j.error || j).slice(0, 200)}`);
  return [200, { text: String(j.text || '').trim().slice(0, 2000) }];
}

// The analyst: looks at weeks, not at one morning. The app sends the numbers (it already holds them, computed the same
// way the screens show them) plus what its own code found (stalls on plan and what followed them before).
const ANALYST_SYS = [
  'את האנליסטית של אפליקציית "קילו בשבוע". זו השיטה שהמשתמש עובד לפיה:',
  BIBLE,
  '',
  '== התפקיד שלך ==',
  'לקרוא את הנתונים של כמה שבועות כתמונה אחת - לא יום אחד - ולהגיד לו מה באמת קורה בגוף שלו ומה לעשות.',
  'מה בודקים:',
  '1. המגמה: ממוצע 7 ימים, ירידה שבועית מול היעד (700 גרם עד קילו).',
  '2. שריפה לילית (ערב אתמול פחות בוקר היום) ועלייה יומית (בוקר עד ערב) - הממוצעים, השינוי לאורך השבועות, ומה משפיע עליהם:',
  '   שינה (שעות), ימי כוח / אירובי / מנוחה ביום שלפני, כמה אכל וכמה מהאוכל היה בשיטה, צ׳יט דיי.',
  '3. תקיעה בזמן שהוא בתוכנית: כשהוא בדפיציט ואוכל לפי השיטה - המשקל יכול לעמוד כמה ימים (מים, מלח, עייפות, שריר) ואז לרדת בבת אחת.',
  '   אם הנתונים מראים שהוא באמת בתוכנית (אוכל בשיטה, קלוריות סבירות, שריפה לילית רגילה) - תרגיעי אותו: זה צפוי, ממשיכים בדיוק אותו דבר.',
  '   אם בעבר היו תקיעות כאלה - תגידי כמה ימים הן נמשכו ומה קרה אחריהן (המספרים מופיעים בממצאי הקוד).',
  '   אם הוא לא באמת בתוכנית (ארוחות מחוץ לשיטה, קלוריות גבוהות, הרבה מתוקים, צ׳יט שהתארך) - תגידי את זה בעדינות ובבירור.',
  '4. חוסר נתונים: אם חסרים ימים, שקילות ערב, שינה או אוכל - תגידי מה בדיוק כדאי להוסיף כדי שהניתוח יהיה טוב יותר.',
  'כללים: רק מהנתונים שקיבלת, אל תמציאי מספרים. עברית פשוטה וחמה, בלי הטפה, בלי מונחים רפואיים. מספרים בגרם או ק״ג כמו שקיבלת.',
  'פלט: JSON בלבד:',
  '{"status":"on_track|stall_on_plan|off_plan|not_enough_data","headline":"<משפט אחד - השורה התחתונה>",',
  ' "insights":[{"title":"<כותרת קצרה>","text":"<1-2 משפטים עם המספרים שלו>"}],',
  ' "calm":"<אם זו תקיעה בזמן תוכנית - משפט הרגעה מבוסס נתונים, אחרת null>",',
  ' "next":["<פעולה מעשית לימים הקרובים>"],"missing":"<מה חסר בנתונים, או null>"}',
  'insights: 3 עד 6. next: 1 עד 3.',
].join('\n');

async function handleAnalysis(uid, b) {
  const data = typeof b.data === 'string' ? b.data.slice(0, 24000) : '';
  if (!data) return [400, { error: 'no data' }];
  const { text } = await openai([
    { role: 'system', content: [{ type: 'input_text', text: ANALYST_SYS }] },
    { role: 'user', content: [{ type: 'input_text', text: data }] },
  ], { json: true, effort: 'medium', maxTokens: 5000 });
  const p = parseJson(text);
  if (!p) return [502, { error: 'bad answer' }];
  const S = ['on_track', 'stall_on_plan', 'off_plan', 'not_enough_data'];
  return [200, {
    status: S.includes(p.status) ? p.status : 'not_enough_data',
    headline: String(p.headline || '').slice(0, 300),
    insights: (Array.isArray(p.insights) ? p.insights : []).slice(0, 6).map(i => ({ title: String(i?.title || '').slice(0, 80), text: String(i?.text || '').slice(0, 400) })),
    calm: p.calm ? String(p.calm).slice(0, 400) : null,
    next: (Array.isArray(p.next) ? p.next : []).slice(0, 3).map(x => String(x).slice(0, 200)),
    missing: p.missing ? String(p.missing).slice(0, 300) : null,
  }];
}

async function sendToUser(uid, payload) {
  webpush.setVapidDetails('mailto:noreply@kiloaweek.app', VAPID_PUBLIC, VAPID_PRIVATE.value());
  const subs = await db.collection(`users/${uid}/push`).get();
  let sent = 0;
  await Promise.all(subs.docs.map(async d => {
    try { await webpush.sendNotification(d.data().sub, JSON.stringify(payload), { TTL: 3600, urgency: 'normal' }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await d.ref.delete(); }
  }));
  return sent;
}

const ORIGINS = [/^https:\/\/kiloaweek-app\.(web\.app|firebaseapp\.com)$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
export const kawApi = onRequest({ region: REGION, secrets: [OPENAI_KEY, VAPID_PRIVATE], memory: '512MiB', timeoutSeconds: 120, cors: ORIGINS }, async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const uid = await authUid(req);
    if (!uid) return res.status(401).json({ error: 'sign in' });
    const path = req.path.replace(/^\/api/, '');
    const b = req.body || {};
    if (path === '/push/test') {
      const sent = await sendToUser(uid, { title: 'קילו בשבוע', body: 'ההתראות עובדות. נתראה בשקילת הבוקר.', url: '/' });
      return res.json({ sent });
    }
    const H = { '/meal': handleMeal, '/chat': handleChat, '/analysis': handleAnalysis, '/transcribe': handleTranscribe }[path];
    if (!H) return res.status(404).json({ error: 'not found' });
    if (!(await takeQuota(uid))) return res.status(429).json({ error: 'הגעת למכסה היומית, נמשיך מחר' });
    const [status, out] = await H(uid, b);
    res.status(status).json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal' });
  }
});

// ── reminders ─────────────────────────────────────────────────────
// Each user: { reminders: { on, morning: "07:30", evening: "22:00" }, sent: { morning: date, evening: date } }.
// A reminder goes out once a day, in the 15 minutes after its time, only if that weigh-in isn't in yet.
const toMin = hm => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

export const kawReminders = onSchedule({ region: REGION, schedule: 'every 15 minutes', timeZone: TZ, secrets: [VAPID_PRIVATE] }, async () => {
  const now = israelNow();
  const users = await db.collection('users').where('reminders.on', '==', true).get();
  for (const u of users.docs) {
    const d = u.data();
    const day = (await db.doc(`users/${u.id}/days/${now.date}`).get()).data() || {};
    for (const slot of ['morning', 'evening']) {
      const t = toMin(d.reminders?.[slot]);
      if (t == null || now.minutes < t || now.minutes >= t + 15) continue;
      if (day[slot] != null || d.sent?.[slot] === now.date) continue;
      const payload = slot === 'morning'
        ? { title: 'בוקר טוב - שקילת בוקר', body: 'אחרי השירותים, לפני שתייה. נראה כמה נשרף בלילה.', url: '/?weigh=morning' }
        : { title: 'שקילת ערב', body: 'עוד שקילה אחת והיום שלם. בבוקר נדע כמה נשרף בלילה.', url: '/?weigh=evening' };
      await sendToUser(u.id, payload);
      await u.ref.set({ sent: { [slot]: now.date } }, { merge: true });
    }
  }
});
