import { describe, expect, it } from 'vitest';
import { afterMiss } from './pin';

describe('afterMiss', () => {
  it('lets the first four misses go, then makes you wait longer each time', () => {
    let t = { fails: 0, until: 0 };
    const waits: number[] = [];
    for (let i = 0; i < 12; i++) {
      t = afterMiss(t, 0);
      waits.push(t.until);
    }
    expect(waits.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(waits.slice(4, 8)).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(Math.max(...waits)).toBe(15 * 60_000);
  });
});
