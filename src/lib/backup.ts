import { db, getKV, getSettings, setKV, withoutRetired } from '../db';
import { tidyRoad } from './store';
import type { Practice, RoadNote, Session, Settings } from '../types';
import { WEATHERS } from '../types';
import { isSealed, seal, unseal, type Sealed } from './crypto';

export interface Backup {
  app: 'my-sky';
  version: 1;
  exportedAt: string;
  sessions: Session[];
  notes: RoadNote[];
  /** added in 1.1; older backups have none */
  practices?: Practice[];
  settings: Omit<Settings, 'pinHash' | 'faceId'>;
}

/** A backup file locked with a password of your choosing. */
export async function makeBackup(password: string): Promise<File> {
  const { pinHash: _pin, faceId: _face, ...settings } = await getSettings();
  const data: Backup = { app: 'my-sky', version: 1, exportedAt: new Date().toISOString(), sessions: await db.sessions.toArray(), notes: await db.notes.toArray(), practices: await db.practices.toArray(), settings };
  const sealed = await seal(data, password);
  // always the same name: saved to the same folder in 檔案, iOS offers to replace the old one
  return new File([JSON.stringify(sealed)], BACKUP_NAME, { type: 'application/json' });
}

export const BACKUP_NAME = 'MindMap-備份.json';

/** On iPhone the share sheet lets you "儲存到檔案"; elsewhere it downloads. False when you cancelled. */
export async function shareOrDownload(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// ---------- 上次匯出 (kept on this phone only, never in a backup) ----------

export const recordExport = (at = Date.now()) => setKV('lastBackup', { at });

/** When you last exported, and what you've written since; null when you never have. */
export async function lastExport(): Promise<{ at: number; sessions: number; notes: number } | null> {
  const last = await getKV<{ at: number }>('lastBackup');
  if (!last) return null;
  return {
    at: last.at,
    sessions: await db.sessions.filter(s => s.createdAt > last.at).count(),
    notes: await db.notes.filter(n => n.createdAt > last.at).count()
  };
}

/** A backup file: locked ones need their password; older unlocked ones open as they are. */
export type BackupFile = { locked: false; data: Backup } | { locked: true; sealed: Sealed };

export async function readBackup(file: File): Promise<BackupFile> {
  const raw = JSON.parse(await file.text()) as unknown;
  if (isSealed(raw)) return { locked: true, sealed: raw };
  return { locked: false, data: checkBackup(raw) };
}

/** Throws when the password is wrong. */
export async function openBackup(sealed: Sealed, password: string): Promise<Backup> {
  return checkBackup(await unseal(sealed, password));
}

/** Thrown when a file opens but something inside it isn't right; nothing is written then. */
export class BadBackup extends Error {}

const isDay = (x: unknown) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
const isWords = (x: unknown) => Array.isArray(x) && x.every(w => typeof w === 'string');

/**
 * Checks every record before anything is replaced, so a damaged file can't empty the phone.
 * One bad record turns the whole file away, rather than quietly leaving parts of it out.
 */
function checkBackup(raw: unknown): Backup {
  const data = raw as Backup;
  if (!data || data.app !== 'my-sky' || !Array.isArray(data.sessions) || !Array.isArray(data.notes)) throw new Error('not a backup');
  const ids = new Set<string>();
  const unique = (id: unknown) => typeof id === 'string' && !ids.has(id) && !!ids.add(id);
  for (const s of data.sessions)
    if (!s || !unique(s.id) || !isDay(s.date) || !WEATHERS.includes(s.weather) || !isWords(s.moods) || !isWords(s.topics))
      throw new BadBackup('一次諮商的紀錄不完整');
  for (const n of data.notes)
    if (!n || !unique(n.id) || !isDay(n.date) || (n.weather !== undefined && !WEATHERS.includes(n.weather)))
      throw new BadBackup('路上的一則紀錄不完整');
  if (data.practices !== undefined && !Array.isArray(data.practices)) throw new BadBackup('想練習的事不完整');
  return data;
}

/** What a backup holds next to what's on this phone, for the confirm before restoring. */
export async function compareBackup(data: Backup) {
  const here = await db.sessions.toArray();
  const inFile = new Set(data.sessions.map(s => s.id));
  const latest = (list: { date: string }[]) => list.reduce<string | null>((m, s) => (!m || s.date > m ? s.date : m), null);
  const onlyHere = here.filter(s => !inFile.has(s.id)).map(s => s.date).sort();
  return {
    file: { exportedAt: data.exportedAt, sessions: data.sessions.length, latest: latest(data.sessions) },
    here: { sessions: here.length, latest: latest(here) },
    /** sessions on this phone that the backup doesn't have: lost on restore (until you go back) */
    onlyHere: onlyHere.length ? { count: onlyHere.length, from: onlyHere[0], to: onlyHere[onlyHere.length - 1] } : null
  };
}

// ---------- 回到還原前: one copy of the phone as it was, for 7 days ----------

const KEEP_BEFORE = 7 * 86400000;
type Before = { at: number; data: Backup };

/** Replaces everything on this phone with the backup (the lock stays as it is). Keeps a copy of what was here. */
export async function restoreBackup(data: Backup) {
  const { pinHash: _pin, faceId: _face, ...settings } = await getSettings();
  const now: Backup = { app: 'my-sky', version: 1, exportedAt: new Date().toISOString(), sessions: await db.sessions.toArray(), notes: await db.notes.toArray(), practices: await db.practices.toArray(), settings };
  await setKV('beforeRestore', { at: Date.now(), data: now } satisfies Before);
  await replaceAll(data);
}

/** When the copy from before the last restore was made, or null (gone after 7 days). */
export async function beforeRestoreAt(): Promise<number | null> {
  const b = await getKV<Before>('beforeRestore');
  if (!b) return null;
  if (Date.now() - b.at > KEEP_BEFORE) {
    await setKV('beforeRestore', undefined);
    return null;
  }
  return b.at;
}

/** Puts the phone back the way it was before the last restore, and lets the copy go. */
export async function undoRestore() {
  const b = await getKV<Before>('beforeRestore');
  if (!b) return;
  await replaceAll(b.data);
  await setKV('beforeRestore', undefined);
}

async function replaceAll(data: Backup) {
  await db.transaction('rw', [db.sessions, db.notes, db.practices, db.kv], async () => {
    const cur = await getSettings();
    await db.sessions.clear();
    await db.notes.clear();
    await db.practices.clear();
    await db.sessions.bulkAdd(data.sessions);
    await db.notes.bulkAdd(data.notes);
    await db.practices.bulkAdd(data.practices ?? []);
    await db.kv.put({ key: 'settings', value: { ...withoutRetired(data.settings), pinHash: cur.pinHash, faceId: cur.faceId } });
  });
  // backups from before the stretches were kept in order may carry notes on the wrong stretch
  await tidyRoad();
}
