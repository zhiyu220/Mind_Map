// Face ID unlock through WebAuthn: the phone's own platform authenticator checks your face and
// answers only after it has. Nothing leaves the phone and no server is involved; the PIN
// stays as the way in when Face ID can't be used.
// With the records sealed, Face ID also has to hand over a secret to open them: the passkey's PRF
// (iOS 18 and later), a value the phone gives out only after checking your face.

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** True on a phone that can check Face ID (or Touch ID) for this page. */
export async function canUseFaceId(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Asks for Face ID once and keeps a key for this app on the phone. Returns its id, or null if cancelled. */
export async function setUpFaceId(): Promise<string | null> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: random(32),
        rp: { name: 'Mind Map', id: location.hostname },
        user: { id: random(16), name: 'Mind Map', displayName: 'Mind Map' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        attestation: 'none',
        timeout: 60_000,
        extensions: { prf: {} }
      }
    })) as PublicKeyCredential | null;
    return cred ? b64url(cred.rawId) : null;
  } catch {
    return null;
  }
}

/** True only when the phone has just checked your face (the "user verified" flag is set). */
export async function checkFaceId(id: string): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromB64url(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000
      }
    })) as PublicKeyCredential | null;
    const data = cred && new Uint8Array((cred.response as AuthenticatorAssertionResponse).authenticatorData);
    return !!data && data.length > 32 && (data[32] & 0x04) !== 0;
  } catch {
    return false;
  }
}

/** For this app's records */
const PRF_SALT = new TextEncoder().encode('my-sky:face:v1');

/**
 * Checks your face and returns the secret this Face ID key gives this app (32 bytes).
 * Null when cancelled or not recognised; 'unsupported' when the phone can't give one (before iOS 18).
 */
export async function faceSecret(id: string): Promise<Uint8Array | null | 'unsupported'> {
  try {
    const cred = (await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromB64url(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: { prf: { eval: { first: PRF_SALT } } }
      }
    })) as PublicKeyCredential | null;
    if (!cred) return null;
    const data = new Uint8Array((cred.response as AuthenticatorAssertionResponse).authenticatorData);
    if (data.length <= 32 || (data[32] & 0x04) === 0) return null;
    const first = cred.getClientExtensionResults().prf?.results?.first;
    return first ? first instanceof ArrayBuffer ? new Uint8Array(first) : new Uint8Array(first.buffer, first.byteOffset, first.byteLength) : 'unsupported';
  } catch {
    return null;
  }
}

export const _test = { b64url, fromB64url };
