// All dates are Israel calendar days, as YYYY-MM-DD strings.
const TZ = 'Asia/Jerusalem';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const dayOf = (ms: number = Date.now()) => fmt.format(new Date(ms));
export const today = () => dayOf();
export const timeOf = (ms: number) => hm.format(new Date(ms));
export const hourNow = () => Number(hm.format(new Date()).slice(0, 2));

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export function diffDays(a: string, b: string) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pa[0], pa[1] - 1, pa[2]) - Date.UTC(pb[0], pb[1] - 1, pb[2])) / 86400000);
}
/** 0 = Sunday ... 6 = Saturday */
export function weekday(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const WD_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function heDate(date: string, withWeekday = true) {
  const [, m, d] = date.split('-').map(Number);
  return `${withWeekday ? `יום ${WEEKDAYS[weekday(date)]}, ` : ''}${d} ב${MONTHS[m - 1]}`;
}
export function shortDate(date: string) {
  const [, m, d] = date.split('-').map(Number);
  return `${d}.${m}`;
}
/** The Sunday that starts this date's week (Israeli week). */
export const weekStart = (date: string) => addDays(date, -weekday(date));
/** Local datetime-local value <-> ms (Israel). */
export function toLocalInput(ms: number) {
  const d = new Date(ms);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function fromLocalInput(v: string) {
  // treat as Israel time: find the offset for that moment
  const guess = new Date(v + ':00Z').getTime();
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return guess - (wall - guess);
}
