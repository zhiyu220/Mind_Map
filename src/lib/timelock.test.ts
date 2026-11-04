import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { closedNow, inWindow } from './timelock';
import { addSession } from './store';

const at = (hhmm: string, day = '2026-11-04') => new Date(`${day}T${hhmm}:00`);
const evening = { on: true, from: '21:00', to: '00:00' };

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('時間鎖', () => {
  it('opens from 21:00 until midnight', () => {
    expect(inWindow(evening, at('20:59'))).toBe(false);
    expect(inWindow(evening, at('21:00'))).toBe(true);
    expect(inWindow(evening, at('23:59'))).toBe(true);
    expect(inWindow(evening, at('00:00'))).toBe(false);
    expect(inWindow(evening, at('09:30'))).toBe(false);
  });

  it('can run past midnight', () => {
    const late = { on: true, from: '22:00', to: '02:00' };
    expect(inWindow(late, at('23:00'))).toBe(true);
    expect(inWindow(late, at('01:59'))).toBe(true);
    expect(inWindow(late, at('02:00'))).toBe(false);
    expect(inWindow(late, at('21:59'))).toBe(false);
  });

  it('keeps the app open when off, inside the window, or on a session day', async () => {
    const base = { customTopics: [] };
    expect(await closedNow({ ...base, timeLock: { ...evening, on: false } }, at('15:00'))).toBe(false);
    expect(await closedNow({ ...base, timeLock: evening }, at('21:30'))).toBe(false);
    expect(await closedNow({ ...base, timeLock: evening }, at('15:00'))).toBe(true);
    // the day in 下次諮商
    expect(await closedNow({ ...base, timeLock: evening, nextSession: '2026-11-04' }, at('15:00'))).toBe(false);
    // a session recorded today (recording it clears 下次諮商)
    await addSession({ weather: 'sun', moods: [], topics: [], quote: '', notes: '' }, true, '2026-11-04');
    expect(await closedNow({ ...base, timeLock: evening }, at('15:00'))).toBe(false);
    expect(await closedNow({ ...base, timeLock: evening }, at('15:00', '2026-11-05'))).toBe(true);
  });
});
