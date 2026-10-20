import { describe, expect, it } from 'vitest';
import { isSealed, seal, unseal } from './crypto';

describe('sealed backups', () => {
  it('opens with the right password and keeps no plain text', async () => {
    const diary = { sessions: [{ quote: '你不需要一次就把所有事情想清楚。' }] };
    const s = await seal(diary, '我的密碼', 1000);
    expect(isSealed(s)).toBe(true);
    expect(JSON.stringify(s)).not.toContain('想清楚');
    expect(await unseal(s, '我的密碼')).toEqual(diary);
  });

  it('refuses a wrong password', async () => {
    const s = await seal({ a: 1 }, 'right', 1000);
    await expect(unseal(s, 'wrong')).rejects.toThrow();
  });

  it('uses a new salt and iv every time', async () => {
    const [a, b] = await Promise.all([seal({ a: 1 }, 'p', 1000), seal({ a: 1 }, 'p', 1000)]);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it('tells a plain old backup from a sealed one', () => {
    expect(isSealed({ app: 'my-sky', version: 1, sessions: [], notes: [] })).toBe(false);
  });
});
