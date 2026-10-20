import type { RoadNote, Session, Song } from '../types';

export interface Month {
  key: string; // YYYY-MM
  title: string;
  sessions: Session[];
  notes: RoadNote[];
  songs: { key: string; date: string; song: Song; road: boolean }[];
  quotes: Session[];
}

/** Newest month first; inside a month, in the order things happened. */
export function groupByMonth(sessions: Session[], notes: RoadNote[]): Month[] {
  const map = new Map<string, Month>();
  const month = (date: string) => {
    const key = date.slice(0, 7);
    if (!map.has(key)) map.set(key, { key, title: `${Number(key.slice(0, 4))}年${Number(key.slice(5))}月`, sessions: [], notes: [], songs: [], quotes: [] });
    return map.get(key)!;
  };
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
    const m = month(s.date);
    m.sessions.push(s);
    if (s.song) m.songs.push({ key: s.id, date: s.date, song: s.song, road: false });
    if (s.quote.trim()) m.quotes.push(s);
  }
  for (const n of [...notes].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
    const m = month(n.date);
    m.notes.push(n);
    if (n.song) m.songs.push({ key: n.id, date: n.date, song: n.song, road: true });
  }
  for (const m of map.values()) m.songs.sort((a, b) => a.date.localeCompare(b.date));
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}
