import { useEffect, useState } from 'react';
import type { Song } from '../types';
import { canRemote, embedUrl, isConnected, needsReconnect, openUrl, pauseSpotify, playOnSpotify, recentSongs, searchTracks, songFromLink, trackIdFromLink, type RemoteResult } from '../lib/spotify';
import { useToast } from './Toast';

const REMOTE_MSG: Record<Exclude<RemoteResult, 'playing'>, string> = {
  'no-device': '找不到你的 Spotify。先打開 Spotify App 一下，再回來按一次',
  premium: 'Spotify 說這個帳號不能遙控播放（需要 Premium）',
  'not-connected': 'Spotify 的連結過期了，到「設定」重新連結',
  error: '現在連不上 Spotify，等一下再試'
};

export function SongPlayer({ song }: { song: Song }) {
  const say = useToast();
  const [remote, setRemote] = useState<'yes' | 'reconnect' | 'no'>('no');
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([isConnected(), canRemote()]).then(([c, r]) => setRemote(r ? 'yes' : c ? 'reconnect' : 'no'));
  }, []);

  const play = async () => {
    setBusy(true);
    const r = await playOnSpotify(song.id);
    setBusy(false);
    if (r === 'playing') {
      setPlaying(true);
      say(`在你的 Spotify 播放：${song.name}`);
    } else say(REMOTE_MSG[r]);
  };
  const pause = async () => {
    await pauseSpotify();
    setPlaying(false);
  };

  return (
    <div className="song-player">
      <iframe
        title={`Spotify：${song.name}`}
        src={embedUrl(song.id)}
        width="100%"
        height="80"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
      {remote === 'yes' && (
        <div className="remote">
          <button className="pill sm" type="button" disabled={busy} onClick={playing ? pause : play}>
            <i className="spotify-dot" aria-hidden="true" />
            {playing ? '暫停' : busy ? '連線中…' : '用我的 Spotify 播完整首'}
          </button>
        </div>
      )}
      {remote === 'reconnect' && <p className="tiny">到「設定」重新連結 Spotify，就能用你的 Spotify 播完整首。</p>}
      <a className="linkish" href={openUrl(song.id)} target="_blank" rel="noreferrer">在 Spotify 打開</a>
    </div>
  );
}

/** Search Spotify by name when connected; otherwise paste a song link. */
export default function SongPicker({ value, onChange }: { value?: Song; onChange: (s: Song | undefined) => void }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'none' | 'error'>('idle');
  const [recent, setRecent] = useState<{ now?: Song; recent: Song[] } | null>(null);
  const [reconnect, setReconnect] = useState(false);

  useEffect(() => {
    isConnected().then(setConnected);
    needsReconnect().then(setReconnect);
    // what you were just listening to, so the song is usually one tap away
    recentSongs().then(setRecent).catch(() => {});
  }, []);

  useEffect(() => {
    const text = q.trim();
    if (!text) {
      setResults([]);
      setState('idle');
      return;
    }
    const id = trackIdFromLink(text);
    if (id) {
      songFromLink(id).then(onChange);
      setQ('');
      return;
    }
    if (!connected) return;
    setState('loading');
    const t = setTimeout(async () => {
      const r = await searchTracks(text).catch(() => null);
      if (r === null) setState('error');
      else {
        setResults(r);
        setState(r.length ? 'idle' : 'none');
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, connected]);

  if (value) {
    return (
      <div className="song-chosen">
        <div className="song-row static">
          <Cover song={value} />
          <div>
            <b>{value.name}</b>
            <span>{value.artists}</span>
          </div>
        </div>
        <SongPlayer song={value} />
        <button className="linkish" type="button" onClick={() => onChange(undefined)}>換一首</button>
      </div>
    );
  }

  return (
    <div className="song-search">
      <div className="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          id="song-q"
          className="field"
          placeholder={connected ? '搜尋歌名或歌手' : '貼上 Spotify 歌曲連結'}
          value={q}
          onChange={e => setQ(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      {connected === false && <p className="tiny">在「設定」連結 Spotify 之後，就可以直接用歌名搜尋。</p>}
      {state === 'loading' && <p className="tiny">找找看…</p>}
      {state === 'none' && <p className="tiny">找不到，換個關鍵字試試。</p>}
      {state === 'error' && <p className="tiny">現在連不上 Spotify。可以先跳過，之後再補。</p>}
      {connected && reconnect && !q.trim() && <p className="tiny">到「設定」重新連結 Spotify，這裡就會出現你剛剛聽的歌。</p>}
      {!q.trim() && recent?.now && (
        <>
          <div className="label">正在聽</div>
          <button className="song-row" type="button" onClick={() => onChange(recent.now)}>
            <Cover song={recent.now} />
            <div>
              <b>{recent.now.name}</b>
              <span>{recent.now.artists}</span>
            </div>
          </button>
        </>
      )}
      {!q.trim() && !!recent?.recent.length && (
        <>
          <div className="label">最近聽過</div>
          <div className="results">
            {recent.recent.map(s => (
              <button key={s.id} className="song-row" type="button" onClick={() => onChange(s)}>
                <Cover song={s} />
                <div>
                  <b>{s.name}</b>
                  <span>{s.artists}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="results">
        {results.map(s => (
          <button key={s.id} className="song-row" type="button" onClick={() => onChange(s)}>
            <Cover song={s} />
            <div>
              <b>{s.name}</b>
              <span>{s.artists}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Cover({ song, small }: { song: Song; small?: boolean }) {
  const cls = small ? 'cover small' : 'cover';
  return song.image ? (
    <img className={cls} src={song.image} alt="" width="46" height="46" />
  ) : (
    <div className={cls} style={{ background: 'var(--w-rain)' }}>
      <svg aria-hidden="true">
        <use href="#i-note" />
      </svg>
    </div>
  );
}

/** A song as a tappable row: cover, name and artist. */
export function SongChip({ song, onPlay }: { song: Song; onPlay: () => void }) {
  return (
    <button className="song-row chip-song" type="button" onClick={onPlay} aria-label={`聽聽看：${song.name}`}>
      <Cover song={song} small />
      <div>
        <b>{song.name}</b>
        {song.artists && <span>{song.artists}</span>}
      </div>
      <span className="play-mark" aria-hidden="true">▶</span>
    </button>
  );
}
