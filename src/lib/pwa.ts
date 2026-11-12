// Add to home screen + web push.
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './store';
import { VAPID_PUBLIC } from './config';

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/i.test(navigator.userAgent);
export const isMobile = () => isIOS() || isAndroid();
export const inAppBrowser = () => /Instagram|FBAN|FBAV|FB_IAB|Line|TikTok|musical_ly|WhatsApp/i.test(navigator.userAgent);

let deferred: any = null;
addEventListener('beforeinstallprompt', (e: any) => { e.preventDefault(); deferred = e; dispatchEvent(new Event('kaw-can-install')); });
export const canPromptInstall = () => !!deferred;
export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice.catch(() => null);
  deferred = null;
  return r?.outcome === 'accepted';
}

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
/** iPhone allows push only from the home-screen app. */
export const pushNeedsInstall = () => isIOS() && !isStandalone();

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function subKey(sub: PushSubscription) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub.endpoint));
  return Array.from(new Uint8Array(h)).slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function enablePush(): Promise<'on' | 'denied' | 'unsupported' | 'install'> {
  if (pushNeedsInstall()) return 'install';
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
  const uid = auth.currentUser!.uid;
  await setDoc(doc(db, `users/${uid}/push/${await subKey(sub)}`), { sub: JSON.parse(JSON.stringify(sub)), ua: navigator.userAgent.slice(0, 200), at: Date.now() });
  return 'on';
}
export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await deleteDoc(doc(db, `users/${auth.currentUser!.uid}/push/${await subKey(sub)}`)).catch(() => {});
  await sub.unsubscribe();
}
export async function pushIsOn() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}
