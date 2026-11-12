import { useEffect, useMemo, useRef, useState } from 'react';
import { newId, useStore } from '../lib/store';
import { useNav } from '../App';
import { Icon, shrinkImage } from '../ui';
import { coachContext, toMap } from '../lib/calc';
import { useVoice } from '../lib/voice';
import { timeOf, today } from '../lib/dates';
import type { ChatMsg, LogCard, MealCore } from '../lib/types';

/** The chat with the AI coach. When you tell her what you did (ate, weighed, drank) she offers a log card - one tap adds it
 *  (a meal also goes into the meal library). No suggested questions, ever (his rule). */
export function Coach() {
  const { chat, addChat, api, days, measures, meals, profile, user } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const m = useMemo(() => toMap(days), [days]);
  const voice = useVoice(api, said => send(said, true), e => setErr(e));

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [chat.length, busy, voice.listening]);

  async function send(q: string, isVoice = false) {
    q = q.trim();
    const image = img;
    if (!q && image) q = 'אכלתי את זה';
    if (!q || busy) return;
    setErr(''); setText(''); setImg(null); setBusy(true);
    const thumb = image ? await small(image, 520) : undefined;
    const mine: ChatMsg = { id: newId(), role: 'user', text: q, at: Date.now(), thumb, voice: isVoice || undefined };
    await addChat(mine);
    try {
      const history = [...chat, mine].slice(-14).map(c => ({ role: c.role, text: c.text }));
      const context = coachContext(m, measures, meals, profile);
      const r = await api<{ reply: string; logs: LogCard[] }>('chat', { messages: history, context, image });
      const logs = (r.logs || []).map(l => (l.kind === 'meal' && thumb ? { ...l, meal: { ...l.meal, thumb } } : l));
      await addChat({ id: newId(), role: 'assistant', text: r.reply, at: Date.now(), logs: logs.length ? logs : undefined });
    } catch (e: any) { setErr(e.message || 'משהו השתבש'); } finally { setBusy(false); }
  }

  const first = (user?.displayName || '').split(' ')[0];
  return (
    <div className="chat-screen">
      <div className="chat">
        {!chat.length && (
          <div className="coach-hello">
            <img src="/img/coach.jpg" alt="" />
            <b>היי{first ? ` ${first}` : ''}, אני המאמנת</b>
            <p>אני AI שמכירה את שיטת קילו בשבוע ורואה את השקילות, המדידות והארוחות שלך. ספרו לי מה אכלתם, כמה שקלתם או מה מעסיק אתכם - בכתב, בהקלטה או בתמונה של הצלחת - ואכין לכם את זה לתיעוד בלחיצה.</p>
          </div>
        )}
        {chat.map((c, i) => {
          const firstOfRun = chat[i - 1]?.role !== c.role;
          return c.role === 'assistant' ? (
            <div key={c.id} className={`row-msg coach ${firstOfRun ? 'first' : ''}`}>
              <span className="who">{firstOfRun && <img src="/img/coach.jpg" alt="המאמנת" />}</span>
              <div className="col">
                {firstOfRun && <span className="name">המאמנת · AI</span>}
                <div className="msg assistant">{c.text}</div>
                {c.meal && <OldMeal c={c} />}
                {c.logs?.map((l, j) => <LogCardView key={j} msg={c} idx={j} />)}
              </div>
            </div>
          ) : (
            <div key={c.id} className={`row-msg me ${firstOfRun ? 'first' : ''}`}>
              <div className="col">
                {firstOfRun && <span className="name">את/ה</span>}
                <div className="msg user">
                  {c.thumb && <img src={c.thumb} alt="" />}
                  {c.voice && <span className="voice-tag"><Icon name="mic" size={15} />הודעה קולית</span>}
                  {c.text}
                  <span className="at">{timeOf(c.at)}</span>
                </div>
              </div>
            </div>
          );
        })}
        {voice.listening && <div className="row-msg me"><div className="col"><div className="msg user"><span className="typing light"><i /><i /><i /></span> מתמלל...</div></div></div>}
        {busy && <div className="row-msg coach first"><span className="who"><img src="/img/coach.jpg" alt="" /></span><div className="col"><div className="msg assistant"><span className="typing"><i /><i /><i /></span></div></div></div>}
        {err && <div className="hint" style={{ color: 'var(--red)', textAlign: 'center' }}>{err}</div>}
        <div ref={endRef} />
      </div>

      <div className="composer">
        {img && <div className="att-prev"><img src={img} alt="" /><span className="hint" style={{ flex: 1 }}>התמונה תישלח עם ההודעה</span><button className="link" onClick={() => setImg(null)}>הסרה</button></div>}
        <div className={`composer-in ${voice.recording ? 'recording' : ''}`}>
          {voice.recording ? (
            <>
              <button className="att" onClick={voice.cancel} aria-label="ביטול הקלטה"><Icon name="trash" /></button>
              <span className="rec-dot" /><span style={{ flex: 1, fontWeight: 700 }}>מקליט... <span className="num">{voice.clock}</span></span>
              <button className="send" onClick={voice.send} aria-label="שליחת ההקלטה"><Icon name="send" /></button>
            </>
          ) : (
            <>
              <button className="att" onClick={() => fileRef.current?.click()} aria-label="תמונה של ארוחה"><Icon name="image" /></button>
              <textarea rows={1} value={text} placeholder="לכתוב או להקליט..." onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} />
              {text.trim() || img
                ? <button className="send" onClick={() => send(text)} disabled={busy} aria-label="שליחה"><Icon name="send" /></button>
                : <button className="send mic" onClick={voice.start} disabled={busy || voice.listening} aria-label="הקלטה קולית"><Icon name="mic" /></button>}
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setImg(await shrinkImage(f, 1024, 0.8)); e.target.value = ''; }} />
      </div>
    </div>
  );
}

/** One log card the coach offered: what it is + "הוסף". Once added: "נוסף" + undo. */
function LogCardView({ msg, idx }: { msg: ChatMsg; idx: number }) {
  const { addChat, saveMeal, deleteMeal, rememberMeal, setWeight, updateDay, days } = useStore();
  const { toast } = useNav();
  const l = msg.logs![idx];
  const [busy, setBusy] = useState(false);
  const patch = (x: Partial<LogCard>) => addChat({ ...msg, logs: msg.logs!.map((y, j) => (j === idx ? ({ ...y, ...x } as LogCard) : y)) });

  async function add() {
    setBusy(true);
    try {
      if (l.kind === 'meal') {
        const meal = { id: newId(), date: today(), at: Date.now(), ...l.meal };
        await saveMeal(meal); await rememberMeal(meal);
        await patch({ added: meal.id, removed: false });
        toast('נוסף ליומן האוכל ולארוחות השמורות');
      } else if (l.kind === 'weight') {
        await setWeight(today(), l.slot, l.kg);
        await patch({ added: today(), removed: false });
        toast(l.slot === 'morning' ? 'שקילת הבוקר נשמרה' : 'שקילת הערב נשמרה');
      } else {
        const d = days.find(x => x.date === today());
        await updateDay(today(), { water: (d?.water || 0) + l.ml });
        await patch({ added: today(), removed: false });
        toast('המים נוספו');
      }
    } finally { setBusy(false); }
  }
  async function undo() {
    if (l.kind === 'meal' && l.added) await deleteMeal(l.added);
    else if (l.kind === 'weight' && l.added) await setWeight(l.added, l.slot, null);
    else if (l.kind === 'water' && l.added) { const d = days.find(x => x.date === l.added); await updateDay(l.added, { water: Math.max(0, (d?.water || 0) - l.ml) }); }
    await patch({ added: undefined, removed: true });
    toast('בוטל');
  }

  const done = !!l.added && !l.removed;
  return (
    <div className={`log-card ${done ? 'done' : ''}`}>
      <div className="lc-main">
        <div className="lc-t">
          {l.kind === 'meal' && <><b>{l.meal.he}</b><Macros m={l.meal} /></>}
          {l.kind === 'weight' && <b>{l.slot === 'morning' ? 'שקילת בוקר' : 'שקילת ערב'} <span className="num">{l.kg.toFixed(1)}</span> ק״ג</b>}
          {l.kind === 'water' && <b>מים <span className="num">{l.ml.toLocaleString('he-IL')}</span> מ״ל</b>}
        </div>
        {l.kind === 'meal' ? (l.meal.thumb ? <img className="lc-ph" src={l.meal.thumb} alt="" /> : <img className="lc-ic" src="/img/f-bowl.png" alt="" />)
          : l.kind === 'weight' ? <img className="lc-ic" src={`/img/act-${l.slot}.png`} alt="" />
            : <span className="lc-ic water"><Icon name="drop" size={30} /></span>}
      </div>
      {done
        ? <div className="lc-done"><span><Icon name="check" size={18} stroke={3} />נוסף</span><button className="link" onClick={undo}>ביטול</button></div>
        : <button className="btn" onClick={add} disabled={busy}>הוסף</button>}
    </div>
  );
}

export function Macros({ m }: { m: Pick<MealCore, 'protein' | 'carbs' | 'sugar'> }) {
  return (
    <span className="macros">
      <span>חלבון <b className="num">{m.protein ?? 0}</b> ג׳</span> · <span>פחמימות <b className="num">{m.carbs ?? 0}</b> ג׳</span> · <span>סוכרים <b className="num">{m.sugar ?? 0}</b> ג׳</span>
    </span>
  );
}

/** Chats from before the log cards: the coach had logged the meal by herself. */
function OldMeal({ c }: { c: ChatMsg }) {
  if (!c.meal) return null;
  return <div className="log-card done"><div className="lc-main"><div className="lc-t"><b>{c.meal.he}</b><span className="hint">{c.meal.removed ? 'הוסר מהיומן' : 'נרשם ביומן האוכל'}</span></div></div></div>;
}

function small(src: string, max: number): Promise<string> {
  return new Promise(res => {
    const i = new Image();
    i.onload = () => { const s = Math.min(1, max / Math.max(i.width, i.height)); const c = document.createElement('canvas'); c.width = i.width * s; c.height = i.height * s; c.getContext('2d')!.drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.72)); };
    i.src = src;
  });
}
