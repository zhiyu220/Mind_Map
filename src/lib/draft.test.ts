import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { clearDraft, loadDraft, moveOldDraft, saveDraft } from './draft';
import { _forget, openWithPin, removePin, setPin } from './lockbox';
import { emptyDraft } from '../components/SessionFlow';

const draft = { ...emptyDraft(), weather: 'rain' as const, quote: '你可以慢一點', raw: '剛走出來，眼睛還是熱的' };

/** The kv table as it sits on the phone, without the app opening anything. */
async function kvOnDisk() {
  const raw = new Dexie('my-sky');
  raw.version(2).stores({ sessions: 'id, date', notes: 'id, after, createdAt', kv: 'key', practices: 'id, createdAt' });
  await raw.open();
  const rows = await raw.table('kv').toArray();
  raw.close();
  return JSON.stringify(rows, (_k, v) => (v instanceof Uint8Array ? '<sealed>' : v));
}

// node has no localStorage: a small one, like the phone's
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: k => store.get(k) ?? null,
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: k => void store.delete(k),
  clear: () => store.clear(),
  key: i => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  }
} as Storage;

beforeEach(async () => {
  _forget();
  store.clear();
  await db.delete();
  await db.open();
});

describe('the half-written session', () => {
  it('is kept, picked up, and let go', async () => {
    expect(await loadDraft()).toBeNull();
    await saveDraft(draft);
    expect(await loadDraft()).toEqual(draft);
    await clearDraft();
    expect(await loadDraft()).toBeNull();
  });

  it('is sealed with a PIN set, written before or after', async () => {
    await saveDraft(draft);
    await setPin('123456');
    expect(await kvOnDisk()).not.toContain('你可以慢一點');
    await saveDraft({ ...draft, notes: '寫到一半' });
    expect(await kvOnDisk()).not.toContain('寫到一半');
    _forget();
    expect(await openWithPin('123456')).toBe('ok');
    expect((await loadDraft())?.notes).toBe('寫到一半');
    await removePin();
    expect(await kvOnDisk()).toContain('寫到一半');
  });

  it('moves out of localStorage (plain text before 2.2.0) into the sealed database', async () => {
    await setPin('123456');
    store.set('my-sky:draft', JSON.stringify(draft));
    await moveOldDraft();
    expect(store.has('my-sky:draft')).toBe(false);
    expect(await kvOnDisk()).not.toContain('你可以慢一點');
    expect(await loadDraft()).toEqual(draft);
  });

  it('keeps a newer draft over the old one, and drops a damaged one', async () => {
    await saveDraft({ ...draft, quote: '新的' });
    store.set('my-sky:draft', JSON.stringify(draft));
    await moveOldDraft();
    expect((await loadDraft())?.quote).toBe('新的');
    store.set('my-sky:draft', '{oops');
    await moveOldDraft();
    expect(store.has('my-sky:draft')).toBe(false);
  });
});
