import { describe, expect, it } from 'vitest';
import { restretch, stretchFor } from './stretch';
import type { RoadNote, Session } from '../types';

const s = (id: string, date: string): Session => ({ id, date, weather: 'cloud', moods: [], topics: [], quote: '', notes: '', done: true, createdAt: 0, updatedAt: 0 });
const n = (id: string, after: string | null, date: string): RoadNote => ({ id, after, date, text: id, star: false, createdAt: 0 });

const sessions = [s('a', '2026-09-03'), s('b', '2026-09-17'), s('c', '2026-10-01')];

describe('stretchFor', () => {
  it('puts a date on the stretch after the last session on or before it', () => {
    expect(stretchFor('2026-09-01', sessions)).toBeNull();
    expect(stretchFor('2026-09-03', sessions)).toBe('a');
    expect(stretchFor('2026-09-10', sessions)).toBe('a');
    expect(stretchFor('2026-09-20', sessions)).toBe('b');
    expect(stretchFor('2026-10-20', sessions)).toBe('c');
  });
  it('works with no sessions yet', () => {
    expect(stretchFor('2026-10-20', [])).toBeNull();
  });
});

describe('restretch', () => {
  const notes = [n('early', 'a', '2026-09-05'), n('late', 'a', '2026-09-12'), n('same', 'a', '2026-09-10'), n('other', 'b', '2026-09-20')];
  const ids = (r: { id: string; after: string | null }[]) => r.map(x => `${x.id}>${x.after}`).sort();

  it('changes nothing when every note is on its stretch', () => {
    expect(restretch(sessions, notes)).toEqual([]);
  });

  it('moves the later half of a stretch behind a session added in its middle', () => {
    const all = [sessions[0], s('x', '2026-09-10'), ...sessions.slice(1)];
    expect(ids(restretch(all, notes))).toEqual(['late>x', 'same>x']);
  });

  it('takes notes from before the first session when one is added before it', () => {
    const all = [s('x', '2026-08-20'), ...sessions];
    expect(ids(restretch(all, [n('pre', null, '2026-08-25'), n('older', null, '2026-08-10')]))).toEqual(['pre>x']);
  });

  it('follows a session whose date was moved earlier or later', () => {
    // b moved from 09-17 to 09-08: notes from 09-08 on, up to c, now come after b
    const earlier = [sessions[0], s('b', '2026-09-08'), sessions[2]];
    expect(ids(restretch(earlier, notes))).toEqual(['late>b', 'same>b']);
    // b moved from 09-17 to 09-25: the 09-20 note now belongs to a
    const later = [sessions[0], s('b', '2026-09-25'), sessions[2]];
    expect(ids(restretch(later, notes))).toEqual(['other>a']);
  });

  it('hands the notes of a deleted session to the one before it', () => {
    expect(ids(restretch([sessions[0], sessions[2]], notes))).toEqual(['other>a']);
  });

  it('mends notes left behind a session that no longer exists', () => {
    expect(ids(restretch(sessions, [n('lost', 'gone', '2026-09-20'), n('lost-early', 'gone', '2026-08-01')]))).toEqual(['lost-early>null', 'lost>b']);
  });

  it('puts a note written on a day with two sessions after the later one', () => {
    const two = [sessions[0], { ...s('b2', '2026-09-17'), createdAt: 1 }, sessions[1]].sort((x, y) => x.date.localeCompare(y.date) || x.createdAt - y.createdAt);
    expect(ids(restretch(two, [n('day', 'b', '2026-09-17')]))).toEqual(['day>b2']);
  });
});
