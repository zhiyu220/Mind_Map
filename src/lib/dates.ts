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

/** What the 下次 sign says when you tap it; null when no upcoming session is set. */
export function countdown(today: string, next?: string): { big: string; small: string } | null {
  if (!next) return null;
  const k = daysBetween(today, next);
  if (k < 0) return null;
  const when = `${long(next)} ${weekday(next)}`;
  if (k === 0) return { big: '就是今天', small: when };
  if (k === 1) return { big: '還有 1 天', small: `明天，${when}` };
  return { big: `還有 ${k} 天`, small: when };
}

/** key + n days */
export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/**
 * A guess at the next session from the gap between the last two (dates oldest first), only to ask
 * about: "下次是 10/28 嗎？". Null when there's nothing sensible to guess.
 */
export function guessNext(dates: string[], today: string): string | null {
  if (dates.length < 2) return null;
  const [prev, last] = dates.slice(-2);
  const gap = daysBetween(prev, last);
  if (gap < 1 || gap > 42) return null;
  let next = addDays(last, gap);
  while (next <= today) next = addDays(next, gap);
  return next;
}

/** The next-session date as the app shows it: one more than 3 days gone is treated as not set. */
export const upcoming = (next: string | undefined, today: string) => (next && daysBetween(today, next) >= -3 ? next : undefined);
