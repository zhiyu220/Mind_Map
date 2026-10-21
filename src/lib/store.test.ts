import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { addFound, addNote, addPractice, addSession, deleteFound, deleteSession, tidyRoad, tryPractice, updateSession } from './store';

const blank = { weather: 'cloud' as const, moods: [], topics: [], quote: '', notes: '' };
const afterOf = async (text: string) => (await db.notes.toArray()).find(n => n.text === text)?.after;

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('the road in the database', () => {
  it('splits a stretch when a session is filled in between two others', async () => {
    const a = await addSession(blank, true, '2026-09-03');
    const c = await addSession(blank, true, '2026-10-01');
    await addNote({ text: 'early', star: false }, '2026-09-05');
    await addNote({ text: 'late', star: false }, '2026-09-20');
    const b = await addSession(blank, true, '2026-09-17');
    expect(await afterOf('early')).toBe(a.id);
    expect(await afterOf('late')).toBe(b.id);
    expect(c.id).not.toBe(b.id);
  });

  it('moves the notes along when a session gets another date', async () => {
    const a = await addSession(blank, true, '2026-09-03');
    const b = await addSession(blank, true, '2026-09-17');
    await addNote({ text: 'between', star: false }, '2026-09-10');
    await addNote({ text: 'after', star: false }, '2026-09-20');
    expect(await afterOf('between')).toBe(a.id);
    await updateSession(b.id, { date: '2026-09-08' });
    expect(await afterOf('between')).toBe(b.id);
    await updateSession(b.id, { date: '2026-09-25' });
    expect(await afterOf('between')).toBe(a.id);
    expect(await afterOf('after')).toBe(a.id);
  });

  it('keeps the notes of a deleted session on the stretch before it', async () => {
    const a = await addSession(blank, true, '2026-09-03');
    const b = await addSession(blank, true, '2026-09-17');
    await addNote({ text: 'k', star: true }, '2026-09-20');
    await deleteSession(b.id);
    expect(await afterOf('k')).toBe(a.id);
    expect(await db.notes.count()).toBe(1);
  });

  it('mends notes an earlier version left on the wrong stretch', async () => {
    const a = await addSession(blank, true, '2026-09-03');
    await db.notes.add({ id: 'lost', after: 'gone', date: '2026-09-10', text: 'lost', star: false, createdAt: 0 });
    await tidyRoad();
    expect(await afterOf('lost')).toBe(a.id);
  });

  it('takes back 試過了 when pressed twice the same day', async () => {
    await addPractice('breathe');
    const p = (await db.practices.toArray())[0];
    await tryPractice(p, '2026-10-01');
    const once = (await db.practices.get(p.id))!;
    expect(once.tries).toEqual(['2026-10-01']);
    await tryPractice(once, '2026-10-01');
    expect((await db.practices.get(p.id))!.tries).toEqual([]);
  });

  it('keeps 後來我發現 on its session, oldest first, and lets one go', async () => {
    const a = await addSession(blank, true, '2026-09-03');
    const one = await addFound(a.id, '第一句', '2026-09-05');
    await addFound(a.id, '第二句', '2026-09-08');
    expect((await db.sessions.get(a.id))!.found!.map(f => f.text)).toEqual(['第一句', '第二句']);
    await deleteFound(a.id, one.id);
    expect((await db.sessions.get(a.id))!.found!.map(f => f.text)).toEqual(['第二句']);
  });
});
