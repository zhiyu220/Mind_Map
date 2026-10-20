import { describe, expect, it } from 'vitest';
import { homeLines, lineOfTheDay } from './lines';
import { countdown, daysBetween, short, weekday } from './dates';
import type { RoadNote, Session } from '../types';

const s = (id: string, date: string, extra: Partial<Session> = {}): Session => ({
  id, date, weather: 'partly', moods: [], topics: [], quote: '', notes: '', done: true, createdAt: 0, updatedAt: 0, ...extra
});
const note = (after: string | null, star = false): RoadNote => ({ id: Math.random().toString(), after, date: '2026-10-17', text: 'x', star, createdAt: 0 });

describe('dates', () => {
  it('counts days across months', () => {
    expect(daysBetween('2026-09-28', '2026-10-03')).toBe(5);
    expect(short('2026-10-05')).toBe('10/5');
    expect(weekday('2026-10-22')).toBe('週四');
  });
  it('counts down to the next session', () => {
    expect(countdown('2026-10-20', '2026-10-22')).toEqual({ big: '還有 2 天', small: '10月22日 週四' });
    expect(countdown('2026-10-21', '2026-10-22')).toEqual({ big: '還有 1 天', small: '明天，10月22日 週四' });
    expect(countdown('2026-10-22', '2026-10-22')?.big).toBe('就是今天');
    expect(countdown('2026-10-23', '2026-10-22')).toBeNull();
    expect(countdown('2026-10-20')).toBeNull();
  });
});

describe('homeLines', () => {
  it('mentions a milestone for a few sessions after reaching it', () => {
    const road = (n: number) => Array.from({ length: n }, (_, i) => s(`s${i}`, `2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, '0')}`));
    const texts = (n: number) => homeLines(road(n), [], '2026-12-01').map(l => l.text);
    expect(texts(9).some(t => t.includes('長椅'))).toBe(false);
    expect(texts(11)).toContain('走到第 10 個點，|路邊多了一張長椅。');
    expect(texts(13).some(t => t.includes('長椅'))).toBe(false);
    expect(texts(30)).toContain('走到第 30 個點，|看得到海了。');
  });

  it('starts gently with no sessions', () => {
    expect(homeLines([], [], '2026-10-20')[0].text).toBe('這裡是起點。');
  });

  it('uses facts from the records', () => {
    const lines = homeLines([s('a', '2026-10-15', { quote: '慢慢來' })], [note('a'), note('a')], '2026-10-20', '2026-10-22').map(l => l.text);
    expect(lines).toContain('10/15 之後，|已經走了 5 天。');
    expect(lines).toContain('上次走完的那天，|是有點雲。');
    expect(lines).toContain('再 2 天就是週四，|又要去說說話了。');
    expect(lines).toContain('這幾天在路上，|記下了 2 件事。');
    expect(lines).toContain('「慢慢來」');
  });

  it('mentions starred notes on the day of the session', () => {
    const lines = homeLines([s('a', '2026-10-15')], [note('a', true)], '2026-10-22', '2026-10-22').map(l => l.text);
    expect(lines).toContain('今天要去諮商。|路上有 1 件想說的事。');
  });

  it('only counts notes on the current stretch of road', () => {
    const lines = homeLines([s('a', '2026-10-08'), s('b', '2026-10-15')], [note('a')], '2026-10-20').map(l => l.text);
    expect(lines.some(t => t.includes('記下了'))).toBe(false);
  });

  it('now and then brings back the song of a day', () => {
    const song = { id: 'x', name: '魚仔', artists: '盧廣仲' };
    const line = homeLines([s('a', '2026-10-15', { song })], [], '2026-10-20').find(l => l.song);
    expect(line).toEqual({ text: '10/15 那天聽的是|〈魚仔〉。', small: '盧廣仲', song });
  });

  it('keeps one line for the whole day', () => {
    const lines = homeLines([s('a', '2026-10-15')], [], '2026-10-20');
    expect(lineOfTheDay(lines, '2026-10-20')).toBe(lineOfTheDay(lines, '2026-10-20'));
  });
});
