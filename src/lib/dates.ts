// Dates are stored as local YYYY-MM-DD strings so a session belongs to the day it happened, wherever the phone is.

export function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

/** Whole days from a to b (b later → positive). */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000);
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

/** 10/15 */
export function short(key: string): string {
  const d = fromKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 10月15日 */
export function long(key: string): string {
  const d = fromKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 週四 */
export function weekday(key: string): string {
  return `週${WEEKDAY[fromKey(key).getDay()]}`;
}

/** 10月20日 星期二 */
export function headerDate(key: string): string {
  return `${long(key)} 星期${WEEKDAY[fromKey(key).getDay()]}`;
}
