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

/** One screen, no scrolling (his rule): last night's burn, today's eating against the body's burn (deficit / what's left),
 *  this morning's weight + the week, the one next thing, the ways in. */
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
  const eaten = meals.filter(x => x.date === t).reduce((a, x) => a + (x.calories || 0), 0);
  const cheat = !!m.get(t)?.tags?.cheat;

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
            <div className="k"><img className="moon-ic" src="/img/act-evening.png" alt="" />{nb >= 0 ? 'בלילה הגוף שרף' : 'בלילה עלית'}</div>
            <div className="v"><span>{Math.abs(nb).toLocaleString('he-IL')}</span><small>גרם</small></div>
            <div className="s">מ-<span className="num">{lastEv!.toFixed(1)}</span> בערב ל-<span className="num">{mo!.toFixed(1)}</span> בבוקר</div>
          </>
        ) : (
          <>
            <div className="k"><img className="moon-ic" src={`/img/act-${h < 15 ? 'morning' : 'evening'}.png`} alt="" />{h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב'}{first ? `, ${first}` : ''}</div>
            <div className="s big">{heDate(t)}</div>
            <div className="s">{hasAny && mo == null && lastEv != null ? 'שקילת הבוקר תגלה כמה הגוף שרף בלילה' : !hasAny ? 'שוקלים בבוקר ובערב - וכל בוקר רואים כאן כמה הגוף שרף בלילה' : ''}</div>
          </>
        )}
      </section>

      <Today eaten={eaten} body={body} cheat={cheat} onFood={() => go('food')} onBody={() => go('body')} />

      <div className="tiles2">
        <button className="card tile2" onClick={() => weigh(mo != null ? 'morning' : undefined)}>
          <div className="k">{mo != null ? 'המשקל הבוקר' : lastEv != null ? 'אתמול בערב' : 'המשקל היום'}</div>
          {hasAny ? <div className="v"><span className="num">{(mo ?? lastEv ?? ev ?? 0).toFixed(1)}</span><small>ק״ג</small></div> : <div className="v dim">עוד לא</div>}
          {mo != null && vsY != null ? (
            <span className={`delta ${vsY <= 0 ? 'down' : 'up'}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: vsY <= 0 ? '' : 'rotate(180deg)' }}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
              <span className="num">{(Math.abs(vsY) / 1000).toFixed(1)}</span> מאתמול
            </span>
          ) : <span className="delta lav">{hasAny ? 'לחצו לעדכון' : 'לחצו כדי לשקול'}</span>}
          <img className="tile-ic" src="/img/f-scale.png" alt="" />
        </button>

        {stall ? (
          <button className="card tile2 warn" onClick={() => go('insights')}>
            <div className="k">המשקל עומד</div>
            <div className="v"><span className="num">{stall.days}</span><small>ימים</small></div>
            <span className="delta up">{stall.share != null && stall.share >= 0.7 ? 'זה קורה - ממשיכים' : 'בודקים את האוכל'}</span>
          </button>
        ) : trend != null ? (
          <button className={`card tile2 ${trend <= -700 ? 'good' : trend < 0 ? 'warn' : 'bad'}`} onClick={() => go('insights')}>
            <div className="k">{trend < 0 ? 'השבוע ירדת' : 'השבוע עלית'}</div>
            <div className="v"><span className="num">{(Math.abs(trend) / 1000).toFixed(2)}</span><small>ק״ג</small></div>
            <span className={`delta ${trend <= -700 ? 'down' : 'up'}`}>{trend <= -700 ? 'במסגרת היעד' : trend < 0 ? 'בכיוון הנכון' : 'רואים את התמונה'}</span>
          </button>
        ) : (
          <div className="card tile2">
            <div className="k">השבוע</div>
            <div className="v dim">בקרוב</div>
            <span className="delta lav">אחרי שבוע של שקילות</span>
          </div>
        )}
      </div>

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

/** Today's eating against the body's burn: eaten, what's left to the end of the day, the usual burn - and whether today
 *  is still a deficit. The burn is the formula's draft (הגוף שלי); without it: eaten only + a way to fill it in. */
function Today({ eaten, body, cheat, onFood, onBody }: { eaten: number; body: ReturnType<typeof bodyNumbers>['body']; cheat: boolean; onFood: () => void; onBody: () => void }) {
  const f = (n: number) => n.toLocaleString('he-IL');
  if (!body) {
    return (
      <div className="card today">
        <div className="td-row">
          <button className="td-c" onClick={onFood}><span>אכלת היום</span><b className="num">{f(eaten)}</b><small>קלוריות</small></button>
          <button className="td-ask" onClick={onBody}><b>כמה נשאר לאכול היום?</b><span>4 פרטים על הגוף, ונדע כמה הוא שורף ביום <Icon name="fwd" size={14} /></span></button>
        </div>
      </div>
    );
  }
  const target = Math.round((body.eatFrom + body.eatTo) / 2 / 50) * 50;
  const left = target - eaten;
  const deficit = body.tdee - eaten;
  const tone = cheat ? 'cheat' : left >= 0 ? 'ok' : deficit > 0 ? 'warn' : 'over';
  const line = cheat ? 'צ׳יט דיי - היום בלי חשבון'
    : left >= 0 ? <>בגירעון · אפשר עוד <b className="num">{f(left)}</b> קלוריות היום</>
      : deficit > 0 ? <>עברת את היעד ב-<b className="num">{f(-left)}</b> · עדיין בגירעון קטן</>
        : <>היום מעל מה שהגוף שורף ב-<b className="num">{f(-deficit)}</b></>;
  const pct = (x: number) => `${Math.max(0, Math.min(100, (x / body.tdee) * 100))}%`;
  return (
    <button className={`card today ${tone}`} onClick={onFood}>
      <div className="td-row">
        <div className="td-c"><span>אכלת</span><b className="num">{f(eaten)}</b></div>
        <div className="td-c main"><span>{left >= 0 ? 'נשארו' : 'מעל היעד'}</span><b className="num">{f(Math.abs(left))}</b></div>
        <div className="td-c"><span>הגוף שורף</span><b className="num">~{f(body.tdee)}</b></div>
      </div>
      <div className="td-bar"><i style={{ width: pct(eaten) }} /><em style={{ insetInlineStart: pct(target) }} /></div>
      <div className="td-line">{line}</div>
    </button>
  );
}
