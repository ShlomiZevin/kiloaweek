// The big picture over days: stalls while on plan (and what followed them before), sleep vs night burn,
// how much of each day was on plan - computed in code, then handed to the AI analyst together with the raw days.
import type { Day, Meal, Measure } from './types';
import { addDays, diffDays, today, weekday, WEEKDAYS } from './dates';
import { avg7, dayGain, dayKinds, eOf, mOf, nightBurn, weekTrend, type DayMap, g } from './calc';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type DayFood = { calories: number; protein: number; carbs: number; sugar: number; meals: number; off: number; warn: number };
export function foodByDay(meals: Meal[]) {
  const m = new Map<string, DayFood>();
  for (const x of meals) {
    const f = m.get(x.date) || { calories: 0, protein: 0, carbs: 0, sugar: 0, meals: 0, off: 0, warn: 0 };
    f.calories += x.calories; f.protein += x.protein || 0; f.carbs += x.carbs || 0; f.sugar += x.sugar || 0; f.meals++; if (x.verdict === 'no') f.off++; if (x.verdict === 'warn') f.warn++;
    m.set(x.date, f);
  }
  return m;
}

/** On plan = no cheat, nothing outside the method, sweets within 6. Unknown when he logged no food. */
export function onPlan(m: DayMap, food: Map<string, DayFood>, date: string): boolean | null {
  const d = m.get(date), f = food.get(date);
  if (d?.tags?.cheat) return false;
  if (!f || !f.meals) return null;
  return f.off === 0 && (d?.sweets ?? 0) <= 6;
}

export type Stall = { start: string; end: string; days: number; dropAfter: number | null; onPlanShare: number | null };

/** Stalls: 4+ days in a row where the 7-day average stopped going down. For each past stall - what came after (3 days). */
export function stalls(m: DayMap, food: Map<string, DayFood>, from: string, to: string = today()) {
  const out: Stall[] = [];
  let run: string[] = [];
  const close = (endIdx: string) => {
    if (run.length >= 4) {
      const end = run[run.length - 1];
      const a = avg7(m, end), b = avg7(m, addDays(end, 3));
      const plans = run.map(d => onPlan(m, food, d)).filter((v): v is boolean => v != null);
      out.push({ start: run[0], end, days: run.length, dropAfter: a != null && b != null && diffDays(to, addDays(end, 3)) >= 0 ? g(b - a) : null, onPlanShare: plans.length ? plans.filter(Boolean).length / plans.length : null });
    }
    run = []; void endIdx;
  };
  for (let d = addDays(from, 1); diffDays(to, d) >= 0; d = addDays(d, 1)) {
    const a = avg7(m, d), p = avg7(m, addDays(d, -1));
    if (a != null && p != null && a - p > -0.02) run.push(d); // not going down (less than 20 g a day)
    else close(d);
  }
  const current = run.length >= 3 && run[run.length - 1] === to ? { start: run[0], days: run.length } : null;
  close(to);
  const past = out.filter(s => s.end !== to && s.dropAfter != null);
  return { past, current, all: out };
}

export function sleepEffect(m: DayMap, from: string, to: string = today()) {
  const b: Record<string, number[]> = { short: [], mid: [], long: [] };
  for (let d = from; diffDays(to, d) >= 0; d = addDays(d, 1)) {
    const s = m.get(d)?.sleep, nb = nightBurn(m, d);
    if (s == null || nb == null) continue;
    b[s < 6 ? 'short' : s < 7.5 ? 'mid' : 'long'].push(nb);
  }
  return { short: { avg: avg(b.short), n: b.short.length }, mid: { avg: avg(b.mid), n: b.mid.length }, long: { avg: avg(b.long), n: b.long.length } };
}

/** The code's own short verdict for the home screen (no AI): a stall while on plan = stay calm. */
export function stallNote(m: DayMap, meals: Meal[]) {
  const t = today();
  const food = foodByDay(meals);
  const s = stalls(m, food, addDays(t, -120), t);
  if (!s.current) return null;
  const recent = Array.from({ length: s.current.days }, (_, i) => onPlan(m, food, addDays(t, -i))).filter((v): v is boolean => v != null);
  const share = recent.length ? recent.filter(Boolean).length / recent.length : null;
  const drops = s.past.filter(x => (x.dropAfter ?? 0) < 0);
  const history = drops.length ? { n: drops.length, avgDays: Math.round(avg(drops.map(x => x.days))!), avgDrop: Math.round(-avg(drops.map(x => x.dropAfter!))!) } : null;
  return { days: s.current.days, share, history };
}

/** Everything the analyst reads, as text (one call per tap). */
export function analysisData(m: DayMap, measures: Measure[], meals: Meal[], days: Day[], profile: { goalWeight?: number; weeklyGoalG?: number }) {
  const t = today();
  const first = days.filter(d => d.morning != null || d.evening != null).map(d => d.date).sort()[0] || t;
  const from = diffDays(t, first) > 42 ? addDays(t, -41) : first;
  const food = foodByDay(meals);
  const L: string[] = [`היום ${t} (${WEEKDAYS[weekday(t)]}). יעד שבועי: ${profile.weeklyGoalG || 800} גרם.${profile.goalWeight ? ` משקל יעד: ${profile.goalWeight}.` : ''}`];
  L.push('', 'ימים (תאריך | יום | בוקר | ערב | שריפה לילית ג׳ | עלייה יומית ג׳ | ממוצע 7 ימים | שינה ש׳ | קלוריות | חלבון/פחמימות/סוכרים ג׳ | ארוחות מחוץ לשיטה | מתוקים | סוג יום):');
  for (let d = from; diffDays(t, d) >= 0; d = addDays(d, 1)) {
    const day = m.get(d), f = food.get(d), k = dayKinds(m, measures, d), a7 = avg7(m, d);
    if (!day && !f) continue;
    L.push([d, WEEKDAYS[weekday(d)], mOf(m, d) ?? '-', eOf(m, d) ?? '-', nightBurn(m, d) ?? '-', dayGain(m, d) ?? '-', a7 != null ? a7.toFixed(2) : '-', day?.sleep ?? '-',
      f ? f.calories : 'לא תועד', f ? `${f.protein}/${f.carbs}/${f.sugar}` : '-', f ? f.off : '-', day?.sweets ?? '-', [k.strength && 'כוח', k.aerobic && 'אירובי', k.cheat && 'צ׳יט'].filter(Boolean).join('+') || 'רגיל'].join(' | '));
  }
  const wt = weekTrend(m, t);
  L.push('', '== מה הקוד מצא ==');
  if (wt != null) L.push(`מגמה שבועית עכשיו (ממוצע 7 ימים מול 7 הקודמים): ${wt} גרם.`);
  const s = stalls(m, food, addDays(t, -150), t);
  if (s.current) L.push(`תקיעה עכשיו: ממוצע 7 הימים לא יורד כבר ${s.current.days} ימים (מ-${s.current.start}).`);
  if (s.past.length) L.push('תקיעות קודמות ומה קרה אחריהן: ' + s.past.map(x => `${x.start}..${x.end} (${x.days} ימים${x.onPlanShare != null ? `, ${Math.round(x.onPlanShare * 100)}% ימים בתוכנית` : ''}) -> ${x.dropAfter} גרם ב-3 הימים שאחרי`).join('; '));
  else L.push('אין עדיין תקיעות קודמות להשוואה.');
  const se = sleepEffect(m, addDays(t, -90), t);
  const sp = [['פחות מ-6 שעות', se.short], ['6-7.5 שעות', se.mid], ['7.5+ שעות', se.long]].filter(([, v]: any) => v.n).map(([k, v]: any) => `${k}: ${Math.round(v.avg)} ג׳ (×${v.n})`);
  L.push(sp.length ? `שריפה לילית לפי שינה: ${sp.join(', ')}.` : 'אין נתוני שינה.');
  const loggedFood = [...food.keys()].filter(d => diffDays(t, d) < 14).length;
  L.push(`ימים עם אוכל מתועד ב-14 הימים האחרונים: ${loggedFood}.`);
  return L.join('\n');
}
