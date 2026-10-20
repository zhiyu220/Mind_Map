// A 4-digit lock so the diary is not open to whoever picks up the phone. Only a salted hash is kept.

const SALT = 'my-sky:pin:v1';

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SALT + pin));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}
