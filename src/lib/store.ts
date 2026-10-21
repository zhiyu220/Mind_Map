import { db, newId, getSettings, saveSettings } from '../db';
import type { Practice, RoadNote, Session, Song, Weather } from '../types';
import { todayKey } from './dates';
import { restretch, stretchFor } from './stretch';

export const byDate = (a: Session, b: Session) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt;

/** Puts every road note back on the stretch its date belongs to. Call inside a transaction on sessions and notes. */
async function tidyStretches() {
  const sessions = (await db.sessions.toArray()).sort(byDate);
  for (const { id, after } of restretch(sessions, await db.notes.toArray())) await db.notes.update(id, { after });
}

/** Once on start: mends notes left on the wrong stretch by earlier versions. */
export const tidyRoad = () => db.transaction('rw', db.sessions, db.notes, tidyStretches);

/** Adds a session for today, or for an earlier day when filling in the past. */
export async function addSession(d: { weather: Weather; moods: string[]; topics: string[]; quote: string; notes: string; song?: Song }, done: boolean, date = todayKey()) {
  const now = Date.now();
  const s: Session = { id: newId(), date, ...d, done, createdAt: now, updatedAt: now };
  await db.transaction('rw', db.sessions, db.notes, db.kv, async () => {
    await db.sessions.add(s);
    // a dot added in the middle of the road splits that stretch: later notes move behind it
    await tidyStretches();
    // today's session reached: the "next session" sign moves on
    const st = await getSettings();
    if (st.nextSession && st.nextSession <= s.date) await saveSettings({ nextSession: undefined });
  });
  return s;
}

export async function updateSession(id: string, patch: Partial<Session>) {
  await db.transaction('rw', db.sessions, db.notes, async () => {
    await db.sessions.update(id, { ...patch, updatedAt: Date.now() });
    // a new date moves the dot along the road, and the notes around it change stretch
    if (patch.date) await tidyStretches();
  });
}

/** Removing a session keeps the road notes: they join the stretch before it. */
export async function deleteSession(id: string) {
  await db.transaction('rw', db.sessions, db.notes, async () => {
    await db.sessions.delete(id);
    await tidyStretches();
  });
}

/** Adds a road note; its date decides which stretch of road it lands on. Returns that stretch. */
export async function addNote(n: { text: string; weather?: Weather; star: boolean; song?: Song }, date = todayKey()) {
  const after = stretchFor(date, (await db.sessions.toArray()).sort(byDate));
  const note: RoadNote = { id: newId(), after, date, createdAt: Date.now(), ...n };
  await db.notes.add(note);
  return after;
}

/** Changing a road note; a new date may move it to another stretch of road. Returns that stretch. */
export async function updateNote(id: string, patch: { text: string; weather?: Weather; star: boolean; date: string; song?: Song }) {
  const after = stretchFor(patch.date, (await db.sessions.toArray()).sort(byDate));
  await db.notes.update(id, { ...patch, after });
  return after;
}

export const toggleStar = (n: RoadNote) => db.notes.update(n.id, { star: !n.star });
export const deleteNote = (id: string) => db.notes.delete(id);

/** 想練習的事 */
export const addPractice = (text: string) => db.practices.add({ id: newId(), text, tries: [], createdAt: Date.now() });
export const renamePractice = (id: string, text: string) => db.practices.update(id, { text });
export const archivePractice = (id: string, archived: boolean) => db.practices.update(id, { archived });
export const deletePractice = (id: string) => db.practices.delete(id);
/** "試過了" for a day; pressing it again the same day takes it back. */
export const tryPractice = (p: Practice, day = todayKey()) =>
  db.practices.update(p.id, { tries: p.tries.includes(day) ? p.tries.filter(d => d !== day) : [...p.tries, day].sort() });
