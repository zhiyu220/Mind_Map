import { describe, expect, it } from 'vitest';
import { trackIdFromLink } from './spotify';

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
