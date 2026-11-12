import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useStore } from './lib/store';
import { Icon, useToast, Toast } from './ui';
import { SignIn } from './screens/SignIn';
import { Home } from './screens/Home';
import { Journal } from './screens/Journal';
import { MeasureScreen } from './screens/Measure';
import { Food } from './screens/Food';
import { Insights } from './screens/Insights';
import { Coach } from './screens/Coach';
import { Me } from './screens/Me';
import { Install } from './screens/Install';
import { Method } from './screens/Method';
import { WeighSheet } from './screens/WeighSheet';

export type Route = 'home' | 'journal' | 'measure' | 'food' | 'insights' | 'coach' | 'me' | 'install' | 'method';
const PATHS: Record<Route, string> = { home: '/', journal: '/journal', measure: '/measure', food: '/food', insights: '/insights', coach: '/coach', me: '/me', install: '/install', method: '/method' };
const fromPath = (p: string): Route => (Object.entries(PATHS).find(([, v]) => v === p)?.[0] as Route) || 'home';

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
  const [toastText, toast] = useToast();

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
    scrollTo(0, 0);
  }, []);
  const weigh = useCallback((slot?: 'morning' | 'evening', date?: string) => setWeighing({ slot, date }), []);

  if (!ready) return <div className="loading"><img src="/img/logo.png" alt="קילו בשבוע" /></div>;
  if (!user) return <SignIn />;

  const Screen = { home: Home, journal: Journal, measure: MeasureScreen, food: Food, insights: Insights, coach: Coach, me: Me, install: Install, method: Method }[route];
  const tabs: { r: Route; he: string; icon: string }[] = [
    { r: 'home', he: 'בית', icon: 'home' },
    { r: 'journal', he: 'יומן', icon: 'journal' },
    { r: 'measure', he: 'לפני/אחרי', icon: 'scale' },
    { r: 'food', he: 'אוכל', icon: 'food' },
    { r: 'insights', he: 'התקדמות', icon: 'chart' },
  ];
  return (
    <NavCtx.Provider value={{ route, go, weigh, toast }}>
      <div className="app">
        <Screen />
      </div>
      <nav className="nav" aria-label="ניווט">
        <div className="nav-in">
          {tabs.map(t => (
            <button key={t.r} className={`${route === t.r ? 'on' : ''} ${t.r === 'measure' ? 'mid' : ''}`} onClick={() => go(t.r)} aria-current={route === t.r ? 'page' : undefined}>
              {t.r === 'measure' ? <span className="mid-i"><Icon name={t.icon} size={26} /></span> : <Icon name={t.icon} size={24} />}
              {t.he}
            </button>
          ))}
        </div>
      </nav>
      <WeighSheet state={weighing} onClose={() => setWeighing(null)} />
      <Toast text={toastText} />
    </NavCtx.Provider>
  );
}

/** The header every screen shares: title on the right, coach + profile on the left. */
export function Top({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  const { go } = useNav();
  const { user } = useStore();
  return (
    <header className="top">
      <div className="top-title">
        {sub && <small>{sub}</small>}
        <b>{title}</b>
      </div>
      <div className="top-actions">
        <button className="icon-btn" onClick={() => go('coach')} aria-label="המאמנת"><Icon name="chat" /></button>
        <button onClick={() => go('me')} aria-label="אני והגדרות">
          {user?.photoURL ? <img className="avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span className="icon-btn"><Icon name="user" /></span>}
        </button>
      </div>
    </header>
  );
}
