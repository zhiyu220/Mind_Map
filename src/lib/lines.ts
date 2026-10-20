import type { RoadNote, Session } from '../types';
import { WEATHER_NAME } from '../types';
import { daysBetween, short, weekday } from './dates';

export interface Line {
  /** "|" marks where the line breaks */
  text: string;
  small?: string;
}

/**
 * The words at the top of the home screen: plain facts from your own records, said gently,
 * now and then one of the sentences you wrote down. Never nudges or judges.
 */
export function homeLines(sessions: Session[], notes: RoadNote[], today: string, nextSession?: string): Line[] {
  const L: Line[] = [];
  const last = sessions[sessions.length - 1];
  const onRoad = notes.filter(n => n.after === (last?.id ?? null));
  const stars = onRoad.filter(n => n.star).length;

  if (!last) {
    L.push({ text: '這裡是起點。' });
    if (nextSession) L.push(nextLine(today, nextSession, stars));
    if (onRoad.length) L.push({ text: `出發之前，|記下了 ${onRoad.length} 件事。` });
    return L;
  }

  if (last.date === today) {
    L.push({ text: `今天走到了|第 ${sessions.length} 個點。` });
    L.push({ text: `今天走完，|是${WEATHER_NAME[last.weather]}。` });
  } else {
    const d = daysBetween(last.date, today);
    if (d > 0) L.push({ text: `${short(last.date)} 之後，|已經走了 ${d} 天。` });
    L.push({ text: `上次走完的那天，|是${WEATHER_NAME[last.weather]}。` });
    if (nextSession && daysBetween(today, nextSession) >= 0) L.push(nextLine(today, nextSession, stars));
    if (onRoad.length) L.push({ text: `這幾天在路上，|記下了 ${onRoad.length} 件事。` });
  }
  L.push({ text: `這條路上，|有 ${sessions.length} 個點了。` });
  for (const s of sessions) if (s.quote.trim()) L.push({ text: `「${s.quote.trim()}」`, small: `${short(s.date)} 記下的` });
  return L;
}

function nextLine(today: string, next: string, stars: number): Line {
  const k = daysBetween(today, next);
  if (k === 0) return { text: stars ? `今天要去諮商。|路上有 ${stars} 件想說的事。` : '今天要去諮商。' };
  if (k === 1) return { text: `明天就是${weekday(next)}，|又要去說說話了。` };
  if (k <= 7) return { text: `再 ${k} 天就是${weekday(next)}，|又要去說說話了。` };
  return { text: `下次諮商是 ${short(next)}。` };
}

/** Same line all day; a new day (or new records) brings a different one. */
export function lineOfTheDay(lines: Line[], today: string): number {
  let h = 0;
  for (const c of today) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return lines.length ? h % lines.length : 0;
}
