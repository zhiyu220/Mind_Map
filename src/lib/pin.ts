// A 4-digit lock so the diary is not open to whoever picks up the phone. Only a salted hash is kept.

const SALT = 'my-sky:pin:v1';

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SALT + pin));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

// Wrong guesses slow down: after 5 misses you wait 30 s, and the wait doubles with each further miss
// (up to 15 minutes). Kept across reloads, so closing and reopening the app doesn't reset it.

const FREE_TRIES = 5;
const FIRST_WAIT = 30_000;
const LONGEST_WAIT = 15 * 60_000;
const KEY = 'my-sky:pin-tries';

export interface Tries {
  fails: number;
  until: number;
}

export function afterMiss(t: Tries, now: number): Tries {
  const fails = t.fails + 1;
  const extra = fails - FREE_TRIES;
  return { fails, until: extra >= 0 ? now + Math.min(LONGEST_WAIT, FIRST_WAIT * 2 ** extra) : 0 };
}

export function loadTries(): Tries {
  try {
    return { fails: 0, until: 0, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { fails: 0, until: 0 };
  }
}

export function saveTries(t: Tries | null) {
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage may be unavailable */
  }
}
