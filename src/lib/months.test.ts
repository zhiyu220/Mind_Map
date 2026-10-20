import { describe, expect, it } from 'vitest';
import { groupByMonth } from './months';
import type { RoadNote, Session } from '../types';

const song = (id: string) => ({ id, name: id, artists: '' });
const s = (id: string, date: string, extra: Partial<Session> = {}): Session => ({ id, date, weather: 'cloud', moods: [], topics: [], quote: '', notes: '', done: true, createdAt: 0, updatedAt: 0, ...extra });
const n = (id: string, date: string, extra: Partial<RoadNote> = {}): RoadNote => ({ id, after: null, date, text: '', star: false, createdAt: 0, ...extra });

describe('groupByMonth', () => {
  it('puts the newest month first, and things in order inside a month', () => {
    const months = groupByMonth(
      [s('b', '2026-10-15', { song: song('s2'), quote: '慢慢來' }), s('a', '2026-10-01', { song: song('s1') }), s('z', '2026-09-24')],
      [n('r', '2026-10-08', { song: song('road') }), n('q', '2026-09-27')]
    );
    expect(months.map(m => m.title)).toEqual(['2026年10月', '2026年9月']);
    const oct = months[0];
    expect(oct.sessions.map(x => x.id)).toEqual(['a', 'b']);
    expect(oct.songs.map(x => [x.song.id, x.road])).toEqual([['s1', false], ['road', true], ['s2', false]]);
    expect(oct.quotes.map(x => x.id)).toEqual(['b']);
    expect(months[1].notes.map(x => x.id)).toEqual(['q']);
  });
  it('has nothing to show with no records', () => {
    expect(groupByMonth([], [])).toEqual([]);
  });
});
