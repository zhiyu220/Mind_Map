import { db, getSettings } from '../db';
import type { RoadNote, Session, Settings } from '../types';
import { todayKey } from './dates';

interface Backup {
  app: 'my-sky';
  version: 1;
  exportedAt: string;
  sessions: Session[];
  notes: RoadNote[];
  settings: Omit<Settings, 'pinHash'>;
}

export async function makeBackup(): Promise<File> {
  const { pinHash: _pin, ...settings } = await getSettings();
  const data: Backup = { app: 'my-sky', version: 1, exportedAt: new Date().toISOString(), sessions: await db.sessions.toArray(), notes: await db.notes.toArray(), settings };
  return new File([JSON.stringify(data, null, 2)], `我的天空-備份-${todayKey()}.json`, { type: 'application/json' });
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

export async function readBackup(file: File): Promise<Backup> {
  const data = JSON.parse(await file.text()) as Backup;
  if (data.app !== 'my-sky' || !Array.isArray(data.sessions) || !Array.isArray(data.notes)) throw new Error('not a backup');
  return data;
}

/** Replaces everything on this phone with the backup (the lock stays as it is). */
export async function restoreBackup(data: Backup) {
  await db.transaction('rw', db.sessions, db.notes, db.kv, async () => {
    const cur = await getSettings();
    await db.sessions.clear();
    await db.notes.clear();
    await db.sessions.bulkAdd(data.sessions);
    await db.notes.bulkAdd(data.notes);
    await db.kv.put({ key: 'settings', value: { ...data.settings, pinHash: cur.pinHash } });
  });
}
