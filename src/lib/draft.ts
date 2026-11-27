// The session you're halfway through writing survives the app being closed (only new records for today).
// It's kept in the database next to the records, so with a PIN set it's sealed like them (src/lib/seal.ts).
// Before 2.2.0 it sat in localStorage as plain text: moveOldDraft() brings it over once the app is open.

import { getKV, setKV } from '../db';
import type { Draft } from '../components/SessionFlow';

const KEY = 'draft';
const OLD_KEY = 'my-sky:draft';

export const loadDraft = async () => (await getKV<Draft>(KEY)) ?? null;
export const saveDraft = (d: Draft) => setKV(KEY, d);
export const clearDraft = () => setKV(KEY, undefined);

/** After unlocking (so it's sealed on the way in): moves a draft left in localStorage into the database. */
export async function moveOldDraft() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(OLD_KEY);
  } catch {
    return;
  }
  if (raw === null) return;
  let old: Draft | null = null;
  try {
    old = JSON.parse(raw) as Draft;
  } catch {
    /* a damaged draft isn't worth keeping */
  }
  if (old && !(await getKV(KEY))) await saveDraft(old);
  try {
    localStorage.removeItem(OLD_KEY);
  } catch {
    /* storage may be unavailable */
  }
}
