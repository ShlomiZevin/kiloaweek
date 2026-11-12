export const firebaseConfig = {
  apiKey: 'AIzaSyDPg7Rdd9aivxeaF90tNK_6ZPfC8ZggW1k',
  authDomain: 'kiloaweek-app.firebaseapp.com',
  projectId: 'kiloaweek-app',
  storageBucket: 'kiloaweek-app.firebasestorage.app',
  messagingSenderId: '760700247532',
  appId: '1:760700247532:web:fcbe681347d74f2db4f4c9',
};
// Web push (VAPID) public key - the private half is the VAPID_PRIVATE secret of the functions.
export const VAPID_PUBLIC = 'BBXfbmc09kPKkwBl4DkdtCTC-jbBfcF5U0ZxrrgmaxpUFs59dOwCHDHTAuj2VLGpT98_eaVnFCK9a7Nyzpg2LAY';

// The server runs in the Shlomiverse project (boostmind-b052c, functions codebase "kiloaweek").
// Dev: Vite proxies /api to the local functions emulator.
export const API_BASE = import.meta.env.DEV ? '/api' : 'https://me-west1-boostmind-b052c.cloudfunctions.net/kawApi';
