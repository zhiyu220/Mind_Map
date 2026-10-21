import type { RoadNote, Session } from '../types';

// The road is cut into stretches by session days. A note belongs to the stretch after the last
// session on or before its date (a note written on a session day counts as after that session).

/** The session a note on `date` comes after, or null when it's before the first session. */
export function stretchFor(date: string, sessionsByDate: Session[]): string | null {
  let after: string | null = null;
  for (const s of sessionsByDate) {
    if (s.date <= date) after = s.id;
    else break;
  }
  return after;
}

/**
 * Which stretch every note belongs on, given the sessions as they are now. Returns only the notes
 * whose stretch changed. Run it after a session is added, deleted or moved to another date, after a
 * restore, and once on start (it also mends notes left behind a session that no longer exists).
 */
export function restretch(sessionsByDate: Session[], notes: RoadNote[]): { id: string; after: string | null }[] {
  return notes.flatMap(n => {
    const after = stretchFor(n.date, sessionsByDate);
    return after === n.after ? [] : [{ id: n.id, after }];
  });
}
