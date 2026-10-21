// The key that seals the records (src/lib/seal.ts) is random. The lockbox keeps it, locked twice over:
// once with the PIN (stretched with PBKDF2), and once with Face ID's secret when Face ID is on.
// The lockbox stays on this phone: a backup has its own password and never carries it.
//
// A wrong PIN simply fails to open the lockbox (AES-GCM refuses); no hash of the PIN is kept to compare against.
// A PIN is still short: 6 digits hold up far better than 4 against someone who copies the phone's files.

import { gcm } from '@noble/ciphers/aes.js';
import { db, getKV, getSettings } from '../db';
import { setKey } from './seal';
import { checkFaceId, faceSecret, setUpFaceId } from './faceid';
import { hashPin } from './pin';

const ITERATIONS = 600_000;

interface Wrapped {
  iv: Uint8Array;
  key: Uint8Array;
}
export interface Lockbox {
  digits: number;
  pin: Wrapped & { salt: Uint8Array; iterations: number };
  /** Face ID's key and the record key locked with its secret */
  face?: Wrapped & { id: string };
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

const wrap = (kek: Uint8Array, key: Uint8Array): Wrapped => {
  const iv = random(12);
  return { iv, key: gcm(kek, iv).encrypt(key) };
};
/** Throws when kek is the wrong one. */
const unwrap = (kek: Uint8Array, w: Wrapped) => gcm(kek, w.iv).decrypt(w.key);

async function pinKey(pin: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations }, base, 256));
}

async function lockWithPin(key: Uint8Array, pin: string): Promise<Lockbox['pin']> {
  const salt = random(16);
  return { salt, iterations: ITERATIONS, ...wrap(await pinKey(pin, salt, ITERATIONS), key) };
}

/** The record key while the app is open (also held by seal.ts) */
let current: Uint8Array | null = null;
const use = (key: Uint8Array | null) => {
  current = key;
  setKey(key);
};

export const getLockbox = async () => (await getKV<Lockbox>('lockbox')) ?? null;
const saveLockbox = (box: Lockbox) => db.kv.put({ key: 'lockbox', value: box });

const TABLES = () => [db.sessions, db.notes, db.practices, db.kv];

/** Writes every record again: sealed with the key in use, or readable when there's none. Inside a transaction. */
async function rewriteAll(before: () => void = () => {}) {
  const rows = { sessions: await db.sessions.toArray(), notes: await db.notes.toArray(), practices: await db.practices.toArray(), kept: await db.kv.get('beforeRestore') };
  before();
  await db.sessions.bulkPut(rows.sessions);
  await db.notes.bulkPut(rows.notes);
  await db.practices.bulkPut(rows.practices);
  if (rows.kept) await db.kv.put(rows.kept);
}

/** Sets a PIN: a new key seals everything from now on. Face ID (from before) has to be set up again. */
export async function setPin(pin: string) {
  const key = random(32);
  const box: Lockbox = { digits: pin.length, pin: await lockWithPin(key, pin) }; // before the transaction: it can't wait on WebCrypto
  const was = current;
  use(key);
  try {
    await db.transaction('rw', TABLES(), async () => {
      if (was) {
        // already sealed with another key: read with that one first
        setKey(was);
        await rewriteAll(() => setKey(key));
      } else await rewriteAll();
      await saveLockbox(box);
      const st = await getSettings();
      await db.kv.put({ key: 'settings', value: { ...st, pinHash: undefined, faceId: undefined } });
    });
  } catch (e) {
    use(was);
    throw e;
  }
}

/** A new PIN for the same key: nothing is rewritten. Face ID stays. */
export async function changePin(pin: string) {
  const box = await getLockbox();
  if (!box || !current) return setPin(pin);
  await saveLockbox({ ...box, digits: pin.length, pin: await lockWithPin(current, pin) });
}

export type Opened = 'ok' | 'wrong' | 'faceAgain';

/** Opens with the PIN. A PIN from before sealing (only its hash kept) is checked that way, and the records get sealed now. */
export async function openWithPin(pin: string): Promise<Opened> {
  const box = await getLockbox();
  if (box) {
    try {
      use(unwrap(await pinKey(pin, box.pin.salt, box.pin.iterations), box.pin));
      return 'ok';
    } catch {
      return 'wrong';
    }
  }
  const { pinHash, faceId } = await getSettings();
  if (!pinHash || (await hashPin(pin)) !== pinHash) return 'wrong';
  await setPin(pin);
  return faceId ? 'faceAgain' : 'ok';
}

/** Opens with Face ID. False when cancelled or not recognised. */
export async function openWithFace(): Promise<boolean> {
  const box = await getLockbox();
  if (!box) {
    // before sealing: Face ID only had to say yes
    const { faceId } = await getSettings();
    return !!faceId && (await checkFaceId(faceId));
  }
  if (!box.face) return false;
  const secret = await faceSecret(box.face.id);
  if (!(secret instanceof Uint8Array)) return false;
  try {
    use(unwrap(secret, box.face));
    return true;
  } catch {
    return false;
  }
}

/** Sets up Face ID to open the lockbox (needs to be open now). 'unsupported' before iOS 18. */
export async function addFace(): Promise<'ok' | 'cancel' | 'unsupported'> {
  const box = await getLockbox();
  if (!box || !current) return 'cancel';
  const id = await setUpFaceId();
  if (!id) return 'cancel';
  const secret = await faceSecret(id);
  if (secret === 'unsupported') return 'unsupported';
  if (!secret) return 'cancel';
  await saveLockbox({ ...box, face: { id, ...wrap(secret, current) } });
  return 'ok';
}

export async function removeFace() {
  const box = await getLockbox();
  if (box) await saveLockbox({ ...box, face: undefined });
}

/** No more PIN: everything is written readable again and the lockbox goes. */
export async function removePin() {
  const was = current;
  try {
    await db.transaction('rw', TABLES(), async () => {
      await rewriteAll(() => setKey(null));
      await db.kv.delete('lockbox');
      const st = await getSettings();
      await db.kv.put({ key: 'settings', value: { ...st, pinHash: undefined, faceId: undefined } });
    });
    use(null);
  } catch (e) {
    use(was);
    throw e;
  }
}

/** For tests: as if the app had just been opened. */
export const _forget = () => use(null);
