import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../App';
import { ActImg, Icon, Sheet, WeightInput, parseKg } from '../ui';
import { addDays, fromLocalInput, heDate, hourNow, toLocalInput, today, dayOf } from '../lib/dates';
import { eOf, mOf, toMap, g, weekTrend } from '../lib/calc';

const SLEEP = [5, 6, 7, 8, 9];
const CONFETTI = ['#34c79a', '#5d70f2', '#f2a20c', '#9fe3c9', '#b7c2ff'];

/** Morning / evening weigh-in. Opens on the last weight, so most mornings it's "-0.3, save". Then the "saved" moment. */
export function WeighSheet({ state, onClose }: { state: { slot?: 'morning' | 'evening'; date?: string } | null; onClose: () => void }) {
  const { days, setWeight, updateDay, profile } = useStore();
  const m = useMemo(() => toMap(days), [days]);
  const [slot, setSlot] = useState<'morning' | 'evening'>('morning');
  const [val, setVal] = useState('');
  const [when, setWhen] = useState('');
  const [sleep, setSleep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<null | { slot: 'morning' | 'evening'; kg: number; delta: number | null; date: string }>(null);
  const [showWhen, setShowWhen] = useState(false);

  useEffect(() => {
    if (!state) { setSaved(null); return; }
    const date = state.date || today();
    const d = m.get(date);
    const s = state.slot || (hourNow() < 14 ? (d?.morning == null ? 'morning' : 'evening') : (d?.evening == null ? 'evening' : 'morning'));
    setSlot(s);
    const existing = s === 'morning' ? d?.morning : d?.evening;
    let last: number | null = existing ?? null;
    for (let i = 0; last == null && i < 30; i++) last = eOf(m, addDays(date, -i)) ?? mOf(m, addDays(date, -i));
    setVal(last != null ? last.toFixed(1) : '');
    const at = (s === 'morning' ? d?.morningAt : d?.eveningAt) || (date === today() ? Date.now() : fromLocalInput(`${date}T${s === 'morning' ? '07:00' : '22:00'}`));
    setWhen(toLocalInput(at));
    setSleep(d?.sleep ?? null);
    setShowWhen(date !== today());
    setSaved(null);
  }, [state]); // eslint-disable-line

  if (!state) return null;
  const date = state.date || today();
  const kgv = parseKg(val);
  const atMs = when ? fromLocalInput(when) : Date.now();
  const saveDate = state.date || dayOf(atMs);
  const prevEvening = eOf(m, addDays(saveDate, -1));
  const morningToday = mOf(m, saveDate);
  const delta = kgv == null ? null : slot === 'morning' ? (prevEvening != null ? g(prevEvening - kgv) : null) : (morningToday != null ? g(kgv - morningToday) : null);
  const existing = slot === 'morning' ? m.get(saveDate)?.morning : m.get(saveDate)?.evening;

  const save = async () => {
    if (kgv == null) return;
    setBusy(true);
    try {
      await setWeight(saveDate, slot, kgv, atMs);
      if (slot === 'morning' && sleep != null) await updateDay(saveDate, { sleep });
      setSaved({ slot, kg: kgv, delta, date: saveDate });
    } finally { setBusy(false); }
  };

  if (saved) {
    const trend = weekTrend(m, saved.date);
    const goal = profile.weeklyGoalG || 800;
    return (
      <Sheet open onClose={onClose}>
        <div className="success">
          <div className="confetti">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % 5], animationDelay: `${(i % 7) * 0.08}s`, transform: `rotate(${i * 23}deg)` }} />)}</div>
          <div className="big-chk"><Icon name="check" size={52} stroke={3.2} /></div>
          <div className="num-big"><span>{saved.kg.toFixed(1)}</span><small>ק״ג</small></div>
          <div className="saved">{saved.slot === 'morning' ? 'משקל בוקר נשמר' : 'משקל ערב נשמר'}</div>
          {saved.delta != null && (
            <div className="card stat-row">
              <span className="ico" style={{ background: saved.slot === 'morning' ? '#fff3e6' : 'var(--lav)' }}>
                {saved.slot === 'morning' ? <Icon name="flame" size={26} className="bad" /> : <img src="/img/act-evening.png" width={34} height={34} alt="" />}
              </span>
              <div style={{ flex: 1 }}>
                <div className="k">{saved.slot === 'morning' ? (saved.delta >= 0 ? 'נשרפו בלילה' : 'עלייה בלילה') : 'עלייה במהלך היום'}</div>
                <div className="v"><span className="num">{Math.abs(saved.delta).toLocaleString('he-IL')}</span> גרם</div>
                <div className="hint">{saved.slot === 'morning' ? `אתמול בערב: ${prevEvening?.toFixed(1)}` : `הבוקר: ${morningToday?.toFixed(1)}`}</div>
              </div>
            </div>
          )}
          {trend != null && (
            <div className={`pill ${trend <= -700 ? '' : trend < 0 ? 'warn' : 'lav'}`}>
              <div className="t"><b style={{ fontSize: 16 }}>{trend <= -goal ? 'המגמה השבועית - מעולה' : trend < 0 ? 'המגמה השבועית בכיוון הנכון' : 'המגמה השבועית: עוד לא יורדת'}</b><div className="hint">{trend < 0 ? 'ירידה' : 'עלייה'} של <span className="num">{(Math.abs(trend) / 1000).toFixed(2)}</span> ק״ג בממוצע השבועי</div></div>
              <span className="chk"><Icon name={trend < 0 ? 'check' : 'chart'} size={20} stroke={3} /></span>
            </div>
          )}
          <button className="btn" style={{ background: 'linear-gradient(135deg,#18b3a0,#0d7f74)' }} onClick={onClose}>מעולה!</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title={date === today() ? (slot === 'morning' ? 'בוקר טוב' : 'ערב טוב') : heDate(date)}>
      <div className="seg">
        <button className={slot === 'morning' ? 'on' : ''} onClick={() => setSlot('morning')}>בוקר</button>
        <button className={slot === 'evening' ? 'on' : ''} onClick={() => setSlot('evening')}>ערב</button>
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
        <ActImg type={slot} size={38} />
        <span className="hint">{slot === 'morning' ? 'אחרי השירותים, לפני שתייה ואוכל' : 'לפני השינה, אחרי הארוחה האחרונה'}</span>
      </div>
      <WeightInput value={val} onChange={setVal} autoFocus />
      {delta != null && (
        <p style={{ textAlign: 'center', fontWeight: 700, color: 'var(--green-d)' }}>
          {slot === 'morning' ? (delta >= 0 ? 'נשרפו בלילה ' : 'עלייה בלילה ') : 'עלייה מהבוקר '}<span className="num">{Math.abs(delta).toLocaleString('he-IL')}</span> גרם
        </p>
      )}
      {slot === 'morning' && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="label" style={{ justifyContent: 'center' }}>כמה ישנת? <span className="hint" style={{ fontWeight: 500 }}>(לא חובה - עוזר לתובנות)</span></div>
          <div className="sleep-chips">
            {SLEEP.map(s => <button key={s} className={`chip ${sleep === s ? 'on' : ''}`} onClick={() => setSleep(sleep === s ? null : s)}>{s === 9 ? '9+' : s}</button>)}
          </div>
        </div>
      )}
      {showWhen ? (
        <label className="field"><span>מתי</span><input className="input" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></label>
      ) : <button className="link" style={{ justifySelf: 'center' }} onClick={() => setShowWhen(true)}>שקלתי בשעה אחרת</button>}
      <button className="btn" style={{ minHeight: 56, fontSize: 18 }} onClick={save} disabled={kgv == null || busy}><Icon name="check" />{busy ? 'שומר...' : 'שמור שקילה'}</button>
      {existing != null && (
        <button className="link" style={{ justifySelf: 'center', color: 'var(--red)' }} onClick={async () => { await setWeight(saveDate, slot, null); onClose(); }}>מחיקת השקילה הזו</button>
      )}
    </Sheet>
  );
}
