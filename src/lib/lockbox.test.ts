import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, getSettings, saveSettings } from '../db';
import { _forget, changePin, getLockbox, openWithPin, removePin, setPin } from './lockbox';
import { Locked } from './seal';
import { hashPin } from './pin';
import { lastExport, makeBackup, openBackup, readBackup, recordExport, restoreBackup, undoRestore } from './backup';
import { addFound, addNote, addPractice, addSession } from './store';

const blank = { weather: 'sun' as const, moods: ['平靜'], topics: ['自己'], quote: '其實我很害怕', notes: '說不出口的事' };

/** The database as it sits on the phone, without the app opening anything. */
async function onDisk() {
  const raw = new Dexie('my-sky');
  raw.version(2).stores({ sessions: 'id, date', notes: 'id, after, createdAt', kv: 'key', practices: 'id, createdAt' });
  await raw.open();
  const all = { sessions: await raw.table('sessions').toArray(), notes: await raw.table('notes').toArray(), practices: await raw.table('practices').toArray(), kv: await raw.table('kv').toArray() };
  raw.close();
  return JSON.stringify(all, (_k, v) => (v instanceof Uint8Array ? '<sealed>' : v));
}

async function write() {
  const s = await addSession(blank, true, '2026-09-03');
  await addFound(s.id, '原來我在等別人先開口');
  await addNote({ text: '路上想到媽媽', star: true }, '2026-09-05');
  await addPractice('睡前寫三件小事');
  return s;
}

beforeEach(async () => {
  _forget();
  await db.delete();
  await db.open();
});

describe('records sealed with a PIN', () => {
  it('leaves none of what you wrote readable on the phone', async () => {
    await write();
    expect(await onDisk()).toContain('其實我很害怕');
    await setPin('123456');
    const disk = await onDisk();
    for (const words of ['其實我很害怕', '說不出口的事', '原來我在等別人先開口', '路上想到媽媽', '睡前寫三件小事', '平靜']) expect(disk).not.toContain(words);
    // the road can still be put in order
    expect(disk).toContain('2026-09-03');
    // and while open, the app reads everything as before
    expect((await db.sessions.toArray())[0].quote).toBe('其實我很害怕');
    expect((await db.notes.toArray())[0].text).toBe('路上想到媽媽');
    // counting through sealed fields still works
    await recordExport(0);
    expect((await lastExport())?.sessions).toBe(1);
  });

  it('seals what you write after setting the PIN', async () => {
    await setPin('123456');
    await write();
    expect(await onDisk()).not.toContain('其實我很害怕');
    expect((await db.sessions.toArray())[0].found?.[0].text).toBe('原來我在等別人先開口');
  });

  it("can't be read before unlocking, opens with the right PIN only", async () => {
    await write();
    await setPin('123456');
    _forget();
    await expect(db.sessions.toArray()).rejects.toThrow(Locked);
    expect(await openWithPin('654321')).toBe('wrong');
    expect(await openWithPin('123456')).toBe('ok');
    expect((await db.sessions.toArray())[0].quote).toBe('其實我很害怕');
  });

  it('keeps no hash of the PIN to guess against', async () => {
    await setPin('123456');
    expect((await getSettings()).pinHash).toBeUndefined();
    expect(await onDisk()).not.toContain(await hashPin('123456'));
    expect((await getLockbox())?.digits).toBe(6);
  });

  it('changes the PIN without rewriting, and the old one stops working', async () => {
    await write();
    await setPin('1234');
    await changePin('246810');
    _forget();
    expect(await openWithPin('1234')).toBe('wrong');
    expect(await openWithPin('246810')).toBe('ok');
    expect((await getLockbox())?.digits).toBe(6);
    expect((await db.practices.toArray())[0].text).toBe('睡前寫三件小事');
  });

  it('seals the records of a PIN set before 2.1 the first time it is entered', async () => {
    await write();
    await saveSettings({ pinHash: await hashPin('1234'), faceId: 'old-face' });
    expect(await openWithPin('0000')).toBe('wrong');
    expect(await onDisk()).toContain('其實我很害怕');
    // Face ID from before has to be set up again: it can't open the sealed records
    expect(await openWithPin('1234')).toBe('faceAgain');
    expect(await onDisk()).not.toContain('其實我很害怕');
    expect((await getSettings()).faceId).toBeUndefined();
    _forget();
    expect(await openWithPin('1234')).toBe('ok');
    expect((await db.sessions.toArray())[0].quote).toBe('其實我很害怕');
  });

  it('turning the PIN off makes everything readable again', async () => {
    await write();
    await setPin('123456');
    await removePin();
    expect(await getLockbox()).toBeNull();
    expect(await onDisk()).toContain('其實我很害怕');
    _forget();
    expect((await db.sessions.toArray())[0].quote).toBe('其實我很害怕');
  });

  it('backs up and restores as before, and the copy kept before a restore is sealed too', async () => {
    await write();
    await setPin('123456');
    const file = await makeBackup('pw');
    const read = await readBackup(file);
    if (!read.locked) throw new Error('should be locked');
    const data = await openBackup(read.sealed, 'pw');
    expect(data.sessions[0].quote).toBe('其實我很害怕');
    expect(JSON.stringify(data)).not.toContain('lockbox');

    await addNote({ text: '還原前寫的', star: false }, '2026-09-20');
    await restoreBackup(data);
    expect(await onDisk()).not.toContain('還原前寫的');
    expect(await onDisk()).not.toContain('其實我很害怕');
    expect((await db.sessions.toArray())[0].quote).toBe('其實我很害怕');
    await undoRestore();
    expect((await db.notes.toArray()).some(n => n.text === '還原前寫的')).toBe(true);
    // the lock is this phone's: a restore leaves it as it was
    expect((await getLockbox())?.digits).toBe(6);
  });
});
