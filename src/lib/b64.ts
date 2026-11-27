// Base64 for bytes of any size. Spreading a whole array into String.fromCharCode runs out of
// stack once it holds more than about a hundred thousand bytes (a backup of a year or so), so go in pieces.

const CHUNK = 0x8000;

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

export const fromB64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/** The URL-safe kind, without padding (PKCE, WebAuthn ids). */
export const toB64url = (buf: ArrayBuffer | Uint8Array) =>
  toB64(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const fromB64url = (s: string) => fromB64(s.replace(/-/g, '+').replace(/_/g, '/'));
