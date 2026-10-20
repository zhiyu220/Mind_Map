import { db, newId, getSettings, saveSettings } from '../db';
import type { RoadNote, Session, Song, Weather } from '../types';
import { todayKey } from './dates';
import { notesToMove, stretchFor } from './stretch';

export const byDate = (a: Session, b: Session) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt;

/** Adds a session for today, or for an earlier day when filling in the past. */
export async function addSession(d: { weather: Weather; moods: string[]; topics: string[]; quote: string; notes: string; song?: Song }, done: boolean, date = todayKey()) {
  const now = Date.now();
  const s: Session = { id: newId(), date, ...d, done, createdAt: now, updatedAt: now };
  await db.transaction('rw', db.sessions, db.notes, db.kv, async () => {
    await db.sessions.add(s);
    // a dot added in the middle of the road splits that stretch: later notes move behind it
    const all = (await db.sessions.toArray()).sort(byDate);
    const move = notesToMove(s, all, await db.notes.toArray());
    for (const n of move) await db.notes.update(n.id, { after: s.id });
    // today's session reached: the "next session" sign moves on
    const st = await getSettings();
    if (st.nextSession && st.nextSession <= s.date) await saveSettings({ nextSession: undefined });
  });
  return s;
}

export async function updateSession(id: string, patch: Partial<Session>) {
  await db.sessions.update(id, { ...patch, updatedAt: Date.now() });
}

/** Removing a session keeps the road notes: they join the stretch before it. */
export async function deleteSession(id: string) {
  await db.transaction('rw', db.sessions, db.notes, async () => {
    const all = (await db.sessions.toArray()).sort(byDate);
    const i = all.findIndex(s => s.id === id);
    const prev = i > 0 ? all[i - 1].id : null;
    await db.notes.where('after').equals(id).modify({ after: prev });
    await db.sessions.delete(id);
  });
}

/** Adds a road note; its date decides which stretch of road it lands on. Returns that stretch. */
export async function addNote(n: { text: string; weather?: Weather; star: boolean }, date = todayKey()) {
  const after = stretchFor(date, (await db.sessions.toArray()).sort(byDate));
  const note: RoadNote = { id: newId(), after, date, createdAt: Date.now(), ...n };
  await db.notes.add(note);
  return after;
}

export const toggleStar = (n: RoadNote) => db.notes.update(n.id, { star: !n.star });
export const deleteNote = (id: string) => db.notes.delete(id);
