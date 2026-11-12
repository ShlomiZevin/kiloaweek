// Import from his Excel / Google Sheet (paste the cells, or a CSV file) and export everything back.
import type { ActType, Day, Measure } from './types';
import { actHe, dayGain, nightBurn, toMap, measureNet, measureMinutes } from './calc';
import { dayOf, fromLocalInput, timeOf } from './dates';

function splitRows(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  const tab = lines.some(l => l.includes('\t'));
  return lines.map(l => (tab ? l.split('\t') : parseCsvLine(l)).map(c => c.trim()));
}
function parseCsvLine(l: string) {
  const out: string[] = []; let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur); return out;
}
export function parseDate(s: string): string | null {
  s = s.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(s);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}
const numOr = (s: string | undefined) => { const n = parseFloat(String(s ?? '').replace(',', '.')); return isFinite(n) ? n : null; };
const findCol = (h: string[], ...keys: string[]) => h.findIndex(c => keys.some(k => c.toLowerCase().includes(k)));

export type ImportResult = { days: Day[]; measures: Measure[]; skipped: number; kind: 'days' | 'measures' | 'none' };

export function parseImport(text: string): ImportResult {
  const rows = splitRows(text);
  const hi = rows.findIndex(r => r.some(c => /תאריך|date/i.test(c)));
  if (hi < 0) return { days: [], measures: [], skipped: rows.length, kind: 'none' };
  const h = rows[hi].map(c => c.toLowerCase());
  const cDate = findCol(h, 'תאריך', 'date');
  const cMorning = findCol(h, 'בוקר', 'morning');
  const cEvening = findCol(h, 'ערב', 'evening');
  const cBefore = findCol(h, 'לפני', 'before');
  const cAfter = findCol(h, 'אחרי', 'after');
  let skipped = 0;
  // long-term sheet: date + morning/evening weights
  if (cMorning >= 0 || cEvening >= 0) {
    const days: Day[] = [];
    for (const r of rows.slice(hi + 1)) {
      const d = parseDate(r[cDate] || '');
      const mo = cMorning >= 0 ? numOr(r[cMorning]) : null, ev = cEvening >= 0 ? numOr(r[cEvening]) : null;
      const ok = (v: number | null) => v != null && v > 20 && v < 400;
      if (!d || (!ok(mo) && !ok(ev))) { skipped++; continue; }
      days.push({ date: d, ...(ok(mo) ? { morning: mo } : {}), ...(ok(ev) ? { evening: ev } : {}) });
    }
    return { days, measures: [], skipped, kind: 'days' };
  }
  // short-term sheet: type, minutes, before, after, drink
  if (cBefore >= 0 && cAfter >= 0) {
    const cType = findCol(h, 'סוג', 'type'), cMin = findCol(h, 'זמן', 'time', 'דק'), cDrink = findCol(h, 'שתי', 'drink');
    const measures: Measure[] = [];
    rows.slice(hi + 1).forEach((r, i) => {
      const b = numOr(r[cBefore]), a = numOr(r[cAfter]);
      const d = parseDate(r[cDate] || '');
      if (b == null || a == null || b < 20 || a < 20 || !d) { skipped++; return; }
      const startedAt = fromLocalInput(`${d}T12:00`) + i * 60000;
      const minutes = cMin >= 0 ? numOr(r[cMin]) : null;
      measures.push({ id: `imp${startedAt.toString(36)}${i}`, type: typeOf(r[cType] || ''), beforeKg: b, afterKg: a, drinkMl: cDrink >= 0 ? numOr(r[cDrink]) || 0 : 0, startedAt, minutes, endedAt: startedAt + (minutes || 0) * 60000 });
    });
    return { days: [], measures, skipped, kind: 'measures' };
  }
  return { days: [], measures: [], skipped: rows.length, kind: 'none' };
}
function typeOf(s: string): ActType {
  if (/פיפי|שתן|pee|number one|numbe one/i.test(s)) return 'pee';
  if (/קקי|צואה|poo|number two/i.test(s)) return 'poop';
  if (/ריצ|run/i.test(s)) return 'run';
  if (/הליכ|walk/i.test(s)) return 'walk';
  if (/בריכ|שחי|swim|pool/i.test(s)) return 'swim';
  if (/אופני|bike|cycl/i.test(s)) return 'bike';
  if (/כוח|strength|gym|משקולות/i.test(s)) return 'strength';
  return 'other';
}

const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function exportCsv(days: Day[], measures: Measure[]) {
  const m = toMap(days);
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const L = [['תאריך', 'משקל בוקר', 'משקל ערב', 'שריפה לילית (ג)', 'עלייה יומית (ג)', 'כוח', 'אירובי', 'צ׳יט', 'הערה'].join(',')];
  for (const d of sorted) L.push([d.date, d.morning ?? '', d.evening ?? '', nightBurn(m, d.date) ?? '', dayGain(m, d.date) ?? '', d.tags?.strength ? 1 : '', d.tags?.aerobic ? 1 : '', d.tags?.cheat ? 1 : '', d.note || ''].map(csvCell).join(','));
  L.push('', ['תאריך', 'שעה', 'סוג', 'דקות', 'לפני (ק״ג)', 'אחרי (ק״ג)', 'שתייה (מ״ל)', 'ירידה נטו (ג)'].join(','));
  for (const x of [...measures].filter(x => x.afterKg != null).sort((a, b) => a.startedAt - b.startedAt))
    L.push([dayOf(x.startedAt), timeOf(x.startedAt), actHe(x.type), measureMinutes(x) ?? '', x.beforeKg, x.afterKg, x.drinkMl || 0, measureNet(x)].map(csvCell).join(','));
  const blob = new Blob(['﻿' + L.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kilo-a-week-${dayOf()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
