import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { PageHead, useNav } from '../App';
import { ACTIVITY, bodyNumbers } from '../lib/body';
import { latestWeight } from '../lib/calc';

/** Account menu / home -> הגוף שלי: BMI, what the body burns at rest (BMR) and on a normal day (TDEE), and a draft of
 *  how much to eat for 0.7-1 kg a week. The weight comes from the weighings. */
export function Body() {
  const { profile, saveProfile, days } = useStore();
  const { toast } = useNav();
  const kg = useMemo(() => latestWeight(days) ?? profile.startWeight ?? null, [days, profile.startWeight]);
  const [year, setYear] = useState(profile.birthYear ? String(profile.birthYear) : '');
  const [h, setH] = useState(profile.heightCm ? String(profile.heightCm) : '');
  const [w, setW] = useState('');
  useEffect(() => { setYear(profile.birthYear ? String(profile.birthYear) : ''); setH(profile.heightCm ? String(profile.heightCm) : ''); }, [profile.birthYear, profile.heightCm]);
  const { body, missing } = bodyNumbers(profile, kg);
  const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };
  const save = (patch: object) => { saveProfile(patch as any); toast('נשמר'); };
  const thisYear = new Date().getFullYear();

  return (
    <div className="stack">
      <PageHead title="הגוף שלי" sub="BMI וכמה הגוף שורף ביום" />
      <div className="card stack">
        <div className="field"><span>מין</span>
          <div className="seg">{([['f', 'אישה'], ['m', 'גבר']] as const).map(([k, he]) => <button key={k} className={profile.sex === k ? 'on' : ''} onClick={() => save({ sex: k })}>{he}</button>)}</div>
        </div>
        <div className="grid2">
          <label className="field"><span>שנת לידה</span><input className="input num" inputMode="numeric" placeholder="1985" value={year} onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onBlur={() => { const y = num(year); if (y && y > thisYear - 100 && y < thisYear - 10 && y !== profile.birthYear) save({ birthYear: y }); }} /></label>
          <label className="field"><span>גובה (ס״מ)</span><input className="input num" inputMode="numeric" placeholder="170" value={h} onChange={e => setH(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onBlur={() => { const v = num(h); if (v && v > 100 && v < 230 && v !== profile.heightCm) save({ heightCm: v }); }} /></label>
        </div>
        {latestWeight(days) == null && (
          <label className="field"><span>משקל (ק״ג)</span><input className="input num" inputMode="decimal" placeholder={profile.startWeight ? String(profile.startWeight) : '80'} value={w} onChange={e => setW(e.target.value)}
            onBlur={() => { const v = num(w); if (v && v > 25 && v < 350) save({ startWeight: v }); }} /></label>
        )}
        {latestWeight(days) != null && <p className="hint">המשקל: <b className="num">{kg!.toFixed(1)}</b> ק״ג - מהשקילה האחרונה.</p>}
        <div className="field"><span>כמה זזים ביום-יום</span>
          <div className="acts-list">
            {ACTIVITY.map(a => (
              <button key={a.k} className={`act-opt ${profile.activity === a.k ? 'on' : ''}`} onClick={() => save({ activity: a.k })}>
                <b>{a.he}</b><small>{a.sub}</small>
              </button>
            ))}
          </div>
        </div>
      </div>

      {body ? (
        <div className="card body-res">
          <div className="br-row"><div><span>BMI</span><b className="num">{body.bmi.toFixed(1)}</b></div><small>{body.bmiHe} (18.5 עד 25)</small></div>
          <div className="br-row"><div><span>במנוחה מלאה הגוף שורף</span><b><span className="num">{body.bmr.toLocaleString('he-IL')}</span> קלוריות</b></div><small>BMR - גם בלי לזוז בכלל</small></div>
          <div className="br-row"><div><span>ביום רגיל שלך</span><b><span className="num">{body.tdee.toLocaleString('he-IL')}</span> קלוריות</b></div><small>TDEE - עם התנועה של היום-יום</small></div>
          <div className="br-goal"><span>כדי לרדת 700 גרם עד קילו בשבוע</span><b>בערך <span className="num">{body.eatFrom.toLocaleString('he-IL')}–{body.eatTo.toLocaleString('he-IL')}</span> קלוריות ביום</b></div>
          <p className="hint">הערכה לפי נוסחה (Mifflin-St Jeor) - טיוטה. השקילות של כמה שבועות יגידו כמה הגוף שלך באמת שורף.</p>
        </div>
      ) : <p className="hint empty-line">חסר: {missing.join(', ')}.</p>}
    </div>
  );
}
