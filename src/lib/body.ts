// BMI, BMR (what the body burns at full rest) and TDEE (a normal day, with activity) - a formula's draft
// (Mifflin-St Jeor); the weighings over weeks are what tell the real story.
import type { Profile } from './types';

export const ACTIVITY = [
  { k: 'low', he: 'כמעט לא זז', sub: 'עבודה מול מחשב, בלי אימונים', f: 1.2 },
  { k: 'light', he: 'קצת', sub: 'הליכות, אימון 1-2 בשבוע', f: 1.375 },
  { k: 'mid', he: 'בינוני', sub: 'אימון 3-5 בשבוע', f: 1.55 },
  { k: 'high', he: 'הרבה', sub: 'אימון כמעט כל יום, עבודה פיזית', f: 1.725 },
] as const;
export type Activity = (typeof ACTIVITY)[number]['k'];

export type Body = { bmi: number; bmiHe: string; bmr: number; tdee: number; eatFrom: number; eatTo: number };

/** null + what's missing, or the numbers. */
export function bodyNumbers(p: Profile, kg: number | null): { body: Body | null; missing: string[] } {
  const age = p.birthYear ? new Date().getFullYear() - p.birthYear : null;
  const missing = [!p.sex && 'מין', !age && 'שנת לידה', !p.heightCm && 'גובה', !kg && 'משקל', !p.activity && 'כמה זזים'].filter(Boolean) as string[];
  if (missing.length || !kg || !age || !p.heightCm || !p.sex || !p.activity) return { body: null, missing };
  const m = p.heightCm / 100;
  const bmi = kg / (m * m);
  const bmr = 10 * kg + 6.25 * p.heightCm - 5 * age + (p.sex === 'm' ? 5 : -161);
  const tdee = bmr * (ACTIVITY.find(a => a.k === p.activity)?.f || 1.2);
  // 700 g - 1 kg a week ≈ 770-1,100 kcal a day under the burn; never below the resting burn's floor
  const floor = p.sex === 'm' ? 1500 : 1200;
  const r50 = (x: number) => Math.round(x / 50) * 50;
  return {
    body: {
      bmi: Math.round(bmi * 10) / 10,
      bmiHe: bmi < 18.5 ? 'מתחת לטווח התקין' : bmi < 25 ? 'בטווח התקין' : bmi < 30 ? 'מעל הטווח התקין' : 'הרבה מעל הטווח התקין',
      bmr: r50(bmr), tdee: r50(tdee),
      eatFrom: r50(Math.max(floor, tdee - 1100)), eatTo: r50(Math.max(floor, tdee - 770)),
    },
    missing: [],
  };
}
