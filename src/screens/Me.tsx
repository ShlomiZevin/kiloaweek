import { useEffect, useState } from 'react';
import { signOutNow, useStore } from '../lib/store';
import { Top, useNav } from '../App';
import { Icon } from '../ui';
import { disablePush, enablePush, isStandalone, pushIsOn, pushNeedsInstall, pushSupported } from '../lib/pwa';
import { exportCsv } from '../lib/csv';

export function Me() {
  const { profile, saveProfile, user, days, measures, api } = useStore();
  const { go, toast } = useNav();
  const [p, setP] = useState({ heightCm: '', startWeight: '', goalWeight: '', weeklyGoalG: '', calorieTarget: '' });
  const [pushOn, setPushOn] = useState(false);
  const rem = profile.reminders || { on: false, morning: '07:30', evening: '22:00' };

  useEffect(() => {
    setP({
      heightCm: profile.heightCm ? String(profile.heightCm) : '',
      startWeight: profile.startWeight ? String(profile.startWeight) : '',
      goalWeight: profile.goalWeight ? String(profile.goalWeight) : '',
      weeklyGoalG: profile.weeklyGoalG ? String(profile.weeklyGoalG) : '',
      calorieTarget: profile.calorieTarget ? String(profile.calorieTarget) : '',
    });
  }, [profile.heightCm, profile.startWeight, profile.goalWeight, profile.weeklyGoalG, profile.calorieTarget]);
  useEffect(() => { pushIsOn().then(setPushOn); }, []);

  const numOrDel = (s: string) => { const n = parseFloat(s.replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };
  const saveField = (k: keyof typeof p) => {
    const v = numOrDel(p[k]);
    if ((profile as any)[k] === (v ?? undefined)) return;
    saveProfile({ [k]: v ?? null } as any);
  };

  const togglePush = async () => {
    if (pushOn) { await disablePush(); setPushOn(false); await saveProfile({ reminders: { ...rem, on: false } }); toast('התזכורות כבויות'); return; }
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
    <>
      <Top title="אני" sub={user?.email || ''} />
      <div className="stack">
        <div className="card row">
          {user?.photoURL && <img src={user.photoURL} alt="" className="avatar" style={{ width: 54, height: 54 }} referrerPolicy="no-referrer" />}
          <div style={{ flex: 1 }}><b style={{ fontSize: 18 }}>{user?.displayName}</b><div className="hint">{days.filter(d => d.morning != null).length} שקילות בוקר · {measures.filter(m => m.afterKg != null).length} מדידות</div></div>
        </div>

        <div className="sec-title">היעדים שלי</div>
        <div className="card stack">
          <div className="grid2">
            <label className="field"><span>משקל התחלה</span><input className="input num" inputMode="decimal" value={p.startWeight} onChange={e => setP({ ...p, startWeight: e.target.value })} onBlur={() => saveField('startWeight')} placeholder="ק״ג" /></label>
            <label className="field"><span>משקל יעד</span><input className="input num" inputMode="decimal" value={p.goalWeight} onChange={e => setP({ ...p, goalWeight: e.target.value })} onBlur={() => saveField('goalWeight')} placeholder="ק״ג" /></label>
            <label className="field"><span>יעד שבועי (גרם)</span><input className="input num" inputMode="numeric" value={p.weeklyGoalG} onChange={e => setP({ ...p, weeklyGoalG: e.target.value })} onBlur={() => saveField('weeklyGoalG')} placeholder="800" /></label>
            <label className="field"><span>גובה (ס״מ)</span><input className="input num" inputMode="numeric" value={p.heightCm} onChange={e => setP({ ...p, heightCm: e.target.value })} onBlur={() => saveField('heightCm')} /></label>
          </div>
          <label className="field"><span>יעד קלוריות יומי (לא חובה)</span><input className="input num" inputMode="numeric" value={p.calorieTarget} onChange={e => setP({ ...p, calorieTarget: e.target.value })} onBlur={() => saveField('calorieTarget')} placeholder="בלי יעד - רק סופרים" /></label>
          <p className="hint">השיטה: דפיציט לאורך שבועות, 700 גרם עד קילו בשבוע. יעד קלוריות הוא כלי, לא חובה.</p>
        </div>

        <div className="sec-title">תזכורות לשקילה</div>
        <div className="card">
          <div className="toggle">
            <div><b>התראות</b><div className="hint">{pushNeedsInstall() ? 'באייפון התראות עובדות רק מהאפליקציה במסך הבית' : !pushSupported() ? 'הדפדפן הזה לא תומך בהתראות' : 'בוקר וערב - רק אם עוד לא שקלת'}</div></div>
            <button className={`switch ${pushOn && rem.on ? 'on' : ''}`} onClick={togglePush} aria-pressed={pushOn} aria-label="התראות" />
          </div>
          <div className="toggle">
            <span className="row"><img src="/img/act-morning.png" width={28} height={28} alt="" />שקילת בוקר</span>
            <input className="input" type="time" style={{ width: 120 }} value={rem.morning} onChange={e => saveProfile({ reminders: { ...rem, morning: e.target.value } })} />
          </div>
          <div className="toggle">
            <span className="row"><img src="/img/act-evening.png" width={28} height={28} alt="" />שקילת ערב</span>
            <input className="input" type="time" style={{ width: 120 }} value={rem.evening} onChange={e => saveProfile({ reminders: { ...rem, evening: e.target.value } })} />
          </div>
          {pushOn && <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={test}><Icon name="bell" size={18} />שליחת התראת בדיקה</button>}
        </div>

        <div className="sec-title">עוד</div>
        <div className="card" style={{ padding: '4px 16px' }}>
          <Row icon="book" text="השיטה - קילו בשבוע" onClick={() => go('method')} />
          {!isStandalone() && <Row icon="phone" text="הוספה למסך הבית" onClick={() => go('install')} />}
          <Row icon="upload" text="ייבוא מאקסל / גוגל שיטס" onClick={() => go('journal')} hint="ביומן, בכפתור הייבוא" />
          <Row icon="download" text="ייצוא כל הנתונים לאקסל" onClick={() => exportCsv(days, measures)} />
          <Row icon="close" text="יציאה מהחשבון" onClick={() => signOutNow()} />
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>הנתונים שלך נשמרים בחשבון שלך בלבד.</p>
      </div>
    </>
  );
}

function Row({ icon, text, hint, onClick }: { icon: string; text: string; hint?: string; onClick: () => void }) {
  return (
    <button className="toggle" style={{ width: '100%', textAlign: 'right' }} onClick={onClick}>
      <span className="row"><Icon name={icon} size={20} /><span><b style={{ fontWeight: 600 }}>{text}</b>{hint && <div className="hint">{hint}</div>}</span></span>
      <Icon name="fwd" size={18} />
    </button>
  );
}
