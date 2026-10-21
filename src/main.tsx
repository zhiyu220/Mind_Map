import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/huninn/400.css';
import './styles.css';
import App from './App';
import { askPersist, dropRetiredSettings } from './db';
import { finishSpotifyLogin } from './lib/spotify';
import { keepUpToDate } from './lib/update';
import { coverWhenHidden } from './lib/privacy';
import { fitSheetsToKeyboard } from './lib/viewport';
import { tidyRoad } from './lib/store';

askPersist();
keepUpToDate();
coverWhenHidden();
fitSheetsToKeyboard();
// mend road notes an earlier version left on the wrong stretch (it changes nothing when all is in order)
tidyRoad().catch(() => {});
// clear what removed features left behind (想說話的時候: names and phone numbers)
dropRetiredSettings().catch(() => {});

// coming back from the Spotify login page: finish it before the app draws
finishSpotifyLogin().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
