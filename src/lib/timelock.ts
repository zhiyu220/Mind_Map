// 時間鎖: the app opens only in a window of the day you choose (21:00–24:00 to start with),
// so it doesn't become something to check all day. The day of a session it stays open.
// It's checked when the app opens or comes back from the background: what you're writing is never cut off.

import { db } from '../db';
import type { Settings } from '../types';
import { toKey } from './dates';

export type TimeLock = NonNullable<Settings['timeLock']>;

export const DEFAULT_TIME_LOCK: TimeLock = { on: false, from: '21:00', to: '00:00' };

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** True when `now` is inside the window. 00:00 as the end means midnight; a window may run past it (22:00–02:00). */
export function inWindow(lock: TimeLock, now: Date): boolean {
  const from = minutes(lock.from);
  const to = minutes(lock.to) || 24 * 60;
  const at = now.getHours() * 60 + now.getMinutes();
  if (from === to % (24 * 60)) return true; // the same time twice: the whole day
  return from < to ? at >= from && at < to : at >= from || at < to;
}

/** "21:00", or "24:00" for midnight as the end. */
export const shown = (hhmm: string, end = false) => (end && hhmm === '00:00' ? '24:00' : hhmm);

/**
 * Whether the time lock keeps the app closed right now. Never on a session day: the one in 下次諮商,
 * or a day a session was recorded (recording it clears 下次諮商). Dates are readable even when records are sealed.
 */
export async function closedNow(settings: Settings, now = new Date()): Promise<boolean> {
  const lock = settings.timeLock;
  if (!lock?.on || inWindow(lock, now)) return false;
  const today = toKey(now);
  if (settings.nextSession === today) return false;
  return (await db.sessions.where('date').equals(today).count()) === 0;
}
