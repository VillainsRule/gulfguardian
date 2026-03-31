/**
 * Leaderboard feature flag — controls whether leaderboard UI is shown.
 */

let enabled = true;

export function isLeaderboardEnabled(): boolean {
  return enabled;
}

export function setLeaderboardEnabled(value: boolean): void {
  enabled = value;
}
