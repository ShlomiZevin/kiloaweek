import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../App';
import { Icon, signedKg } from '../ui';
import { addDays, heDate, hourNow, timeOf, today } from '../lib/dates';
import { eOf, mOf, nightBurn, toMap, vsDaysAgo, weekTrend } from '../lib/calc';
import { stallNote } from '../lib/analysis';
import { isMobile, isStandalone, pushIsOn } from '../lib/pwa';
import { LiveMeasure } from './Measure';

/** Concept A: one hero (last night's burn), the morning weight, the week in one line, one clear next action. */
export function Home() {
  const { days, measures, profile, user, meals } = useStore();
  const { go, weigh } = useNav();
  const m = useMemo(() => toMap(days), [days]);
  const t = today();
  const h = hourNow();
  const mo = mOf(m, t), ev = eOf(m, t);
  const nb = nightBurn(m, t);
  const lastEv = eOf(m, addDays(t, -1));
  const vsY = vsDaysAgo(m, t, 1, 'morning');
  const trend = weekTrend(m, t);
  const goalG = profile.weeklyGoalG || 800;
  const open = measures.find(x => x.afterKg == null);
  const stall = useMemo(() => stallNote(m, meals), [m, meals]);
  const [pushOn, setPushOn] = useState(true);
  useEffect(() => { pushIsOn().then(setPushOn); }, []);
  const hasAny = days.some(d => d.morning != null || d.evening != null);
  const first = (profile.name || user?.displayName || '').split(' ')[0];

  // the one next thing to do
  const next = mo == null && h < 15
    ? { slot: 'morning' as const, title: 'שקילת בוקר', sub: 'אחרי השירותים, לפני שתייה', icon: 'morning' }
    : ev == null
      ? { slot: 'evening' as const, title: mo == null ? 'שקילת ערב' : 'בערב: לשקול שוב', sub: 'כדי לראות מחר כמה נשרף בלילה', icon: 'evening' }
      : null;

  return (
    <>
      <header className="top">
        <div className="brand"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>קילו בשבוע</div>
        <div className="top-actions">
          <button className="icon-btn" onClick={() => go('coach')} aria-label="המאמנת"><Icon name="chat" /></button>
          <button onClick={() => go('me')} aria-label="אני והגדרות">{user?.photoURL ? <img className="avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span className="icon-btn"><Icon name="user" /></span>}</button>
        </div>
      </header>

      <div className="stack" style={{ gap: 14 }}>
        {open && <LiveMeasure m={open} compact />}

        {nb != null ? (
          <section className="hero">
            <img className="moon-ic" src="/img/act-evening.png" alt="" />
            <div className="k">{nb >= 0 ? 'בלילה נשרפו' : 'בלילה עלית'}</div>
            <div className="v"><span>{Math.abs(nb).toLocaleString('he-IL')}</span><small>גרם</small></div>
            <div className="s">מ-{lastEv!.toFixed(1)} אמש ל-{mo!.toFixed(1)} הבוקר</div>
          </section>
        ) : (
          <section className="hero">
            <img className="moon-ic" src={`/img/act-${h < 15 ? 'morning' : 'evening'}.png`} alt="" />
            <div className="k">{h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב'}{first ? `, ${first}` : ''}</div>
            <div className="s" style={{ fontSize: 16 }}>{heDate(t)}</div>
            {mo == null && lastEv != null && <div className="s">אתמול בערב: <b className="num">{lastEv.toFixed(1)}</b> ק״ג. שקילת הבוקר תגלה כמה נשרף בלילה.</div>}
            {!hasAny && <div className="s">שוקלים בבוקר ובערב, וכאן תראה כל בוקר כמה הגוף שרף בשינה.</div>}
          </section>
        )}

        {mo != null && (
          <button className="card wbig" onClick={() => weigh('morning')}>
            <div>
              <div className="k">המשקל הבוקר</div>
              <div className="v"><span className="num">{mo.toFixed(1)}</span><small>ק״ג</small></div>
              <div className="sub">{m.get(t)?.morningAt ? `${timeOf(m.get(t)!.morningAt!)} · ` : ''}{vsY != null ? <>אתמול <span className="num">{signedKg(vsY)}</span></> : 'לחץ לעדכון'}{ev != null ? <> · ערב <span className="num">{ev.toFixed(1)}</span></> : null}</div>
            </div>
            <span className="ic"><Icon name="scale" size={30} /></span>
          </button>
        )}

        {trend != null ? (
          <button className={`pill ${trend <= -700 ? '' : trend < 0 ? 'warn' : 'bad'}`} onClick={() => go('insights')}>
            <div className="t">
              <b>{trend < 0 ? 'השבוע ירדת ' : 'השבוע עלית '}<span className="num">{(Math.abs(trend) / 1000).toFixed(2)}</span> ק״ג</b>
              <div className="hint">{trend <= -700 ? 'בדרך ליעד' : trend < 0 ? 'בכיוון הנכון' : 'מסתכלים על התמונה המלאה'} · יעד <span className="num">{(goalG / 1000).toFixed(1)}</span> ק״ג בשבוע</div>
            </div>
            <span className="chk"><Icon name={trend < 0 ? 'check' : 'chart'} size={20} stroke={3} /></span>
          </button>
        ) : hasAny ? (
          <div className="pill lav"><div className="t"><b>המגמה השבועית בדרך</b><div className="hint">אחרי שבועיים של שקילות בוקר נראה אותה כאן</div></div><span className="chk"><Icon name="chart" size={20} /></span></div>
        ) : null}

        {stall && (
          <button className="ins amber" onClick={() => go('insights')}>
            <span className="ii"><Icon name="timer" /></span>
            <div>
              <b>המשקל עומד {stall.days} ימים - נשימה</b>
              <p>{stall.share != null && stall.share >= 0.7 ? 'אתה בתוכנית. זה קורה: הגוף מחזיק מים ואז יורד בבת אחת.' : 'בודקים את האוכל של הימים האחרונים.'}{stall.history ? ` אצלך זה קרה ${stall.history.n} פעמים, נמשך בערך ${stall.history.avgDays} ימים, ואחריו ירדת ${stall.history.avgDrop} גרם בשלושה ימים.` : ''}</p>
            </div>
          </button>
        )}

        {next && (
          <button className="cta" onClick={() => weigh(next.slot)}>
            <span className="ci"><img src={`/img/act-${next.icon}.png`} width={40} height={40} alt="" /></span>
            <div style={{ flex: 1 }}><b>{next.title}</b><span>{next.sub}</span></div>
            <Icon name="fwd" />
          </button>
        )}

        <div className="minis">
          <button className="mini" onClick={() => go('measure')}><span className="mi"><img src="/img/act-run.png" alt="" /></span>לפני / אחרי</button>
          <button className="mini t" onClick={() => go('food')}><span className="mi"><Icon name="camera" /></span>צילום צלחת</button>
          <button className="mini" onClick={() => go('coach')}><span className="mi"><img src="/img/coach.jpg" alt="" style={{ objectFit: 'cover' }} /></span>המאמנת</button>
        </div>

        {!hasAny && (
          <div className="card stack">
            <b>איך מתחילים</b>
            <ol className="steps">
              <li>שוקלים מחר בבוקר אחרי השירותים, ובערב לפני השינה.</li>
              <li>שוקלים לפני ואחרי פעילות, פיפי וקקי - להכיר את הגוף.</li>
              <li>מצלמים את הצלחת. אחרי שבועיים יש מגמה ותובנות.</li>
            </ol>
            <div className="row"><button className="btn soft sm" onClick={() => go('journal')}>יש לי אקסל - לייבא</button><button className="btn soft sm" onClick={() => go('method')}>מה השיטה?</button></div>
          </div>
        )}

        {isMobile() && !isStandalone() && (
          <button className="pill lav" onClick={() => go('install')}>
            <div className="t"><b style={{ fontSize: 15.5 }}>להוסיף למסך הבית</b><div className="hint">נפתח כמו אפליקציה, עם תזכורות לשקילה</div></div>
            <span className="chk"><Icon name="phone" size={18} /></span>
          </button>
        )}
        {!pushOn && (isStandalone() || !isMobile()) && hasAny && (
          <button className="pill lav" onClick={() => go('me')}>
            <div className="t"><b style={{ fontSize: 15.5 }}>תזכורת לשקילה</b><div className="hint">בוקר וערב, רק אם עוד לא שקלת</div></div>
            <span className="chk"><Icon name="bell" size={18} /></span>
          </button>
        )}
      </div>
    </>
  );
}
