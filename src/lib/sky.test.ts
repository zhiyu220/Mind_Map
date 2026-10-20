import { describe, expect, it } from 'vitest';
import { isNight, seasonOf, themeFor } from './sky';

const at = (month: number, hour: number) => new Date(2026, month - 1, 15, hour, 30);

describe('sky', () => {
  it('is night from 6pm to 6am', () => {
    expect(isNight(at(10, 17))).toBe(false);
    expect(isNight(at(10, 18))).toBe(true);
    expect(isNight(at(10, 5))).toBe(true);
    expect(isNight(at(10, 6))).toBe(false);
  });
  it('knows the season', () => {
    expect([3, 6, 9, 12, 1].map(m => seasonOf(at(m, 12)))).toEqual(['spring', 'summer', 'autumn', 'winter', 'winter']);
  });
  it('follows the clock, the phone, or stays day', () => {
    expect(themeFor('time', at(10, 21), false)).toBe('dark');
    expect(themeFor('phone', at(10, 21), false)).toBe('light');
    expect(themeFor('phone', at(10, 12), true)).toBe('dark');
    expect(themeFor('day', at(10, 21), true)).toBe('light');
  });
});
