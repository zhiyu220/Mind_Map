import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  getKV: vi.fn(async () => ({ access: 'tok', refresh: 'r', expires: Date.now() + 60_000, scope: 'user-modify-playback-state user-read-playback-state' })),
  setKV: vi.fn(),
  getSettings: vi.fn(async () => ({ customTopics: [] }))
}));

import { canRemote, playOnSpotify, trackIdFromLink } from './spotify';

describe('trackIdFromLink', () => {
  it('reads share links, intl links and URIs', () => {
    expect(trackIdFromLink('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc')).toBe('4uLU6hMCjMI75M1A2tKUQC');
    expect(trackIdFromLink('https://open.spotify.com/intl-ja/track/4uLU6hMCjMI75M1A2tKUQC')).toBe('4uLU6hMCjMI75M1A2tKUQC');
    expect(trackIdFromLink('spotify:track:4uLU6hMCjMI75M1A2tKUQC')).toBe('4uLU6hMCjMI75M1A2tKUQC');
  });
  it('ignores plain text', () => {
    expect(trackIdFromLink('晴天 周杰倫')).toBeNull();
  });
});

describe('playOnSpotify', () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (devices: unknown[], playStatus: number) => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/me/player/devices')) return new Response(JSON.stringify({ devices }), { status: 200 });
      return new Response(null, { status: playStatus });
    }));
    return calls;
  };

  it('knows the sign-in allows remote play', async () => {
    expect(await canRemote()).toBe(true);
  });

  it('plays on the active device first, else the phone', async () => {
    const calls = respond([{ id: 'mac', is_active: false, type: 'Computer' }, { id: 'phone', is_active: false, type: 'Smartphone' }], 204);
    expect(await playOnSpotify('abc')).toBe('playing');
    const play = calls[1];
    expect(play.url).toContain('device_id=phone');
    expect(play.init?.method).toBe('PUT');
    expect(JSON.parse(String(play.init?.body))).toEqual({ uris: ['spotify:track:abc'] });
  });

  it('asks to open Spotify when no device is around', async () => {
    respond([], 204);
    expect(await playOnSpotify('abc')).toBe('no-device');
  });

  it('reports when the account cannot be controlled', async () => {
    respond([{ id: 'phone', is_active: true, type: 'Smartphone' }], 403);
    expect(await playOnSpotify('abc')).toBe('premium');
  });
});
