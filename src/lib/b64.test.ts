import { describe, expect, it } from 'vitest';
import { fromB64, fromB64url, toB64, toB64url } from './b64';

describe('base64', () => {
  it('matches btoa on small input', () => {
    const b = new Uint8Array([0, 1, 2, 250, 251, 255]);
    expect(toB64(b)).toBe(btoa(String.fromCharCode(...b)));
    expect(fromB64(toB64(b))).toEqual(b);
  });

  it('handles a few megabytes (a backup of years of writing)', () => {
    const b = new Uint8Array(3_000_000).map((_, i) => (i * 31) % 256);
    const s = toB64(b);
    expect(s).toBe(Buffer.from(b).toString('base64'));
    expect(Buffer.from(fromB64(s)).equals(Buffer.from(b))).toBe(true);
  });

  it('has a URL-safe kind without padding', () => {
    const b = new Uint8Array([251, 255, 254, 62, 63]);
    const s = toB64url(b);
    expect(s).not.toMatch(/[+/=]/);
    expect(fromB64url(s)).toEqual(b);
  });
});
