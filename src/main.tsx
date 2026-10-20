import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/huninn/400.css';
import './styles.css';
import App from './App';
import { askPersist } from './db';
import { finishSpotifyLogin } from './lib/spotify';

askPersist();

// coming back from the Spotify login page: finish it before the app draws
finishSpotifyLogin().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
