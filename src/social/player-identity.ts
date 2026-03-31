/**
 * Player identity — callsign generation, customization, and country flag utilities.
 */

export const PREFIXES = [
  'GHOST', 'IRON', 'SHADOW', 'STORM', 'STEEL',
  'COBRA', 'VIPER', 'HAWK', 'WOLF', 'EAGLE',
  'THUNDER', 'SILENT', 'DARK', 'SWIFT', 'CRIMSON',
  'ALPHA', 'BRAVO', 'DELTA', 'OMEGA', 'TITAN',
  'ROGUE', 'REAPER', 'FROST', 'SAVAGE', 'NOBLE',
  'PHANTOM', 'STRIKE', 'RAPID', 'APEX', 'NIGHT',
  'ATOMIC', 'EMBER', 'POLAR', 'SIERRA', 'ECHO',
  'RAZOR', 'ONYX', 'SPECTRE', 'WARDOG', 'LANCE',
];

export const SUFFIXES = [
  'AEGIS', 'BLADE', 'FALCON', 'SENTINEL', 'PHOENIX',
  'GUARDIAN', 'RAPTOR', 'HAMMER', 'SHIELD', 'ARROW',
  'SABRE', 'TALON', 'FURY', 'WARDEN', 'DAGGER',
  'HYDRA', 'CONDOR', 'PATRIOT', 'JAVELIN', 'TRIDENT',
  'BASTION', 'CORSAIR', 'NOMAD', 'VALKYRIE', 'TYPHOON',
  'ARSENAL', 'MANTIS', 'BULWARK', 'TEMPEST', 'PROWLER',
  'CENTURION', 'GARRISON', 'OUTPOST', 'RAMPART', 'CITADEL',
  'SPARTAN', 'HORNET', 'MUSKET', 'BRIGADE', 'VANGUARD',
];

const CALLSIGN_KEY = 'gulfguardian_callsign';
const CLAIM_TOKEN_KEY = 'gulfguardian_claim_token';
const ALPHA2_REGEX = /^[A-Za-z]{2}$/;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in restricted contexts.
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors in restricted contexts.
  }
}

export function getCallsign(): string {
  let callsign = safeGetItem(CALLSIGN_KEY);
  if (!callsign) {
    const adj = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
    const noun = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    const num = Math.floor(Math.random() * 100);
    callsign = `${adj}-${noun}-${num.toString().padStart(2, '0')}`;
    safeSetItem(CALLSIGN_KEY, callsign);
  }
  return callsign;
}

export function setCallsign(callsign: string, claimToken: string): void {
  safeSetItem(CALLSIGN_KEY, callsign);
  safeSetItem(CLAIM_TOKEN_KEY, claimToken);
}

export function getClaimToken(): string | null {
  return safeGetItem(CLAIM_TOKEN_KEY);
}

export function hasClaimedCallsign(): boolean {
  return !!(safeGetItem(CALLSIGN_KEY) && safeGetItem(CLAIM_TOKEN_KEY));
}

export function clearCallsign(): void {
  safeRemoveItem(CALLSIGN_KEY);
  safeRemoveItem(CLAIM_TOKEN_KEY);
}

export function generateClaimToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert a 2-letter country code to a flag emoji.
 */
export function countryToFlag(code: string): string {
  const upper = code.toUpperCase();
  if (!ALPHA2_REGEX.test(upper)) return '';
  const offset = 0x1F1E6 - 65; // 'A' = 65
  return String.fromCodePoint(upper.charCodeAt(0) + offset, upper.charCodeAt(1) + offset);
}
