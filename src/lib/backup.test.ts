import { beforeEach, describe, expect, it } from 'vitest';
import { db, getSettings, saveSettings } from '../db';
import { makeBackup, openBackup, readBackup, restoreBackup, type Backup } from './backup';
import { unseal } from './crypto';
import { addNote, addPractice, addSession } from './store';

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
});
