import { registerSW } from 'virtual:pwa-register';

// Keeping the app up to date on the iPhone home screen.
// iOS often resumes the app instead of reopening it, so we also look for a new version every
// time the app comes back to the front. A new version is switched in right away when the app has
// only just opened, otherwise when you leave the app, so nothing you're writing gets cut off.

const FRESH_START = 5000;
const HOURLY = 60 * 60 * 1000;

export function keepUpToDate() {
  const openedAt = Date.now();
  let waiting = false;

  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      waiting = true;
      if (Date.now() - openedAt < FRESH_START) update(true);
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, HOURLY);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && waiting) update(true);
  });
}
