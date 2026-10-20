import { describe, expect, it } from 'vitest';
import { _test } from './faceid';

describe('faceid', () => {
  it('keeps a credential id intact through base64url', () => {
    const id = Uint8Array.from([0, 255, 62, 63, 1, 2, 250]);
    const s = _test.b64url(id);
    expect(s).not.toMatch(/[+/=]/);
    expect([..._test.fromB64url(s)]).toEqual([...id]);
  });
});
