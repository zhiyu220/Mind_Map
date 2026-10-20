// Password protection for backup files: AES-GCM with a key stretched from your password (PBKDF2).
// A backup file is a diary you might keep in iCloud or send to yourself, so it never leaves in plain text.

export interface Sealed {
  app: 'my-sky';
  sealed: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  iv: string;
  data: string;
}

const ITERATIONS = 600_000;
const enc = new TextEncoder();
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(Array.from(atob(s), c => c.charCodeAt(0)));

async function keyFrom(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(value: unknown, password: string, iterations = ITERATIONS): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt, iterations);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))));
  return { app: 'my-sky', sealed: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toB64(salt) }, iv: toB64(iv), data: toB64(data) };
}

export const isSealed = (x: unknown): x is Sealed => !!x && typeof x === 'object' && (x as Sealed).sealed === 1 && typeof (x as Sealed).data === 'string';

/** Throws when the password is wrong (AES-GCM refuses to decrypt). */
export async function unseal<T>(s: Sealed, password: string): Promise<T> {
  const key = await keyFrom(password, fromB64(s.kdf.salt), s.kdf.iterations);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(s.iv) }, key, fromB64(s.data));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
