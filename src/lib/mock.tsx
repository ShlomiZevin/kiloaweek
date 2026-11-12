// DEV ONLY (npm run dev with VITE_MOCK=1): the same store API over memory + localStorage, with 60 days of
// realistic data, so every screen can be tested without a Google account. Never part of the production bundle's path.
import { useMemo, useState, type ReactNode } from 'react';
import { StoreCtx, foodKey, libraryEntry, type Store } from './store';
import { API_BASE } from './config';
import type { ChatMsg, Day, Meal, Measure, Profile, SavedMeal } from './types';
import { addDays, fromLocalInput, today, weekday } from './dates';

const KEY = 'kaw-mock-v2';
function seed() {
  const t = today();
  const days: Day[] = [], measures: Measure[] = [];
  let w = 89.2; let rnd = 7;
  const r = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  for (let i = 63; i >= 0; i--) {
    const d = addDays(t, -i), wd = weekday(d);
    const strength = wd === 1 || wd === 3 || wd === 5, aerobic = wd === 0 || wd === 2 || wd === 4 || wd === 3, cheat = wd === 5 && i % 14 < 7;
    w -= 0.115 + (r() - 0.5) * 0.08;
    const weekendBump = wd === 0 ? 0.35 : wd === 6 ? 0.2 : 0;
    const morning = +(w + weekendBump + (r() - 0.5) * 0.3).toFixed(1);
    const night = (strength ? 0.78 : aerobic ? 0.7 : 0.6) + (r() - 0.5) * 0.15;
    const evening = i === 0 ? undefined : +(morning + 0.9 + (cheat ? 0.8 : 0) + (r() - 0.5) * 0.3).toFixed(1);
    days.push({ date: d, morning, evening, morningAt: fromLocalInput(`${d}T07:1${i % 10}`), eveningAt: evening ? fromLocalInput(`${d}T22:3${i % 10}`) : undefined, tags: { strength, aerobic: false, cheat }, sleep: [6, 7, 7, 8, 6, 5, 8][i % 7], sweets: Math.round(r() * 5), water: 1500 + Math.round(r() * 6) * 250 });
    void night;
    if (aerobic && i > 0) {
      const type = (['run', 'walk', 'swim', 'bike'] as const)[Math.floor(r() * 4)];
      const minutes = 35 + Math.round(r() * 30);
      const rate = { run: 11, walk: 6, swim: 9, bike: 8 }[type];
      const drink = Math.round(r() * 3) * 150;
      const startedAt = fromLocalInput(`${d}T18:00`);
      measures.push({ id: 'm' + i, type, beforeKg: morning + 0.6, afterKg: +(morning + 0.6 - (minutes * rate - drink) / 1000).toFixed(2), drinkMl: drink, minutes, startedAt, endedAt: startedAt + minutes * 60000 });
    }
    if (i % 3 === 0 && i > 0) { const s = fromLocalInput(`${d}T08:00`); measures.push({ id: 'p' + i, type: 'pee', beforeKg: morning + 0.3, afterKg: +(morning + 0.3 - 0.25 - r() * 0.15).toFixed(2), startedAt: s, endedAt: s }); }
    if (i % 4 === 0 && i > 0) { const s = fromLocalInput(`${d}T09:00`); measures.push({ id: 'k' + i, type: 'poop', beforeKg: morning + 0.2, afterKg: +(morning + 0.2 - 0.15 - r() * 0.2).toFixed(2), startedAt: s, endedAt: s }); }
  }
  const meals: Meal[] = [
    { id: 'a1', date: t, at: fromLocalInput(`${t}T08:30`), he: 'יוגורט עם שיבולת שועל', items: [{ he: 'יוגורט 0% (200 ג׳)', calories: 110, protein: 20, carbs: 8, sugar: 8 }, { he: 'שיבולת שועל (30 ג׳)', calories: 115, protein: 4, carbs: 18, sugar: 0 }], calories: 225, protein: 24, carbs: 26, sugar: 8, verdict: 'ok', why: 'חלבי רזה ושיבולת במידה - בדיוק בשיטה.' },
    { id: 'a2', date: t, at: fromLocalInput(`${t}T13:10`), he: 'חזה עוף עם סלט', items: [{ he: 'חזה עוף בגריל (150 ג׳)', calories: 250, protein: 46, carbs: 0, sugar: 0 }, { he: 'סלט ירקות גדול', calories: 80, protein: 3, carbs: 14, sugar: 8 }, { he: 'קוטג׳ 5% (100 ג׳)', calories: 95, protein: 11, carbs: 3, sugar: 3 }], calories: 425, protein: 60, carbs: 17, sugar: 11, verdict: 'ok', why: 'חלבון רזה וירקות, בלי שמן.' },
  ];
  const foods: SavedMeal[] = [
    ...meals.map((x, i) => ({ ...(libraryEntry(x) as any), id: foodKey(x.he), n: 5 - i })),
    { id: 'שקשוקה', he: 'שקשוקה', items: [{ he: 'שקשוקה, 2 ביצים', calories: 260, protein: 15, carbs: 14, sugar: 9 }], calories: 260, protein: 15, carbs: 14, sugar: 9, verdict: 'ok', n: 2, lastAt: Date.now() - 86400000 },
  ];
  return { profile: { name: 'בודק', email: 'test@example.com', startWeight: 89.5, goalWeight: 80, heightCm: 178, sex: 'm', birthYear: 1984, activity: 'light', reminders: { on: false, morning: '07:30', evening: '22:00' } } as Profile, days, measures, meals, foods, chat: [] as ChatMsg[] };
}
type DB = ReturnType<typeof seed>;
function load(): DB {
  if (new URLSearchParams(location.search).has('fresh')) localStorage.removeItem(KEY);
  if (new URLSearchParams(location.search).has('empty')) return { profile: { reminders: { on: false, morning: '07:30', evening: '22:00' } }, days: [], measures: [], meals: [], foods: [], chat: [] };
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch {}
  return seed();
}

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load);
  const commit = (f: (d: DB) => DB) => setDb(prev => { const n = f(structuredClone(prev)); localStorage.setItem(KEY, JSON.stringify(n)); return n; });
  const user = { uid: 'dev-user', displayName: 'שלומי בודק', email: 'test@example.com', photoURL: null, getIdToken: async () => 'dev:dev-user' } as any;
  const store = useMemo<Store>(() => ({
    user, ready: true, loaded: true, profile: db.profile, days: db.days, measures: [...db.measures].sort((a, b) => b.startedAt - a.startedAt), meals: [...db.meals].sort((a, b) => a.at - b.at), chat: db.chat, foods: [...(db.foods || [])].sort((a, b) => b.n - a.n || b.lastAt - a.lastAt),
    async setWeight(date, slot, kg, at) { commit(d => { let x = d.days.find(y => y.date === date); if (!x) { x = { date }; d.days.push(x); } (x as any)[slot] = kg == null ? undefined : kg; (x as any)[slot + 'At'] = kg == null ? undefined : at || Date.now(); return d; }); },
    async updateDay(date, patch) { commit(d => { let x = d.days.find(y => y.date === date); if (!x) { x = { date }; d.days.push(x); } Object.assign(x, patch); return d; }); },
    async deleteDay(date) { commit(d => ({ ...d, days: d.days.filter(x => x.date !== date) })); },
    async saveMeasure(m) { commit(d => ({ ...d, measures: [...d.measures.filter(x => x.id !== m.id), m] })); },
    async deleteMeasure(id) { commit(d => ({ ...d, measures: d.measures.filter(x => x.id !== id) })); },
    async saveMeal(m) { commit(d => ({ ...d, meals: [...d.meals.filter(x => x.id !== m.id), m] })); },
    async deleteMeal(id) { commit(d => ({ ...d, meals: d.meals.filter(x => x.id !== id) })); },
    async rememberMeal(m) { commit(d => { const id = foodKey(m.he); const old = (d.foods ||= []).find(x => x.id === id); const e = { ...(libraryEntry(m) as any), id, n: (old?.n || 0) + 1 }; d.foods = [...d.foods.filter(x => x.id !== id), e]; return d; }); },
    async forgetMeal(key) { commit(d => ({ ...d, foods: (d.foods || []).filter(x => x.id !== key) })); },
    async addChat(m) { commit(d => ({ ...d, chat: d.chat.some(x => x.id === m.id) ? d.chat.map(x => (x.id === m.id ? m : x)) : [...d.chat, m] })); },
    async clearChat() { commit(d => ({ ...d, chat: [] })); },
    async saveProfile(p) { commit(d => ({ ...d, profile: { ...d.profile, ...p } })); },
    async api(path, body) {
      const r = await fetch(`${API_BASE}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer dev:dev-user' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `שגיאה ${r.status}`);
      return j;
    },
  }), [db]); // eslint-disable-line
  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}
