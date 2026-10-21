// Spotify, signed in with your own account (Authorization Code + PKCE: no server, no secret).
// Used to search songs by name, to offer what you've just been listening to, to keep a private
// 「Mind Map」 playlist of every session's song, and (with Premium) to start a song on your Spotify app.
// In-page full playback (Web Playback SDK) does not work in mobile browsers, so we use the
// embedded player plus remote control of the Spotify app instead.

import { getKV, getSettings, setKV } from '../db';
import type { Song } from '../types';

interface Tokens {
  access: string;
  refresh: string;
  expires: number;
  /** what this sign-in allowed; older sign-ins had none */
  scope?: string;
}

const SCOPES = [
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'playlist-read-private',
  'playlist-modify-private'
].join(' ');

/** Signed in, but before some features existed: a fresh sign-in adds the missing permissions. */
export async function needsReconnect() {
  const t = await getKV<Tokens>('spotify');
  if (!t) return false;
  const have = new Set((t.scope ?? '').split(' '));
  return SCOPES.split(' ').some(x => !have.has(x));
}

async function hasScope(x: string) {
  return !!(await getKV<Tokens>('spotify'))?.scope?.split(' ').includes(x);
}

const VERIFIER = 'my-sky:spotify-verifier';
const redirectUri = () => location.origin + location.pathname;

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function clientId(): Promise<string | undefined> {
  return (await getSettings()).spotifyClientId || import.meta.env.VITE_SPOTIFY_CLIENT_ID || undefined;
}

export async function startSpotifyLogin() {
  const id = await clientId();
  if (!id) throw new Error('no client id');
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)).buffer);
  sessionStorage.setItem(VERIFIER, verifier);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const q = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES
  });
  location.assign(`https://accounts.spotify.com/authorize?${q}`);
}

/** Runs on every start; finishes a login when Spotify sends us back with ?code=. */
export async function finishSpotifyLogin() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (!code && !params.get('error')) return;
  history.replaceState(null, '', location.pathname);
  const verifier = sessionStorage.getItem(VERIFIER);
  const id = await clientId();
  if (!code || !verifier || !id) return;
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: id, code_verifier: verifier })
    });
    if (res.ok) await keep(await res.json());
  } finally {
    sessionStorage.removeItem(VERIFIER);
  }
}

async function keep(j: { access_token: string; refresh_token?: string; expires_in: number; scope?: string }) {
  const old = await getKV<Tokens>('spotify');
  await setKV('spotify', {
    access: j.access_token,
    refresh: j.refresh_token ?? old?.refresh ?? '',
    expires: Date.now() + (j.expires_in - 60) * 1000,
    scope: j.scope ?? old?.scope ?? ''
  });
}

/** Signed in with permission to start songs on the Spotify app (needs a fresh sign-in after this feature arrived). */
export async function canRemote() {
  return hasScope('user-modify-playback-state');
}

export async function isConnected() {
  return !!(await getKV<Tokens>('spotify'));
}

export async function disconnect() {
  await setKV('spotify', undefined);
}

async function token(): Promise<string | null> {
  const t = await getKV<Tokens>('spotify');
  if (!t) return null;
  if (Date.now() < t.expires) return t.access;
  const id = await clientId();
  if (!id || !t.refresh) return null;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: id })
  });
  if (!res.ok) {
    await disconnect();
    return null;
  }
  await keep(await res.json());
  return (await getKV<Tokens>('spotify'))!.access;
}

interface ApiTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string; width: number }[] };
}

export async function searchTracks(q: string): Promise<Song[] | null> {
  const t = await token();
  if (!t) return null;
  const res = await fetch(`https://api.spotify.com/v1/search?${new URLSearchParams({ q, type: 'track', limit: '10' })}`, {
    headers: { Authorization: `Bearer ${t}` }
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { tracks: { items: ApiTrack[] } };
  return j.tracks.items.map(toSong);
}

const toSong = (it: ApiTrack): Song => ({
  id: it.id,
  name: it.name,
  artists: it.artists.map(a => a.name).join('、'),
  image: [...it.album.images].sort((a, b) => a.width - b.width).find(i => i.width >= 64)?.url
});

/** What's playing now and what you listened to lately, newest first, without repeats. */
export async function recentSongs(): Promise<{ now?: Song; recent: Song[] } | null> {
  if (!(await hasScope('user-read-recently-played'))) return null;
  const t = await token();
  if (!t) return null;
  const auth = { headers: { Authorization: `Bearer ${t}` } };
  const [cur, rec] = await Promise.all([
    fetch('https://api.spotify.com/v1/me/player/currently-playing', auth).catch(() => null),
    fetch('https://api.spotify.com/v1/me/player/recently-played?limit=20', auth).catch(() => null)
  ]);
  let now: Song | undefined;
  if (cur?.status === 200) {
    const j = (await cur.json()) as { item?: ApiTrack & { type?: string } };
    if (j.item?.id && j.item.type !== 'episode') now = toSong(j.item);
  }
  const items = rec?.ok ? ((await rec.json()) as { items: { track: ApiTrack }[] }).items : [];
  return { now, recent: dedupe(items.map(i => toSong(i.track)), now?.id).slice(0, 8) };
}

export function dedupe(songs: Song[], skip?: string): Song[] {
  const seen = new Set(skip ? [skip] : []);
  return songs.filter(s => !seen.has(s.id) && seen.add(s.id));
}

// ---------- the 「Mind Map」 playlist ----------

interface PlaylistState {
  id: string;
  /** the track list last written, to skip writing when nothing changed */
  synced: string;
  /** the description has been rewritten without the word 諮商 (older playlists had it) */
  quiet?: boolean;
}

// Spotify can read this; it says nothing about what the songs were for
const PLAYLIST_DESCRIPTION = '照日期排的歌。由「Mind Map」整理。';

/** Every session's song in the order of the road (oldest first). */
export function playlistUris(sessions: { date: string; createdAt: number; song?: Song }[]): string[] {
  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .filter(s => s.song?.id)
    .map(s => `spotify:track:${s.song!.id}`);
}

export const playlistUrl = (id: string) => `https://open.spotify.com/playlist/${id}`;

export async function playlistInfo() {
  return getKV<PlaylistState>('spotify-playlist');
}

/**
 * A playlist made by an earlier version says 諮商 in its description: rewrite it once, whether or not
 * the playlist is still kept in sync. Returns the updated state, or undefined when nothing was done.
 */
export async function quietPlaylist(): Promise<PlaylistState | undefined> {
  const st = await playlistInfo();
  if (!st || st.quiet || !(await hasScope('playlist-modify-private'))) return;
  const t = await token();
  if (!t) return;
  const res = await fetch(`https://api.spotify.com/v1/playlists/${st.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: PLAYLIST_DESCRIPTION })
  });
  // gone from Spotify: nothing left to fix
  if (!res.ok && res.status !== 404) return;
  const next = { ...st, quiet: true };
  await setKV('spotify-playlist', next);
  return next;
}

/**
 * Makes the private 「Mind Map」 playlist match the road: created on first use, recreated if you
 * deleted it in Spotify. Returns the playlist id, or null when it can't (not connected / no permission).
 */
export async function syncPlaylist(uris: string[]): Promise<string | null> {
  if (!(await hasScope('playlist-modify-private'))) return null;
  const t = await token();
  if (!t) return null;
  const headers = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
  const api = (path: string, init?: RequestInit) => fetch(`https://api.spotify.com/v1${path}`, { ...init, headers });
  const signature = uris.join(',');
  let st = await playlistInfo();

  if (st) {
    const check = await api(`/playlists/${st.id}?fields=id`);
    if (check.status === 404) st = undefined;
    else {
      if (!st.quiet) st = (await quietPlaylist()) ?? st;
      if (st.synced === signature) return st.id;
    }
  }
  if (!st) {
    if (!uris.length) return null; // no songs yet: don't make an empty playlist
    const me = await api('/me');
    if (!me.ok) return null;
    const { id: userId } = (await me.json()) as { id: string };
    const made = await api(`/users/${encodeURIComponent(userId)}/playlists`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Mind Map', public: false, description: PLAYLIST_DESCRIPTION })
    });
    if (!made.ok) return null;
    st = { id: ((await made.json()) as { id: string }).id, synced: '', quiet: true };
  }

  // replace everything with the first 100, then add the rest 100 at a time
  const first = await api(`/playlists/${st.id}/tracks`, { method: 'PUT', body: JSON.stringify({ uris: uris.slice(0, 100) }) });
  if (!first.ok) return null;
  for (let i = 100; i < uris.length; i += 100) {
    const more = await api(`/playlists/${st.id}/tracks`, { method: 'POST', body: JSON.stringify({ uris: uris.slice(i, i + 100) }) });
    if (!more.ok) return null;
  }
  await setKV('spotify-playlist', { id: st.id, synced: signature, quiet: st.quiet });
  return st.id;
}

/** open.spotify.com/track/<id>, spotify:track:<id>, or a share link with ?si= */
export function trackIdFromLink(text: string): string | null {
  const m = text.match(/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/);
  return m ? m[1] : null;
}

/** Title for a pasted link, via Spotify's public oEmbed; falls back to a plain label. */
export async function songFromLink(id: string): Promise<Song> {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`);
    if (res.ok) {
      const j = (await res.json()) as { title?: string; thumbnail_url?: string };
      return { id, name: j.title || 'Spotify 的歌', artists: '', image: j.thumbnail_url };
    }
  } catch {
    /* offline or blocked */
  }
  return { id, name: 'Spotify 的歌', artists: '' };
}

export const embedUrl = (id: string) => `https://open.spotify.com/embed/track/${id}?utm_source=generator`;
export const openUrl = (id: string) => `https://open.spotify.com/track/${id}`;

export type RemoteResult = 'playing' | 'no-device' | 'premium' | 'not-connected' | 'error';

interface Device {
  id: string;
  is_active: boolean;
  type: string;
}

/**
 * Plays a song on one of your Spotify apps (the one already playing, else this phone).
 * Spotify must have been opened recently, or it won't show up as a device.
 */
export async function playOnSpotify(trackId: string): Promise<RemoteResult> {
  const t = await token();
  if (!t) return 'not-connected';
  const auth = { Authorization: `Bearer ${t}` };
  try {
    const dres = await fetch('https://api.spotify.com/v1/me/player/devices', { headers: auth });
    if (dres.status === 401) return 'not-connected';
    const { devices = [] } = dres.ok ? ((await dres.json()) as { devices?: Device[] }) : {};
    const usable = devices.filter(d => d.id);
    const device = usable.find(d => d.is_active) ?? usable.find(d => d.type === 'Smartphone') ?? usable[0];
    if (!device) return 'no-device';
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device.id)}`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [`spotify:track:${trackId}`] })
    });
    if (res.ok) return 'playing';
    if (res.status === 404) return 'no-device';
    if (res.status === 403) return 'premium';
    if (res.status === 401) return 'not-connected';
    return 'error';
  } catch {
    return 'error';
  }
}

export async function pauseSpotify(): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  const res = await fetch('https://api.spotify.com/v1/me/player/pause', { method: 'PUT', headers: { Authorization: `Bearer ${t}` } }).catch(() => null);
  return !!res?.ok;
}
