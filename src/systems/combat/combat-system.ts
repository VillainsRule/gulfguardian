import { getRun } from '@/core/run-state';
import { getAbilityCooldown } from '@/data/abilities';
import { SCORING, BUDGET_COSTS } from '@/data/scoring';
import { registerVar } from '@/debug/tuning-registry';
import { liveTracking } from '@/debug/StatsRecorder';
import { trackPlayerDamage } from '@/analytics/analytics';

export let GUN_HEAT_PER_SHOT = 0.025;      // ~40 shots to overheat
export let GUN_COOL_RATE = 0.3;             // cools 0.3 per second
export let GUN_OVERHEAT_RECOVERY = 0.3;     // must cool to 30% before firing again

let RAPIDFIRE_ADD_TIME = 3.5;
let RAPIDFIRE_MAX_TIME = 15;
let RAPIDFIRE_COOLDOWN_MULT = 0.5;
let SHIELD_DURATION = 5.0;
let MULTIFIRE_DURATION = 8.0;
let MIRV_DURATION = 12.0;
let FAE_DURATION = 12.0;

registerVar({ key: 'powerups.rapidfireAddTime', label: 'Rapidfire +Sec', category: 'Powerups', min: 1, max: 15, step: 0.5, get: () => RAPIDFIRE_ADD_TIME, set: v => { RAPIDFIRE_ADD_TIME = v; }, default: 3.5 });
registerVar({ key: 'powerups.rapidfireMaxTime', label: 'Rapidfire Max', category: 'Powerups', min: 5, max: 60, step: 1, get: () => RAPIDFIRE_MAX_TIME, set: v => { RAPIDFIRE_MAX_TIME = v; }, default: 15 });
registerVar({ key: 'powerups.rapidfireCooldownMult', label: 'Rapidfire Speed', category: 'Powerups', min: 0.1, max: 1, step: 0.05, get: () => RAPIDFIRE_COOLDOWN_MULT, set: v => { RAPIDFIRE_COOLDOWN_MULT = v; }, default: 0.5 });
registerVar({ key: 'powerups.shieldDuration', label: 'Shield Duration', category: 'Powerups', min: 1, max: 20, step: 0.5, get: () => SHIELD_DURATION, set: v => { SHIELD_DURATION = v; }, default: 5 });
registerVar({ key: 'powerups.multifireDuration', label: 'Multifire Duration', category: 'Powerups', min: 2, max: 30, step: 1, get: () => MULTIFIRE_DURATION, set: v => { MULTIFIRE_DURATION = v; }, default: 8 });
registerVar({ key: 'powerups.mirvDuration', label: 'MIRV Duration', category: 'Powerups', min: 2, max: 30, step: 1, get: () => MIRV_DURATION, set: v => { MIRV_DURATION = v; }, default: 12 });
registerVar({ key: 'powerups.faeDuration', label: 'FAE Duration', category: 'Powerups', min: 2, max: 30, step: 1, get: () => FAE_DURATION, set: v => { FAE_DURATION = v; }, default: 12 });

registerVar({ key: 'combat.gunHeatPerShot', label: 'Gun Heat/Shot', category: 'Weapons', min: 0.005, max: 0.2, step: 0.005, get: () => GUN_HEAT_PER_SHOT, set: v => { GUN_HEAT_PER_SHOT = v; }, default: 0.025 });
registerVar({ key: 'combat.gunCoolRate', label: 'Gun Cool Rate', category: 'Weapons', min: 0.05, max: 2, step: 0.05, get: () => GUN_COOL_RATE, set: v => { GUN_COOL_RATE = v; }, default: 0.3 });
registerVar({ key: 'combat.gunOverheatRecovery', label: 'Overheat Recovery', category: 'Weapons', min: 0.1, max: 0.9, step: 0.05, get: () => GUN_OVERHEAT_RECOVERY, set: v => { GUN_OVERHEAT_RECOVERY = v; }, default: 0.3 });

export class CombatSystem {
  static tryFireGun(): boolean {
    const run = getRun();
    if (run.gunOverheated) return false;
    const heatPerShot = run.rapidFireActive ? GUN_HEAT_PER_SHOT * RAPIDFIRE_COOLDOWN_MULT : GUN_HEAT_PER_SHOT;
    run.gunHeat = Math.min(1.0, run.gunHeat + heatPerShot);
    if (run.gunHeat >= 1.0) {
      run.gunOverheated = true;
    }
    return true;
  }

  static tryFireMissile(): boolean {
    const run = getRun();
    if (run.missileCount <= 0) return false;
    if (run.missionOutcome !== 'active') return false;

    run.missileCount--;
    return true;
  }

  static registerKill(baseScore: number, killX: number, killY: number, playerX: number, playerY: number): number {
    const run = getRun();

    // Combo system
    run.comboCount++;
    run.comboTimer = SCORING.COMBO_WINDOW;
    run.comboMultiplier = Math.min(run.comboCount, SCORING.COMBO_MAX_MULTIPLIER);
    if (run.comboCount > run.bestCombo) run.bestCombo = run.comboCount;

    // Proximity bonus
    const dist = Math.sqrt((killX - playerX) ** 2 + (killY - playerY) ** 2);
    let score = baseScore;
    if (dist < SCORING.PROXIMITY_RANGE) {
      score = Math.floor(score * (1 + SCORING.PROXIMITY_KILL_BONUS));
    }

    // Apply combo multiplier
    score = score * run.comboMultiplier;

    run.score += score;
    run.enemiesDestroyed++;
    return score;
  }

  static updateCooldowns(dt: number): void {
    const run = getRun();

    if (run.playerContactCooldown > 0) {
      run.playerContactCooldown = Math.max(0, run.playerContactCooldown - dt);
    }

    // Gun heat cooldown
    if (run.gunHeat > 0) {
      run.gunHeat = Math.max(0, run.gunHeat - GUN_COOL_RATE * dt);
      if (run.gunOverheated && run.gunHeat <= GUN_OVERHEAT_RECOVERY) {
        run.gunOverheated = false;
      }
    }

    // Rapid fire timer
    if (run.rapidFireActive) {
      run.rapidFireTimer -= dt;
      if (run.rapidFireTimer <= 0) {
        run.rapidFireActive = false;
        run.rapidFireTimer = 0;
      }
    }

    // Shield timer
    if (run.shieldActive) {
      run.shieldTimer -= dt;
      if (run.shieldTimer <= 0) {
        run.shieldActive = false;
        run.shieldTimer = 0;
      }
    }

    // Multifire timer
    if (run.multifireActive) {
      run.multifireTimer -= dt;
      if (run.multifireTimer <= 0) {
        run.multifireActive = false;
        run.multifireTimer = 0;
      }
    }

    // MIRV timer
    if (run.mirvActive) {
      run.mirvTimer -= dt;
      if (run.mirvTimer <= 0) {
        run.mirvActive = false;
        run.mirvTimer = 0;
      }
    }

    // FAE timer
    if (run.faeActive) {
      run.faeTimer -= dt;
      if (run.faeTimer <= 0) {
        run.faeActive = false;
        run.faeTimer = 0;
      }
    }

    // Combo decay
    if (run.comboTimer > 0) {
      run.comboTimer -= dt;
      if (run.comboTimer <= 0) {
        run.comboCount = 0;
        run.comboMultiplier = 1;
      }
    }

    // Missile auto-reload — DISABLED (missiles only from pickups and tanker deliveries)
  }

  static resupplyFromTanker(): void {
    const run = getRun();
    run.missileCount = Math.min(run.maxMissiles, run.missileCount + 3);
  }

  static applyPickup(type: 'missiles' | 'health' | 'rapidfire' | 'score' | 'shield' | 'multifire' | 'mirv' | 'fae'): void {
    const run = getRun();
    switch (type) {
      case 'missiles':
        run.missileCount = Math.min(run.maxMissiles, run.missileCount + 1);
        break;
      case 'health':
        run.playerHP = Math.min(run.playerMaxHP, run.playerHP + 1);
        break;
      case 'rapidfire':
        run.rapidFireActive = true;
        run.rapidFireTimer = Math.min(RAPIDFIRE_MAX_TIME, run.rapidFireTimer + RAPIDFIRE_ADD_TIME);
        break;
      case 'score':
        run.score += SCORING.PICKUP_SCORE_BONUS;
        break;
      case 'shield':
        run.shieldActive = true;
        run.shieldTimer = SHIELD_DURATION;
        break;
      case 'multifire':
        run.multifireActive = true;
        run.multifireTimer = MULTIFIRE_DURATION;
        break;
      case 'mirv':
        run.mirvActive = true;
        run.mirvTimer = MIRV_DURATION;
        break;
      case 'fae':
        run.faeActive = true;
        run.faeTimer = FAE_DURATION;
        break;
    }
  }

  static damagePlayer(amount: number, source?: import('@/analytics/analytics').DamageSource): void {
    const run = getRun();
    if (run.shieldActive) {
      // Shield absorbs the hit — light shake only
      CombatSystem.triggerScreenShake(2, 0.1);
      if (source) trackPlayerDamage(source, amount, true);
      return;
    }
    run.playerHP = Math.max(0, run.playerHP - amount);
    liveTracking.damageTaken += amount;
    if (source) trackPlayerDamage(source, amount, false);
    // Heavy screen shake on taking damage
    CombatSystem.triggerScreenShake(amount * 6, 0.4);
    if (run.playerHP <= 0) {
      run.missionOutcome = 'defeat';
      run.budget += BUDGET_COSTS.PLAYER_DESTROYED;
    }
  }

  static triggerScreenShake(intensity: number, duration: number, sourceX?: number, sourceY?: number): void {
    const run = getRun();
    run.screenShakeTimer = duration;
    run.screenShakeDuration = Math.max(duration, 0.0001);
    run.screenShakeIntensity = Math.min(intensity, 30);
    if (sourceX !== undefined && sourceY !== undefined) {
      run.screenShakeSourceX = sourceX;
      run.screenShakeSourceY = sourceY;
    } else {
      run.screenShakeSourceX = 0;
      run.screenShakeSourceY = 0;
    }
  }

  /** Micro-hitstop: briefly dilate time for visceral impact on big kills */
  static triggerHitStop(duration: number, scale: number): void {
    const run = getRun();
    // Only override if this hitstop is stronger (shorter scale = harder freeze)
    if (run.hitStopTimer <= 0 || scale < run.hitStopScale) {
      run.hitStopTimer = duration;
      run.hitStopScale = scale;
    }
  }

  static getMissileFireCooldown(): number {
    const run = getRun();
    const baseCooldown = getAbilityCooldown('missile').cooldown;
    return run.rapidFireActive ? baseCooldown * RAPIDFIRE_COOLDOWN_MULT : baseCooldown;
  }
}
