/**
 * Challenge URL — encode/decode seed + score in URL for "beat my score" sharing.
 *
 * URL format: ?c=<base64(JSON)>
 * Payload: { s: seed, sc: score, v: 1 }
 */

export interface ChallengeParams {
  seed: string;
  score: number;
}
const MAX_CHALLENGE_SCORE = 99_999_999;
const MAX_SEED_LENGTH = 80;
const SEED_REGEX = /^[A-Za-z0-9._:-]+$/;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Encode challenge data into a URL query string */
export function encodeChallengeUrl(seed: string, score: number): string {
  const payload = JSON.stringify({ s: seed, sc: score, v: 1 });
  const encoded = bytesToBase64(new TextEncoder().encode(payload));
  const base = window.location.origin + window.location.pathname;
  return `${base}?c=${encodeURIComponent(encoded)}`;
}

/** Decode challenge data from the current URL, if present */
export function decodeChallengeFromUrl(): ChallengeParams | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('c');
    if (!raw) return null;
    const bytes = base64ToBytes(decodeURIComponent(raw));
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);
    if (typeof data.s !== 'string' || typeof data.sc !== 'number') return null;
    if (data.s.length < 1 || data.s.length > MAX_SEED_LENGTH) return null;
    if (!SEED_REGEX.test(data.s)) return null;
    if (!Number.isFinite(data.sc) || data.sc < 0 || data.sc > MAX_CHALLENGE_SCORE) return null;
    return { seed: data.s, score: data.sc };
  } catch {
    return null;
  }
}

/** Remove challenge params from URL without reload (clean up after reading) */
export function clearChallengeUrl(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('c');
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Ignore if history API unavailable
  }
}

/** Active challenge state — set on load, consumed by scenes */
let activeChallenge: ChallengeParams | null = null;

export function initChallengeFromUrl(): void {
  activeChallenge = decodeChallengeFromUrl();
  if (activeChallenge) {
    clearChallengeUrl();
  }
}

export function getActiveChallenge(): ChallengeParams | null {
  return activeChallenge;
}

export function clearActiveChallenge(): void {
  activeChallenge = null;
}
