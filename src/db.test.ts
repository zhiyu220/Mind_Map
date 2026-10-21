import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { db } from './db';

// The database name and the old versions must never change: renaming or rewriting them would
// leave everyone's records, PIN and backups unreadable (see CLAUDE.md).
describe('the database', () => {
  it('is still called my-sky', () => {
    expect(db.name).toBe('my-sky');
  });

  it('opens a database from 1.0 and keeps everything in it', async () => {
    db.close();
    await Dexie.delete('my-sky');
    const old = new Dexie('my-sky');
    old.version(1).stores({ sessions: 'id, date', notes: 'id, after, createdAt', kv: 'key' });
    await old.table('sessions').add({ id: 's1', date: '2026-09-03', weather: 'sun', moods: [], topics: [], quote: 'q', notes: '', done: true, createdAt: 1, updatedAt: 1 });
    await old.table('notes').add({ id: 'n1', after: 's1', date: '2026-09-05', text: 'hi', star: true, createdAt: 2 });
    await old.table('kv').put({ key: 'settings', value: { customTopics: ['貓'], pinHash: 'p' } });
    old.close();

    await db.open();
    expect(db.verno).toBeGreaterThanOrEqual(2);
    expect((await db.sessions.get('s1'))?.quote).toBe('q');
    expect((await db.notes.get('n1'))?.text).toBe('hi');
    expect((await db.kv.get('settings'))?.value).toEqual({ customTopics: ['貓'], pinHash: 'p' });
    expect(await db.practices.count()).toBe(0);
  });
});
