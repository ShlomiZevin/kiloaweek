import { useEffect, useMemo, useState } from 'react';
import { newId, useStore } from '../lib/store';
import { useNav } from '../App';
import { ActImg, Empty, Icon, Sheet, WeightInput, parseKg } from '../ui';
import { ACTS, actHe, actStats, eOf, isTimed, measureMinutes, measureNet, mOf, toMap } from '../lib/calc';
import { addDays, fromLocalInput, shortDate, dayOf, timeOf, toLocalInput, today } from '../lib/dates';
import type { ActType, Measure } from '../lib/types';

const pad = (n: number) => String(n).padStart(2, '0');
function useClock(from: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const s = Math.max(0, Math.floor((now - from) / 1000));
  return `${s >= 3600 ? pad(Math.floor(s / 3600)) + ':' : ''}${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}
const lastAct = (): ActType => { try { return (localStorage.getItem('kaw-act') as ActType) || 'run'; } catch { return 'run'; } };

/** Before / after anything: same clothes, add what you drank meanwhile -> exactly how much the body lost. */
export function MeasureScreen() {
  const { measures, days, saveMeasure } = useStore();
  const { toast } = useNav();
  const m = useMemo(() => toMap(days), [days]);
  const open = measures.find(x => x.afterKg == null);
  const [type, setType] = useState<ActType>(lastAct);
  const [before, setBefore] = useState('');
  const [manual, setManual] = useState(false);
  const [edit, setEdit] = useState<Measure | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  useEffect(() => { try { localStorage.setItem('kaw-act', type); } catch {} }, [type]);

  // start from the latest weight there is
  useEffect(() => {
    const last = measures.find(x => x.afterKg != null && Date.now() - (x.endedAt || x.startedAt) < 3 * 3600_000);
    const t = today();
    const v = last?.afterKg ?? eOf(m, t) ?? mOf(m, t) ?? eOf(m, addDays(t, -1));
    if (v != null && !before) setBefore(v.toFixed(1));
  }, [days, measures]); // eslint-disable-line

  const start = async () => {
    const b = parseKg(before); if (b == null) return;
    await saveMeasure({ id: newId(), type, beforeKg: b, startedAt: Date.now() });
    setJustDone(null);
    toast(isTimed(type) ? 'הטיימר רץ. בסוף - שוקלים שוב' : 'נשמר. שוקלים שוב אחרי');
  };
  const stats = actStats(measures);
  const st = stats.find(s => s.type === type)!;
  const hist = measures.filter(x => x.type === type && x.afterKg != null).slice(0, 8);
  const done = justDone ? measures.find(x => x.id === justDone) : null;

  return (
    <div className="stack">
      {open ? <LiveMeasure m={open} onDone={id => setJustDone(id)} /> : (
        <>
          {done && <ResultCard x={done} measures={measures} />}
          <div className="label center">מה עושים?</div>
          <ActRow value={type} onChange={setType} />
          <div className="card stack">
            <div className="label center">המשקל לפני</div>
            <WeightInput value={before} onChange={setBefore} />
          </div>
          <SameClothes />
          <button className="btn" onClick={start} disabled={parseKg(before) == null}>{isTimed(type) ? 'התחלה - הטיימר רץ' : 'שמירת "לפני"'}</button>
          <button className="link" onClick={() => setManual(true)} style={{ justifySelf: 'center' }}>שכחתי - להזין לפני ואחרי ביחד</button>
        </>
      )}

      <div className="sec-title"><span className="row" style={{ gap: 8 }}><ActImg type={type} size={28} />{actHe(type) ? `${actHe(type)} - הממוצע שלך` : 'הממוצע שלך'}</span></div>
      <div className="card">
        {st.n ? (
          <div className="result3">
            <div><div className="v num">{Math.round(st.avgNet!).toLocaleString('he-IL')}</div><div className="k">גרם בממוצע</div></div>
            <div><div className="v num">{st.perMin != null ? st.perMin.toFixed(1) : '—'}</div><div className="k">גרם לדקה</div></div>
            <div><div className="v num">{st.n}</div><div className="k">מדידות</div></div>
          </div>
        ) : <p className="hint">עוד אין מדידות כאלה. אחרי 2-3 מדידות יודעים כמה זה מוריד לך.</p>}
      </div>

      {hist.length > 0 && (
        <div className="card"><div className="scroll-x">
          <table className="tbl">
            <thead><tr><th>מתי</th><th>לפני</th><th>נטו</th>{isTimed(type) && <th>דקות</th>}{isTimed(type) && <th>ג׳/דקה</th>}<th></th></tr></thead>
            <tbody>
              {hist.map(x => {
                const net = measureNet(x)!, mn = measureMinutes(x);
                return (
                  <tr key={x.id} className="click" onClick={() => setEdit(x)}>
                    <td className="d"><b>{shortDate(dayOf(x.startedAt))}</b><small>{timeOf(x.startedAt)}</small></td>
                    <td className="num">{x.beforeKg.toFixed(1)}</td>
                    <td className="num"><b>{net.toLocaleString('he-IL')}</b> ג׳</td>
                    {isTimed(type) && <td className="num">{mn ?? '—'}</td>}
                    {isTimed(type) && <td className="num">{mn ? (net / mn).toFixed(1) : '—'}</td>}
                    <td style={{ color: 'var(--muted)' }}><Icon name="edit" size={16} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div></div>
      )}

      <div className="sec-title">כל הסוגים</div>
      <div className="card">
        {stats.some(s => s.n) ? (<div className="scroll-x">
          <table className="tbl">
            <thead><tr><th>סוג</th><th>ממוצע</th><th>ג׳/דקה</th><th>מדידות</th></tr></thead>
            <tbody>
              {stats.filter(s => s.n).map(s => (
                <tr key={s.type} className="click" onClick={() => setType(s.type)}>
                  <td><span className="row" style={{ gap: 8 }}><ActImg type={s.type} size={28} />{actHe(s.type)}</span></td>
                  <td className="num">{Math.round(s.avgNet!).toLocaleString('he-IL')} ג׳</td>
                  <td className="num">{s.perMin != null ? s.perMin.toFixed(1) : '—'}</td>
                  <td className="num">{s.n}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : <Empty img="/img/f-tape.png" title="המעבדה של הגוף שלך" text="שוקלים לפני ואחרי כל דבר - באותם בגדים - ורואים בדיוק כמה הגוף מאבד. נטו = לפני פחות אחרי, ועוד מה ששתיתם בינתיים." />}
      </div>
      {manual && <MeasureEditor initial={{ id: newId(), type, beforeKg: parseKg(before) || 0, startedAt: Date.now() - 30 * 60000 }} isNew onClose={() => setManual(false)} />}
      {edit && <MeasureEditor initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

/** Pick what you're doing. The toilet ones come last, pictures only (his rule). */
function ActRow({ value, onChange, small }: { value: ActType; onChange: (t: ActType) => void; small?: boolean }) {
  return (
    <div className={`act-row ${small ? 'small' : ''}`}>
      {ACTS.map(a => (
        <button key={a.type} className={`act-c ${value === a.type ? 'on' : ''}`} onClick={() => onChange(a.type)} aria-label={a.he || 'שירותים'} aria-pressed={value === a.type}>
          <span className="c"><ActImg type={a.type} size={small ? 30 : 34} /></span>
          <span className="l">{value === a.type ? a.he : ''}</span>
        </button>
      ))}
    </div>
  );
}
const SameClothes = () => (
  <div className="note"><Icon name="info" size={20} /><span>אותם בגדים לפני ואחרי, בלי שיער רטוב. שתיתם בינתיים? מוסיפים - וככה רואים בדיוק כמה הגוף איבד.</span></div>
);

/** A measurement in progress - lives in the database (a drink too, the moment it's added), so closing the app loses nothing. */
export function LiveMeasure({ m, compact, onDone }: { m: Measure; compact?: boolean; onDone?: (id: string) => void }) {
  const { saveMeasure, deleteMeasure } = useStore();
  const { go, toast } = useNav();
  const clock = useClock(m.startedAt);
  const [after, setAfter] = useState(m.beforeKg.toFixed(1));
  const drink = m.drinkMl || 0;
  const timed = isTimed(m.type);
  const addDrink = (ml: number) => saveMeasure({ ...m, drinkMl: Math.max(0, drink + ml) });
  const finish = async () => {
    const a = parseKg(after); if (a == null) return;
    const endedAt = Date.now();
    await saveMeasure({ ...m, afterKg: a, drinkMl: drink, endedAt, minutes: timed ? Math.max(1, Math.round((endedAt - m.startedAt) / 60000)) : null });
    const net = Math.round((m.beforeKg - a) * 1000) + drink;
    toast(`הגוף איבד ${net.toLocaleString('he-IL')} גרם`);
    onDone?.(m.id);
  };
  if (compact) {
    return (
      <button className="next live" onClick={() => go('measure')}>
        <span className="ni"><ActImg type={m.type} size={40} /></span>
        <div><small>{actHe(m.type) ? `${actHe(m.type)} · ` : ''}לפני <span className="num">{m.beforeKg.toFixed(1)}</span> ק״ג</small><b>מדידה בתהליך - לסיים</b></div>
        {timed && <span className="clock num">{clock}</span>}
      </button>
    );
  }
  return (
    <>
      <div className="card live-head">
        <div className="lh-w">
          <div className="k">המשקל לפני</div>
          <div className="v"><span className="num">{m.beforeKg.toFixed(1)}</span><small>ק״ג</small></div>
          <div className="hint">{actHe(m.type) ? `${actHe(m.type)} · ` : ''}{timeOf(m.startedAt)}</div>
        </div>
        <span className="vsep" />
        {timed
          ? <div className="tm"><Icon name="timer" size={30} /><div><div className="clock num">{clock}</div><div className="hint">עברו מאז</div></div></div>
          : <div className="tm"><ActImg type={m.type} size={52} /></div>}
      </div>
      <div className="card stack">
        <div className="label center">המשקל אחרי</div>
        <WeightInput value={after} onChange={setAfter} />
      </div>
      <div className="card stack">
        <div className="row between"><b>כמה שתיתם בינתיים?</b><span className="drop-ic"><Icon name="drop" size={24} /></span></div>
        <div className="drinks">{[100, 250, 500].map(ml => <button key={ml} className="chip" onClick={() => addDrink(ml)}>+<span className="num">{ml}</span> מ״ל</button>)}</div>
        {drink > 0 && <div className="drink-total"><Icon name="check" size={16} stroke={3} /><span><span className="num">{drink.toLocaleString('he-IL')}</span> מ״ל נוספו</span><button className="link" onClick={() => saveMeasure({ ...m, drinkMl: 0 })}>איפוס</button></div>}
      </div>
      <SameClothes />
      <button className="btn" onClick={finish} disabled={parseKg(after) == null}><Icon name="check" size={20} stroke={3} />סיימתי</button>
      <button className="link" style={{ justifySelf: 'center', color: 'var(--red)' }} onClick={async () => { await deleteMeasure(m.id); toast('המדידה בוטלה'); }}>ביטול המדידה</button>
    </>
  );
}

function ResultCard({ x, measures }: { x: Measure; measures: Measure[] }) {
  const net = measureNet(x);
  if (net == null) return null;
  const mn = measureMinutes(x);
  const others = measures.filter(y => y.type === x.type && y.id !== x.id && measureNet(y) != null);
  const avg = others.length ? others.reduce((a, y) => a + measureNet(y)!, 0) / others.length : null;
  return (
    <div className="card stack" style={{ background: 'var(--mint)', borderColor: '#d3eedf' }}>
      <div className="row"><ActImg type={x.type} size={40} /><b style={{ fontSize: 17 }}>{actHe(x.type) ? `${actHe(x.type)} - התוצאה` : 'התוצאה'}</b></div>
      <div className="result3">
        <div><div className="v num" style={{ color: 'var(--green-d)' }}>{net.toLocaleString('he-IL')}</div><div className="k">גרם נטו</div></div>
        <div><div className="v num">{mn && isTimed(x.type) ? (net / mn).toFixed(1) : '—'}</div><div className="k">גרם לדקה</div></div>
        <div><div className="v num">{avg != null ? `${net >= avg ? '+' : '−'}${Math.round(Math.abs(((net - avg) / (avg || 1)) * 100))}%` : '—'}</div><div className="k">מול הממוצע שלך</div></div>
      </div>
      {x.drinkMl ? <p className="hint">כולל {x.drinkMl} מ״ל ששתיתם בינתיים (נוספו לנטו).</p> : null}
    </div>
  );
}

function MeasureEditor({ initial, isNew, onClose }: { initial: Measure; isNew?: boolean; onClose: () => void }) {
  const { saveMeasure, deleteMeasure } = useStore();
  const { toast } = useNav();
  const [type, setType] = useState<ActType>(initial.type);
  const [b, setB] = useState(initial.beforeKg ? initial.beforeKg.toFixed(1) : '');
  const [a, setA] = useState(initial.afterKg != null ? initial.afterKg.toFixed(1) : '');
  const [drink, setDrink] = useState(String(initial.drinkMl || ''));
  const [mins, setMins] = useState(String(measureMinutes(initial) ?? ''));
  const [when, setWhen] = useState(toLocalInput(initial.startedAt));
  const save = async () => {
    const bk = parseKg(b), ak = parseKg(a); if (bk == null || ak == null) return;
    const startedAt = fromLocalInput(when); const minutes = isTimed(type) ? parseInt(mins) || null : null;
    await saveMeasure({ ...initial, type, beforeKg: bk, afterKg: ak, drinkMl: parseInt(drink) || 0, startedAt, minutes, endedAt: minutes ? startedAt + minutes * 60000 : startedAt });
    toast('נשמר'); onClose();
  };
  return (
    <Sheet open onClose={onClose} title={isNew ? 'מדידה ידנית' : 'עריכת מדידה'}>
      <ActRow value={type} onChange={setType} small />
      <div className="grid2">
        <label className="field"><span>לפני (ק״ג)</span><input className="input num" inputMode="decimal" value={b} onChange={e => setB(e.target.value)} /></label>
        <label className="field"><span>אחרי (ק״ג)</span><input className="input num" inputMode="decimal" value={a} onChange={e => setA(e.target.value)} /></label>
        <label className="field"><span>שתייה בינתיים (מ״ל)</span><input className="input num" inputMode="numeric" value={drink} onChange={e => setDrink(e.target.value.replace(/\D/g, ''))} /></label>
        {isTimed(type) && <label className="field"><span>דקות</span><input className="input num" inputMode="numeric" value={mins} onChange={e => setMins(e.target.value.replace(/\D/g, ''))} /></label>}
      </div>
      <label className="field"><span>מתי התחיל</span><input className="input" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></label>
      <button className="btn" onClick={save} disabled={parseKg(b) == null || parseKg(a) == null}>שמירה</button>
      {!isNew && <button className="btn danger" onClick={async () => { await deleteMeasure(initial.id); toast('נמחק'); onClose(); }}>מחיקה</button>}
    </Sheet>
  );
}
