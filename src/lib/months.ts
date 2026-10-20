import type { RoadNote, Session, Song, Weather } from '../types';

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

export interface SkyMonth {
  month: number; // 1–12
  sessions: Session[];
  /** weather noted on the road that month, in order */
  road: Weather[];
}

/** Years that have anything in them, newest first. */
export function recordYears(sessions: Session[], notes: RoadNote[]): number[] {
  const years = new Set([...sessions, ...notes].map(x => Number(x.date.slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}

/** 這一年的天空: every month of a year, with each session's weather and the road's. */
export function skyOfYear(year: number, sessions: Session[], notes: RoadNote[]): SkyMonth[] {
  const months: SkyMonth[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, sessions: [], road: [] }));
  const inYear = <T extends { date: string; createdAt: number }>(list: T[]) =>
    list.filter(x => Number(x.date.slice(0, 4)) === year).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  for (const s of inYear(sessions)) months[Number(s.date.slice(5, 7)) - 1].sessions.push(s);
  for (const n of inYear(notes)) if (n.weather) months[Number(n.date.slice(5, 7)) - 1].road.push(n.weather);
  return months;
}

/** Topics you've talked about, the most often first. */
export function topicsUsed(sessions: Session[]): string[] {
  const count = new Map<string, number>();
  for (const s of sessions) for (const t of s.topics) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
