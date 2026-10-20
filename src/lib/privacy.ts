// When the app leaves the screen, iOS keeps a snapshot of it for the app switcher.
// Cover the page with a plain sky first, so what you wrote doesn't show there.
// (Only on leaving: a window blur also happens when you tap the Spotify player, so it's not used.)

export function coverWhenHidden() {
  const root = document.documentElement;
  const cover = () => root.classList.add('covered-up');
  const uncover = () => root.classList.remove('covered-up');
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? cover() : uncover()));
  window.addEventListener('pagehide', cover);
  window.addEventListener('pageshow', uncover);
}
