import { useEffect, useRef, useState } from 'react';
import { newId, useStore } from '../lib/store';
import { useNav } from '../App';
import { Icon, Sheet, shrinkImage } from '../ui';
import { addDays, heDate, today, fromLocalInput, toLocalInput, dayOf } from '../lib/dates';
import { bodyNumbers } from '../lib/body';
import { latestWeight } from '../lib/calc';
import { useVoice } from '../lib/voice';
import { Macros } from './Coach';
import type { Meal, MealCore, MealItem, SavedMeal } from '../lib/types';

const sumOf = (items: MealItem[]) => ({
  protein: items.reduce((a, x) => a + (x.protein || 0), 0), carbs: items.reduce((a, x) => a + (x.carbs || 0), 0),
  sugar: items.reduce((a, x) => a + (x.sugar || 0), 0), calories: items.reduce((a, x) => a + (x.calories || 0), 0),
});

/** Food: counted mainly in protein, carbs and sugars. Three ways in (photo, type, say it), the saved meals again in one tap. */
export function Food() {
  const { meals, days, foods, api, profile } = useStore();
  const { go, toast } = useNav();
  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState<null | { image?: string; text?: string }>(null);
  const [edit, setEdit] = useState<Meal | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const voice = useVoice(api, said => setAdding({ text: said }), toast);
  const list = meals.filter(m => m.date === date);
  const day = days.find(d => d.date === date);
  const tot = list.reduce((a, m) => ({ protein: a.protein + (m.protein || 0), carbs: a.carbs + (m.carbs || 0), sugar: a.sugar + (m.sugar || 0), calories: a.calories + (m.calories || 0) }), { protein: 0, carbs: 0, sugar: 0, calories: 0 });
  const { body } = bodyNumbers(profile, latestWeight(days) ?? profile.startWeight ?? null);
  const target = body?.target ?? null;
  const again = useAgain(date);

  return (
    <div className="stack food">
      <div className="card totals">
        <div className="day-nav">
          <button className="icon-btn sm" onClick={() => setDate(addDays(date, -1))} aria-label="יום קודם"><Icon name="back" size={20} /></button>
          <b>{date === today() ? 'היום' : heDate(date)}</b>
          <button className="icon-btn sm" onClick={() => setDate(addDays(date, 1))} disabled={date >= today()} aria-label="יום הבא" style={{ opacity: date >= today() ? .3 : 1 }}><Icon name="fwd" size={20} /></button>
        </div>
        <div className="macro3">
          <div><span>חלבון</span><b className="num">{tot.protein}</b><small>גרם</small></div>
          <div><span>פחמימות</span><b className="num">{tot.carbs}</b><small>גרם</small></div>
          <div><span>סוכרים</span><b className="num">{tot.sugar}</b><small>גרם</small></div>
        </div>
        <div className="cal-pill"><Icon name="flame" size={18} /><b className="num">{tot.calories.toLocaleString('he-IL')}</b>{target ? <> מתוך <span className="num">{target.toLocaleString('he-IL')}</span></> : null} קלוריות</div>
      </div>

      <div className="ways">
        <button className="way mint" onClick={() => fileRef.current?.click()}><Icon name="camera" size={28} />לצלם ארוחה</button>
        <button className="way aqua" onClick={() => setAdding({})}><Icon name="keyboard" size={28} />לכתוב מה אכלתי</button>
        {voice.recording
          ? <button className="way rec" onClick={voice.send}><span className="rec-dot" /><span>שליחה <span className="num">{voice.clock}</span></span></button>
          : <button className="way lav" onClick={voice.start} disabled={voice.listening}><Icon name="mic" size={28} />{voice.listening ? 'מתמלל...' : 'לספר מה אכלתי'}</button>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setAdding({ image: await shrinkImage(f, 1024, 0.8) }); }} />

      {foods.length > 0 && (
        <>
          <div className="sec-title"><span>אכלתם שוב? בלחיצה</span><button className="link" onClick={() => go('foods')}>כל השמורות</button></div>
          <div className="again">
            {foods.slice(0, 8).map(f => (
              <button key={f.id} className="again-card" onClick={() => again(f)}>
                {f.thumb && <img src={f.thumb} alt="" />}
                <b>{f.he}</b>
                <span className="ac-m"><span className="num">{f.calories.toLocaleString('he-IL')}</span> קלוריות · חלבון <span className="num">{f.protein ?? 0}</span></span>
                <span className="ac-add"><Icon name="plus" size={16} stroke={2.8} />הוספה</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="sec-title">{date === today() ? 'הארוחות של היום' : 'הארוחות'}</div>
      {list.length ? list.map(m => (
        <button key={m.id} className="card meal" onClick={() => setEdit(m)}>
          {m.thumb ? <img className="ph" src={m.thumb} alt="" /> : <span className="ph"><img src="/img/f-bowl.png" alt="" /></span>}
          <div className="mi">
            <b>{m.he}</b>
            <Macros m={m} />
          </div>
          <Icon name="fwd" size={20} />
        </button>
      )) : <p className="hint empty-line">עוד לא תיעדת אוכל {date === today() ? 'היום' : 'ביום הזה'}.</p>}

      {adding && <AddMeal date={date} input={adding} cheat={!!day?.tags?.cheat} onClose={() => setAdding(null)} />}
      {edit && <EditMeal meal={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

/** A saved meal -> eaten again on this date (and counted once more in the library). */
export function useAgain(date = today()) {
  const { saveMeal, rememberMeal } = useStore();
  const { toast } = useNav();
  return async (f: SavedMeal) => {
    const { id: _k, n: _n, lastAt: _l, ...core } = f;
    const meal: Meal = { ...core, id: newId(), date, at: date === today() ? Date.now() : fromLocalInput(`${date}T13:00`) };
    await saveMeal(meal); await rememberMeal(meal);
    toast(`נוסף: ${f.he}`);
  };
}

function AddMeal({ date, input, cheat, onClose }: { date: string; input: { image?: string; text?: string }; cheat: boolean; onClose: () => void }) {
  const { api, saveMeal, rememberMeal } = useStore();
  const { toast } = useNav();
  const [said, setSaid] = useState(input.text || '');
  const [fix, setFix] = useState('');
  const [state, setState] = useState<'write' | 'busy' | 'done' | 'err'>(input.image || input.text ? 'busy' : 'write');
  const [meal, setMeal] = useState<MealCore | null>(null);
  const [err, setErr] = useState('');
  const started = useRef(false);

  const analyse = async (text = said) => {
    setState('busy'); setErr('');
    try {
      const r = await api<{ meal: MealCore }>('meal', { image: input.image, text, cheat });
      setMeal({ ...r.meal, text: text || undefined }); setState('done');
    } catch (e: any) { setErr(e.message || 'שגיאה'); setState('err'); }
  };
  useEffect(() => {
    if (started.current || state !== 'busy') return;
    started.current = true;
    analyse();
  }, []); // eslint-disable-line

  const save = async () => {
    if (!meal) return;
    const thumb = input.image ? await shrinkFromDataUrl(input.image, 520) : undefined;
    const m: Meal = { id: newId(), date, at: date === today() ? Date.now() : fromLocalInput(`${date}T13:00`), ...meal, thumb };
    await saveMeal(m); await rememberMeal(m);
    toast(`נשמר: ${meal.he}`);
    onClose();
  };
  const dropItem = (i: number) => { if (!meal) return; const items = meal.items.filter((_, j) => j !== i); setMeal({ ...meal, items, ...sumOf(items) }); };

  return (
    <Sheet open onClose={onClose} title="ארוחה חדשה" tall>
      {input.image && <img src={input.image} alt="" className="add-ph" />}
      {state === 'write' && (
        <>
          <textarea className="input" autoFocus value={said} onChange={e => setSaid(e.target.value)} placeholder="מה אכלתם? למשל: חביתה משתי ביצים, סלט וקוטג׳" />
          <p className="hint">לא צריך כמויות מדויקות - מה שלא כתוב, יושלם למנה ממוצעת.</p>
          <button className="btn" onClick={() => analyse()} disabled={!said.trim()}>לספור</button>
        </>
      )}
      {state === 'busy' && <div className="empty"><div className="typing"><i /><i /><i /></div><b>סופר חלבון, פחמימות וסוכרים...</b></div>}
      {state === 'err' && <><div className="card" style={{ background: 'var(--red-l)' }}><b>{err}</b></div><button className="btn" onClick={() => analyse()}>שוב</button></>}
      {state === 'done' && meal && (
        <>
          <input className="input title-input" value={meal.he} onChange={e => setMeal({ ...meal, he: e.target.value })} aria-label="שם הארוחה" />
          <div className="macro3 boxed">
            <div><span>חלבון</span><b className="num">{meal.protein}</b><small>גרם</small></div>
            <div><span>פחמימות</span><b className="num">{meal.carbs}</b><small>גרם</small></div>
            <div><span>סוכרים</span><b className="num">{meal.sugar}</b><small>גרם</small></div>
          </div>
          <div className="card items">
            {meal.items.map((it, i) => (
              <div key={i} className="it">
                <div><b>{it.he}</b><Macros m={it} /></div>
                {meal.items.length > 1 && <button className="icon-btn sm" onClick={() => dropItem(i)} aria-label={`הסרת ${it.he}`}><Icon name="close" size={18} /></button>}
              </div>
            ))}
            <div className="divider" />
            <div className="it"><span className="hint">קלוריות</span><b className="num">{meal.calories.toLocaleString('he-IL')}</b></div>
          </div>
          {meal.why && <div className="why"><img src="/img/coach.jpg" alt="" /><p>{meal.why}</p></div>}
          <button className="btn" onClick={save}>שמירה</button>
          <div className="row">
            <input className="input" value={fix} onChange={e => setFix(e.target.value)} placeholder="משהו לא מדויק? למשל: בלי הלחם" />
            <button className="btn sm soft" disabled={!fix.trim()} onClick={() => { const t = [said, fix].filter(Boolean).join('. תיקון: '); setSaid(t); setFix(''); analyse(t); }}>עדכון</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

export function EditMeal({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const { saveMeal, deleteMeal } = useStore();
  const { toast } = useNav();
  const [m, setM] = useState<Meal>(meal);
  const [when, setWhen] = useState(toLocalInput(meal.at));
  const setNum = (k: 'protein' | 'carbs' | 'sugar' | 'calories', v: string) => setM({ ...m, [k]: parseInt(v.replace(/\D/g, '')) || 0 });
  const dropItem = (i: number) => { const items = m.items.filter((_, j) => j !== i); setM({ ...m, items, ...sumOf(items) }); };
  return (
    <Sheet open onClose={onClose} title="עריכת ארוחה">
      {m.thumb && <img src={m.thumb} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 16 }} />}
      <input className="input title-input" value={m.he} onChange={e => setM({ ...m, he: e.target.value })} aria-label="שם הארוחה" />
      <div className="grid4">
        {([['protein', 'חלבון'], ['carbs', 'פחמימות'], ['sugar', 'סוכרים'], ['calories', 'קלוריות']] as const).map(([k, he]) => (
          <label key={k} className="field"><span>{he}</span><input className="input num" inputMode="numeric" value={m[k] ?? 0} onChange={e => setNum(k, e.target.value)} /></label>
        ))}
      </div>
      {m.items.length > 1 && (
        <div className="card items">
          {m.items.map((it, i) => <div key={i} className="it"><div><b>{it.he}</b>{it.protein != null && <Macros m={it} />}</div><button className="icon-btn sm" onClick={() => dropItem(i)} aria-label={`הסרת ${it.he}`}><Icon name="close" size={18} /></button></div>)}
        </div>
      )}
      <label className="field"><span>מתי</span><input className="input" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></label>
      <button className="btn" onClick={async () => { const at = fromLocalInput(when); await saveMeal({ ...m, at, date: dayOf(at) }); toast('נשמר'); onClose(); }}>שמירה</button>
      <button className="btn danger" onClick={async () => { await deleteMeal(m.id); toast('נמחק'); onClose(); }}>מחיקה</button>
    </Sheet>
  );
}

function shrinkFromDataUrl(src: string, max: number): Promise<string> {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.7));
    };
    img.src = src;
  });
}
