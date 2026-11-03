import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { addFound, getDay, saveDay, addPractice, addSession, deleteFound, deleteSession, tidyRoad, tryPractice, updateSession } from './store';

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
    await saveDay({ text: 'early' }, '2026-09-05');
    await saveDay({ text: 'late' }, '2026-09-20');
    const b = await addSession(blank, true, '2026-09-17');
    expect(await afterOf('early')).toBe(a.id);
    expect(await afterOf('late')).toBe(b.id);
    expect(c.id).not.toBe(b.id);
  });

  it('moves the notes along when a session gets another date', async () => {
    const a = await addSession(blank, true, '2026-09-03');
    const b = await addSession(blank, true, '2026-09-17');
    await saveDay({ text: 'between' }, '2026-09-10');
    await saveDay({ text: 'after' }, '2026-09-20');
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
    await saveDay({ text: 'k' }, '2026-09-20');
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

  it('keeps one page a day: writing again the same day changes that page', async () => {
    await addSession(blank, true, '2026-09-03');
    const first = await saveDay({ happened: '下雨', weather: 'rain' }, '2026-09-05');
    expect(first.was).toBeUndefined();
    const again = await saveDay({ felt: '有點累' }, '2026-09-05');
    expect(again.was?.happened).toBe('下雨');
    expect(await db.notes.count()).toBe(1);
    expect(await getDay('2026-09-05')).toMatchObject({ happened: '下雨', felt: '有點累', weather: 'rain' });
  });

  it('merges the notes of a day from before 2.2 into one page, in the order they were written', async () => {
    const a = await addSession(blank, true, '2026-09-03');
    const old = (id: string, date: string, createdAt: number, extra = {}) => ({ id, after: a.id, date, text: id, star: false, createdAt, ...extra });
    await db.notes.bulkAdd([
      old('晚上又想到', '2026-09-05', 3, { weather: 'rain' as const }),
      old('早上', '2026-09-05', 1, { weather: 'sun' as const, star: true, song: { id: 's', name: '歌', artists: '人' } }),
      old('中午', '2026-09-05', 2),
      old('隔天', '2026-09-06', 4)
    ]);
    await tidyRoad();
    const days = (await db.notes.toArray()).sort((x, y) => x.date.localeCompare(y.date));
    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({ id: '早上', text: '早上\n\n中午\n\n晚上又想到', weather: 'rain', song: { id: 's' } });
    expect(days[1].text).toBe('隔天');
    // nothing changes the second time
    await tidyRoad();
    expect(await db.notes.count()).toBe(2);
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
