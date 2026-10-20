// Spotify, signed in with your own account (Authorization Code + PKCE: no server, no secret).
// Used to search songs by name. Playback is Spotify's own embedded player.

import { getKV, getSettings, setKV } from '../db';
import type { Song } from '../types';

interface Tokens {
  access: string;
  refresh: string;
  expires: number;
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
    scope: ''
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

async function keep(j: { access_token: string; refresh_token?: string; expires_in: number }) {
  const old = await getKV<Tokens>('spotify');
  await setKV('spotify', { access: j.access_token, refresh: j.refresh_token ?? old?.refresh ?? '', expires: Date.now() + (j.expires_in - 60) * 1000 });
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
  return j.tracks.items.map(it => ({
    id: it.id,
    name: it.name,
    artists: it.artists.map(a => a.name).join('、'),
    image: [...it.album.images].sort((a, b) => a.width - b.width).find(i => i.width >= 64)?.url
  }));
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
