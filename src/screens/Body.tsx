import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { PageHead, useNav } from '../App';
import { ACTIVITY, bodyNumbers } from '../lib/body';
import { latestWeight } from '../lib/calc';
import { TargetSteps } from './TargetWhy';

/** Account menu / home -> הגוף שלי. The daily target and HOW it's worked out come first (his rule: the most important thing
 *  here); BMI / BMR after it; the details form last once it's filled (first while something is missing). */
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

  const form = (
    <div className="card stack">
      {body && <b>הפרטים שלי</b>}
      <div className="field"><span>מין</span>
        <div className="seg">{([['f', 'אישה'], ['m', 'גבר']] as const).map(([k, he]) => <button key={k} className={profile.sex === k ? 'on' : ''} onClick={() => save({ sex: k })}>{he}</button>)}</div>
      </div>
      <div className="grid2">
        <label className="field"><span>שנת לידה</span><input className="input num" inputMode="numeric" placeholder="1985" value={year} onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onBlur={() => { const y = num(year); if (y && y > thisYear - 100 && y < thisYear - 10 && y !== profile.birthYear) save({ birthYear: y }); }} /></label>
        <label className="field"><span>גובה (ס״מ)</span><input className="input num" inputMode="numeric" placeholder="170" value={h} onChange={e => setH(e.target.value.replace(/\D/g, '').slice(0, 3))}
          onBlur={() => { const v = num(h); if (v && v > 100 && v < 230 && v !== profile.heightCm) save({ heightCm: v }); }} /></label>
      </div>
      {latestWeight(days) == null
        ? <label className="field"><span>משקל (ק״ג)</span><input className="input num" inputMode="decimal" placeholder={profile.startWeight ? String(profile.startWeight) : '80'} value={w} onChange={e => setW(e.target.value)}
            onBlur={() => { const v = num(w); if (v && v > 25 && v < 350) save({ startWeight: v }); }} /></label>
        : <p className="hint">המשקל: <b className="num">{kg!.toFixed(1)}</b> ק״ג - מהשקילה האחרונה.</p>}
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
  );

  return (
    <div className="stack">
      <PageHead title="הגוף שלי" sub="היעד היומי שלך, ואיך הגענו אליו" />
      {body ? (
        <>
          <div className="card target-hero">
            <div className="th-top">
              <span>היעד הקלורי היומי שלך</span>
              <b><span className="num">{body.target.toLocaleString('he-IL')}</span></b>
              <small>קלוריות ביום</small>
            </div>
            <div className="th-how">כך הגענו לזה</div>
            <TargetSteps body={body} sex={profile.sex} />
          </div>
          <div className="card body-two">
            <div><span>BMI</span><b className="num">{body.bmi.toFixed(1)}</b><small>{body.bmiHe} (18.5–25)</small></div>
            <div><span>במנוחה מלאה (BMR)</span><b className="num">{body.bmr.toLocaleString('he-IL')}</b><small>קלוריות ביום, בלי לזוז</small></div>
          </div>
          <p className="hint" style={{ textAlign: 'center' }}>הערכה לפי נוסחה (Mifflin-St Jeor). השקילות של כמה שבועות יגידו כמה הגוף שלך באמת שורף.</p>
          {form}
        </>
      ) : (
        <>
          {form}
          <p className="hint empty-line">עוד חסר: {missing.join(', ')} - ואז יופיע כאן היעד היומי שלך, עם ההסבר.</p>
        </>
      )}
    </div>
  );
}
