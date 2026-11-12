import { useEffect, useMemo, useRef, useState } from 'react';
import { newId, useStore } from '../lib/store';
import { Top, useNav } from '../App';
import { Icon, shrinkImage } from '../ui';
import { coachContext, researchContext, toMap } from '../lib/calc';
import { today } from '../lib/dates';
import type { ChatMsg, Meal } from '../lib/types';

const STARTERS = ['מה לאכול בערב?', 'למה עליתי היום במשקל?', 'כמה שרפתי בלילה השבוע?', 'לעבוד יותר על אירובי או על שריר?', 'תפריט ליום לפי השיטה', 'מה מותר בצ׳יט דיי?'];
const RESEARCH_Q = 'תנתחי לעומק את כל הנתונים שלי: מגמה שבועית, שריפה לילית ומה משפיע עליה (כוח / אירובי / מנוחה), איזה יום הכי כבד, מה שורף לי הכי הרבה במדידות. ובסוף: 3 המלצות מעשיות לשבוע הקרוב.';
const VERDICT = { ok: 'בשיטה', warn: 'לשים לב', no: 'לא בשיטה' } as const;

export function Coach() {
  const { chat, addChat, clearChat, api, days, measures, meals, profile, saveMeal, deleteMeal } = useStore();
  const { go, toast } = useNav();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'' | 'think' | 'listen'>('');
  const [img, setImg] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [rec, setRec] = useState<{ r: MediaRecorder; start: number } | null>(null);
  const [secs, setSecs] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chunks = useRef<Blob[]>([]);
  const m = useMemo(() => toMap(days), [days]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chat.length, busy]);
  useEffect(() => {
    if (sessionStorage.getItem('kaw-research')) { sessionStorage.removeItem('kaw-research'); send(RESEARCH_Q, { research: true }); }
  }, []); // eslint-disable-line
  useEffect(() => { if (!rec) return; const i = setInterval(() => setSecs(Math.floor((Date.now() - rec.start) / 1000)), 250); return () => clearInterval(i); }, [rec]);

  async function send(q: string, opt: { research?: boolean; voice?: boolean } = {}) {
    q = q.trim();
    const image = img;
    if (!q && image) q = 'אכלתי את זה';
    if (!q || busy) return;
    setErr(''); setText(''); setImg(null); setBusy('think');
    const thumb = image ? await small(image, 520) : undefined;
    const mine: ChatMsg = { id: newId(), role: 'user', text: q, at: Date.now(), thumb, voice: opt.voice || undefined };
    await addChat(mine);
    try {
      const history = [...chat, mine].slice(-14).map(c => ({ role: c.role, text: c.text }));
      let context = coachContext(m, measures, meals, profile);
      if (opt.research) context += '\n\n' + researchContext(m, measures, days);
      const r = await api<{ reply: string; meal: Omit<Meal, 'id' | 'date' | 'at'> | null }>('chat', { messages: history, context, image, research: !!opt.research });
      let logged: ChatMsg['meal'];
      if (r.meal) {
        const id = newId();
        await saveMeal({ id, date: today(), at: Date.now(), ...r.meal, thumb, text: q });
        logged = { id, he: r.meal.he, calories: r.meal.calories, verdict: r.meal.verdict };
      }
      await addChat({ id: newId(), role: 'assistant', text: r.reply, at: Date.now(), meal: logged });
    } catch (e: any) { setErr(e.message || 'משהו השתבש'); } finally { setBusy(''); }
  }

  // voice: tap to record, tap again to send
  async function toggleRec() {
    if (rec) { rec.r.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { toast('הדפדפן הזה לא מקליט'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = e => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRec(null);
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
        if (blob.size < 1500) return;
        setBusy('listen');
        try {
          const audio = await toDataUrl(blob);
          const { text: said } = await api<{ text: string }>('transcribe', { audio });
          setBusy('');
          if (said) await send(said, { voice: true }); else toast('לא שמעתי כלום, נסה שוב');
        } catch (e: any) { setBusy(''); setErr(e.message || 'ההקלטה לא נקלטה'); }
      };
      r.start();
      setSecs(0);
      setRec({ r, start: Date.now() });
    } catch { toast('צריך לאשר גישה למיקרופון'); }
  }

  async function undoMeal(msg: ChatMsg) {
    if (!msg.meal) return;
    await deleteMeal(msg.meal.id);
    await addChat({ ...msg, meal: { ...msg.meal, removed: true } });
    toast('הארוחה הוסרה מהיומן');
  }

  return (
    <>
      <Top title="המאמנת" sub="מכירה את השיטה ואת הנתונים שלך" />
      <div className="chat" style={{ paddingBottom: 120 }}>
        {!chat.length && (
          <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <img src="/img/coach.jpg" alt="" style={{ width: 96, height: 96, borderRadius: '50%', margin: '0 auto' }} />
            <b>היי, אני המאמנת שלך</b>
            <p className="hint">מכירה את שיטת קילו בשבוע ורואה את השקילות, המדידות והארוחות שלך. אפשר לכתוב, להקליט, או לשלוח תמונה של הצלחת - ואני ארשום את הארוחה ביומן.</p>
            <div className="starters" style={{ justifyContent: 'center' }}>{STARTERS.map(s => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div>
            <button className="btn soft sm" onClick={() => send(RESEARCH_Q, { research: true })}><Icon name="spark" size={18} />ניתוח עמוק של כל הנתונים</button>
          </div>
        )}
        {chat.map(c => (
          <div key={c.id} className={`msg ${c.role}`}>
            {c.thumb && <img src={c.thumb} alt="" />}
            {c.voice && <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginInlineEnd: 6, opacity: .85 }}><Icon name="mic" size={15} /></span>}
            {c.text}
            {c.meal && (
              <div className="meal-chip" style={{ opacity: c.meal.removed ? .55 : 1 }}>
                <div style={{ flex: 1 }}>
                  <b>{c.meal.removed ? 'הוסר מהיומן' : 'נרשם ביומן האוכל'}</b>
                  <div className="hint">{c.meal.he} · <span className="num">{c.meal.calories.toLocaleString('he-IL')}</span> קק״ל · <span className={`badge ${c.meal.verdict}`}>{VERDICT[c.meal.verdict]}</span></div>
                </div>
                {!c.meal.removed && <div className="row" style={{ gap: 4 }}><button className="link" onClick={() => go('food')}>לראות</button><button className="link" style={{ color: 'var(--muted)' }} onClick={() => undoMeal(c)}>ביטול</button></div>}
              </div>
            )}
          </div>
        ))}
        {busy && <div className={`msg ${busy === 'listen' ? 'user' : 'assistant'}`}><span className="typing"><i /><i /><i /></span>{busy === 'listen' && <span style={{ marginInlineStart: 8 }}>מתמלל...</span>}</div>}
        {err && <div className="hint" style={{ color: 'var(--red)', textAlign: 'center' }}>{err}</div>}
        {chat.length > 0 && !busy && (
          <div className="starters" style={{ marginTop: 6 }}>
            {STARTERS.slice(0, 3).map(s => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
            <button className="chip" onClick={() => send(RESEARCH_Q, { research: true })}>ניתוח עמוק</button>
            <button className="chip" onClick={() => clearChat()} style={{ color: 'var(--muted)' }}>שיחה חדשה</button>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="composer">
        {img && <div className="row" style={{ maxWidth: 488, margin: '0 auto 6px' }}><img src={img} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 12 }} /><span className="hint" style={{ flex: 1 }}>אשלח את התמונה - והארוחה תירשם</span><button className="link" onClick={() => setImg(null)}>הסרה</button></div>}
        <div className={`composer-in ${rec ? 'recording' : ''}`}>
          {rec ? (
            <>
              <span className="rec-dot" /><span style={{ flex: 1, fontWeight: 700 }}>מקליט... <span className="num">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span></span>
              <button className="att" onClick={() => { chunks.current = []; rec.r.onstop = null as any; rec.r.stream.getTracks().forEach(t => t.stop()); rec.r.stop(); setRec(null); }} aria-label="ביטול הקלטה"><Icon name="trash" /></button>
              <button className="send" onClick={toggleRec} aria-label="שליחת ההקלטה"><Icon name="send" /></button>
            </>
          ) : (
            <>
              <button className="att" onClick={() => fileRef.current?.click()} aria-label="תמונה של ארוחה"><Icon name="camera" /></button>
              <textarea rows={1} value={text} placeholder="לכתוב, להקליט או לצלם..." onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} />
              {text.trim() || img
                ? <button className="send" onClick={() => send(text)} disabled={!!busy} aria-label="שליחה"><Icon name="send" /></button>
                : <button className="send" onClick={toggleRec} disabled={!!busy} aria-label="הקלטה קולית"><Icon name="mic" /></button>}
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setImg(await shrinkImage(f, 1024, 0.8)); e.target.value = ''; }} />
      </div>
    </>
  );
}

function small(src: string, max: number): Promise<string> {
  return new Promise(res => {
    const i = new Image();
    i.onload = () => { const s = Math.min(1, max / Math.max(i.width, i.height)); const c = document.createElement('canvas'); c.width = i.width * s; c.height = i.height * s; c.getContext('2d')!.drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.72)); };
    i.src = src;
  });
}
function toDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
}
