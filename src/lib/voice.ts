// Voice message -> Hebrew text: tap to record, tap again to send (the server transcribes with gpt-4o-transcribe).
// Used by the coach chat and by "tell what you ate" in Food.
import { useEffect, useRef, useState } from 'react';

export function useVoice(api: <T = any>(path: string, body: unknown) => Promise<T>, onText: (text: string) => void, onError: (msg: string) => void) {
  const [rec, setRec] = useState<{ r: MediaRecorder; start: number } | null>(null);
  const [secs, setSecs] = useState(0);
  const [listening, setListening] = useState(false);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => { if (!rec) return; const i = setInterval(() => setSecs(Math.floor((Date.now() - rec.start) / 1000)), 250); return () => clearInterval(i); }, [rec]);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { onError('הדפדפן הזה לא מקליט'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRec(null);
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
        if (blob.size < 1500) return;
        setListening(true);
        try {
          const audio = await toDataUrl(blob);
          const { text } = await api<{ text: string }>('transcribe', { audio });
          if (text) onText(text); else onError('לא שמעתי כלום, נסו שוב');
        } catch (e: any) { onError(e.message || 'ההקלטה לא נקלטה'); } finally { setListening(false); }
      };
      r.start();
      setSecs(0);
      setRec({ r, start: Date.now() });
    } catch { onError('צריך לאשר גישה למיקרופון'); }
  }
  const send = () => rec?.r.stop();
  const cancel = () => {
    if (!rec) return;
    chunks.current = [];
    rec.r.onstop = null;
    rec.r.stream.getTracks().forEach(t => t.stop());
    rec.r.stop();
    setRec(null);
  };
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return { recording: !!rec, listening, clock, start, send, cancel };
}

function toDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
}
