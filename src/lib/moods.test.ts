import { describe, expect, it } from 'vitest';
import { FIRST_MOODS } from '../types';
import { ALL_MOODS, MOOD_FAMILIES, familyOf, findMoods, moodHistory } from './moods';

describe('心情輪', () => {
  it('has eight families of a dozen or more words, each word once', () => {
    expect(MOOD_FAMILIES).toHaveLength(8);
    for (const f of MOOD_FAMILIES) expect(f.words.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ALL_MOODS).size).toBe(ALL_MOODS.length);
  });

  it('keeps every mood from before, so old records still show as picked', () => {
    for (const m of FIRST_MOODS) expect(familyOf(m)).toBeGreaterThanOrEqual(0);
  });

  it('finds words by part of a word or by family', () => {
    expect(findMoods('難')).toEqual(expect.arrayContaining(['難過', '坐立難安']));
    expect(findMoods('輕輕的')).toEqual(MOOD_FAMILIES[4].words);
    expect(findMoods('  ')).toEqual([]);
    expect(findMoods('搬家')).toEqual([]);
    expect(familyOf('搬家')).toBe(-1);
  });

  it('gives the moods used lately and the last record’s, leaving out the one being changed', () => {
    const sessions = [
      { id: 'a', date: '2026-11-01', moods: ['焦慮', '疲累'], createdAt: 1 },
      { id: 'b', date: '2026-11-20', moods: ['平靜'], createdAt: 3 },
      { id: 'c', date: '2026-11-25', moods: [], createdAt: 5 }
    ];
    const notes = [
      { id: 'n1', date: '2026-11-10', moods: ['委屈', '焦慮'], createdAt: 2 },
      { id: 'n2', date: '2026-11-22', createdAt: 4 }
    ];
    expect(moodHistory(sessions, notes)).toEqual({ recent: ['平靜', '委屈', '焦慮', '疲累'], last: ['平靜'] });
    expect(moodHistory(sessions, notes, { session: 'b' }).last).toEqual(['委屈', '焦慮']);
    expect(moodHistory(sessions, notes, { day: '2026-11-10' }, 2).recent).toEqual(['平靜', '焦慮']);
    expect(moodHistory([], [])).toEqual({ recent: [], last: [] });
  });
});
