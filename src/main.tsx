import { createRoot } from 'react-dom/client';
import './styles.css';
import './theme-a.css';
import { StoreProvider } from './lib/store';
import { App } from './App';

async function start() {
  // DEV only: VITE_MOCK=1 runs every screen on seeded data without a Google account (src/lib/mock.tsx)
  const Provider = import.meta.env.DEV && import.meta.env.VITE_MOCK === '1' ? (await import('./lib/mock')).MockStoreProvider : StoreProvider;
  createRoot(document.getElementById('root')!).render(<Provider><App /></Provider>);
}
start();

if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
