import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { addSession, addToPack, chooseLeave, choosePack, dayFamily, leaveChosen, movePack, packNow } from './store';
import { todayKey } from './dates';
import { makeBackup, openBackup, readBackup, restoreBackup } from './backup';

const blank = { weather: 'cloud' as const, moods: [], topics: [], quote: '', notes: '' };

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('想帶去說, the backpack', () => {
  it("groups a sentence by the family most of that day's moods are in", () => {
    expect(dayFamily(['疲累', '焦慮', '難過'])).toBe('沉沉的');
    expect(dayFamily(['焦慮', '疲累'])).toBe('緊緊的');
    expect(dayFamily(['自己寫的心情'])).toBeUndefined();
    expect(dayFamily(undefined)).toBeUndefined();
  });

  it('keeps where a sentence came from; 後來我發現 go together, and any can be moved', async () => {
    const a = await addToPack({ text: '  是一直在想別人會不會不高興。 ', from: 'diary', date: '2026-11-19', part: 'felt' }, ['疲累', '委屈']);
    const b = await addToPack({ text: '如果不用先道歉，我想說什麼？', from: 'found', date: '2026-11-20' }, ['焦慮']);
    expect(a).toMatchObject({ text: '是一直在想別人會不會不高興。', group: '沉沉的', part: 'felt' });
    expect(b.group).toBe('lamp');
    await movePack(a.id, '刺刺的');
    expect((await db.pack.get(a.id))?.group).toBe('刺刺的');
  });

  it("puts away what was ticked once today's session is saved, and leaves the rest", async () => {
    const a = await addToPack({ text: '帶去的', from: 'own', date: todayKey() });
    await addToPack({ text: '這次沒說的', from: 'own', date: todayKey() });
    await choosePack(a.id, true);
    const last = await addSession({ ...blank, leave: '媽媽那通電話', bringLeave: true }, true, '2026-01-01');
    await chooseLeave(last.id);
    // filling in an old session doesn't empty the backpack
    expect((await packNow()).length).toBe(2);
    await addSession(blank, true);
    expect((await packNow()).map(p => p.text)).toEqual(['這次沒說的']);
    expect((await db.pack.get(a.id))?.brought).toBe(todayKey());
    expect(await leaveChosen()).toBeNull();
  });

  it('goes into a backup and comes back', async () => {
    await addToPack({ text: '想說的', from: 'diary', date: '2026-11-19', part: 'happened' }, ['生氣']);
    const before = await db.pack.toArray();
    const read = await readBackup(await makeBackup('pw'));
    if (!read.locked) throw new Error('should be locked');
    await db.delete();
    await db.open();
    await restoreBackup(await openBackup(read.sealed, 'pw'));
    expect(await db.pack.toArray()).toEqual(before);
  });
});
