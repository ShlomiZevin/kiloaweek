import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../App';
import { Icon } from '../ui';
import { addDays, heDate, hourNow, today } from '../lib/dates';
import { eOf, latestWeight, mOf, nightBurn, toMap, vsDaysAgo, weekTrend } from '../lib/calc';
import { bodyNumbers } from '../lib/body';
import { stallNote } from '../lib/analysis';
import { isMobile, isStandalone, pushIsOn } from '../lib/pwa';
import { LiveMeasure } from './Measure';

/** One screen, no scrolling (his rule): last night's burn, this morning's weight, the week, the one next thing, the ways in. */
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
  const { body } = useMemo(() => bodyNumbers(profile, latestWeight(days) ?? profile.startWeight ?? null), [profile, days]);
  const bodyLine = body ? (
    <button className="body-chips" onClick={() => go('body')}>
      <span>BMI <b className="num">{body.bmi.toFixed(1)}</b></span>
      <span>שורף ביום <b className="num">~{body.tdee.toLocaleString('he-IL')}</b></span>
      <span>לאכול <b className="num">{body.eatFrom.toLocaleString('he-IL')}–{body.eatTo.toLocaleString('he-IL')}</b></span>
    </button>
  ) : (
    <button className="body-chips ask" onClick={() => go('body')}><span>כמה הגוף שלך שורף ביום? <b>4 פרטים</b></span><Icon name="fwd" size={16} /></button>
  );

  // the one next thing
  const next = mo == null && h < 15
    ? { k: 'הפעולה הבאה:', title: 'שקילת בוקר', icon: 'morning', run: () => weigh('morning') }
    : ev == null
      ? { k: 'הפעולה הבאה:', title: h < 17 ? 'בערב - לשקול שוב' : 'שקילת ערב', icon: 'evening', run: () => weigh('evening') }
      : isMobile() && !isStandalone()
        ? { k: 'כמו אפליקציה, עם תזכורות', title: 'להוסיף למסך הבית', icon: 'phone', run: () => go('install') }
        : !pushOn
          ? { k: 'בוקר וערב, רק אם עוד לא שקלת', title: 'תזכורת לשקילה', icon: 'bell', run: () => go('reminders') }
          : { k: 'היום שלם', title: 'מחר בבוקר - שקילה', icon: 'morning', run: () => go('journal') };

  return (
    <div className="home">
      <section className="hero">
        {nb != null ? (
          <>
            <img className="moon-ic" src="/img/act-evening.png" alt="" />
            <div className="k">{nb >= 0 ? 'בלילה הגוף שרף' : 'בלילה עלית'}</div>
            <div className="v"><span>{Math.abs(nb).toLocaleString('he-IL')}</span><small>גרם</small></div>
            <div className="s">מ-<span className="num">{lastEv!.toFixed(1)}</span> בערב ל-<span className="num">{mo!.toFixed(1)}</span> בבוקר</div>
            {bodyLine}
          </>
        ) : (
          <>
            <img className="moon-ic" src={`/img/act-${h < 15 ? 'morning' : 'evening'}.png`} alt="" />
            <div className="k">{h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב'}{first ? `, ${first}` : ''}</div>
            <div className="s big">{heDate(t)}</div>
            {(!hasAny || (mo == null && lastEv != null)) && <div className="s">{hasAny ? 'שקילת הבוקר תגלה כמה הגוף שרף בלילה' : 'שוקלים בבוקר ובערב - וכל בוקר רואים כאן כמה הגוף שרף בלילה'}</div>}
            {bodyLine}
          </>
        )}
      </section>

      <button className="card wbig" onClick={() => weigh(mo != null ? 'morning' : undefined)}>
        <div className="wt">
          <div className="k">{mo != null ? 'המשקל הבוקר' : lastEv != null ? 'אתמול בערב' : 'המשקל של היום'}</div>
          <div className="v">{hasAny ? <><span className="num">{(mo ?? lastEv ?? ev ?? 0).toFixed(1)}</span><small>ק״ג</small></> : <span className="dim">עוד לא נשקלת</span>}</div>
          {mo != null && vsY != null ? (
            <span className={`delta ${vsY <= 0 ? 'down' : 'up'}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: vsY <= 0 ? '' : 'rotate(180deg)' }}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
              <span className="num">{(Math.abs(vsY) / 1000).toFixed(1)}</span> {vsY <= 0 ? 'פחות' : 'יותר'} מאתמול
            </span>
          ) : !hasAny ? <span className="delta lav">לחצו כדי לשקול</span> : null}
        </div>
        <span className="ic"><img src="/img/f-scale.png" alt="" /></span>
      </button>

      {stall ? (
        <button className="pill warn" onClick={() => go('insights')}>
          <div className="t">
            <b>המשקל עומד {stall.days} ימים - נשימה</b>
            <div className="hint">{stall.share != null && stall.share >= 0.7 ? 'אתם בתוכנית. זה קורה, ואז הוא יורד בבת אחת.' : 'בודקים את האוכל של הימים האחרונים.'}</div>
          </div>
          <span className="chk"><Icon name="timer" size={22} /></span>
        </button>
      ) : trend != null ? (
        <button className={`pill ${trend <= -700 ? '' : trend < 0 ? 'warn' : 'bad'}`} onClick={() => go('insights')}>
          <div className="t">
            <div className="k">{trend < 0 ? 'השבוע ירדת' : 'השבוע עלית'}</div>
            <div className="pv"><span className="num">{(Math.abs(trend) / 1000).toFixed(2)}</span><small>ק״ג</small></div>
            <div className="hint">{trend <= -700 ? 'במסגרת היעד' : trend < 0 ? 'בכיוון הנכון' : 'מסתכלים על התמונה המלאה'}: <span className="num">{(goalG / 1000).toFixed(1)}</span> ק״ג בשבוע</div>
          </div>
          <span className="chk"><Icon name={trend < 0 ? 'check' : 'chart'} size={26} stroke={3} /></span>
        </button>
      ) : (
        <div className="pill lav">
          <div className="t"><div className="k">כמה ירדת השבוע</div><div className="hint">יופיע כאן אחרי שבוע של שקילות בוקר. היעד: <span className="num">{(goalG / 1000).toFixed(1)}</span> ק״ג בשבוע</div></div>
          <span className="chk"><Icon name="chart" size={22} /></span>
        </div>
      )}

      {open ? <LiveMeasure m={open} compact /> : (
        <button className="next" onClick={next.run}>
          <span className="ni">{['morning', 'evening'].includes(next.icon) ? <img src={`/img/act-${next.icon}.png`} alt="" /> : <Icon name={next.icon} size={26} />}</span>
          <div><small>{next.k}</small><b>{next.title}</b></div>
          <Icon name="fwd" size={20} />
        </button>
      )}

      <div className="minis">
        <button className="mini lav" onClick={() => go('measure')}><span className="mi pic"><img src="/img/i-measure.png" alt="" /></span>לפני ואחרי</button>
        <button className="mini blue" onClick={() => go('food')}><span className="mi pic"><img src="/img/f-bowl.png" alt="" /></span>לרשום אוכל</button>
        <button className="mini mint" onClick={() => go('coach')}><span className="mi ph"><img src="/img/coach.jpg" alt="" /></span>לשוחח עם המאמנת</button>
      </div>
    </div>
  );
}
