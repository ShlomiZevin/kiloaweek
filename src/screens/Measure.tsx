import { useEffect, useMemo, useState } from 'react';
import { newId, useStore } from '../lib/store';
import { Top, useNav } from '../App';
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

export function MeasureScreen() {
  const { measures, days, saveMeasure } = useStore();
  const { toast } = useNav();
  const m = useMemo(() => toMap(days), [days]);
  const open = measures.find(x => x.afterKg == null);
  const [type, setType] = useState<ActType>('pee');
  const [before, setBefore] = useState('');
  const [manual, setManual] = useState(false);
  const [edit, setEdit] = useState<Measure | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);

  // start from the latest weight he has
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
    toast(isTimed(type) ? `יצאת ל${actHe(type)} - הטיימר רץ` : 'נשמר. שוקלים שוב אחרי');
  };
  const stats = actStats(measures);
  const st = stats.find(s => s.type === type)!;
  const hist = measures.filter(x => x.type === type && x.afterKg != null).slice(0, 8);
  const done = justDone ? measures.find(x => x.id === justDone) : null;

  return (
    <>
      <Top title="מדידה לפני / אחרי" sub="להכיר את הגוף" />
      <div className="stack">
        {open ? <LiveMeasure m={open} onDone={id => setJustDone(id)} /> : (
          <>
            {done && <ResultCard x={done} measures={measures} />}
            <div className="card stack">
              <div className="label">מה מודדים?</div>
              <div className="acts">
                {ACTS.map(a => (
                  <button key={a.type} className={`act ${type === a.type ? 'on' : ''}`} onClick={() => setType(a.type)}>
                    <ActImg type={a.type} size={46} />{a.he}
                  </button>
                ))}
              </div>
              <div className="label" style={{ marginTop: 6 }}>משקל לפני</div>
              <WeightInput value={before} onChange={setBefore} />
              <p className="hint" style={{ textAlign: 'center' }}>
                {isTimed(type) ? 'שוקלים ממש לפני היציאה. כשחוזרים - שוקלים שוב ורושמים כמה שתית בדרך.' : 'שוקלים עכשיו, ושוב מיד אחרי.'}
              </p>
              <button className="btn" onClick={start} disabled={parseKg(before) == null}>{isTimed(type) ? `התחלת ${actHe(type)}` : 'שמירת "לפני"'}</button>
              <button className="link" onClick={() => setManual(true)} style={{ justifySelf: 'center' }}>שכחתי - להזין לפני ואחרי ביחד</button>
            </div>
          </>
        )}

        <div className="sec-title">{actHe(type)} - הממוצע שלך</div>
        <div className="card">
          {st.n ? (
            <div className="result3">
              <div><div className="v num">{Math.round(st.avgNet!).toLocaleString('he-IL')}</div><div className="k">גרם בממוצע</div></div>
              <div><div className="v num">{st.perMin != null ? st.perMin.toFixed(1) : '—'}</div><div className="k">גרם לדקה</div></div>
              <div><div className="v num">{st.n}</div><div className="k">מדידות</div></div>
            </div>
          ) : <p className="hint">עוד אין מדידות של {actHe(type)}. אחרי 2-3 מדידות תדע כמה זה שורף לך.</p>}
        </div>

        {hist.length > 0 && (
          <div className="card">
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
          </div>
        )}

        <div className="sec-title">כל הסוגים</div>
        <div className="card">
          {stats.some(s => s.n) ? (
            <table className="tbl">
              <thead><tr><th>סוג</th><th>ממוצע</th><th>ג׳/דקה</th><th>מדידות</th></tr></thead>
              <tbody>
                {stats.filter(s => s.n).map(s => (
                  <tr key={s.type} className="click" onClick={() => setType(s.type)}>
                    <td><span className="row" style={{ gap: 8 }}><ActImg type={s.type} size={26} />{actHe(s.type)}</span></td>
                    <td className="num">{Math.round(s.avgNet!).toLocaleString('he-IL')} ג׳</td>
                    <td className="num">{s.perMin != null ? s.perMin.toFixed(1) : '—'}</td>
                    <td className="num">{s.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty img="/img/f-tape.png" title="המעבדה של הגוף שלך" text="כל מדידה לפני/אחרי מלמדת משהו: כמה גרם פיפי, כמה ריצה של שעה, כמה בריכה. נטו = לפני פחות אחרי, ועוד מה ששתית בדרך." />}
        </div>
      </div>
      {manual && <MeasureEditor initial={{ id: newId(), type, beforeKg: parseKg(before) || 0, startedAt: Date.now() - 30 * 60000 }} isNew onClose={() => setManual(false)} />}
      {edit && <MeasureEditor initial={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

/** A measurement in progress - lives in the database, so closing the app mid-run loses nothing. */
export function LiveMeasure({ m, compact, onDone }: { m: Measure; compact?: boolean; onDone?: (id: string) => void }) {
  const { saveMeasure, deleteMeasure } = useStore();
  const { go, toast } = useNav();
  const clock = useClock(m.startedAt);
  const [after, setAfter] = useState(m.beforeKg.toFixed(1));
  const [drink, setDrink] = useState('');
  const timed = isTimed(m.type);
  const finish = async () => {
    const a = parseKg(after); if (a == null) return;
    const endedAt = Date.now();
    await saveMeasure({ ...m, afterKg: a, drinkMl: parseInt(drink) || 0, endedAt, minutes: timed ? Math.max(1, Math.round((endedAt - m.startedAt) / 60000)) : null });
    const net = Math.round((m.beforeKg - a) * 1000) + (parseInt(drink) || 0);
    toast(`${actHe(m.type)}: ${net.toLocaleString('he-IL')} גרם`);
    onDone?.(m.id);
  };
  if (compact) {
    return (
      <button className="card live row" onClick={() => go('measure')} style={{ textAlign: 'right' }}>
        <ActImg type={m.type} size={44} />
        <div style={{ flex: 1 }}><b>{actHe(m.type)} בתהליך</b><div className="hint">לפני: {m.beforeKg.toFixed(1)} ק״ג · לחץ כדי לסיים</div></div>
        <span className="clock num" style={{ fontSize: 22, fontWeight: 900, color: 'var(--green-d)' }}>{clock}</span>
      </button>
    );
  }
  return (
    <div className="card live stack">
      <div className="row between">
        <div className="row"><ActImg type={m.type} size={48} /><div><b style={{ fontSize: 18 }}>{actHe(m.type)}</b><div className="hint">לפני: <span className="num">{m.beforeKg.toFixed(1)}</span> ק״ג · {timeOf(m.startedAt)}</div></div></div>
        <span className="badge ok">מדידה בתהליך</span>
      </div>
      {timed && <div style={{ textAlign: 'center' }}><div className="label" style={{ justifyContent: 'center' }}><Icon name="timer" size={18} />זמן מתחילת הפעילות</div><div className="clock num">{clock}</div></div>}
      <div className="label">משקל אחרי</div>
      <WeightInput value={after} onChange={setAfter} />
      {timed && (
        <label className="field"><span>כמה שתית בדרך? (מ״ל)</span>
          <input className="input" inputMode="numeric" placeholder="0" value={drink} onChange={e => setDrink(e.target.value.replace(/\D/g, ''))} />
        </label>
      )}
      <button className="btn" onClick={finish} disabled={parseKg(after) == null}>סיום המדידה</button>
      <button className="link" style={{ justifySelf: 'center', color: 'var(--red)' }} onClick={async () => { await deleteMeasure(m.id); toast('המדידה בוטלה'); }}>ביטול המדידה</button>
    </div>
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
      <div className="row"><ActImg type={x.type} size={40} /><b style={{ fontSize: 17 }}>{actHe(x.type)} - התוצאה</b></div>
      <div className="result3">
        <div><div className="v num" style={{ color: 'var(--green-d)' }}>{net.toLocaleString('he-IL')}</div><div className="k">גרם נטו</div></div>
        <div><div className="v num">{mn && isTimed(x.type) ? (net / mn).toFixed(1) : '—'}</div><div className="k">גרם לדקה</div></div>
        <div><div className="v num">{avg != null ? `${net >= avg ? '+' : '−'}${Math.round(Math.abs(((net - avg) / (avg || 1)) * 100))}%` : '—'}</div><div className="k">מול הממוצע שלך</div></div>
      </div>
      {x.drinkMl ? <p className="hint">כולל {x.drinkMl} מ״ל ששתית בדרך (נוספו לנטו).</p> : null}
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
      <div className="acts">{ACTS.map(x => <button key={x.type} className={`act ${type === x.type ? 'on' : ''}`} onClick={() => setType(x.type)}><ActImg type={x.type} size={36} />{x.he}</button>)}</div>
      <div className="grid2">
        <label className="field"><span>לפני (ק״ג)</span><input className="input num" inputMode="decimal" value={b} onChange={e => setB(e.target.value)} /></label>
        <label className="field"><span>אחרי (ק״ג)</span><input className="input num" inputMode="decimal" value={a} onChange={e => setA(e.target.value)} /></label>
        {isTimed(type) && <label className="field"><span>דקות</span><input className="input num" inputMode="numeric" value={mins} onChange={e => setMins(e.target.value.replace(/\D/g, ''))} /></label>}
        {isTimed(type) && <label className="field"><span>שתייה (מ״ל)</span><input className="input num" inputMode="numeric" value={drink} onChange={e => setDrink(e.target.value.replace(/\D/g, ''))} /></label>}
      </div>
      <label className="field"><span>מתי התחיל</span><input className="input" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></label>
      <button className="btn" onClick={save} disabled={parseKg(b) == null || parseKg(a) == null}>שמירה</button>
      {!isNew && <button className="btn danger" onClick={async () => { await deleteMeasure(initial.id); toast('נמחק'); onClose(); }}>מחיקה</button>}
    </Sheet>
  );
}
