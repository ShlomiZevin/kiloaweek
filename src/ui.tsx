import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ActType } from './lib/types';

// ── line icons (the activity / morning / evening icons are painted pictures in /img) ──
const P: Record<string, ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></>,
  journal: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 8h6M9 12h6M9 16h3.5" /></>,
  scale: <><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><path d="M8 9.5a5.5 5.5 0 0 1 8 0" /><path d="m12 11 1.6-2.2" /></>,
  food: <><path d="M7 3v7a2 2 0 0 0 2 2v9" /><path d="M11 3v7a2 2 0 0 1-2 2" /><path d="M7 3v5M17 21V3c-2.2 1-3.5 3.5-3.5 7 0 2 1.2 3 3.5 3" /></>,
  chart: <><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></>,
  chat: <><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1.3-3.6 4-5.5 7.5-5.5s6.2 1.9 7.5 5.5" /></>,
  camera: <><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Z" /><circle cx="12" cy="13" r="3.5" /></>,
  send: <><path d="M20 4 3.5 11l6.5 2.5L12.5 20Z" /><path d="m10 13.5 4-4" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="m9 6 6 6-6 6" />,
  fwd: <path d="m15 6-6 6 6 6" />,
  trash: <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19.5h14" /></>,
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M5 19.5h14" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  timer: <><circle cx="12" cy="13.5" r="7" /><path d="M12 13.5V10M9.5 3.5h5" /></>,
  drop: <path d="M12 3.5c3.5 4.2 6 7.4 6 10.5a6 6 0 0 1-12 0c0-3.1 2.5-6.3 6-10.5Z" />,
  spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></>,
  phone: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  share: <><path d="M12 15V3.5M8 7.5l4-4 4 4" /><path d="M6 11v8.5h12V11" /></>,
  dots: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 2.8-5.4 3.6-9.3 2.1 1.4 3 3.2 3 5 1-.6 1.7-1.7 1.9-3 2.4 2 4.5 4.6 4.5 7.6C18.5 18.6 15.9 21 12 21Z" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  candy: <><circle cx="12" cy="12" r="4.5" /><path d="m7.8 9.8-3.3-2.3v9l3.3-2.3M16.2 9.8l3.3-2.3v9l-3.3-2.3" /></>,
};
export function Icon({ name, size = 22, stroke = 2, className }: { name: keyof typeof P | string; size?: number; stroke?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[name]}
    </svg>
  );
}
export const ActImg = ({ type, size = 44 }: { type: ActType | 'morning' | 'evening'; size?: number }) => (
  <img src={`/img/act-${type}.png`} width={size} height={size} alt="" className="act-img" />
);

// ── number formats ──
export const kg = (v: number | null | undefined, d = 1) => (v == null ? '—' : v.toFixed(d));
export function signedG(v: number | null | undefined) {
  if (v == null) return '—';
  const r = Math.round(v);
  return `⁦${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toLocaleString('he-IL')}⁩`; // LTR-isolated so the sign stays in front
}
export function signedKg(vg: number | null | undefined) {
  if (vg == null) return '—';
  const v = vg / 1000;
  return `⁦${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}⁩`;
}
/** down = good in this app */
export const tone = (v: number | null | undefined) => (v == null ? '' : v < 0 ? 'good' : v > 0 ? 'bad' : '');

// ── bottom sheet ──
export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    document.body.classList.add('noscroll');
    return () => { removeEventListener('keydown', k); document.body.classList.remove('noscroll'); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className={`sheet ${tall ? 'tall' : ''}`} onClick={e => e.stopPropagation()} role="dialog" aria-modal>
        <div className="sheet-grip" />
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="סגירה"><Icon name="close" /></button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ── weight pad: big number, -/+ 100 g, the keyboard when he wants it ──
export function WeightInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.select(), 250); }, [autoFocus]);
  const step = (d: number) => {
    const n = parseFloat(value.replace(',', '.'));
    onChange((isFinite(n) ? n + d : 80).toFixed(1));
  };
  return (
    <div className="wpad">
      <button type="button" className="wpad-btn" onClick={() => step(0.1)} aria-label="הוסף 100 גרם"><Icon name="plus" size={26} /></button>
      <div className="wpad-num">
        <input ref={ref} inputMode="decimal" value={value} onChange={e => onChange(e.target.value.replace(/[^\d.,]/g, ''))} aria-label="משקל בקילו" />
        <span>ק״ג</span>
      </div>
      <button type="button" className="wpad-btn" onClick={() => step(-0.1)} aria-label="הורד 100 גרם"><Icon name="minus" size={26} /></button>
    </div>
  );
}
export const parseKg = (s: string) => {
  const n = parseFloat(String(s).replace(',', '.'));
  return isFinite(n) && n > 20 && n < 400 ? n : null;
};

export function Toast({ text }: { text: string | null }) {
  return text ? <div className="toast" role="status">{text}</div> : null;
}
export function useToast() {
  const [t, setT] = useState<string | null>(null);
  const show = (s: string) => { setT(s); setTimeout(() => setT(null), 2600); };
  return [t, show] as const;
}

/** Shrinks a photo in the browser before it goes anywhere (AI gets ~1024px, the meal keeps a ~200px thumb). */
export function shrinkImage(file: File, max: number, quality = 0.82): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

export function Empty({ img, title, text, children }: { img?: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {img && <img src={img} alt="" width={84} height={84} />}
      <b>{title}</b>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
