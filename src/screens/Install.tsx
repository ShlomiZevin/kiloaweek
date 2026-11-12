import { useEffect, useState } from 'react';
import { PageHead, useNav } from '../App';
import { Icon } from '../ui';
import { canPromptInstall, inAppBrowser, isAndroid, isIOS, isStandalone, promptInstall } from '../lib/pwa';

export function Install() {
  const { go, toast } = useNav();
  const [can, setCan] = useState(canPromptInstall());
  useEffect(() => { const on = () => setCan(true); addEventListener('kaw-can-install', on); return () => removeEventListener('kaw-can-install', on); }, []);
  const ios = isIOS(), android = isAndroid(), inApp = inAppBrowser();

  if (isStandalone()) return (<><PageHead title="מסך הבית" /><div className="card"><b>האפליקציה כבר במסך הבית.</b><p className="hint">אפשר להפעיל תזכורות לשקילה.</p><button className="btn" style={{ marginTop: 12 }} onClick={() => go('reminders')}>לתזכורות</button></div></>);

  return (
    <>
      <PageHead title="הוספה למסך הבית" sub="כמו אפליקציה, בלי חנות" />
      <div className="stack">
        <div className="card row">
          <img src="/img/icon-192.png" alt="" style={{ width: 64, height: 64, borderRadius: 16 }} />
          <div><b>קילו בשבוע על המסך</b><p className="hint">נפתח במסך מלא, מהיר, ושולח תזכורת לשקילת בוקר וערב. {ios ? 'באייפון - התראות עובדות רק מהאייקון במסך הבית.' : ''}</p></div>
        </div>

        {inApp && (
          <div className="card" style={{ background: 'var(--amber-l)' }}>
            <b>קודם פותחים בדפדפן</b>
            <p className="hint">אתה בתוך אינסטגרם / וואטסאפ / פייסבוק. לוחצים על <Icon name="dots" size={16} /> (או "שיתוף") ובוחרים "פתח בדפדפן" - {ios ? 'Safari' : 'Chrome'}.</p>
          </div>
        )}

        {can && (
          <button className="btn" onClick={async () => { if (await promptInstall()) toast('נוסף למסך הבית'); }}><Icon name="download" />הוספה בלחיצה אחת</button>
        )}

        {(ios || (!android && !can)) && (
          <div className="card stack">
            <b>אייפון / אייפד (Safari)</b>
            <ol className="steps">
              <li><span>לוחצים על <span className="kbd-ic"><Icon name="share" size={16} /></span> שיתוף - בסרגל התחתון (או למעלה ליד הכתובת).</span></li>
              <li>גוללים ובוחרים <b>"הוספה למסך הבית"</b>.</li>
              <li>לוחצים <b>"הוסף"</b> - והאייקון של קילו בשבוע על המסך.</li>
            </ol>
          </div>
        )}
        {(android || (!ios && !can)) && (
          <div className="card stack">
            <b>אנדרואיד (Chrome)</b>
            <ol className="steps">
              <li><span>לוחצים על <span className="kbd-ic"><Icon name="dots" size={16} /></span> התפריט - למעלה בצד שמאל.</span></li>
              <li>בוחרים <b>"התקנת אפליקציה"</b> או <b>"הוספה למסך הבית"</b>.</li>
              <li>מאשרים <b>"התקנה"</b>.</li>
            </ol>
          </div>
        )}
        <p className="hint" style={{ textAlign: 'center' }}>אחרי ההוספה - פותחים מהאייקון ומפעילים תזכורות בעמוד "אני".</p>
      </div>
    </>
  );
}
