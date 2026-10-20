import Dexie, { type EntityTable } from 'dexie';
import type { Practice, RoadNote, Session, Settings } from './types';

interface KV {
  key: string;
  value: unknown;
}

export const db = new Dexie('my-sky') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
  notes: EntityTable<RoadNote, 'id'>;
  practices: EntityTable<Practice, 'id'>;
  kv: EntityTable<KV, 'key'>;
};

db.version(1).stores({
  sessions: 'id, date',
  notes: 'id, after, createdAt',
  kv: 'key'
});
db.version(2).stores({ practices: 'id, createdAt' });

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const DEFAULT_SETTINGS: Settings = { customTopics: [] };

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) };
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings();
  await db.kv.put({ key: 'settings', value: { ...cur, ...patch } });
}

export async function getKV<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}

export async function setKV(key: string, value: unknown) {
  if (value === undefined) await db.kv.delete(key);
  else await db.kv.put({ key, value });
}

/** Ask the browser not to evict our data (Safari may clear storage of sites not used for a while). */
export function askPersist() {
  navigator.storage?.persist?.().catch(() => {});
}
