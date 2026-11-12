// Firebase + the user's data, live. Everything lives under users/{uid}; the device keeps an offline copy,
// so a weighing at 6 a.m. without signal still saves and syncs later.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, onSnapshot, setDoc, deleteDoc,
  query, orderBy, limit, where, writeBatch, deleteField, increment,
} from 'firebase/firestore';
import { firebaseConfig } from './config';
import { API_BASE } from './config';
import type { ChatMsg, Day, Meal, Measure, Profile, SavedMeal } from './types';
import { addDays, today } from './dates';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

export async function signInGoogle() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
  try {
    await signInWithPopup(auth, p);
  } catch (e: any) {
    // iOS home-screen apps and some in-app browsers block popups - fall back to a redirect
    if (standalone || /popup|cancelled-popup|operation-not-supported/.test(String(e?.code))) await signInWithRedirect(auth, p);
    else throw e;
  }
}
export const signOutNow = () => signOut(auth);

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clean = <T extends object>(o: T) => JSON.parse(JSON.stringify(o)) as T; // drops undefined
/** The meal library key: the meal's name, normalized (same name = same saved meal). */
export const foodKey = (he: string) => (he.trim().replace(/\s+/g, ' ').replace(/[\/#?.\[\]]/g, '').slice(0, 80) || 'ארוחה');
/** What the library keeps of a meal. */
export function libraryEntry(m: Meal) {
  return clean({ he: m.he, items: m.items, calories: m.calories, protein: m.protein, carbs: m.carbs, sugar: m.sugar, verdict: m.verdict, why: m.why, thumb: m.thumb, lastAt: m.at });
}

export type Store = {
  user: User | null;
  ready: boolean;
  profile: Profile;
  days: Day[];
  measures: Measure[];
  meals: Meal[];
  chat: ChatMsg[];
  foods: SavedMeal[];
  loaded: boolean;
  setWeight: (date: string, slot: 'morning' | 'evening', kg: number | null, at?: number) => Promise<void>;
  updateDay: (date: string, patch: Partial<Day>) => Promise<void>;
  deleteDay: (date: string) => Promise<void>;
  saveMeasure: (m: Measure) => Promise<void>;
  deleteMeasure: (id: string) => Promise<void>;
  saveMeal: (m: Meal) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  /** Adds the meal to the library (or counts one more use). */
  rememberMeal: (m: Meal) => Promise<void>;
  forgetMeal: (key: string) => Promise<void>;
  addChat: (m: ChatMsg) => Promise<void>;
  clearChat: () => Promise<void>;
  saveProfile: (p: Partial<Profile>) => Promise<void>;
  api: <T = any>(path: string, body: unknown) => Promise<T>;
};

export const StoreCtx = createContext<Store | null>(null);
export const useStore = () => useContext(StoreCtx)!;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [days, setDays] = useState<Day[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [foods, setFoods] = useState<SavedMeal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setReady(true); }), []);

  useEffect(() => {
    if (!user) { setDays([]); setMeasures([]); setMeals([]); setChat([]); setFoods([]); setProfile({}); setLoaded(false); return; }
    const base = `users/${user.uid}`;
    const subs = [
      onSnapshot(doc(db, base), s => {
        const p = (s.data() || {}) as Profile;
        setProfile(p);
        if (!s.exists() || !p.email) {
          setDoc(doc(db, base), clean({ name: user.displayName || '', email: user.email || '', photo: user.photoURL || '', createdAt: p.createdAt || Date.now(),
            reminders: p.reminders || { on: false, morning: '07:30', evening: '22:00' } }), { merge: true });
        }
      }),
      onSnapshot(collection(db, `${base}/days`), s => { setDays(s.docs.map(d => ({ ...(d.data() as Day), date: d.id }))); setLoaded(true); }),
      onSnapshot(query(collection(db, `${base}/measures`), orderBy('startedAt', 'desc'), limit(500)), s => setMeasures(s.docs.map(d => ({ ...(d.data() as Measure), id: d.id })))),
      onSnapshot(query(collection(db, `${base}/meals`), where('date', '>=', addDays(today(), -60))), s => setMeals(s.docs.map(d => ({ ...(d.data() as Meal), id: d.id })).sort((a, b) => a.at - b.at))),
      onSnapshot(collection(db, `${base}/foods`), s => setFoods(s.docs.map(d => ({ ...(d.data() as SavedMeal), id: d.id })).sort((a, b) => b.n - a.n || b.lastAt - a.lastAt))),
      onSnapshot(query(collection(db, `${base}/chat`), orderBy('at', 'desc'), limit(80)), s => setChat(s.docs.map(d => ({ ...(d.data() as ChatMsg), id: d.id })).reverse())),
    ];
    return () => subs.forEach(u => u());
  }, [user]);

  const store = useMemo<Store>(() => {
    const base = () => `users/${auth.currentUser!.uid}`;
    return {
      user, ready, profile, days, measures, meals, chat, foods, loaded,
      async setWeight(date, slot, kg, at) {
        const ref = doc(db, `${base()}/days/${date}`);
        if (kg == null) await setDoc(ref, { [slot]: deleteField(), [slot + 'At']: deleteField() }, { merge: true });
        else await setDoc(ref, { [slot]: Math.round(kg * 100) / 100, [slot + 'At']: at || Date.now() }, { merge: true });
      },
      async updateDay(date, patch) { await setDoc(doc(db, `${base()}/days/${date}`), clean(patch), { merge: true }); },
      async deleteDay(date) { await deleteDoc(doc(db, `${base()}/days/${date}`)); },
      async saveMeasure(m) { const { id, ...rest } = m; await setDoc(doc(db, `${base()}/measures/${id}`), clean(rest)); },
      async deleteMeasure(id) { await deleteDoc(doc(db, `${base()}/measures/${id}`)); },
      async saveMeal(m) { const { id, ...rest } = m; await setDoc(doc(db, `${base()}/meals/${id}`), clean(rest)); },
      async deleteMeal(id) { await deleteDoc(doc(db, `${base()}/meals/${id}`)); },
      async rememberMeal(m) { await setDoc(doc(db, `${base()}/foods/${foodKey(m.he)}`), { ...libraryEntry(m), n: increment(1) }, { merge: true }); },
      async forgetMeal(key) { await deleteDoc(doc(db, `${base()}/foods/${key}`)); },
      async addChat(m) { const { id, ...rest } = m; await setDoc(doc(db, `${base()}/chat/${id}`), clean(rest)); },
      async clearChat() {
        const b = writeBatch(db);
        chat.forEach(c => b.delete(doc(db, `${base()}/chat/${c.id}`)));
        await b.commit();
      },
      async saveProfile(p) { await setDoc(doc(db, base()), clean(p), { merge: true }); },
      async api(path, body) {
        const token = await auth.currentUser!.getIdToken();
        const r = await fetch(`${API_BASE}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `שגיאה ${r.status}`);
        return j;
      },
    };
  }, [user, ready, profile, days, measures, meals, chat, foods, loaded]);

  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}
