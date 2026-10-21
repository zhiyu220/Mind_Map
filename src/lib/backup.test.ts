import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, getSettings, saveSettings } from '../db';
import { BACKUP_NAME, BadBackup, beforeRestoreAt, compareBackup, lastExport, makeBackup, openBackup, readBackup, recordExport, restoreBackup, undoRestore, type Backup } from './backup';
import { unseal } from './crypto';
import { addFound, addNote, addPractice, addSession } from './store';

const blank = { weather: 'sun' as const, moods: ['平靜'], topics: ['自己'], quote: '慢慢來', notes: '' };
const asFile = (x: unknown) => new File([JSON.stringify(x)], 'backup.json', { type: 'application/json' });
const snapshot = async () => ({
  sessions: (await db.sessions.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
  notes: (await db.notes.toArray()).sort((a, b) => a.id.localeCompare(b.id)),
  practices: (await db.practices.toArray()).sort((a, b) => a.id.localeCompare(b.id))
});

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(() => vi.restoreAllMocks());

const oldBackup = (sessions: unknown[], notes: unknown[] = []) => ({ app: 'my-sky', version: 1, exportedAt: '2026-10-01T00:00:00.000Z', sessions, notes, settings: { customTopics: [] } });
const ses = (id: string, date: string, extra = {}) => ({ id, date, weather: 'sun', moods: [], topics: [], quote: '', notes: '', done: true, createdAt: 1, updatedAt: 1, ...extra });

describe('backups', () => {
  it('comes back the same after export, unlock and restore', async () => {
    await addSession(blank, true, '2026-09-03');
    await addNote({ text: '想說的', star: true, weather: 'rain' }, '2026-09-05');
    await addPractice('散步');
    await saveSettings({ nextSession: '2026-10-28', customTopics: ['貓'] });
    const before = await snapshot();

    const file = await makeBackup('pw');
    const read = await readBackup(file);
    if (!read.locked) throw new Error('should be locked');
    await db.delete();
    await db.open();
    await restoreBackup(await openBackup(read.sealed, 'pw'));

    expect(await snapshot()).toEqual(before);
    expect((await getSettings()).nextSession).toBe('2026-10-28');
  });

  it('carries what 3.0 adds: the first feelings, 後來我發現 and 我的人', async () => {
    const s = await addSession({ ...blank, raw: '有點亂', takeHome: '慢慢來', leave: '媽媽的事', bringLeave: true }, true, '2026-09-03');
    await addFound(s.id, '原來我在等別人先開口', '2026-09-10');
    await saveSettings({ people: [{ name: '小安', phone: '0912345678', via: 'sms' }], places: '去河邊騎車' });
    const before = await snapshot();
    const sealed = JSON.parse(await (await makeBackup('pw')).text());
    await db.delete();
    await db.open();
    await restoreBackup(await openBackup(sealed, 'pw'));
    expect(await snapshot()).toEqual(before);
    const back = (await db.sessions.get(s.id))!;
    expect(back.raw).toBe('有點亂');
    expect(back.found?.map(f => f.text)).toEqual(['原來我在等別人先開口']);
    expect((await getSettings()).people?.[0].name).toBe('小安');
  });

  it('never carries the PIN or Face ID, and keeps the ones on this phone', async () => {
    await saveSettings({ pinHash: 'old-pin', faceId: 'old-face' });
    const sealed = JSON.parse(await (await makeBackup('pw')).text());
    const inside = await unseal<Backup>(sealed, 'pw');
    expect(JSON.stringify(inside)).not.toContain('old-pin');
    expect(JSON.stringify(inside)).not.toContain('old-face');

    await saveSettings({ pinHash: 'this-phone', faceId: 'this-face' });
    await restoreBackup(inside);
    const st = await getSettings();
    expect(st.pinHash).toBe('this-phone');
    expect(st.faceId).toBe('this-face');
  });

  it('refuses the wrong password', async () => {
    const sealed = JSON.parse(await (await makeBackup('right')).text());
    await expect(openBackup(sealed, 'wrong')).rejects.toThrow();
  });

  it('restores an unlocked backup from 1.0, from before 想練習的事', async () => {
    const old = {
      app: 'my-sky',
      version: 1,
      exportedAt: '2026-10-01T00:00:00.000Z',
      sessions: [{ id: 's1', date: '2026-09-03', weather: 'partly', moods: [], topics: [], quote: '', notes: '', done: true, createdAt: 1, updatedAt: 1 }],
      notes: [{ id: 'n1', after: 's1', date: '2026-09-05', text: 'hi', star: false, createdAt: 2 }],
      settings: { customTopics: [] }
    };
    await addPractice('to be replaced');
    const read = await readBackup(asFile(old));
    if (read.locked) throw new Error('should be unlocked');
    await restoreBackup(read.data);
    const now = await snapshot();
    expect(now.sessions.map(s => s.id)).toEqual(['s1']);
    expect(now.notes.map(n => n.id)).toEqual(['n1']);
    expect(now.practices).toEqual([]);
  });

  it('puts the notes of an older backup back on the right stretch', async () => {
    const old = {
      app: 'my-sky',
      version: 1,
      exportedAt: '2026-10-01T00:00:00.000Z',
      sessions: [
        { id: 'a', date: '2026-09-03', weather: 'sun', moods: [], topics: [], quote: '', notes: '', done: true, createdAt: 1, updatedAt: 1 },
        { id: 'b', date: '2026-09-08', weather: 'sun', moods: [], topics: [], quote: '', notes: '', done: true, createdAt: 2, updatedAt: 2 }
      ],
      // written before b's date was changed to 09-08, so it was left on a's stretch
      notes: [{ id: 'n', after: 'a', date: '2026-09-10', text: 'x', star: true, createdAt: 3 }],
      settings: { customTopics: [] }
    };
    const read = await readBackup(asFile(old));
    if (read.locked) throw new Error('should be unlocked');
    await restoreBackup(read.data);
    expect((await db.notes.get('n'))!.after).toBe('b');
  });

  it('turns away a file that is not a backup', async () => {
    await expect(readBackup(asFile({ hello: 1 }))).rejects.toThrow();
  });

  it('always has the same file name, and keeps when it was made inside', async () => {
    const file = await makeBackup('pw');
    expect(file.name).toBe(BACKUP_NAME);
    const inside = await unseal<Backup>(JSON.parse(await file.text()), 'pw');
    expect(Date.parse(inside.exportedAt)).toBeGreaterThan(0);
  });

  it('turns away a backup with a broken record, and leaves the phone as it was', async () => {
    await addSession(blank, true, '2026-09-03');
    for (const bad of [
      oldBackup([ses('a', '2026-09-03', { weather: 'snow' })]),
      oldBackup([ses('a', '9/3')]),
      oldBackup([ses('a', '2026-09-03'), ses('a', '2026-09-10')]),
      oldBackup([ses('a', '2026-09-03', { moods: 'x' })]),
      oldBackup([ses('a', '2026-09-03')], [{ id: 'n', after: 'a', date: 'soon', text: '', star: false, createdAt: 1 }])
    ])
      await expect(readBackup(asFile(bad))).rejects.toBeInstanceOf(BadBackup);
    expect(await db.sessions.count()).toBe(1);
  });

  it('can go back to before a restore, and the copy never goes into a backup', async () => {
    await addSession(blank, true, '2026-10-14');
    const mine = await snapshot();
    const read = await readBackup(asFile(oldBackup([ses('old', '2026-06-01')])));
    if (read.locked) throw new Error('should be unlocked');
    const diff = await compareBackup(read.data);
    expect(diff.onlyHere).toEqual({ count: 1, from: '2026-10-14', to: '2026-10-14' });
    await restoreBackup(read.data);
    expect((await snapshot()).sessions.map(x => x.id)).toEqual(['old']);
    expect(await beforeRestoreAt()).not.toBeNull();

    const inside = await unseal<Backup>(JSON.parse(await (await makeBackup('pw')).text()), 'pw');
    expect(JSON.stringify(inside)).not.toContain('beforeRestore');

    await undoRestore();
    expect(await snapshot()).toEqual(mine);
    expect(await beforeRestoreAt()).toBeNull();
  });

  it('lets the copy from before a restore go after 7 days', async () => {
    const read = await readBackup(asFile(oldBackup([ses('old', '2026-06-01')])));
    if (read.locked) throw new Error('should be unlocked');
    await restoreBackup(read.data);
    const later = Date.now() + 8 * 86400000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    expect(await beforeRestoreAt()).toBeNull();
  });

  it('remembers the last export on this phone only, and counts what came after', async () => {
    expect(await lastExport()).toBeNull();
    await recordExport(Date.now() - 1000);
    await addSession(blank, true, '2026-10-14');
    await addNote({ text: 'x', star: false }, '2026-10-15');
    expect(await lastExport()).toMatchObject({ sessions: 1, notes: 1 });
    const inside = await unseal<Backup>(JSON.parse(await (await makeBackup('pw')).text()), 'pw');
    expect(JSON.stringify(inside)).not.toContain('lastBackup');
  });
});
