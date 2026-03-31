/**
 * Daily Challenge — date-based seeded runs for competitive sharing.
 */

/** Get the daily challenge number (days since epoch: 2025-01-01) */
export function getDailyNumber(): number {
  const epoch = new Date('2025-01-01T00:00:00Z').getTime();
  const now = new Date();
  // Use UTC to ensure everyone gets the same daily worldwide
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
  return Math.floor((today - epoch) / 86400000);
}

/** Get the seed string for today's daily challenge */
export function getDailySeed(): string {
  return `daily-${getDailyNumber()}`;
}

/** Check if a seed is a daily challenge seed */
export function isDailySeed(seed: string): boolean {
  return seed.startsWith('daily-');
}

/** Extract the daily number from a daily seed */
export function getDailyNumberFromSeed(seed: string): number | null {
  const match = /^daily-(\d+)$/.exec(seed);
  if (!match) return null;
  const num = Number.parseInt(match[1], 10);
  return Number.isNaN(num) ? null : num;
}

/**
 * Generate Wordle-style emoji summary for a run.
 * Uses emoji blocks to represent performance visually.
 */
export function generateDailyEmoji(
  tankersSaved: number,
  totalTankers: number,
  sectorsCleared: number,
  bestCombo: number,
  isVictory: boolean
): string {
  const safeTankers = Math.max(0, Math.min(12, Math.floor(totalTankers)));
  const safeSaved = Math.max(0, Math.min(safeTankers, Math.floor(tankersSaved)));
  const safeSectors = Math.max(0, Math.min(5, Math.floor(sectorsCleared)));
  const parts: string[] = [];

  // Tanker status: green = saved, red = lost
  for (let i = 0; i < safeTankers; i++) {
    parts.push(i < safeSaved ? '🟩' : '🟥');
  }

  parts.push(' ');

  // Sectors: green = cleared, black = not reached
  for (let i = 0; i < 5; i++) {
    parts.push(i < safeSectors ? '🟩' : '⬛');
  }

  // Combo indicator
  if (bestCombo >= 20) parts.push(' 💀');
  else if (bestCombo >= 10) parts.push(' 🔥');
  else if (bestCombo >= 5) parts.push(' ⚡');

  // Victory/defeat
  parts.push(isVictory ? ' ✓' : ' ✗');

  return parts.join('');
}

/**
 * Check if player has already completed today's daily (via localStorage).
 */
export function hasDailyBeenPlayed(): boolean {
  try {
    const stored = localStorage.getItem('gg-daily-last');
    return stored === String(getDailyNumber());
  } catch {
    return false;
  }
}

/** Mark today's daily as completed */
export function markDailyPlayed(): void {
  try {
    localStorage.setItem('gg-daily-last', String(getDailyNumber()));
  } catch {
    // localStorage unavailable
  }
}

/** Save daily high score */
export function saveDailyScore(score: number): void {
  try {
    const key = `gg-daily-score-${getDailyNumber()}`;
    const existing = localStorage.getItem(key);
    const existingScore = existing !== null ? parseInt(existing, 10) : null;
    if (existingScore === null || Number.isNaN(existingScore) || score > existingScore) {
      localStorage.setItem(key, String(score));
    }
  } catch {
    // localStorage unavailable
  }
}

/** Get daily high score for today */
export function getDailyHighScore(): number | null {
  try {
    const key = `gg-daily-score-${getDailyNumber()}`;
    const val = localStorage.getItem(key);
    if (!val) return null;
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}
