import { describe, expect, it } from 'vitest';
import { notesToMove, stretchFor } from './stretch';
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

describe('notesToMove', () => {
  const notes = [n('early', 'a', '2026-09-05'), n('late', 'a', '2026-09-12'), n('same', 'a', '2026-09-10'), n('other', 'b', '2026-09-20')];

  it('moves the later half of a stretch behind a session added in its middle', () => {
    const added = s('x', '2026-09-10');
    const all = [sessions[0], added, ...sessions.slice(1)];
    expect(notesToMove(added, all, notes).map(x => x.id).sort()).toEqual(['late', 'same']);
  });

  it('takes notes from before the first session when added before it', () => {
    const added = s('x', '2026-08-20');
    expect(notesToMove(added, [added, ...sessions], [n('pre', null, '2026-08-25'), n('older', null, '2026-08-10')]).map(x => x.id)).toEqual(['pre']);
  });

  it('moves nothing when added after the last session', () => {
    const added = s('x', '2026-10-15');
    expect(notesToMove(added, [...sessions, added], [n('k', 'c', '2026-10-05')])).toEqual([]);
  });
});
