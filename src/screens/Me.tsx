import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { PageHead, useNav } from '../App';
import { Icon } from '../ui';
import { disablePush, enablePush, pushIsOn, pushNeedsInstall, pushSupported } from '../lib/pwa';

/** Account menu -> היעדים שלי */
export function Goals() {
  const { profile, saveProfile } = useStore();
  const { toast } = useNav();
  const [p, setP] = useState({ startWeight: '', goalWeight: '', weeklyGoalG: '' });
  useEffect(() => {
    setP({
      startWeight: profile.startWeight ? String(profile.startWeight) : '',
      goalWeight: profile.goalWeight ? String(profile.goalWeight) : '',
      weeklyGoalG: profile.weeklyGoalG ? String(profile.weeklyGoalG) : '',
    });
  }, [profile.startWeight, profile.goalWeight, profile.weeklyGoalG]);
  const numOrDel = (s: string) => { const n = parseFloat(s.replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };
  const saveField = (k: keyof typeof p) => {
    const v = numOrDel(p[k]);
    if ((profile as any)[k] === (v ?? undefined)) return;
    saveProfile({ [k]: v ?? null } as any);
    toast('נשמר');
  };
  const F = ({ k, he, ph, mode = 'decimal' }: { k: keyof typeof p; he: string; ph?: string; mode?: 'decimal' | 'numeric' }) => (
    <label className="field"><span>{he}</span><input className="input num" inputMode={mode} value={p[k]} placeholder={ph} onChange={e => setP({ ...p, [k]: e.target.value })} onBlur={() => saveField(k)} /></label>
  );
  return (
    <div className="stack">
      <PageHead title="היעדים שלי" />
      <div className="card stack">
        <div className="grid2">
          {F({ k: 'startWeight', he: 'משקל התחלה (ק״ג)' })}
          {F({ k: 'goalWeight', he: 'משקל יעד (ק״ג)' })}
          {F({ k: 'weeklyGoalG', he: 'יעד שבועי (גרם)', ph: '800', mode: 'numeric' })}
        </div>
        <p className="hint">השיטה: גירעון לאורך שבועות - 700 גרם עד קילו בשבוע. המשקל היומי עולה ויורד, המגמה השבועית היא מה שקובע.</p>
      </div>
    </div>
  );
}

/** Account menu -> תזכורות לשקילה */
export function Reminders() {
  const { profile, saveProfile, api } = useStore();
  const { go, toast } = useNav();
  const [pushOn, setPushOn] = useState(false);
  const rem = profile.reminders || { on: false, morning: '07:30', evening: '22:00' };
  useEffect(() => { pushIsOn().then(setPushOn); }, []);
  const toggle = async () => {
    if (pushOn && rem.on) { await disablePush(); setPushOn(false); await saveProfile({ reminders: { ...rem, on: false } }); toast('התזכורות כבויות'); return; }
    const r = await enablePush();
    if (r === 'on') { setPushOn(true); await saveProfile({ reminders: { ...rem, on: true } }); toast('התזכורות פועלות'); }
    else if (r === 'install') go('install');
    else if (r === 'denied') toast('ההתראות חסומות בדפדפן - אפשר לפתוח אותן בהגדרות האתר');
    else toast('הדפדפן הזה לא תומך בהתראות');
  };
  const test = async () => {
    try { const r = await api<{ sent: number }>('push/test', {}); toast(r.sent ? 'נשלחה התראת בדיקה' : 'לא נמצא מכשיר רשום'); }
    catch (e: any) { toast(e.message); }
  };
  return (
    <div className="stack">
      <PageHead title="תזכורות לשקילה" />
      <div className="card">
        <div className="toggle">
          <div><b>התראות</b><div className="hint">{pushNeedsInstall() ? 'באייפון התראות עובדות רק מהאפליקציה במסך הבית' : !pushSupported() ? 'הדפדפן הזה לא תומך בהתראות' : 'בוקר וערב - רק אם עוד לא שקלת'}</div></div>
          <button className={`switch ${pushOn && rem.on ? 'on' : ''}`} onClick={toggle} aria-pressed={pushOn && rem.on} aria-label="התראות" />
        </div>
        <div className="toggle">
          <span className="row"><img src="/img/act-morning.png" width={30} height={30} alt="" />שקילת בוקר</span>
          <input className="input" type="time" style={{ width: 120 }} value={rem.morning} onChange={e => saveProfile({ reminders: { ...rem, morning: e.target.value } })} />
        </div>
        <div className="toggle">
          <span className="row"><img src="/img/act-evening.png" width={30} height={30} alt="" />שקילת ערב</span>
          <input className="input" type="time" style={{ width: 120 }} value={rem.evening} onChange={e => saveProfile({ reminders: { ...rem, evening: e.target.value } })} />
        </div>
      </div>
      {pushOn && rem.on && <button className="btn ghost" onClick={test}><Icon name="bell" size={18} />שליחת התראת בדיקה</button>}
    </div>
  );
}
