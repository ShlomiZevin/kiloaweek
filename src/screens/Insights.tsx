import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../App';
import { ActImg, Empty, Icon } from '../ui';
import { C, Legend, MiniLine, WeightChart } from '../Chart';
import { addDays, diffDays, shortDate, today, WD_SHORT, timeOf } from '../lib/dates';
import { actHe, actStats, avg7, mOf, research, toMap, weekTrend } from '../lib/calc';
import { analysisData, sleepEffect } from '../lib/analysis';
import type { Analysis } from '../lib/types';

const RANGES = [{ d: 30, he: '30 יום' }, { d: 60, he: '60 יום' }, { d: 90, he: '90 יום' }, { d: 0, he: 'הכול' }];

export function Insights() {
  const { days, measures } = useStore();
  const { go } = useNav();
  const [range, setRange] = useState(60);
  const m = useMemo(() => toMap(days), [days]);
  const t = today();
  const first = days.filter(d => d.morning != null || d.evening != null).map(d => d.date).sort()[0];
  const from = !first ? addDays(t, -30) : range === 0 ? first : (diffDays(t, first) < range ? first : addDays(t, -range + 1));
  const r = useMemo(() => research(m, measures, from, t), [m, measures, from, t]);
  const se = useMemo(() => sleepEffect(m, from, t), [m, from, t]);
  const stats = actStats(measures).filter(s => s.n);
  const trend = weekTrend(m, t);

  if (!first) return (
    <>
      <div className="card"><Empty img="/img/f-scale.png" title="התובנות נבנות מהשקילות שלך" text="שבוע של שקילות בוקר וערב, וכמה מדידות לפני/אחרי - ומתחילים לראות כמה אתה שורף בלילה, מה שורף לך הכי הרבה, ואיזה יום הכי כבד." /></div>
    </>
  );

  const dates: string[] = [];
  for (let d = from; diffDays(t, d) >= 0; d = addDays(d, 1)) dates.push(d);
  const series = [
    { key: 'a', he: 'ממוצע 7 ימים', color: C.avg, kind: 'line' as const, pts: dates.map(d => ({ date: d, v: avg7(m, d) })).filter((p): p is { date: string; v: number } => p.v != null) },
    { key: 'm', he: 'בוקר', color: C.morning, kind: 'dots' as const, pts: dates.filter(d => m.get(d)?.morning != null).map(d => ({ date: d, v: m.get(d)!.morning! })) },
    { key: 'e', he: 'ערב', color: C.evening, kind: 'dots' as const, pts: dates.filter(d => m.get(d)?.evening != null).map(d => ({ date: d, v: m.get(d)!.evening! })) },
  ];
  // total change over the range, by the 7-day average (or first/last morning)
  const a0 = series[0].pts[0]?.v ?? mOf(m, from), a1 = series[0].pts[series[0].pts.length - 1]?.v ?? null;
  const total = a0 != null && a1 != null ? a1 - a0 : null;
  const maxNight = Math.max(1, ...r.nightByKind.map(k => k.avg || 0));
  const maxDev = Math.max(1, ...r.weekdayDev.map(w => Math.abs(w.dev || 0)));
  const sleepRows = [['פחות מ-6 שעות', se.short], ['6 עד 7.5 שעות', se.mid], ['7.5 שעות ומעלה', se.long]] as const;
  const maxSleep = Math.max(1, ...sleepRows.map(([, v]) => v.avg || 0));

  return (
    <>
      <div className="ghead">
        <div className="gk">ההתקדמות שלי</div>
        {total != null && <div className="v"><span>{total <= 0 ? '−' : '+'}{Math.abs(total).toFixed(1)}</span><small>ק״ג</small></div>}
        <div className="s">ב-{diffDays(t, from) + 1} הימים האחרונים, לפי הממוצע השבועי</div>
        {trend != null && <div className="hp"><Icon name={trend <= -700 ? 'check' : 'chart'} size={16} stroke={3} />{trend <= -700 ? 'בכיוון היעד' : trend < 0 ? 'יורד, מתחת ליעד' : 'השבוע לא יורד'}: <span className="num">{(Math.abs(trend) / 1000).toFixed(2)}</span> ק״ג בשבוע</div>}
      </div>
      <div className="seg" style={{ marginBottom: 12 }}>
        {RANGES.map(x => <button key={x.d} className={range === x.d ? 'on' : ''} onClick={() => setRange(x.d)}>{x.he}</button>)}
      </div>
      <div className="stack">
        <div className="card stack">
          <b>המשקל שלך</b>
          <WeightChart series={series} from={from} to={t} />
          <Legend items={series.map(s => ({ he: s.he, color: s.color, kind: s.kind }))} />
        </div>

        <AnalysisCard />

        {r.conclusions.length > 0 && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="sec-title" style={{ margin: '8px 2px 0' }}>תובנות מהנתונים שלך</div>
            {r.conclusions.map((c, i) => (
              <div key={i} className={`ins ${i % 3 === 1 ? 'mint' : ''}`}><span className="ii"><Icon name={['chart', 'flame', 'scale', 'timer', 'spark'][i % 5]} size={20} /></span><p style={{ marginTop: 0, fontSize: 15, color: 'var(--ink)' }}>{c}</p></div>
            ))}
          </div>
        )}

        <div className="grid2">
          <div className="card tile"><div className="k">שריפה לילית ממוצעת</div><div className="v num">{r.avgNight != null ? Math.round(r.avgNight).toLocaleString('he-IL') : '—'}</div><div className="hint">גרם, ערב → בוקר</div></div>
          <div className="card tile"><div className="k">עלייה יומית ממוצעת</div><div className="v num">{r.avgDayGain != null ? Math.round(r.avgDayGain).toLocaleString('he-IL') : '—'}</div><div className="hint">גרם, בוקר → ערב</div></div>
        </div>

        <div className="card stack">
          <b>שריפה לילית לפי שבוע</b>
          <MiniLine pts={r.nightTrend.map(x => ({ label: shortDate(x.start), v: x.avg }))} />
          <p className="hint">כשהקו עולה - הגוף שורף יותר במנוחה. אימוני כוח ושינה טובה מעלים אותו.</p>
        </div>

        <div className="card stack">
          <b>אירובי או שריר? הלילה שאחרי</b>
          <div className="bars">
            {r.nightByKind.map(k => (
              <div key={k.kind} className="hbar">
                <span>{k.he}</span>
                <span className="tr"><i style={{ width: `${((k.avg || 0) / maxNight) * 100}%`, background: k.kind === 'rest' ? '#a9b2c6' : k.kind === 'strength' ? '#ea7a1e' : k.kind === 'aerobic' ? C.evening : C.avg }} /></span>
                <b>{k.avg != null ? `${Math.round(k.avg).toLocaleString('he-IL')} ג׳` : '—'}<span className="hint" style={{ fontWeight: 500 }}> ×{k.n}</span></b>
              </div>
            ))}
          </div>
          <p className="hint">ממוצע הגרמים שנשרפו בלילה, לפי מה שעשית ביום שלפניו. ימי צ׳יט לא נספרים.</p>
        </div>

        <div className="card stack">
          <b>שינה ושריפה לילית</b>
          {sleepRows.some(([, v]) => v.n) ? (
            <div className="bars">
              {sleepRows.map(([he, v]) => (
                <div key={he} className="hbar"><span>{he}</span><span className="tr"><i style={{ width: `${((v.avg || 0) / maxSleep) * 100}%`, background: 'var(--indigo)' }} /></span><b>{v.avg != null ? `${Math.round(v.avg).toLocaleString('he-IL')} ג׳` : '—'}<span className="hint" style={{ fontWeight: 500 }}> ×{v.n}</span></b></div>
              ))}
            </div>
          ) : <p className="hint">בשקילת הבוקר אפשר לסמן כמה ישנת - ופה יופיע אם שינה ארוכה שורפת לך יותר.</p>}
        </div>

        <div className="card stack">
          <b>איזה יום הכי כבד?</b>
          <div className="wd">
            {r.weekdayDev.map(w => (
              <div key={w.wd}>
                <b>{w.dev != null ? (w.dev > 0 ? '+' : '') + Math.round(w.dev) : ''}</b>
                <i className={r.heaviestWd === w.wd ? 'top' : ''} style={{ height: `${w.dev != null ? Math.max(4, (Math.abs(w.dev) / maxDev) * 80) : 3}px`, opacity: w.dev != null && w.dev < 0 ? .55 : 1 }} />
                {WD_SHORT[w.wd]}
              </div>
            ))}
          </div>
          <p className="hint">כמה גרם משקל הבוקר באותו יום מעל או מתחת לממוצע של השבוע סביבו.</p>
        </div>

        <div className="card stack">
          <div className="row between"><b>כמה גרם כל דבר שורף לך</b><button className="link" onClick={() => go('measure')}>מדידה חדשה</button></div>
          {stats.length ? (
            <table className="tbl">
              <thead><tr><th>סוג</th><th>ממוצע</th><th>ג׳/דקה</th><th>×</th></tr></thead>
              <tbody>{stats.map(s => (
                <tr key={s.type}><td><span className="row" style={{ gap: 8 }}><ActImg type={s.type} size={26} />{actHe(s.type)}</span></td>
                  <td className="num"><b>{Math.round(s.avgNet!).toLocaleString('he-IL')}</b> ג׳</td><td className="num">{s.perMin != null ? s.perMin.toFixed(1) : '—'}</td><td className="num">{s.n}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="hint">שקילה לפני ואחרי ריצה, בריכה, פיפי וקקי - ופה יופיע כמה כל אחד מהם שורף לך.</p>}
        </div>

        {r.cheatEffect.n > 0 && (
          <div className="card tile"><div className="k">בוקר אחרי צ׳יט דיי</div><div className="v num">{r.cheatEffect.avg! > 0 ? '+' : ''}{Math.round(r.cheatEffect.avg!).toLocaleString('he-IL')} ג׳</div><div className="hint">ממוצע של {r.cheatEffect.n} פעמים, לעומת הבוקר של יום הצ׳יט</div></div>
        )}
      </div>
    </>
  );
}

const STATUS: Record<Analysis['status'], { he: string; bg: string; fg: string }> = {
  on_track: { he: 'בדרך הנכונה', bg: 'var(--mint)', fg: 'var(--green-d)' },
  stall_on_plan: { he: 'תקיעה - ממשיכים', bg: 'var(--amber-l)', fg: '#8a5a00' },
  off_plan: { he: 'לחזור לתוכנית', bg: 'var(--red-l)', fg: 'var(--red)' },
  not_enough_data: { he: 'צריך עוד נתונים', bg: 'var(--lav)', fg: 'var(--indigo-d)' },
};

/** The analyst: weeks of night burn, day gain, food, sleep and trend read as one picture. One AI call per tap, kept for the day. */
function AnalysisCard() {
  const { days, measures, meals, profile, api, saveProfile } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const a = profile.analysis;
  const fresh = a && a.date === today();
  const run = async () => {
    setBusy(true); setErr('');
    try {
      const data = analysisData(toMap(days), measures, meals, days, profile);
      const result = await api<Analysis>('analysis', { data });
      await saveProfile({ analysis: { date: today(), at: Date.now(), result } });
    } catch (e: any) { setErr(e.message || 'שגיאה'); } finally { setBusy(false); }
  };
  return (
    <div className="card stack" style={{ background: 'linear-gradient(180deg,#f4f5ff,#fff)' }}>
      <div className="row between">
        <b style={{ fontSize: 17 }}>התמונה המלאה</b>
        {a && <span className="analysis-status" style={{ background: STATUS[a.result.status].bg, color: STATUS[a.result.status].fg }}>{STATUS[a.result.status].he}</span>}
      </div>
      {!a && !busy && <p className="hint">ניתוח של כל הימים יחד: שריפה לילית, עלייה יומית, אוכל, שינה והמגמה. מזהה תקיעה כשאתה בתוכנית, ואומר אם להירגע ולהמשיך או לשנות.</p>}
      {busy && <div className="row" style={{ justifyContent: 'center', padding: 16 }}><span className="typing"><i /><i /><i /></span><span className="hint">קוראת את כל הנתונים...</span></div>}
      {a && !busy && (
        <>
          <p style={{ fontSize: 17, fontWeight: 700 }}>{a.result.headline}</p>
          {a.result.calm && <div className="ins amber"><span className="ii"><Icon name="timer" size={20} /></span><p style={{ marginTop: 0, color: 'var(--ink)' }}>{a.result.calm}</p></div>}
          {a.result.insights.map((x, i) => <div key={i} className="ins" style={{ background: '#fff', border: '1px solid var(--line)' }}><span className="ii" style={{ background: 'var(--lav)' }}><Icon name={['flame', 'chart', 'food', 'scale', 'spark', 'timer'][i % 6]} size={20} /></span><div><b>{x.title}</b><p>{x.text}</p></div></div>)}
          {a.result.next.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <div className="label">לימים הקרובים</div>
              <ol className="steps">{a.result.next.map((x, i) => <li key={i}>{x}</li>)}</ol>
            </div>
          )}
          {a.result.missing && <p className="hint">כדי לדייק: {a.result.missing}</p>}
          <p className="hint">נותח {fresh ? `היום ב-${timeOf(a.at)}` : `ב-${shortDate(a.date)}`}</p>
        </>
      )}
      {err && <p className="hint" style={{ color: 'var(--red)' }}>{err}</p>}
      {!busy && <button className={`btn ${a ? 'soft' : ''}`} onClick={run}><Icon name="spark" size={18} />{a ? (fresh ? 'לנתח שוב' : 'ניתוח מעודכן') : 'לנתח את התמונה המלאה'}</button>}
    </div>
  );
}
