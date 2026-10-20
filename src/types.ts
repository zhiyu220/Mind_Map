export type Weather = 'sun' | 'partly' | 'cloud' | 'rain' | 'storm';

export const WEATHERS: Weather[] = ['sun', 'partly', 'cloud', 'rain', 'storm'];

export const WEATHER_NAME: Record<Weather, string> = {
  sun: '晴朗',
  partly: '有點雲',
  cloud: '陰天',
  rain: '下雨',
  storm: '雷雨'
};

export const MOODS = ['平靜', '輕鬆', '感謝', '有希望', '疲累', '焦慮', '難過', '生氣', '委屈', '困惑', '空空的', '說不出來'];
export const TOPICS = ['家庭', '感情', '朋友', '工作／學業', '自己', '身體／睡眠', '過去的事'];

export interface Song {
  id: string; // Spotify track id
  name: string;
  artists: string;
  image?: string;
}

/** A session day: one solid dot on the path. */
export interface Session {
  id: string;
  date: string; // YYYY-MM-DD, local
  weather: Weather;
  moods: string[];
  topics: string[];
  quote: string;
  notes: string;
  song?: Song;
  /** false when saved early with "先存起來" */
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Something written on the road between two sessions (the dashed dot). */
export interface RoadNote {
  id: string;
  /** the session this note comes after; null = before the first session */
  after: string | null;
  date: string; // YYYY-MM-DD
  weather?: Weather;
  text: string;
  star: boolean;
  song?: Song;
  createdAt: number;
}

/** 想練習的事: a small thing to try between sessions. No checkbox, just a mark each day you tried. */
export interface Practice {
  id: string;
  text: string;
  /** YYYY-MM-DD of each day you tried it, oldest first */
  tries: string[];
  /** put away for now; kept so it can come back */
  archived?: boolean;
  createdAt: number;
}

export interface Settings {
  nextSession?: string; // YYYY-MM-DD
  customTopics: string[];
  pinHash?: string;
  spotifyClientId?: string;
  /** keep a private 「Mind Map」 playlist of every session's song; on unless turned off */
  spotifyPlaylist?: boolean;
}
