import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/huninn/400.css';
import './styles.css';
import App from './App';
import { askPersist } from './db';
import { finishSpotifyLogin } from './lib/spotify';
import { keepUpToDate } from './lib/update';
import { coverWhenHidden } from './lib/privacy';
import { tidyRoad } from './lib/store';

askPersist();
keepUpToDate();
coverWhenHidden();
// mend road notes an earlier version left on the wrong stretch (it changes nothing when all is in order)
tidyRoad().catch(() => {});

// coming back from the Spotify login page: finish it before the app draws
finishSpotifyLogin().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
