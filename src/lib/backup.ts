import { db, getSettings } from '../db';
import type { Practice, RoadNote, Session, Settings } from '../types';
import { todayKey } from './dates';
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
  return new File([JSON.stringify(sealed)], `MindMap-備份-${todayKey()}.json`, { type: 'application/json' });
}

/** On iPhone the share sheet lets you "儲存到檔案"; elsewhere it downloads. */
export async function shareOrDownload(file: File) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

function checkBackup(raw: unknown): Backup {
  const data = raw as Backup;
  if (!data || data.app !== 'my-sky' || !Array.isArray(data.sessions) || !Array.isArray(data.notes)) throw new Error('not a backup');
  return data;
}

/** Replaces everything on this phone with the backup (the lock stays as it is). */
export async function restoreBackup(data: Backup) {
  await db.transaction('rw', [db.sessions, db.notes, db.practices, db.kv], async () => {
    const cur = await getSettings();
    await db.sessions.clear();
    await db.notes.clear();
    await db.practices.clear();
    await db.sessions.bulkAdd(data.sessions);
    await db.notes.bulkAdd(data.notes);
    await db.practices.bulkAdd(data.practices ?? []);
    await db.kv.put({ key: 'settings', value: { ...data.settings, pinHash: cur.pinHash, faceId: cur.faceId } });
  });
}
