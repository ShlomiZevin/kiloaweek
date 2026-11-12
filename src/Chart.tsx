import { useMemo, useRef, useState } from 'react';
import { diffDays, addDays, shortDate, heDate } from './lib/dates';

export const C = { morning: '#d97706', evening: '#2563eb', avg: '#0f8f80' };

type Pt = { date: string; v: number };
type Series = { key: string; he: string; color: string; kind: 'dots' | 'line'; pts: Pt[] };

/** Weight over time: morning + evening dots, the 7-day average as a line. Time runs left to right. Touch for values. */
export function WeightChart({ series, from, to, unit = 'ק״ג', height = 220 }: { series: Series[]; from: string; to: string; unit?: string; height?: number }) {
  const W = 360, H = height, padL = 34, padR = 10, padT = 12, padB = 26;
  const n = Math.max(1, diffDays(to, from));
  const all = series.flatMap(s => s.pts.map(p => p.v));
  const [hover, setHover] = useState<string | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const { lo, hi, ticks } = useMemo(() => {
    if (!all.length) return { lo: 0, hi: 1, ticks: [] as number[] };
    let lo = Math.min(...all), hi = Math.max(...all);
    const padv = Math.max(0.3, (hi - lo) * 0.12); lo -= padv; hi += padv;
    const step = niceStep((hi - lo) / 4);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const ticks: number[] = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(2));
    return { lo, hi, ticks };
  }, [all.join(',')]); // eslint-disable-line
  const x = (d: string) => padL + (diffDays(d, from) / n) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(f => addDays(from, Math.round(f * n)));

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const f = Math.min(1, Math.max(0, (px - padL) / (W - padL - padR)));
    setHover(addDays(from, Math.round(f * n)));
  };
  const at = (s: Series, d: string) => s.pts.find(p => p.date === d)?.v;
  const hx = hover ? x(hover) : 0;

  if (!all.length) return <div className="hint" style={{ padding: 20, textAlign: 'center' }}>אין עדיין נתונים בטווח הזה.</div>;
  return (
    <div style={{ position: 'relative' }}>
      <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="גרף משקל">
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#edf1ef" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
          </g>
        ))}
        {xTicks.map((d, i) => <text key={i} x={x(d)} y={H - 8} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{shortDate(d)}</text>)}
        <defs><linearGradient id="kawArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.avg} stopOpacity="0.22" /><stop offset="1" stopColor={C.avg} stopOpacity="0" /></linearGradient></defs>
        {series.filter(s => s.kind === 'line' && s.pts.length > 1).map(s => <path key={s.key + 'a'} d={areaPath(s.pts, x, y, H - padB)} fill="url(#kawArea)" />)}
        {series.filter(s => s.kind === 'line').map(s => <path key={s.key} d={linePath(s.pts, x, y)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />)}
        {series.filter(s => s.kind === 'dots').map(s => s.pts.map(p => <circle key={s.key + p.date} cx={x(p.date)} cy={y(p.v)} r={n > 90 ? 2.6 : 3.6} fill={s.color} stroke="#fff" strokeWidth={1.2} />))}
        {hover && <line x1={hx} x2={hx} y1={padT} y2={H - padB} stroke="#9fb1a8" strokeDasharray="3 3" />}
        {hover && series.map(s => { const v = at(s, hover); return v != null ? <circle key={'h' + s.key} cx={hx} cy={y(v)} r={5} fill={s.color} stroke="#fff" strokeWidth={2} /> : null; })}
      </svg>
      {hover && (
        <div className="tip" style={{ top: 4, [hx > W / 2 ? 'left' : 'right']: 8 } as any}>
          <b>{heDate(hover)}</b>
          {series.map(s => { const v = at(s, hover); return v != null ? <div key={s.key} className="row" style={{ gap: 6 }}><span className="dot" style={{ background: s.color }} />{s.he}: <b className="num">{v.toFixed(2)}</b> {unit}</div> : null; })}
        </div>
      )}
    </div>
  );
}

function linePath(pts: Pt[], x: (d: string) => number, y: (v: number) => number) {
  let d = '', prev: string | null = null;
  for (const p of pts) {
    const gap = prev && diffDays(p.date, prev) > 3;
    d += `${!prev || gap ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)} `;
    prev = p.date;
  }
  return d;
}
function areaPath(pts: Pt[], x: (d: string) => number, y: (v: number) => number, base: number) {
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return `${line} L${x(pts[pts.length - 1].date).toFixed(1)},${base} L${x(pts[0].date).toFixed(1)},${base} Z`;
}
function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

export function Legend({ items }: { items: { he: string; color: string; kind: 'dots' | 'line' }[] }) {
  return (
    <div className="legend">
      {items.map(i => (
        <span key={i.he}>{i.kind === 'line' ? <svg width="18" height="8"><line x1="1" x2="17" y1="4" y2="4" stroke={i.color} strokeWidth="3" strokeLinecap="round" /></svg> : <span className="dot" style={{ background: i.color }} />}{i.he}</span>
      ))}
    </div>
  );
}

/** Small line of weekly values (night burn per week). */
export function MiniLine({ pts, color = C.avg, unit = 'גרם' }: { pts: { label: string; v: number }[]; color?: string; unit?: string }) {
  const W = 360, H = 120, padL = 38, padR = 10, padT = 10, padB = 22;
  const [hi, setHi] = useState<number | null>(null);
  if (pts.length < 2) return <div className="hint">צריך לפחות שבועיים של שקילות בוקר וערב.</div>;
  const vs = pts.map(p => p.v); let lo = Math.min(...vs), top = Math.max(...vs);
  const pad = Math.max(50, (top - lo) * 0.2); lo = Math.max(0, lo - pad); top += pad;
  const x = (i: number) => padL + (i / (pts.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (top - lo || 1)) * (H - padT - padB);
  return (
    <div style={{ position: 'relative' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} onPointerLeave={() => setHi(null)}>
        {[lo, (lo + top) / 2, top].map((t, i) => <g key={i}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#edf1ef" /><text x={padL - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text></g>)}
        <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r={hi === i ? 6 : 4} fill={color} stroke="#fff" strokeWidth={1.5} />)}
        {pts.map((p, i) => <rect key={'r' + i} x={x(i) - 14} y={0} width={28} height={H} fill="transparent" onPointerEnter={() => setHi(i)} onPointerDown={() => setHi(i)} />)}
        {[0, pts.length - 1].map(i => <text key={'l' + i} x={x(i)} y={H - 6} textAnchor={i ? 'end' : 'start'}>{pts[i].label}</text>)}
      </svg>
      {hi != null && <div className="tip" style={{ top: 0, [x(hi) > W / 2 ? 'left' : 'right']: 8 } as any}>שבוע {pts[hi].label}: <b className="num">{Math.round(pts[hi].v).toLocaleString('he-IL')}</b> {unit}</div>}
    </div>
  );
}
