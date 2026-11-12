import { useEffect, useRef, useState } from 'react';
import { newId, useStore } from '../lib/store';
import { Top, useNav } from '../App';
import { Empty, Icon, Sheet, shrinkImage } from '../ui';
import { addDays, heDate, timeOf, today, fromLocalInput, toLocalInput, dayOf } from '../lib/dates';
import type { Meal, MealItem } from '../lib/types';

const VERDICT: Record<Meal['verdict'], string> = { ok: 'מתאים לשיטה', warn: 'לשים לב', no: 'לא בשיטה' };

export function Food() {
  const { meals, days, updateDay, profile } = useStore();
  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState<null | { image?: string; text?: string }>(null);
  const [edit, setEdit] = useState<Meal | null>(null);
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const list = meals.filter(m => m.date === date);
  const day = days.find(d => d.date === date);
  const cal = list.reduce((a, m) => a + m.calories, 0);
  const protein = list.reduce((a, m) => a + (m.protein || 0), 0);
  const sweets = day?.sweets || 0, water = day?.water || 0, cheat = !!day?.tags?.cheat;
  const target = profile.calorieTarget;
  const last = list[list.length - 1];
  const { go } = useNav();

  const onPhoto = async (f?: File) => {
    if (!f) return;
    const image = await shrinkImage(f, 1024, 0.8);
    setAdding({ image });
  };

  return (
    <>
      <Top title="אוכל" sub="לא דיאטה - שיטה" />
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="יום קודם"><Icon name="back" /></button>
        <b>{date === today() ? `היום, ${heDate(date, false)}` : heDate(date)}</b>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} disabled={date >= today()} aria-label="יום הבא" style={{ opacity: date >= today() ? .3 : 1 }}><Icon name="fwd" /></button>
      </div>
      <div className="stack">
        {last && (
          <button className="food-hero" onClick={() => setEdit(last)}>
            {last.thumb ? <img src={last.thumb} alt="" /> : <div style={{ height: 180, display: 'grid', placeItems: 'center' }}><img src="/img/f-bowl.png" alt="" style={{ width: 110, height: 110, mixBlendMode: 'multiply' }} /></div>}
            <div className="tag">
              <span className={`badge ${last.verdict}`}>{VERDICT[last.verdict]}</span>
              <b className="num">{last.calories.toLocaleString('he-IL')}</b>
              <span className="hint">קלוריות · {last.he}</span>
            </div>
          </button>
        )}

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div className="hint" style={{ fontWeight: 600 }}>{date === today() ? 'סה״כ היום' : 'סה״כ ביום הזה'}</div>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, lineHeight: 1.05 }} className="num">{cal.toLocaleString('he-IL')}</div>
            <div className="hint">קלוריות{protein ? ` · ${protein} ג׳ חלבון` : ''}{target ? ` · יעד ${target.toLocaleString('he-IL')}` : ''}</div>
            {target ? <div className="bar" style={{ background: '#e8ebf5', marginTop: 8 }}><i style={{ width: `${Math.min(100, (cal / target) * 100)}%`, background: cal > target ? 'var(--red)' : 'var(--green)' }} /></div> : null}
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
          <div style={{ textAlign: 'center', minWidth: 96 }}>
                        <div style={{ fontSize: 28, fontWeight: 800 }} className="num">{sweets} / 6</div>
            <div className="hint">מתוקים בלי סוכר</div>
            <div className="counter" style={{ justifyContent: 'center', marginTop: 6 }}><button onClick={() => updateDay(date, { sweets: Math.max(0, sweets - 1) })} aria-label="פחות"><Icon name="minus" size={16} /></button><button onClick={() => updateDay(date, { sweets: sweets + 1 })} aria-label="עוד"><Icon name="plus" size={16} /></button></div>
          </div>
        </div>

        {last?.why && (
          <button className="ins" onClick={() => go('coach')}>
            <span className="ii" style={{ overflow: 'hidden', padding: 0 }}><img src="/img/coach.jpg" alt="" style={{ width: 42, height: 42, objectFit: 'cover' }} /></span>
            <div><b style={{ fontSize: 14 }}>המאמנת</b><p>{last.why}</p></div>
          </button>
        )}

        <button className="cta teal" onClick={() => fileRef.current?.click()}>
          <span className="ci"><Icon name="camera" size={26} /></span>
          <div style={{ flex: 1 }}><b>{list.length ? 'להוסיף ארוחה' : 'לצלם את הצלחת'}</b><span>קלוריות לכל פריט, ואם זה בשיטה</span></div>
        </button>
        <div className="row">
          <input className="input" placeholder="או לכתוב: חזה עוף, סלט גדול וקוטג׳" value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { setAdding({ text: text.trim() }); setText(''); } }} />
          <button className="btn sm" disabled={!text.trim()} onClick={() => { setAdding({ text: text.trim() }); setText(''); }} aria-label="ניתוח"><Icon name="send" size={20} /></button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />

        <div className="card toggle" style={{ padding: '10px 16px' }}>
          <span className="row"><Icon name="drop" size={20} className="" /><span><b style={{ fontWeight: 600 }}>מים</b> <span className="num" style={{ fontWeight: 800 }}>{(water / 1000).toFixed(2)}</span> ל׳</span></span>
          <div className="counter"><button onClick={() => updateDay(date, { water: Math.max(0, water - 250) })} aria-label="פחות כוס"><Icon name="minus" size={16} /></button><button onClick={() => updateDay(date, { water: water + 250 })} aria-label="עוד כוס"><Icon name="plus" size={16} /></button></div>
        </div>
        {sweets > 6 && <p className="hint" style={{ color: 'var(--bad)' }}>יותר מ-6 מתוקים היום - השיטה אומרת עד 6.</p>}

        <div className="card toggle" style={{ padding: '12px 16px', background: cheat ? 'var(--amber-l)' : '#fff' }}>
          <div><b>צ׳יט דיי</b><div className="hint">שחרור מלא, בלי רגשות אשם. נספר בתובנות בנפרד.</div></div>
          <button className={`switch ${cheat ? 'on' : ''}`} onClick={() => updateDay(date, { tags: { ...(day?.tags || {}), cheat: !cheat } })} aria-pressed={cheat} aria-label="צ׳יט דיי" />
        </div>

        <div className="sec-title">{list.length ? `${list.length} ארוחות` : 'הארוחות'}</div>
        {list.length ? list.map(m => (
          <button key={m.id} className="card meal" onClick={() => setEdit(m)} style={{ textAlign: 'right' }}>
            {m.thumb ? <img className="ph" src={m.thumb} alt="" /> : <span className="ph"><Icon name="food" /></span>}
            <div className="mi">
              <div className="row between"><b>{m.he}</b><span className="cal num">{m.calories.toLocaleString('he-IL')}</span></div>
              <div className="row between" style={{ marginTop: 4 }}><span className={`badge ${m.verdict}`}>{VERDICT[m.verdict]}</span><span className="hint">{timeOf(m.at)} · קק״ל</span></div>
              {m.why && <div className="hint" style={{ marginTop: 4 }}>{m.why}</div>}
            </div>
          </button>
        )) : <div className="card"><Empty img="/img/f-bowl.png" title="עוד לא תיעדת אוכל היום" text="מצלמים את הצלחת או כותבים משפט. מקבלים קלוריות לכל פריט, ואם זה בשיטה." /></div>}
      </div>
      {adding && <AddMeal date={date} input={adding} cheat={cheat} onClose={() => setAdding(null)} />}
      {edit && <EditMeal meal={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function AddMeal({ date, input, cheat, onClose }: { date: string; input: { image?: string; text?: string }; cheat: boolean; onClose: () => void }) {
  const { api, saveMeal } = useStore();
  const { toast } = useNav();
  const [note, setNote] = useState(input.text || '');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'ask' | 'err'>(input.text && !input.image ? 'busy' : 'idle');
  const [meal, setMeal] = useState<Omit<Meal, 'id' | 'date' | 'at'> | null>(null);
  const [question, setQuestion] = useState('');
  const [err, setErr] = useState('');
  const started = useRef(false);

  const analyse = async (extra?: string) => {
    setState('busy'); setErr('');
    try {
      const r = await api<{ meal?: any; needsInfo?: boolean; question?: string }>('meal', { image: input.image, text: [note, extra].filter(Boolean).join('. '), cheat });
      if (r.needsInfo) { setQuestion(r.question || ''); setState('ask'); return; }
      setMeal({ ...r.meal, text: note || undefined }); setState('done');
    } catch (e: any) { setErr(e.message || 'שגיאה'); setState('err'); }
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (input.text && !input.image) analyse();
  }, []); // eslint-disable-line

  const save = async () => {
    if (!meal) return;
    const thumb = input.image ? await shrinkFromDataUrl(input.image, 520) : undefined;
    await saveMeal({ id: newId(), date, at: date === today() ? Date.now() : fromLocalInput(`${date}T13:00`), ...meal, thumb });
    toast(`נשמר: ${meal.calories.toLocaleString('he-IL')} קק״ל`);
    onClose();
  };
  const setItem = (i: number, patch: Partial<MealItem>) => {
    if (!meal) return;
    const items = meal.items.map((x, j) => (j === i ? { ...x, ...patch } : x));
    setMeal({ ...meal, items, calories: items.reduce((a, x) => a + x.calories, 0) });
  };

  return (
    <Sheet open onClose={onClose} title="ארוחה חדשה" tall>
      {input.image && <img src={input.image} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 16 }} />}
      {state === 'idle' && (
        <>
          <label className="field"><span>משהו להוסיף? (לא חובה)</span><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="למשל: בלי שמן, 200 גרם עוף" /></label>
          <button className="btn" onClick={() => analyse()}>מה יש בצלחת?</button>
        </>
      )}
      {state === 'busy' && <div className="empty"><div className="typing"><i /><i /><i /></div><b>מנתח את הארוחה...</b></div>}
      {state === 'ask' && (
        <>
          <div className="card" style={{ background: 'var(--amber-l)' }}><b>{question}</b></div>
          <AskBack onAnswer={a => analyse(a)} />
        </>
      )}
      {state === 'err' && <><div className="card" style={{ background: 'var(--red-l)' }}><b>{err}</b><div className="hint">אפשר לנסות שוב, או להזין ידנית.</div></div><button className="btn" onClick={() => analyse()}>שוב</button>
        <button className="btn ghost" onClick={() => { setMeal({ he: note || 'ארוחה', items: [{ he: note || 'ארוחה', calories: 0 }], calories: 0, verdict: 'warn' }); setState('done'); }}>הזנה ידנית</button></>}
      {state === 'done' && meal && (
        <>
          <input className="input" style={{ fontWeight: 800, fontSize: 18 }} value={meal.he} onChange={e => setMeal({ ...meal, he: e.target.value })} />
          <div className="card items">
            {meal.items.map((it, i) => (
              <div key={i} className="it"><span>{it.he}</span><span className="row" style={{ gap: 6 }}><input className="num" inputMode="numeric" value={it.calories} onChange={e => setItem(i, { calories: parseInt(e.target.value.replace(/\D/g, '')) || 0 })} /><span className="hint">קק״ל</span></span></div>
            ))}
            <div className="divider" />
            <div className="it"><b>סה״כ</b><b className="num" style={{ fontSize: 20 }}>{meal.calories.toLocaleString('he-IL')} קק״ל</b></div>
          </div>
          <div className={`card`} style={{ background: meal.verdict === 'ok' ? 'var(--green-l)' : meal.verdict === 'warn' ? 'var(--amber-l)' : 'var(--red-l)' }}>
            <span className={`badge ${meal.verdict}`}>{VERDICT[meal.verdict]}</span>
            {meal.why && <p style={{ marginTop: 6 }}>{meal.why}</p>}
          </div>
          <button className="btn" onClick={save}>שמירה</button>
        </>
      )}
    </Sheet>
  );
}

function AskBack({ onAnswer }: { onAnswer: (a: string) => void }) {
  const [a, setA] = useState('');
  return <div className="row"><input className="input" value={a} onChange={e => setA(e.target.value)} placeholder="התשובה שלך" /><button className="btn sm" disabled={!a.trim()} onClick={() => onAnswer(a.trim())}>שליחה</button></div>;
}

function EditMeal({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const { saveMeal, deleteMeal } = useStore();
  const { toast } = useNav();
  const [m, setM] = useState<Meal>(meal);
  const [when, setWhen] = useState(toLocalInput(meal.at));
  const setItem = (i: number, cal: number) => { const items = m.items.map((x, j) => (j === i ? { ...x, calories: cal } : x)); setM({ ...m, items, calories: items.reduce((a, x) => a + x.calories, 0) }); };
  return (
    <Sheet open onClose={onClose} title="עריכת ארוחה">
      {m.thumb && <img src={m.thumb} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 16 }} />}
      <input className="input" style={{ fontWeight: 800 }} value={m.he} onChange={e => setM({ ...m, he: e.target.value })} />
      <div className="card items">
        {m.items.map((it, i) => <div key={i} className="it"><span>{it.he}</span><input className="num" inputMode="numeric" value={it.calories} onChange={e => setItem(i, parseInt(e.target.value.replace(/\D/g, '')) || 0)} /></div>)}
        <div className="it"><b>סה״כ</b><b className="num">{m.calories.toLocaleString('he-IL')} קק״ל</b></div>
      </div>
      <div className="row">{(['ok', 'warn', 'no'] as const).map(v => <button key={v} className={`chip ${m.verdict === v ? 'on' : ''}`} onClick={() => setM({ ...m, verdict: v })}>{VERDICT[v]}</button>)}</div>
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
