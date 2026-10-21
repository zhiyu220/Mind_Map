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

// Settings of features that were taken out. Their data goes too: people's names and phone numbers
// (from 想說話的時候, removed in 2.0.1) shouldn't stay on the phone or in backups once unused.
export const RETIRED_SETTINGS = ['people', 'places'];

export const withoutRetired = (value: object) =>
  Object.fromEntries(Object.entries(value).filter(([k]) => !RETIRED_SETTINGS.includes(k)));

/** Once on start: clears what removed features left in the settings. */
export async function dropRetiredSettings() {
  const row = await db.kv.get('settings');
  const value = row?.value as Record<string, unknown> | undefined;
  if (value && RETIRED_SETTINGS.some(k => k in value)) await db.kv.put({ key: 'settings', value: withoutRetired(value) });
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
