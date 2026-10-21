// 手機上的資料也加密: with a PIN set, what you wrote is kept sealed (AES-GCM) inside IndexedDB.
// The key lives in memory only, from unlocking until the app is closed. A Dexie middleware seals
// records on the way in and opens them on the way out, so the rest of the app doesn't notice.
// It has to be synchronous (a transaction closes when it waits on anything else), hence noble's AES.
//
// Left readable: the fields the database sorts and finds by (ids, dates, which stretch a note is on).
// Kept on the phone apart from the records: the lockbox (src/lib/lockbox.ts), never in a backup.

import { gcm } from '@noble/ciphers/aes.js';
import type { DBCore, DBCoreCursor, Middleware } from 'dexie';

/** Per table: the fields left readable. Everything else goes into the sealed part. */
export const OPEN_FIELDS: Record<string, string[]> = {
  sessions: ['id', 'date'],
  notes: ['id', 'after', 'createdAt'],
  practices: ['id', 'createdAt'],
  kv: ['key']
};
/** kv rows that hold what you wrote (the copy kept before a restore); settings and the like stay readable */
const SEALED_KV = ['beforeRestore'];

let key: Uint8Array | null = null;

/** The key for this time the app is open; null to stop sealing (records already sealed then can't be read). */
export const setKey = (k: Uint8Array | null) => void (key = k);
export const hasKey = () => !!key;

/** Thrown when a sealed record is read before unlocking. */
export class Locked extends Error {
  constructor() {
    super('locked');
  }
}

type Row = Record<string, unknown> & { $?: Uint8Array };

const sealed = (table: string, row: Row) => table !== 'kv' || SEALED_KV.includes(row.key as string);

export function sealRow(table: string, row: Row): Row {
  if (!key || !row || typeof row !== 'object' || !sealed(table, row)) return row;
  const open = OPEN_FIELDS[table];
  const kept: Row = {};
  const rest: Row = {};
  for (const [k, v] of Object.entries(row)) (open.includes(k) ? kept : rest)[k] = v;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = gcm(key, iv).encrypt(new TextEncoder().encode(JSON.stringify(rest)));
  const $ = new Uint8Array(iv.length + data.length);
  $.set(iv);
  $.set(data, iv.length);
  return { ...kept, $ };
}

export function openRow<T>(row: T): T {
  if (!row || typeof row !== 'object' || !('$' in row) || !((row as Row).$ instanceof Uint8Array)) return row;
  if (!key) throw new Locked();
  const { $, ...kept } = row as Row;
  const rest = JSON.parse(new TextDecoder().decode(gcm(key, $!.subarray(0, 12)).decrypt($!.subarray(12))));
  // readable fields win: an update applied to a cached sealed record lands next to the sealed part
  return { ...rest, ...kept } as T;
}

const openCursor = (c: DBCoreCursor): DBCoreCursor =>
  Object.create(c, {
    key: { get: () => c.key },
    primaryKey: { get: () => c.primaryKey },
    value: { get: () => openRow(c.value) }
  });

export const sealing: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'seal',
  create: down => ({
    ...down,
    table(name) {
      const t = down.table(name);
      if (!(name in OPEN_FIELDS)) return t;
      return {
        ...t,
        mutate: req =>
          t.mutate(req.type === 'add' || req.type === 'put' ? { ...req, values: req.values.map(v => sealRow(name, v)) } : req),
        get: req => t.get(req).then(openRow),
        getMany: req => t.getMany(req).then(rows => rows.map(openRow)),
        query: req => t.query(req).then(res => (req.values ? { ...res, result: res.result.map(openRow) } : res)),
        openCursor: req => t.openCursor(req).then(c => c && openCursor(c))
      };
    }
  })
};
