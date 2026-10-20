// The sky follows real time: a night sky after dark, and the meadow changes with the seasons.

export type SkyMode = 'time' | 'phone' | 'day';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** Night from 6 in the evening until 6 in the morning. */
export const isNight = (d: Date) => d.getHours() >= 18 || d.getHours() < 6;

export function seasonOf(d: Date): Season {
  const m = d.getMonth() + 1;
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}

export function themeFor(mode: SkyMode, d: Date, phoneDark: boolean): 'light' | 'dark' {
  if (mode === 'day') return 'light';
  if (mode === 'phone') return phoneDark ? 'dark' : 'light';
  return isNight(d) ? 'dark' : 'light';
}

/** Keeps <html data-theme data-season> up to date; checks again every minute and when the app comes back. */
export function followSky(mode: SkyMode): () => void {
  const root = document.documentElement;
  const phone = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const now = new Date();
    root.dataset.theme = themeFor(mode, now, phone.matches);
    root.dataset.season = seasonOf(now);
  };
  apply();
  const t = setInterval(apply, 60_000);
  const onVis = () => !document.hidden && apply();
  document.addEventListener('visibilitychange', onVis);
  phone.addEventListener('change', apply);
  return () => {
    clearInterval(t);
    document.removeEventListener('visibilitychange', onVis);
    phone.removeEventListener('change', apply);
  };
}
