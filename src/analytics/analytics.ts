import { VERSION } from '@/app/version';
import { getQuality, isMobileDetected } from '@/app/quality';
import { getRun } from '@/core/run-state';
import { liveTracking } from '@/debug/StatsRecorder';
import { getGameMode, type GameMode } from '@/social/game-mode';

// GA4 gtag global
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

function gtag(...args: any[]): void {
  try {
    window.gtag?.(...args);
  } catch {
    // Silently ignore — ad blockers, CSP, etc.
  }
}

/** Set user properties and fire app_start. Call once at bootstrap. */
export function initAnalytics(): void {
  const quality = getQuality();
  const mobile = isMobileDetected();

  gtag('set', 'user_properties', {
    quality_level: quality.level,
    is_mobile: String(mobile),
    app_version: VERSION,
  });

  gtag('event', 'app_start', {
    version: VERSION,
    quality_level: quality.level,
    is_mobile: mobile,
  });
}

/** Fired when player starts a mission from the briefing screen. */
export function trackMissionStart(mode: GameMode, dailyNumber?: number | null, seed?: string): void {
  gtag('event', 'mission_start', {
    game_mode: mode,
    daily_number: dailyNumber ?? undefined,
    seed: seed?.substring(0, 40),
  });
}

/** Fired when player reaches a new sector (wave 1-5). */
export function trackSectorReached(sector: number): void {
  const run = getRun();
  gtag('event', 'sector_reached', {
    sector,
    mission_time: Math.round(run.missionTime),
    player_hp: run.playerHP,
    score: run.score,
    enemies_destroyed: run.enemiesDestroyed,
  });
}

export type DamageSource = 'missile' | 'mine' | 'fab' | 'fab_contact' | 'gunboat_contact' | 'drone';

/** Fired when player takes damage. */
export function trackPlayerDamage(source: DamageSource, amount: number, shieldBlocked: boolean): void {
  const run = getRun();
  gtag('event', 'player_damage', {
    source,
    amount,
    hp_remaining: run.playerHP,
    sector: run.wave,
    shield_blocked: shieldBlocked,
  });
}

/** Fired when mission outcome is determined (victory or defeat). */
export function trackMissionEnd(defeatReason?: 'player_killed' | 'tankers_lost'): void {
  const run = getRun();
  const gm = getGameMode();

  gtag('event', 'mission_end', {
    outcome: run.missionOutcome,
    defeat_reason: defeatReason,
    score: run.score,
    sector: run.wave,
    mission_time: Math.round(run.missionTime),
    enemies_destroyed: run.enemiesDestroyed,
    tankers_saved: run.tankersSaved,
    tankers_lost: run.tankersLost,
    best_combo: run.bestCombo,
    game_mode: gm.mode,
  });

  // Second event for detailed combat stats (GA4 has 25 param limit per event)
  gtag('event', 'mission_end_detail', {
    outcome: run.missionOutcome,
    shots_fired: liveTracking.shotsFired,
    shots_hit: liveTracking.shotsHit,
    missiles_fired: liveTracking.missilesFired,
    missiles_hit: liveTracking.missilesHit,
    pickups_collected: liveTracking.pickupsCollected,
    damage_dealt: liveTracking.damageDealt,
    damage_taken: liveTracking.damageTaken,
    kills_fab: liveTracking.killBreakdown.fabs,
    kills_cmb: liveTracking.killBreakdown.cmbs,
    kills_gunboat: liveTracking.killBreakdown.gunboats,
    kills_drone: liveTracking.killBreakdown.drones,
    kills_helicopter: liveTracking.killBreakdown.helicopters,
    kills_mine: liveTracking.killBreakdown.mines,
  });
}

/** Fired when a tanker is destroyed. */
export function trackTankerLost(tankersRemaining: number): void {
  const run = getRun();
  gtag('event', 'tanker_lost', {
    tankers_remaining: tankersRemaining,
    sector: run.wave,
    mission_time: Math.round(run.missionTime),
  });
}

/** Fired at kill milestones (10, 25, 50, 75, 100). */
export function trackKillMilestone(kills: number): void {
  const run = getRun();
  gtag('event', 'kill_milestone', {
    kills,
    sector: run.wave,
    mission_time: Math.round(run.missionTime),
  });
}

/** Fired when player takes an action on the debrief screen. */
export function trackDebriefAction(action: 'play_again' | 'main_menu' | 'share' | 'leaderboard' | 'challenge', outcome: string): void {
  gtag('event', 'debrief_action', {
    action,
    outcome,
  });
}
