import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { signOutNow, useStore } from './lib/store';
import { Icon, Sheet, useToast, Toast } from './ui';
import { isStandalone } from './lib/pwa';
import { SignIn } from './screens/SignIn';
import { Home } from './screens/Home';
import { Journal } from './screens/Journal';
import { MeasureScreen } from './screens/Measure';
import { Food } from './screens/Food';
import { Insights } from './screens/Insights';
import { Coach } from './screens/Coach';
import { Goals, Reminders } from './screens/Me';
import { Foods } from './screens/Foods';
import { Install } from './screens/Install';
import { WeighSheet } from './screens/WeighSheet';

export type Route = 'home' | 'journal' | 'measure' | 'food' | 'insights' | 'coach' | 'goals' | 'reminders' | 'foods' | 'install';
const PATHS: Record<Route, string> = {
  home: '/', journal: '/journal', measure: '/measure', food: '/food', insights: '/insights', coach: '/coach',
  goals: '/goals', reminders: '/reminders', foods: '/foods', install: '/install',
};
const fromPath = (p: string): Route => (Object.entries(PATHS).find(([, v]) => v === p)?.[0] as Route) || 'home';
const SCREENS: Record<Route, () => JSX.Element> = {
  home: Home, journal: Journal, measure: MeasureScreen, food: Food, insights: Insights, coach: Coach,
  goals: Goals, reminders: Reminders, foods: Foods, install: Install,
};
const TABS: { r: Route; he: string; icon: string }[] = [
  { r: 'home', he: 'בית', icon: 'home' },
  { r: 'journal', he: 'יומן', icon: 'journal' },
  { r: 'measure', he: 'לפני/אחרי', icon: 'scale' },
  { r: 'food', he: 'אוכל', icon: 'food' },
  { r: 'insights', he: 'התקדמות', icon: 'chart' },
];

type Nav = {
  route: Route;
  go: (r: Route) => void;
  weigh: (slot?: 'morning' | 'evening', date?: string) => void;
  toast: (s: string) => void;
};
const NavCtx = createContext<Nav>(null as any);
export const useNav = () => useContext(NavCtx);

export function App() {
  const { user, ready } = useStore();
  const [route, setRoute] = useState<Route>(() => fromPath(location.pathname));
  const [weighing, setWeighing] = useState<{ slot?: 'morning' | 'evening'; date?: string } | null>(null);
  const [menu, setMenu] = useState(false);
  const [toastText, toast] = useToast();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const on = () => setRoute(fromPath(location.pathname));
    addEventListener('popstate', on);
    return () => removeEventListener('popstate', on);
  }, []);
  // a reminder notification opens /?weigh=morning
  useEffect(() => {
    if (!user) return;
    const w = new URLSearchParams(location.search).get('weigh');
    if (w === 'morning' || w === 'evening') { setWeighing({ slot: w }); history.replaceState(null, '', location.pathname); }
  }, [user]);

  const go = useCallback((r: Route) => {
    if (PATHS[r] !== location.pathname) history.pushState(null, '', PATHS[r]);
    setRoute(r);
    setMenu(false);
    mainRef.current?.scrollTo(0, 0);
  }, []);
  const weigh = useCallback((slot?: 'morning' | 'evening', date?: string) => setWeighing({ slot, date }), []);

  if (!ready) return <div className="loading"><img src="/img/logo.png" alt="קילו בשבוע" /></div>;
  if (!user) return <SignIn />;

  const Screen = SCREENS[route];
  return (
    <NavCtx.Provider value={{ route, go, weigh, toast }}>
      <div className={`shell r-${route}`}>
        <Header onMenu={() => setMenu(true)} />
        <main ref={mainRef} className="main">
          <div className="page"><Screen /></div>
        </main>
        <nav className="nav" aria-label="ניווט">
          <div className="nav-in">
            {TABS.map(t => (
              <button key={t.r} className={`${route === t.r ? 'on' : ''} ${t.r === 'measure' ? 'mid' : ''}`} onClick={() => go(t.r)} aria-current={route === t.r ? 'page' : undefined}>
                <span className="ni"><Icon name={t.icon} size={24} /></span>
                {t.he}
              </button>
            ))}
          </div>
        </nav>
      </div>
      <AccountMenu open={menu} onClose={() => setMenu(false)} />
      <WeighSheet state={weighing} onClose={() => setWeighing(null)} />
      <Toast text={toastText} />
    </NavCtx.Provider>
  );
}

/** The header - always at the top. The app's name; the coach and the account menu on the left. In the chat it also says
 *  plainly who you're talking to: the AI coach. */
function Header({ onMenu }: { onMenu: () => void }) {
  const { route, go } = useNav();
  const { user, chat, clearChat } = useStore();
  return (
    <header className={`top ${route === 'coach' ? 'with-coach' : ''}`}>
      <div className="top-row">
        <button className="brand" onClick={() => go('home')} aria-label="קילו בשבוע - בית">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>
          קילו בשבוע
        </button>
        <div className="top-actions">
          {route !== 'coach' && <button className="icon-btn" onClick={() => go('coach')} aria-label="המאמנת"><Icon name="chat" size={26} /></button>}
          {route !== 'coach' && <span className="top-sep" />}
          <button onClick={onMenu} aria-label="החשבון שלי" className="avatar-btn">
            {user?.photoURL ? <img className="avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span className="avatar ph">{(user?.displayName || '?').slice(0, 1)}</span>}
          </button>
        </div>
      </div>
      {route === 'coach' && (
        <div className="coach-id">
          <span className="coach-ph"><img src="/img/coach.jpg" alt="" /><i><Icon name="spark" size={12} stroke={2.6} /></i></span>
          <div className="coach-t">
            <b>המאמנת <span className="ai">AI</span></b>
            <small><span className="ok-dot"><Icon name="check" size={10} stroke={3.4} /></span>יודעת את השיטה ואת הנתונים שלך</small>
          </div>
          {chat.length > 0 && <button className="new-chat" onClick={() => clearChat()}><Icon name="plus" size={16} stroke={2.6} />שיחה חדשה</button>}
        </div>
      )}
    </header>
  );
}

/** Tapping the profile picture: the account, like common apps - each entry opens its own page. */
function AccountMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useStore();
  const { go } = useNav();
  const rows: { r: Route; icon: string; he: string; sub?: string; tint: string }[] = [
    { r: 'goals', icon: 'target', he: 'היעדים שלי', sub: 'משקל התחלה, משקל יעד, יעד שבועי', tint: 'mint' },
    { r: 'reminders', icon: 'bell', he: 'תזכורות לשקילה', sub: 'בוקר וערב, הפעלה וכיבוי', tint: 'lav' },
    { r: 'foods', icon: 'food', he: 'הארוחות השמורות שלי', sub: 'כל הארוחות שתיעדת, להוספה בלחיצה', tint: 'aqua' },
  ];
  if (!isStandalone()) rows.push({ r: 'install', icon: 'phone', he: 'הוספה למסך הבית', tint: 'blue' });
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="acct">
        {user?.photoURL ? <img className="acct-ph" src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span className="acct-ph ph">{(user?.displayName || '?').slice(0, 1)}</span>}
        <b>{user?.displayName}</b>
        <small>{user?.email}</small>
      </div>
      <div className="divider" />
      <div className="menu">
        {rows.map(x => (
          <button key={x.r} className="menu-row" onClick={() => go(x.r)}>
            <span className={`mi ${x.tint}`}><Icon name={x.icon} size={24} /></span>
            <span className="mt"><b>{x.he}</b>{x.sub && <small>{x.sub}</small>}</span>
            <Icon name="fwd" size={20} />
          </button>
        ))}
      </div>
      <button className="logout" onClick={() => { onClose(); signOutNow(); }}><Icon name="logout" size={22} />יציאה מהחשבון</button>
    </Sheet>
  );
}

/** A page opened from the account menu: its name and a way back. */
export function PageHead({ title, sub }: { title: string; sub?: string }) {
  const { go } = useNav();
  return (
    <div className="page-head">
      <button className="icon-btn" onClick={() => (history.length > 1 ? history.back() : go('home'))} aria-label="חזרה"><Icon name="back" size={24} /></button>
      <div><h1>{title}</h1>{sub && <small>{sub}</small>}</div>
    </div>
  );
}
