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
 * When a session is added on an earlier date, it splits the stretch it lands in:
 * notes from that day on move behind the new dot. Returns the notes to move.
 */
export function notesToMove(newSession: Session, sessionsByDate: Session[], notes: RoadNote[]): RoadNote[] {
  const before = sessionsByDate.filter(s => s.id !== newSession.id);
  const split = stretchFor(newSession.date, before);
  return notes.filter(n => n.after === split && n.date >= newSession.date);
}
