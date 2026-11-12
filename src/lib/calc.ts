// Every number the app shows is computed here from the raw weighings - nothing is stored twice.
import type { ActType, Day, Measure } from './types';
import { addDays, diffDays, today, weekday, weekStart, WEEKDAYS } from './dates';

export const AEROBIC: ActType[] = ['run', 'walk', 'swim', 'bike'];
// The toilet ones come last and have no words on screen (his rule) - just their pictures.
export const ACTS: { type: ActType; he: string; ai: string; timed: boolean }[] = [
  { type: 'run', he: 'ריצה', ai: 'ריצה', timed: true },
  { type: 'walk', he: 'הליכה', ai: 'הליכה', timed: true },
  { type: 'swim', he: 'בריכה', ai: 'בריכה', timed: true },
  { type: 'bike', he: 'אופניים', ai: 'אופניים', timed: true },
  { type: 'strength', he: 'אימון כוח', ai: 'אימון כוח', timed: true },
  { type: 'other', he: 'אחר', ai: 'פעילות אחרת', timed: true },
  { type: 'pee', he: '', ai: 'שירותים (קטנים)', timed: false },
  { type: 'poop', he: '', ai: 'שירותים (גדולים)', timed: false },
];
/** The word on screen ('' for the toilet ones - show their picture). */
export const actHe = (t: ActType) => ACTS.find(a => a.type === t)?.he ?? '';
/** In sentences: never empty. */
export const actSay = (t: ActType) => actHe(t) || 'המדידה';
const actAi = (t: ActType) => ACTS.find(a => a.type === t)?.ai || t;
export const isTimed = (t: ActType) => !!ACTS.find(a => a.type === t)?.timed;

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) && v > 20 && v < 400 ? v : null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const g = (kg: number) => Math.round(kg * 1000);

export type DayMap = Map<string, Day>;
export const toMap = (days: Day[]): DayMap => new Map(days.map(d => [d.date, d]));
export const mOf = (m: DayMap, date: string) => num(m.get(date)?.morning);
export const eOf = (m: DayMap, date: string) => num(m.get(date)?.evening);

/** Grams burned overnight: last evening -> this morning. */
export function nightBurn(m: DayMap, date: string) {
  const e = eOf(m, addDays(date, -1)), mo = mOf(m, date);
  return e != null && mo != null ? g(e - mo) : null;
}
/** Grams gained during the day: this morning -> this evening. */
export function dayGain(m: DayMap, date: string) {
  const mo = mOf(m, date), e = eOf(m, date);
  return mo != null && e != null ? g(e - mo) : null;
}
export function vsDaysAgo(m: DayMap, date: string, n: number, slot: 'morning' | 'evening') {
  const f = slot === 'morning' ? mOf : eOf;
  const a = f(m, date), b = f(m, addDays(date, -n));
  return a != null && b != null ? g(a - b) : null;
}

/** Day tags = what he set by hand + what his measurements say (a run -> aerobic, a strength session -> strength). */
export function dayKinds(m: DayMap, measures: Measure[], date: string) {
  const t = m.get(date)?.tags || {};
  const ms = measures.filter(x => dayOfMs(x.startedAt) === date);
  return {
    strength: !!t.strength || ms.some(x => x.type === 'strength'),
    aerobic: !!t.aerobic || ms.some(x => AEROBIC.includes(x.type)),
    cheat: !!t.cheat,
  };
}
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayOfMs = (ms: number) => dayFmt.format(new Date(ms));

/** Average morning weight of the 7 days ending at `date` (needs 3+ weighings). */
export function avg7(m: DayMap, date: string, slot: 'morning' | 'evening' = 'morning') {
  const f = slot === 'morning' ? mOf : eOf;
  const xs: number[] = [];
  for (let i = 0; i < 7; i++) { const v = f(m, addDays(date, -i)); if (v != null) xs.push(v); }
  return xs.length >= 3 ? avg(xs) : null;
}
/** The weekly trend: this 7-day average vs the 7 days before it, in grams (negative = down). */
export function weekTrend(m: DayMap, date: string) {
  const a = avg7(m, date), b = avg7(m, addDays(date, -7));
  return a != null && b != null ? g(a - b) : null;
}

export type WeekRow = {
  start: string; avgMorning: number | null; avgEvening: number | null; avgNight: number | null; avgDayGain: number | null;
  change: number | null; n: number;
};
/** Calendar weeks (Sunday-Saturday), newest first. */
export function weeks(m: DayMap, from: string, to: string = today()): WeekRow[] {
  const rows: WeekRow[] = [];
  for (let s = weekStart(to); diffDays(s, weekStart(from)) >= 0; s = addDays(s, -7)) {
    const ms: number[] = [], es: number[] = [], nb: number[] = [], dg: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(s, i);
      const a = mOf(m, d), b = eOf(m, d), n = nightBurn(m, d), q = dayGain(m, d);
      if (a != null) ms.push(a); if (b != null) es.push(b); if (n != null) nb.push(n); if (q != null) dg.push(q);
    }
    rows.push({ start: s, avgMorning: avg(ms), avgEvening: avg(es), avgNight: avg(nb), avgDayGain: avg(dg), change: null, n: ms.length });
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i].avgMorning, b = rows[i + 1].avgMorning;
    rows[i].change = a != null && b != null ? g(a - b) : null;
  }
  return rows.filter(r => r.n || r.avgEvening != null);
}

export function measureNet(x: Measure) {
  if (x.afterKg == null) return null;
  return g(x.beforeKg - x.afterKg) + (x.drinkMl || 0); // drinking during it hid that much loss
}
export function measureMinutes(x: Measure) {
  if (x.minutes != null) return x.minutes;
  if (x.endedAt) return Math.max(1, Math.round((x.endedAt - x.startedAt) / 60000));
  return null;
}

export type ActStat = { type: ActType; n: number; avgNet: number | null; perMin: number | null; avgMin: number | null };
export function actStats(measures: Measure[]): ActStat[] {
  return ACTS.map(({ type }) => {
    const done = measures.filter(x => x.type === type && measureNet(x) != null);
    const nets = done.map(x => measureNet(x)!);
    const rates = done.map(x => { const mn = measureMinutes(x); return mn ? measureNet(x)! / mn : null; }).filter((v): v is number => v != null);
    const mins = done.map(measureMinutes).filter((v): v is number => v != null);
    return { type, n: done.length, avgNet: avg(nets), perMin: isTimed(type) ? avg(rates) : null, avgMin: avg(mins) };
  });
}

export type Research = {
  nightByKind: { kind: 'strength' | 'aerobic' | 'both' | 'rest'; he: string; avg: number | null; n: number }[];
  weekdayDev: { wd: number; he: string; dev: number | null; n: number }[];
  heaviestWd: number | null;
  nightTrend: { start: string; avg: number }[];
  cheatEffect: { avg: number | null; n: number };
  avgNight: number | null;
  avgDayGain: number | null;
  conclusions: string[];
};

/** The research views: what his own numbers say about his body. */
export function research(m: DayMap, measures: Measure[], from: string, to: string = today()): Research {
  const dates: string[] = [];
  for (let d = from; diffDays(to, d) >= 0; d = addDays(d, 1)) dates.push(d);

  // night burn after each kind of day
  const buckets: Record<string, number[]> = { strength: [], aerobic: [], both: [], rest: [] };
  const allNight: number[] = [], allGain: number[] = [];
  for (const d of dates) {
    const nb = nightBurn(m, d);
    const dg = dayGain(m, d);
    if (dg != null) allGain.push(dg);
    if (nb == null) continue;
    allNight.push(nb);
    const k = dayKinds(m, measures, addDays(d, -1));
    if (k.cheat) continue; // a cheat day says nothing about training
    buckets[k.strength && k.aerobic ? 'both' : k.strength ? 'strength' : k.aerobic ? 'aerobic' : 'rest'].push(nb);
  }
  const KH: Record<string, string> = { strength: 'אחרי יום כוח', aerobic: 'אחרי יום אירובי', both: 'אחרי כוח + אירובי', rest: 'אחרי יום מנוחה' };
  const nightByKind = (['strength', 'aerobic', 'both', 'rest'] as const).map(kind => ({ kind, he: KH[kind], avg: avg(buckets[kind]), n: buckets[kind].length }));

  // which weekday is heavy: each morning vs the centred 7-day average around it
  const wdDev: number[][] = [[], [], [], [], [], [], []];
  for (const d of dates) {
    const v = mOf(m, d); if (v == null) continue;
    const around: number[] = [];
    for (let i = -3; i <= 3; i++) { const x = mOf(m, addDays(d, i)); if (x != null) around.push(x); }
    if (around.length < 5) continue;
    wdDev[weekday(d)].push(g(v - avg(around)!));
  }
  const weekdayDev = wdDev.map((xs, wd) => ({ wd, he: WEEKDAYS[wd], dev: avg(xs), n: xs.length }));
  const withData = weekdayDev.filter(w => w.n >= 2 && w.dev != null);
  const heaviestWd = withData.length >= 4 ? withData.reduce((a, b) => (b.dev! > a.dev! ? b : a)).wd : null;

  const nightTrend = weeks(m, from, to).filter(w => w.avgNight != null).map(w => ({ start: w.start, avg: w.avgNight! })).reverse();

  // the morning after a cheat day, vs the morning before it
  const cheat: number[] = [];
  for (const d of dates) {
    if (!m.get(d)?.tags?.cheat) continue;
    const before = mOf(m, d), after = mOf(m, addDays(d, 1));
    if (before != null && after != null) cheat.push(g(after - before));
  }

  const r: Research = {
    nightByKind, weekdayDev, heaviestWd, nightTrend, cheatEffect: { avg: avg(cheat), n: cheat.length },
    avgNight: avg(allNight), avgDayGain: avg(allGain), conclusions: [],
  };
  r.conclusions = conclude(m, measures, r, to);
  return r;
}

const fmtG = (x: number) => `${Math.round(Math.abs(x)).toLocaleString('he-IL')} גרם`;

function conclude(m: DayMap, measures: Measure[], r: Research, to: string): string[] {
  const out: string[] = [];
  const t = weekTrend(m, to);
  if (t != null) {
    if (t <= -700 && t >= -1000) out.push(`המגמה השבועית: ירידה של ${fmtG(t)} - בדיוק בטווח של השיטה (700 גרם עד קילו).`);
    else if (t < -1000) out.push(`המגמה השבועית: ירידה של ${fmtG(t)} - מעל קילו בשבוע. מעולה, רק לוודא שזה בר-קיימא.`);
    else if (t < 0) out.push(`המגמה השבועית: ירידה של ${fmtG(t)}. היעד הוא 700 גרם עד קילו - יש לאן לדחוף.`);
    else out.push(`השבוע הממוצע עלה ב-${fmtG(t)} לעומת השבוע הקודם. מסתכלים על התזונה של השבוע ועל הדפיציט.`);
  }
  if (r.avgNight != null) out.push(`בלילה אתה שורף בממוצע ${fmtG(r.avgNight)}${r.avgDayGain != null ? `, וביום עולה בממוצע ${fmtG(r.avgDayGain)}` : ''}.`);
  const s = r.nightByKind.find(k => k.kind === 'strength')!, a = r.nightByKind.find(k => k.kind === 'aerobic')!, rest = r.nightByKind.find(k => k.kind === 'rest')!;
  if (s.n >= 3 && a.n >= 3 && s.avg != null && a.avg != null) {
    const d = s.avg - a.avg;
    if (d > 40) out.push(`אחרי ימי כוח הגוף שורף בלילה ${fmtG(d)} יותר מאשר אחרי אירובי - הכוח מעלה לך את השריפה במנוחה. כדאי לשמור עליו.`);
    else if (d < -40) out.push(`אחרי ימי אירובי הלילה שורף ${fmtG(-d)} יותר מאשר אחרי כוח. אצלך האירובי עושה את העבודה גם בשינה.`);
    else out.push('השריפה הלילית דומה אחרי כוח ואחרי אירובי - שניהם עובדים לך באותה מידה.');
  } else if (s.n + a.n > 0) {
    out.push('כדי לדעת אם לעבוד על אירובי או על שריר - צריך לפחות 3 לילות אחרי ימי כוח ו-3 אחרי ימי אירובי. סמן ביומן או מדוד לפני/אחרי.');
  }
  if (rest.n >= 3 && rest.avg != null && s.avg != null && s.n >= 3 && s.avg - rest.avg > 40)
    out.push(`לילה אחרי יום כוח שורף ${fmtG(s.avg - rest.avg)} יותר מלילה אחרי מנוחה.`);
  if (r.heaviestWd != null) out.push(`ביום ${WEEKDAYS[r.heaviestWd]} אתה בדרך כלל הכי כבד בשבוע - אל תיבהל מהמספר באותו בוקר.`);
  if (r.nightTrend.length >= 4) {
    const first = avg(r.nightTrend.slice(0, 2).map(x => x.avg))!, last = avg(r.nightTrend.slice(-2).map(x => x.avg))!;
    if (last - first > 50) out.push(`השריפה הלילית עלתה מ-${fmtG(first)} ל-${fmtG(last)} - הגוף שורף יותר במנוחה.`);
    else if (first - last > 50) out.push(`השריפה הלילית ירדה מ-${fmtG(first)} ל-${fmtG(last)}. שינה, שתייה בערב ואימוני כוח משפיעים עליה.`);
  }
  const st = actStats(measures).filter(x => x.perMin != null && x.n >= 2 && !['pee', 'poop'].includes(x.type));
  if (st.length >= 2) {
    const best = st.reduce((p, c) => (c.perMin! > p.perMin! ? c : p));
    out.push(`הפעילות שהכי שורפת לך לדקה: ${actSay(best.type)} - ${best.perMin!.toFixed(1)} גרם לדקה.`);
  }
  if (r.cheatEffect.n >= 2 && r.cheatEffect.avg != null)
    out.push(`בוקר אחרי צ׳יט דיי אתה בממוצע ${r.cheatEffect.avg > 0 ? 'כבד ב-' : 'קל ב-'}${fmtG(r.cheatEffect.avg)}. זה בעיקר מים - חוזרים לשגרה ורואים איך זה יורד.`);
  return out;
}

/** A compact text of his numbers for the coach (the server never reads the database for this). */
export function coachContext(m: DayMap, measures: Measure[], meals: { date: string; he: string; calories: number; verdict: string; protein?: number; carbs?: number; sugar?: number }[], profile: { goalWeight?: number; startWeight?: number; heightCm?: number }) {
  const t = today();
  const lines: string[] = [`היום: ${t} (${WEEKDAYS[weekday(t)]}).`];
  if (profile.startWeight) lines.push(`משקל התחלה: ${profile.startWeight} ק״ג.`);
  if (profile.goalWeight) lines.push(`משקל יעד: ${profile.goalWeight} ק״ג.`);
  if (profile.heightCm) lines.push(`גובה: ${profile.heightCm} ס״מ.`);
  lines.push('14 הימים האחרונים (תאריך | בוקר | ערב | שריפה לילית גרם | עלייה יומית גרם | סוג יום):');
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t, -i), k = dayKinds(m, measures, d);
    const mo = mOf(m, d), e = eOf(m, d), nb = nightBurn(m, d), dg = dayGain(m, d);
    if (mo == null && e == null) continue;
    lines.push(`${d} | ${mo ?? '-'} | ${e ?? '-'} | ${nb ?? '-'} | ${dg ?? '-'} | ${[k.strength && 'כוח', k.aerobic && 'אירובי', k.cheat && 'צ׳יט'].filter(Boolean).join('+') || 'רגיל'}`);
  }
  const wt = weekTrend(m, t);
  if (wt != null) lines.push(`מגמה שבועית (ממוצע 7 ימים מול 7 קודמים): ${wt} גרם.`);
  const st = actStats(measures).filter(x => x.n);
  if (st.length) lines.push('מדידות לפני/אחרי (ממוצע): ' + st.map(x => `${actAi(x.type)} ${Math.round(x.avgNet!)} גרם${x.perMin != null ? ` (${x.perMin.toFixed(1)} ג׳/דקה)` : ''} ×${x.n}`).join(', '));
  const todays = meals.filter(x => x.date === t);
  if (todays.length) {
    const sum = (k: 'protein' | 'carbs' | 'sugar' | 'calories') => todays.reduce((a, x) => a + (x[k] || 0), 0);
    lines.push(`אכל היום: ${todays.map(x => `${x.he} (חלבון ${x.protein ?? '?'}, פחמימות ${x.carbs ?? '?'}, סוכרים ${x.sugar ?? '?'} ג׳)${x.verdict === 'no' ? ' (לא בשיטה)' : ''}`).join('; ')}. סה״כ: חלבון ${sum('protein')} ג׳, פחמימות ${sum('carbs')} ג׳, סוכרים ${sum('sugar')} ג׳, ${sum('calories')} קק״ל.`);
  }
  return lines.join('\n');
}

/** Same data, more of it, for "analyse my data" research questions. */
export function researchContext(m: DayMap, measures: Measure[], days: Day[]) {
  const sorted = [...days].filter(d => d.morning != null || d.evening != null).sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
  const lines = ['כל השקילות (תאריך | בוקר | ערב | סוג יום):'];
  for (const d of sorted) {
    const k = dayKinds(m, measures, d.date);
    lines.push(`${d.date} | ${d.morning ?? '-'} | ${d.evening ?? '-'} | ${[k.strength && 'כוח', k.aerobic && 'אירובי', k.cheat && 'צ׳יט'].filter(Boolean).join('+') || '-'}`);
  }
  const done = measures.filter(x => x.afterKg != null).slice(-60);
  if (done.length) {
    lines.push('מדידות לפני/אחרי (סוג | נטו גרם | דקות):');
    for (const x of done) lines.push(`${actAi(x.type)} | ${measureNet(x)} | ${measureMinutes(x) ?? '-'}`);
  }
  return lines.join('\n');
}
