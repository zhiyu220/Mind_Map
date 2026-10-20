import { describe, expect, it } from 'vitest';
import { groupByMonth, recordYears, skyOfYear, topicsUsed } from './months';
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

describe('skyOfYear', () => {
  it('puts each session and road weather in its month, in order', () => {
    const sky = skyOfYear(
      2026,
      [s('b', '2026-03-20', { weather: 'sun' }), s('a', '2026-03-06', { weather: 'rain' }), s('old', '2025-03-01')],
      [n('r', '2026-03-10', { weather: 'storm' }), n('plain', '2026-03-11'), n('x', '2026-12-31', { weather: 'sun' })]
    );
    expect(sky).toHaveLength(12);
    expect(sky[2].sessions.map(x => x.id)).toEqual(['a', 'b']);
    expect(sky[2].road).toEqual(['storm']);
    expect(sky[11].road).toEqual(['sun']);
    expect(sky[0].sessions).toEqual([]);
  });
  it('lists the years with records, newest first', () => {
    expect(recordYears([s('a', '2025-05-01'), s('b', '2026-01-01')], [n('c', '2024-12-31')])).toEqual([2026, 2025, 2024]);
  });
});

describe('topicsUsed', () => {
  it('lists the most talked-about topics first', () => {
    expect(topicsUsed([s('a', '2026-01-01', { topics: ['家庭', '自己'] }), s('b', '2026-01-08', { topics: ['自己'] })])).toEqual(['自己', '家庭']);
  });
});
