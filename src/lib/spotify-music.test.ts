import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const kv = new Map<string, unknown>();
vi.mock('../db', () => ({
  getKV: vi.fn(async (k: string) => kv.get(k)),
  setKV: vi.fn(async (k: string, v: unknown) => void (v === undefined ? kv.delete(k) : kv.set(k, v))),
  getSettings: vi.fn(async () => ({ customTopics: [] }))
}));

import { dedupe, playlistUris, recentSongs, syncPlaylist } from './spotify';

const ALL = 'user-modify-playback-state user-read-playback-state user-read-currently-playing user-read-recently-played playlist-read-private playlist-modify-private';
const track = (id: string) => ({ id, name: `歌${id}`, artists: [{ name: '某人' }], album: { images: [] } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  kv.clear();
  kv.set('spotify', { access: 'tok', refresh: 'r', expires: Date.now() + 60_000, scope: ALL });
});
afterEach(() => vi.unstubAllGlobals());

describe('playlistUris', () => {
  it('follows the road: by date, then by when it was written; skips sessions without a song', () => {
    const uris = playlistUris([
      { date: '2026-10-15', createdAt: 2, song: { id: 'c', name: '', artists: '' } },
      { date: '2026-10-01', createdAt: 9, song: { id: 'a', name: '', artists: '' } },
      { date: '2026-10-08', createdAt: 1 },
      { date: '2026-10-01', createdAt: 10, song: { id: 'b', name: '', artists: '' } }
    ]);
    expect(uris).toEqual(['spotify:track:a', 'spotify:track:b', 'spotify:track:c']);
  });
});

describe('recentSongs', () => {
  it('puts what is playing first and drops repeats', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('currently-playing') ? json({ item: { ...track('now'), type: 'track' } }) : json({ items: [{ track: track('now') }, { track: track('x') }, { track: track('x') }, { track: track('y') }] })
    ));
    const r = await recentSongs();
    expect(r?.now?.id).toBe('now');
    expect(r?.recent.map(s => s.id)).toEqual(['x', 'y']);
  });

  it('copes with nothing playing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('currently-playing') ? new Response(null, { status: 204 }) : json({ items: [{ track: track('x') }] }))));
    const r = await recentSongs();
    expect(r?.now).toBeUndefined();
    expect(r?.recent.map(s => s.id)).toEqual(['x']);
  });

  it('asks nothing of Spotify for an older sign-in without the permission', async () => {
    kv.set('spotify', { access: 'tok', refresh: 'r', expires: Date.now() + 60_000, scope: 'user-modify-playback-state' });
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await recentSongs()).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('dedupe keeps the first of each', () => {
    expect(dedupe([{ id: '1', name: '', artists: '' }, { id: '1', name: '', artists: '' }, { id: '2', name: '', artists: '' }]).map(s => s.id)).toEqual(['1', '2']);
  });
});

describe('syncPlaylist', () => {
  it('creates the private playlist once, fills it, and skips writing when nothing changed', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace('https://api.spotify.com/v1', '');
      calls.push(`${init?.method ?? 'GET'} ${path.split('?')[0]}`);
      if (path === '/me') return json({ id: 'me' });
      if (path === '/users/me/playlists') {
        expect(JSON.parse(String(init?.body))).toMatchObject({ name: '我的天空', public: false });
        return json({ id: 'pl' }, 201);
      }
      if (path.startsWith('/playlists/pl/tracks')) return json({ snapshot_id: 's' }, 201);
      if (path.startsWith('/playlists/pl')) return json({ id: 'pl' });
      return json({}, 404);
    }));
    expect(await syncPlaylist(['spotify:track:a'])).toBe('pl');
    expect(calls).toEqual(['GET /me', 'POST /users/me/playlists', 'PUT /playlists/pl/tracks']);

    calls.length = 0;
    expect(await syncPlaylist(['spotify:track:a'])).toBe('pl');
    expect(calls).toEqual(['GET /playlists/pl']);
  });

  it('remakes the playlist if it was deleted in Spotify', async () => {
    kv.set('spotify-playlist', { id: 'gone', synced: '' });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = url.replace('https://api.spotify.com/v1', '').split('?')[0];
      if (path === '/playlists/gone') return json({}, 404);
      if (path === '/me') return json({ id: 'me' });
      if (path === '/users/me/playlists') return json({ id: 'new' }, 201);
      return json({}, 201);
    }));
    expect(await syncPlaylist(['spotify:track:a'])).toBe('new');
  });

  it('makes no empty playlist before there is a song', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await syncPlaylist([])).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
