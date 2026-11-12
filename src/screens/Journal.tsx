import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { Top, useNav } from '../App';
import { Empty, Icon, Sheet, signedG, tone } from '../ui';
import { addDays, diffDays, heDate, shortDate, today, WD_SHORT, weekday } from '../lib/dates';
import { dayGain, dayKinds, nightBurn, toMap, vsDaysAgo, weeks } from '../lib/calc';
import { exportCsv, parseImport, type ImportResult } from '../lib/csv';
import type { Day } from '../lib/types';

export function Journal() {
  const { days, measures } = useStore();
  const { weigh } = useNav();
  const [view, setView] = useState<'days' | 'weeks'>('days');
  const [edit, setEdit] = useState<string | null>(null);
  const [imp, setImp] = useState(false);
  const [count, setCount] = useState(45);
  const m = useMemo(() => toMap(days), [days]);
  const withData = days.filter(d => d.morning != null || d.evening != null).map(d => d.date).sort();
  const first = withData[0];
  const t = today();
  const span = first ? Math.min(count, diffDays(t, first) + 1) : 0;
  const list = Array.from({ length: span }, (_, i) => addDays(t, -i));

  return (
    <>
      <Top title="יומן משקל" sub="בוקר, ערב, ומה שביניהם" />
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="seg" style={{ flex: 1 }}>
          <button className={view === 'days' ? 'on' : ''} onClick={() => setView('days')}>ימים</button>
          <button className={view === 'weeks' ? 'on' : ''} onClick={() => setView('weeks')}>שבועות</button>
        </div>
        <button className="icon-btn" onClick={() => setImp(true)} aria-label="ייבוא"><Icon name="upload" /></button>
        <button className="icon-btn" onClick={() => exportCsv(days, measures)} aria-label="ייצוא לאקסל"><Icon name="download" /></button>
      </div>

      {!first ? (
        <div className="card"><Empty img="/img/f-scale.png" title="היומן ריק" text="כל שקילה נכנסת לכאן כמו באקסל - עם השריפה הלילית, העלייה היומית וההשוואות מחושבות לבד.">
          <div className="row"><button className="btn sm" onClick={() => weigh()}>שקילה ראשונה</button><button className="btn soft sm" onClick={() => setImp(true)}>ייבוא מאקסל</button></div>
        </Empty></div>
      ) : view === 'days' ? (
        <div className="card" style={{ padding: '6px 12px' }}>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>יום</th><th>בוקר</th><th>ערב</th><th>לילה</th><th>יום</th><th>מול אתמול</th><th>מול שבוע</th></tr></thead>
              <tbody>
                {list.map(d => {
                  const day = m.get(d), nb = nightBurn(m, d), dg = dayGain(m, d), vy = vsDaysAgo(m, d, 1, 'morning'), vw = vsDaysAgo(m, d, 7, 'morning');
                  const k = dayKinds(m, measures, d);
                  return (
                    <tr key={d} className="click" onClick={() => setEdit(d)}>
                      <td className="d"><b>{shortDate(d)} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{WD_SHORT[weekday(d)]}</span></b>
                        <small>{[k.strength && 'כוח', k.aerobic && 'אירובי', k.cheat && 'צ׳יט'].filter(Boolean).join(' · ') || ' '}</small></td>
                      <td className="num"><b>{day?.morning != null ? day.morning.toFixed(1) : '—'}</b></td>
                      <td className="num">{day?.evening != null ? day.evening.toFixed(1) : '—'}</td>
                      <td className={`num ${nb != null && nb > 0 ? 'good' : ''}`}>{nb != null ? nb.toLocaleString('he-IL') : '—'}</td>
                      <td className="num">{signedG(dg)}</td>
                      <td className={`num ${tone(vy)}`}>{signedG(vy)}</td>
                      <td className={`num ${tone(vw)}`}>{signedG(vw)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {first && diffDays(t, first) + 1 > count && <button className="btn ghost sm" style={{ margin: '10px auto', display: 'flex' }} onClick={() => setCount(c => c + 60)}>עוד ימים</button>}
          <p className="hint" style={{ padding: '6px 2px 8px' }}>לילה = ערב אתמול פחות בוקר היום (כמה נשרף בשינה). יום = כמה עלית מהבוקר לערב. השוואות בגרם, לפי משקל הבוקר.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '6px 12px' }}>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>שבוע</th><th>ממוצע בוקר</th><th>שינוי</th><th>לילה ממוצע</th><th>יום ממוצע</th></tr></thead>
              <tbody>
                {weeks(m, first).map(w => (
                  <tr key={w.start}>
                    <td className="d"><b>{shortDate(w.start)}–{shortDate(addDays(w.start, 6))}</b><small>{w.n} שקילות בוקר</small></td>
                    <td className="num"><b>{w.avgMorning != null ? w.avgMorning.toFixed(2) : '—'}</b></td>
                    <td className={`num ${w.change != null && w.change <= -700 ? 'good' : tone(w.change)}`}>{signedG(w.change)}</td>
                    <td className="num">{w.avgNight != null ? Math.round(w.avgNight).toLocaleString('he-IL') : '—'}</td>
                    <td className="num">{w.avgDayGain != null ? signedG(w.avgDayGain) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ padding: '6px 2px 8px' }}>שבוע מתחיל ביום ראשון. שינוי = הממוצע מול השבוע שלפניו. היעד: ירידה של 700 עד 1,000 גרם.</p>
        </div>
      )}
      {edit && <DayEditor date={edit} onClose={() => setEdit(null)} />}
      {imp && <ImportSheet onClose={() => setImp(false)} />}
    </>
  );
}

function DayEditor({ date, onClose }: { date: string; onClose: () => void }) {
  const { days, updateDay, deleteDay } = useStore();
  const { weigh, toast } = useNav();
  const day: Day = days.find(d => d.date === date) || { date };
  const [note, setNote] = useState(day.note || '');
  const tags = day.tags || {};
  const toggle = (k: 'strength' | 'aerobic' | 'cheat') => updateDay(date, { tags: { ...tags, [k]: !tags[k] } });
  return (
    <Sheet open onClose={onClose} title={heDate(date)}>
      <div className="grid2">
        <button className="card wcard" style={{ minHeight: 110 }} onClick={() => { onClose(); weigh('morning', date); }}>
          <div className="wtitle"><img src="/img/act-morning.png" alt="" />בוקר</div>
          <div className="big" style={{ fontSize: 30 }}><span className="num">{day.morning != null ? day.morning.toFixed(1) : '--.-'}</span></div>
        </button>
        <button className="card wcard" style={{ minHeight: 110 }} onClick={() => { onClose(); weigh('evening', date); }}>
          <div className="wtitle"><img src="/img/act-evening.png" alt="" />ערב</div>
          <div className="big" style={{ fontSize: 30 }}><span className="num">{day.evening != null ? day.evening.toFixed(1) : '--.-'}</span></div>
        </button>
      </div>
      <div>
        <div className="label" style={{ marginBottom: 8 }}>מה היה ביום הזה</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className={`chip ${tags.strength ? 'on' : ''}`} onClick={() => toggle('strength')}>אימון כוח</button>
          <button className={`chip ${tags.aerobic ? 'on' : ''}`} onClick={() => toggle('aerobic')}>אירובי</button>
          <button className={`chip ${tags.cheat ? 'on' : ''}`} onClick={() => toggle('cheat')}>צ׳יט דיי</button>
        </div>
        <p className="hint" style={{ marginTop: 6 }}>כך התובנות יודעות אם הלילה שאחרי שרף יותר בזכות כוח או אירובי. מדידת ריצה/כוח מסמנת לבד.</p>
      </div>
      <label className="field"><span>הערה</span><textarea className="input" value={note} onChange={e => setNote(e.target.value)} onBlur={() => note !== (day.note || '') && updateDay(date, { note })} placeholder="ישנתי רע, אירוע, מחלה..." /></label>
      {(day.morning != null || day.evening != null) && <button className="btn danger" onClick={async () => { await deleteDay(date); toast('היום נמחק'); onClose(); }}>מחיקת כל היום</button>}
    </Sheet>
  );
}

function ImportSheet({ onClose }: { onClose: () => void }) {
  const { importDays, saveMeasure, days } = useStore();
  const { toast } = useNav();
  const [text, setText] = useState('');
  const [res, setRes] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const read = (t: string) => { setText(t); setRes(t.trim() ? parseImport(t) : null); };
  const exists = new Set(days.filter(d => d.morning != null || d.evening != null).map(d => d.date));
  const go = async () => {
    if (!res) return;
    setBusy(true);
    try {
      if (res.kind === 'days') { const n = await importDays(res.days); toast(`יובאו ${n} ימים`); }
      if (res.kind === 'measures') { for (const x of res.measures) await saveMeasure(x); toast(`יובאו ${res.measures.length} מדידות`); }
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title="ייבוא מאקסל / גוגל שיטס" tall>
      <ol className="steps">
        <li>בגיליון, מסמנים את הטבלה כולל שורת הכותרות (תאריך, משקל בוקר, משקל ערב) ומעתיקים.</li>
        <li>מדביקים כאן. עובד גם עם הגיליון של המדידות הקצרות (סוג, לפני, אחרי, שתייה).</li>
      </ol>
      <textarea className="input" style={{ minHeight: 160, direction: 'ltr', fontSize: 13 }} placeholder="הדבק כאן..." value={text} onChange={e => read(e.target.value)} />
      <label className="btn ghost sm" style={{ justifySelf: 'start' }}>
        <Icon name="upload" size={18} />או קובץ CSV
        <input type="file" accept=".csv,.tsv,.txt" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) read(await f.text()); }} />
      </label>
      {res && (
        <div className="card" style={{ background: res.kind === 'none' ? 'var(--red-l)' : 'var(--green-l)' }}>
          {res.kind === 'none' ? <b>לא מצאתי עמודת תאריך + משקל. ודא ששורת הכותרות הועתקה.</b> :
            res.kind === 'days' ? <><b>{res.days.length} ימים מוכנים לייבוא</b><div className="hint">{res.days.filter(d => exists.has(d.date)).length ? `${res.days.filter(d => exists.has(d.date)).length} מהם כבר קיימים - הערכים מהגיליון יחליפו את הקיימים. ` : ''}{res.skipped ? `${res.skipped} שורות ריקות דולגו.` : ''}</div></> :
              <><b>{res.measures.length} מדידות לפני/אחרי מוכנות לייבוא</b><div className="hint">{res.skipped ? `${res.skipped} שורות דולגו.` : ''}</div></>}
        </div>
      )}
      <button className="btn" disabled={!res || res.kind === 'none' || busy} onClick={go}>{busy ? 'מייבא...' : 'ייבוא'}</button>
    </Sheet>
  );
}
