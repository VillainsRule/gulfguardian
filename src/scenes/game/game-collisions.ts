import { getRun, WORLD_WIDTH } from '@/core/run-state';
import { getQuality } from '@/app/quality';
import { playSfx } from '@/audio/sfx';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/app/constants';
import { CombatSystem } from '@/systems/combat/combat-system';
import { SCORING, BUDGET_COSTS } from '@/data/scoring';
import { GameEntities, GameLayers } from './game-types';
import { spawnExplosion, spawnFlash, spawnImpactSpark, spawnShockwave, spawnEmbers, tryDropPickup, spawnPickupAt, spawnFloatingScore, spawnSecondaryExplosions, spawnWaterRipple, spawnDeathSequence, spawnSplashdown } from './game-effects';
import { SeededRNG } from '@/core/rng';
import { Tanker } from '@/entities/tankers/Tanker';
import { computeSmoothedRoute, RoutePoint } from '@/entities/tankers/tanker-routes';
import { spawnMirvSubmissiles } from './game-combat';
import { clampToChannel } from './map-renderer';
import { liveTracking, KillBreakdown } from '@/debug/StatsRecorder';
import { trackTankerLost } from '@/analytics/analytics';

// ── Re-usable scratch arrays for viewport-filtered entity lists (avoids per-frame allocation) ──
// These are module-level to prevent GC churn; contents are rebuilt each frame.
const _visibleBullets: any[] = [];
const _visibleFabs: any[] = [];
const _visibleMines: any[] = [];
const _visibleMissiles: any[] = [];

/** Build a filtered list of alive entities within X bounds into a pre-allocated scratch array */
function fillVisible<T extends { alive: boolean; x: number }>(
  src: T[], dst: T[], left: number, right: number,
): number {
  let count = 0;
  for (let i = 0; i < src.length; i++) {
    const e = src[i];
    if (e.alive && e.x >= left && e.x <= right) {
      dst[count++] = e;
    }
  }
  // Truncate the scratch array
  dst.length = count;
  return count;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

/** Squared distance — avoids sqrt for radius comparisons */
function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2, dy = y1 - y2;
  return dx * dx + dy * dy;
}

/** Check bullet hits against an enemy list. Returns true if bullet was consumed. */
function checkBulletVsEnemies<T extends { alive: boolean; x: number; y: number; scoreValue: number; takeDamage(d: number): void }>(
  bullet: { alive: boolean; x: number; y: number; damage: number },
  enemies: T[],
  hitRadiusSq: number,
  configKey: string,
  px: number, py: number,
  entities: GameEntities, layers: GameLayers, rng: SeededRNG,
  bulletAngle: number,
  skipCloaked?: boolean,
  useFlashInsteadOfSpark?: boolean,
): boolean {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (skipCloaked && 'cloaked' in enemy && (enemy as any).cloaked) continue;
    if (distSq(bullet.x, bullet.y, enemy.x, enemy.y) >= hitRadiusSq) continue;
    (enemy as any).takeDamage(bullet.damage);
    bullet.alive = false;
    liveTracking.shotsHit++;
    liveTracking.damageDealt += bullet.damage;
    if (!enemy.alive) handleEnemyKill(enemy, px, py, KILL_CONFIGS[configKey], entities, layers, rng, configKey);
    const quality = getQuality();
    if (quality.renderSkipCosmetic > 0) {
    } else if (useFlashInsteadOfSpark) spawnFlash(bullet.x, bullet.y, entities, layers);
    else spawnImpactSpark(bullet.x, bullet.y, bulletAngle, entities, layers);
    return true;
  }
  return false;
}

/** Apply area damage (missile blast or FAE) to an enemy list */
function applyAreaDamage<T extends { alive: boolean; x: number; y: number; scoreValue: number; takeDamage(d: number): void }>(
  enemies: T[],
  hitX: number, hitY: number,
  directRadiusSq: number, directDamage: number,
  blastR: number, blastRadiusSq: number,
  configKey: string,
  px: number, py: number,
  entities: GameEntities, layers: GameLayers, rng: SeededRNG,
  skipCloaked?: boolean,
): void {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (skipCloaked && 'cloaked' in enemy && (enemy as any).cloaked) continue;
    const d = distSq(hitX, hitY, enemy.x, enemy.y);
    if (d < directRadiusSq) { enemy.takeDamage(directDamage); liveTracking.damageDealt += directDamage; }
    else if (blastR > 0 && d < blastRadiusSq) { enemy.takeDamage(1); liveTracking.damageDealt += 1; }
    else continue;
    if (!enemy.alive) handleEnemyKill(enemy, px, py, KILL_CONFIGS[configKey], entities, layers, rng, configKey);
  }
}

// Pickup label/color maps (module-level to avoid per-frame allocation)
const PICKUP_LABEL_COLORS: Record<string, string> = {
  missiles: '#ffaa00', health: '#00ff41', rapidfire: '#00e5ff',
  score: '#ffff00', bomb: '#ff3333', shield: '#8888ff',
  tanker_repair: '#00ff41', bonus_tanker: '#ffff00',
  multifire: '#ff44ff', mirv: '#44ffff', fae: '#ff6600',
};
const PICKUP_LABELS: Record<string, string> = {
  missiles: 'MSL +1', health: 'HP +1', rapidfire: 'RAPID FIRE!',
  score: '+500 PTS', bomb: 'BOMB!', shield: 'SHIELD!',
  tanker_repair: 'TANKER REPAIRED', bonus_tanker: '+1 TANKER',
  multifire: 'MULTIFIRE!', mirv: 'MIRV!', fae: 'FUEL-AIR!',
};

const CHAIN_EXPLOSION_RADIUS = 80;
const PLAYER_CONTACT_COOLDOWN = 0.4;
const ENEMY_CONTACT_COOLDOWN = 0.45;

// ── Kill effect configs by enemy type ──

type DeathSize = 'small' | 'medium' | 'large';

interface KillConfig {
  deathSize: DeathSize;
  deathColor: number;
  scoreColor: string;
  shakeIntensity: number;
  shakeDuration: number;
  sfx: string;
  shockwaveRadius?: number;
  emberCount?: number;
  emberRadius?: number;
  rippleSize?: number;
  splash?: boolean;
  guaranteedPickup?: boolean;
  hitStopDuration?: number;
  hitStopScale?: number;
}

const KILL_CONFIGS: Record<string, KillConfig> = {
  fab: { deathSize: 'small', deathColor: COLORS.red, scoreColor: '#ff3333', shakeIntensity: 10, shakeDuration: 0.35, sfx: 'enemyExplode', shockwaveRadius: 100, emberCount: 6, emberRadius: 20, rippleSize: 40, splash: true },
  cmb: { deathSize: 'medium', deathColor: COLORS.red, scoreColor: '#ffaa00', shakeIntensity: 16, shakeDuration: 0.6, sfx: 'bigExplode', shockwaveRadius: 150, emberCount: 10, emberRadius: 35, hitStopDuration: 0.035, hitStopScale: 0.2 },
  gunboat: { deathSize: 'large', deathColor: COLORS.red, scoreColor: '#ffaa00', shakeIntensity: 25, shakeDuration: 0.85, sfx: 'bigExplode', shockwaveRadius: 240, emberCount: 18, emberRadius: 55, rippleSize: 70, splash: true, guaranteedPickup: true, hitStopDuration: 0.045, hitStopScale: 0.15 },
  drone: { deathSize: 'small', deathColor: COLORS.amber, scoreColor: '#ffaa00', shakeIntensity: 8, shakeDuration: 0.3, sfx: 'enemyExplode', emberCount: 5, emberRadius: 18 },
  helicopter: { deathSize: 'medium', deathColor: COLORS.red, scoreColor: '#ff3333', shakeIntensity: 14, shakeDuration: 0.5, sfx: 'heliDeath', shockwaveRadius: 130, emberCount: 10, emberRadius: 30, hitStopDuration: 0.03, hitStopScale: 0.25 },
  mine: { deathSize: 'small', deathColor: COLORS.amber, scoreColor: '#ffaa00', shakeIntensity: 10, shakeDuration: 0.35, sfx: 'mineExplode', emberCount: 14, emberRadius: 35, rippleSize: 50, splash: true },
};

function trackKillByConfig(configKey: string): void {
  if (configKey in liveTracking.killBreakdown) {
    liveTracking.killBreakdown[configKey as keyof KillBreakdown]++;
  }
}

function handleEnemyKill(
  enemy: { x: number; y: number; scoreValue: number },
  playerX: number, playerY: number,
  config: KillConfig,
  entities: GameEntities, layers: GameLayers, rng: SeededRNG,
  configKey?: string,
): void {
  const run = getRun();
  const quality = getQuality();
  if (configKey) trackKillByConfig(configKey);
  const score = CombatSystem.registerKill(enemy.scoreValue, enemy.x, enemy.y, playerX, playerY);
  spawnDeathSequence(enemy.x, enemy.y, config.deathSize, config.deathColor, entities, layers);
  if (config.shockwaveRadius && !quality.skipKillShockwave) spawnShockwave(enemy.x, enemy.y, entities, layers, config.shockwaveRadius);
  spawnEmbers(enemy.x, enemy.y, entities, layers, config.emberCount, config.emberRadius);
  spawnFloatingScore(enemy.x, enemy.y, score, entities, layers, config.scoreColor, run.comboMultiplier > 1);
  if (config.rippleSize && !quality.skipKillRipple) spawnWaterRipple(enemy.x, enemy.y, entities, layers, config.rippleSize);
  if (config.splash && !quality.skipKillSplash) spawnSplashdown(enemy.x, enemy.y, entities, layers);
  CombatSystem.triggerScreenShake(config.shakeIntensity, config.shakeDuration, enemy.x, enemy.y);
  if (config.hitStopDuration) CombatSystem.triggerHitStop(config.hitStopDuration, config.hitStopScale!);
  if (config.guaranteedPickup) {
    spawnPickupAt(enemy.x, enemy.y, entities, layers, rng);
  } else {
    tryDropPickup(enemy.x, enemy.y, entities, layers, rng);
  }
  triggerChainExplosions(enemy.x, enemy.y, entities, layers, rng, playerX, playerY);
  playSfx(config.sfx as any);
}

function handleMineKill(
  mine: { x: number; y: number; scoreValue: number },
  playerX: number, playerY: number,
  entities: GameEntities, layers: GameLayers, rng: SeededRNG,
): void {
  liveTracking.killBreakdown.mines++;
  const score = CombatSystem.registerKill(mine.scoreValue, mine.x, mine.y, playerX, playerY);
  spawnExplosion(mine.x, mine.y, 65, 0.6, COLORS.amber, entities, layers);
  spawnEmbers(mine.x, mine.y, entities, layers, 8, 25);
  spawnFloatingScore(mine.x, mine.y, score, entities, layers, '#ffaa00');
  spawnWaterRipple(mine.x, mine.y, entities, layers, 45);
  spawnSplashdown(mine.x, mine.y, entities, layers);
  CombatSystem.triggerScreenShake(7, 0.25, mine.x, mine.y);
  triggerChainExplosions(mine.x, mine.y, entities, layers, rng, playerX, playerY);
  playSfx('mineExplode');
}

function handleTankerDestroyed(tanker: Tanker, entities: GameEntities, layers: GameLayers): void {
  if (tanker.lossProcessed) return;
  const run = getRun();
  tanker.lossProcessed = true;
  run.oilFlow = Math.max(0, run.oilFlow - SCORING.TANKER_LOST_PENALTY);
  run.tankersLost++;
  trackTankerLost(entities.tankers.filter(t => t.alive && t !== tanker).length);
  run.budget += BUDGET_COSTS.TANKER_LOST;
  run.oilPrice += 15;
  spawnSecondaryExplosions(tanker.x, tanker.y, 5, 40, COLORS.red, entities, layers);
  spawnWaterRipple(tanker.x, tanker.y, entities, layers, 50);
}

function triggerChainExplosions(
  x: number, y: number,
  entities: GameEntities, layers: GameLayers, rng: SeededRNG,
  playerX: number, playerY: number,
): void {
  const run = getRun();
  const chainRadiusSq = CHAIN_EXPLOSION_RADIUS * CHAIN_EXPLOSION_RADIUS;
  for (const mine of entities.mines) {
    if (!mine.alive) continue;
    if (distSq(x, y, mine.x, mine.y) < chainRadiusSq) {
      mine.detonate();
      const score = CombatSystem.registerKill(mine.scoreValue, mine.x, mine.y, playerX, playerY);
      spawnExplosion(mine.x, mine.y, 65, 0.6, COLORS.amber, entities, layers);
      spawnFloatingScore(mine.x, mine.y, score, entities, layers, '#ffaa00');
      spawnWaterRipple(mine.x, mine.y, entities, layers, 45);
      spawnSplashdown(mine.x, mine.y, entities, layers);
      CombatSystem.triggerScreenShake(7, 0.25);
    }
  }
}

/** Handle MIRV sub-missile spawning and FAE area explosion on player missile impact */
function handleMissileImpactPowerups(
  impactX: number, impactY: number,
  missile: { canTriggerImpactPowerups: boolean },
  entities: GameEntities, layers: GameLayers, rng: SeededRNG,
  px: number, py: number,
): void {
  const run = getRun();

  if (!missile.canTriggerImpactPowerups) return;

  if (run.mirvActive) {
    spawnMirvSubmissiles(impactX, impactY, entities, layers, rng);
  }

  if (run.faeActive) {
    // Fuel-Air Explosive: large area damage on missile impact
    const FAE_RADIUS = 200;
    const FAE_DAMAGE = 1;

    spawnExplosion(impactX, impactY, 100, 0.7, 0xff6600, entities, layers);
    spawnSecondaryExplosions(impactX, impactY, 5, 60, COLORS.red, entities, layers);
    spawnShockwave(impactX, impactY, entities, layers, FAE_RADIUS, 0xff6600);
    spawnEmbers(impactX, impactY, entities, layers, 10, 50);
    CombatSystem.triggerScreenShake(15, 0.5, impactX, impactY);

    // Damage all enemies in radius
    const faeRadiusSq = FAE_RADIUS * FAE_RADIUS;
    applyAreaDamage(entities.fabs, impactX, impactY, faeRadiusSq, FAE_DAMAGE, 0, 0, 'fab', px, py, entities, layers, rng);
    applyAreaDamage(entities.cmbs, impactX, impactY, faeRadiusSq, FAE_DAMAGE, 0, 0, 'cmb', px, py, entities, layers, rng, true);
    applyAreaDamage(entities.gunboats, impactX, impactY, faeRadiusSq, FAE_DAMAGE, 0, 0, 'gunboat', px, py, entities, layers, rng);
    applyAreaDamage(entities.drones, impactX, impactY, faeRadiusSq, FAE_DAMAGE, 0, 0, 'drone', px, py, entities, layers, rng);
    applyAreaDamage(entities.helicopters, impactX, impactY, faeRadiusSq, FAE_DAMAGE, 0, 0, 'helicopter', px, py, entities, layers, rng);
    for (const mine of entities.mines) {
      if (!mine.alive || distSq(impactX, impactY, mine.x, mine.y) >= faeRadiusSq) continue;
      mine.detonate();
      handleMineKill(mine, px, py, entities, layers, rng);
    }
  }
}

export function checkCollisions(entities: GameEntities, layers: GameLayers, rng: SeededRNG, cameraX: number = 0): void {
  const run = getRun();
  const { playerShip, fabs, cmbs, gunboats, drones, helicopters, mines, missiles, bullets, tankers } = entities;
  const px = playerShip.x, py = playerShip.y;

  // Camera-based X culling bounds (400px margin for fast-moving entities)
  const cullLeft = cameraX - 400;
  const cullRight = cameraX + GAME_WIDTH + 400;

  // Pre-filter bullets to only alive player bullets in viewport (avoids repeated checks in inner loops)
  fillVisible(bullets as any[], _visibleBullets, cullLeft, cullRight);

  // Player bullets vs enemies
  for (let bi = 0; bi < _visibleBullets.length; bi++) {
    const bullet = _visibleBullets[bi];
    if (!bullet.alive || !bullet.isPlayerBullet) continue;
    const bulletAngle = Math.atan2(bullet.vy, bullet.vx);

    if (checkBulletVsEnemies(bullet, fabs, 18 * 18, 'fab', px, py, entities, layers, rng, bulletAngle)) continue;
    if (checkBulletVsEnemies(bullet, cmbs, 18 * 18, 'cmb', px, py, entities, layers, rng, bulletAngle, true)) continue;
    if (checkBulletVsEnemies(bullet, gunboats, 20 * 20, 'gunboat', px, py, entities, layers, rng, bulletAngle)) continue;

    // Mines need special handling (detonate instead of takeDamage)
    let hitMine = false;
    for (const mine of mines) {
      if (!mine.alive || distSq(bullet.x, bullet.y, mine.x, mine.y) >= 15 * 15) continue;
      mine.detonate();
      bullet.alive = false;
      handleMineKill(mine, px, py, entities, layers, rng);
      hitMine = true;
      break;
    }
    if (hitMine) continue;

    if (checkBulletVsEnemies(bullet, drones, 16 * 16, 'drone', px, py, entities, layers, rng, bulletAngle, false, true)) continue;
    checkBulletVsEnemies(bullet, helicopters, 16 * 16, 'helicopter', px, py, entities, layers, rng, bulletAngle);
  }

  // Player bullets vs enemy missiles
  for (let bi = 0; bi < _visibleBullets.length; bi++) {
    const bullet = _visibleBullets[bi];
    if (!bullet.alive || !bullet.isPlayerBullet) continue;
    for (const missile of missiles) {
      if (!missile.alive || missile.isPlayerMissile) continue;
      if (distSq(bullet.x, bullet.y, missile.x, missile.y) < 14 * 14) {
        missile.alive = false;
        bullet.alive = false;
        spawnExplosion(missile.x, missile.y, 28, 0.3, COLORS.amber, entities, layers);
        CombatSystem.triggerScreenShake(3, 0.1);
        break;
      }
    }
  }

  // Player missiles vs enemies
  for (const missile of missiles) {
    if (!missile.alive || !missile.isPlayerMissile) continue;

    // Detect direct hit on any enemy using squared distances
    const mx = missile.x, my = missile.y;
    const hitChecks: Array<{ list: any[]; radiusSq: number; skipCloaked?: boolean }> = [
      { list: fabs, radiusSq: 20 * 20 },
      { list: cmbs, radiusSq: 20 * 20, skipCloaked: true },
      { list: gunboats, radiusSq: 22 * 22 },
      { list: mines, radiusSq: 15 * 15 },
      { list: drones, radiusSq: 18 * 18 },
      { list: helicopters, radiusSq: 18 * 18 },
    ];
    let directHit = false;
    for (const { list, radiusSq, skipCloaked } of hitChecks) {
      for (const enemy of list) {
        if (!enemy.alive) continue;
        if (skipCloaked && 'cloaked' in enemy && enemy.cloaked) continue;
        if (distSq(mx, my, enemy.x, enemy.y) < radiusSq) {
          directHit = true;
          break;
        }
      }
      if (directHit) break;
    }

    if (!directHit) continue;

    // Missile detonates at impact point
    missile.alive = false;
    liveTracking.missilesHit++;
    const hitX = mx, hitY = my;
    const blastR = missile.blastRadius;
    const blastRadiusSq = blastR * blastR;

    // Apply direct damage + blast radius damage to all enemies in range
    applyAreaDamage(fabs, hitX, hitY, 20 * 20, missile.damage, blastR, blastRadiusSq, 'fab', px, py, entities, layers, rng);
    applyAreaDamage(cmbs, hitX, hitY, 20 * 20, missile.damage, blastR, blastRadiusSq, 'cmb', px, py, entities, layers, rng, true);
    applyAreaDamage(gunboats, hitX, hitY, 22 * 22, missile.damage, blastR, blastRadiusSq, 'gunboat', px, py, entities, layers, rng);
    // Mines use detonate instead of takeDamage
    for (const mine of mines) {
      if (!mine.alive) continue;
      const d = distSq(hitX, hitY, mine.x, mine.y);
      if (d < 15 * 15 || (blastR > 0 && d < blastRadiusSq)) {
        mine.detonate();
        handleMineKill(mine, px, py, entities, layers, rng);
      }
    }
    applyAreaDamage(drones, hitX, hitY, 18 * 18, missile.damage, blastR, blastRadiusSq, 'drone', px, py, entities, layers, rng);
    applyAreaDamage(helicopters, hitX, hitY, 18 * 18, missile.damage, blastR, blastRadiusSq, 'helicopter', px, py, entities, layers, rng);

    // Visual effects at impact
    spawnFlash(hitX, hitY, entities, layers);
    if (blastR > 0) {
      spawnExplosion(hitX, hitY, blastR * 0.8, 0.4, COLORS.amber, entities, layers);
      spawnShockwave(hitX, hitY, entities, layers, blastR);
    }
    handleMissileImpactPowerups(hitX, hitY, missile, entities, layers, rng, px, py);
  }

  // Enemy missiles vs player
  for (const missile of missiles) {
    if (!missile.alive || missile.isPlayerMissile) continue;
    if (distSq(missile.x, missile.y, px, py) < 18 * 18) {
      missile.alive = false;
      CombatSystem.damagePlayer(missile.damage, 'missile');
      spawnExplosion(px, py, 35, 0.4, COLORS.cyan, entities, layers);
      spawnWaterRipple(px, py, entities, layers, 40);
    }
  }

  // Enemy missiles vs tankers
  for (const missile of missiles) {
    if (!missile.alive || missile.isPlayerMissile) continue;
    for (const tanker of tankers) {
      if (!tanker.alive || tanker.completed) continue;
      if (distSq(missile.x, missile.y, tanker.x, tanker.y) < 20 * 20) {
        missile.alive = false;
        tanker.takeDamage(missile.damage);
        run.oilPrice += missile.damage * 3;
        if (!tanker.alive) {
          handleTankerDestroyed(tanker, entities, layers);
          spawnExplosion(tanker.x, tanker.y, 70, 0.8, COLORS.amber, entities, layers);
          spawnSecondaryExplosions(tanker.x, tanker.y, 6, 45, COLORS.red, entities, layers);
          spawnWaterRipple(tanker.x, tanker.y, entities, layers, 55);
          CombatSystem.triggerScreenShake(14, 0.5);
        }
        break;
      }
    }
  }

  // Mines vs player
  for (const mine of mines) {
    if (!mine.alive) continue;
    if (distSq(mine.x, mine.y, px, py) < mine.triggerRadius * mine.triggerRadius) {
      mine.detonate();
      CombatSystem.damagePlayer(mine.damage, 'mine');
      spawnExplosion(mine.x, mine.y, 65, 0.7, COLORS.amber, entities, layers);
      spawnWaterRipple(mine.x, mine.y, entities, layers, 50);
      triggerChainExplosions(mine.x, mine.y, entities, layers, rng, px, py);
      playSfx('mineExplode');
      continue;
    }

    // Mines vs tankers
    for (const tanker of tankers) {
      if (!tanker.alive || tanker.completed) continue;
      if (distSq(mine.x, mine.y, tanker.x, tanker.y) < mine.triggerRadius * mine.triggerRadius) {
        mine.detonate();
        tanker.takeDamage(mine.damage);
        run.oilPrice += mine.damage * 3;
        if (!tanker.alive) handleTankerDestroyed(tanker, entities, layers);
        spawnExplosion(mine.x, mine.y, 65, 0.7, COLORS.amber, entities, layers);
        spawnWaterRipple(mine.x, mine.y, entities, layers, 50);
        triggerChainExplosions(mine.x, mine.y, entities, layers, rng, px, py);
        break;
      }
    }
  }

  // FAB melee damage to player
  for (const fab of fabs) {
    if (!fab.alive) continue;
    if (distSq(fab.x, fab.y, px, py) < fab.attackRange * fab.attackRange && fab.attackTimer <= 0 && fab.targetTanker === null) {
      CombatSystem.damagePlayer(fab.damage, 'fab');
      fab.attackTimer = fab.attackCooldown;
      spawnFlash(px, py, entities, layers, COLORS.red);
    }
  }

  // Player vs FABs — contact collision
  for (const fab of fabs) {
    if (!fab.alive || distSq(px, py, fab.x, fab.y) >= 22 * 22) continue;
    if (run.playerContactCooldown > 0 || fab.contactCooldownTimer > 0) continue;
    fab.takeDamage(2);
    CombatSystem.damagePlayer(1, 'fab_contact');
    run.playerContactCooldown = PLAYER_CONTACT_COOLDOWN;
    fab.contactCooldownTimer = ENEMY_CONTACT_COOLDOWN;
    spawnExplosion(fab.x, fab.y, 40, 0.45, COLORS.red, entities, layers);
    spawnFlash(px, py, entities, layers, COLORS.red);
    CombatSystem.triggerScreenShake(8, 0.25);
    if (!fab.alive) handleEnemyKill(fab, px, py, KILL_CONFIGS.fab, entities, layers, rng);
  }

  // Player vs Gunboats — contact collision
  for (const gb of gunboats) {
    if (!gb.alive || distSq(px, py, gb.x, gb.y) >= 28 * 28) continue;
    if (run.playerContactCooldown > 0 || gb.contactCooldownTimer > 0) continue;
    gb.takeDamage(2);
    CombatSystem.damagePlayer(2, 'gunboat_contact');
    run.playerContactCooldown = PLAYER_CONTACT_COOLDOWN;
    gb.contactCooldownTimer = ENEMY_CONTACT_COOLDOWN;
    spawnExplosion(gb.x, gb.y, 55, 0.6, COLORS.red, entities, layers);
    spawnFlash(px, py, entities, layers, COLORS.red);
    CombatSystem.triggerScreenShake(16, 0.5);
    if (!gb.alive) handleEnemyKill(gb, px, py, KILL_CONFIGS.gunboat, entities, layers, rng);
  }

  // Player vs Drones — kamikaze contact
  for (const drone of drones) {
    if (!drone.alive || distSq(px, py, drone.x, drone.y) >= 20 * 20) continue;
    CombatSystem.damagePlayer(drone.damage, 'drone');
    drone.alive = false;
    drone.visible = false;
    handleEnemyKill(drone, px, py, KILL_CONFIGS.drone, entities, layers, rng);
    spawnFlash(px, py, entities, layers, COLORS.red);
  }

  // Drones vs Tankers — kamikaze contact
  for (const tanker of tankers) {
    if (!tanker.alive || tanker.completed) continue;
    for (const drone of drones) {
      if (!drone.alive || distSq(tanker.x, tanker.y, drone.x, drone.y) >= 20 * 20) continue;
      tanker.takeDamage(drone.damage);
      run.oilPrice += drone.damage * 3;
      drone.alive = false;
      drone.visible = false;
      spawnExplosion(drone.x, drone.y, 35, 0.4, COLORS.amber, entities, layers);
      CombatSystem.triggerScreenShake(6, 0.25);
      if (!tanker.alive) handleTankerDestroyed(tanker, entities, layers);
    }
  }

  // Tankers vs FABs — contact collision
  for (const tanker of tankers) {
    if (!tanker.alive || tanker.completed) continue;
    for (const fab of fabs) {
      if (!fab.alive || distSq(tanker.x, tanker.y, fab.x, fab.y) >= 22 * 22) continue;
      if (tanker.contactCooldownTimer > 0 || fab.contactCooldownTimer > 0) continue;
      fab.takeDamage(1);
      tanker.takeDamage(1);
      tanker.contactCooldownTimer = ENEMY_CONTACT_COOLDOWN;
      fab.contactCooldownTimer = ENEMY_CONTACT_COOLDOWN;
      run.oilPrice += 3;
      spawnExplosion(fab.x, fab.y, 35, 0.4, COLORS.amber, entities, layers);
      CombatSystem.triggerScreenShake(5, 0.2);
      if (!tanker.alive) handleTankerDestroyed(tanker, entities, layers);
      if (!fab.alive) {
        spawnDeathSequence(fab.x, fab.y, 'small', COLORS.red, entities, layers);
      }
    }
  }

  // Tankers vs Gunboats — contact collision
  for (const tanker of tankers) {
    if (!tanker.alive || tanker.completed) continue;
    for (const gb of gunboats) {
      if (!gb.alive || distSq(tanker.x, tanker.y, gb.x, gb.y) >= 30 * 30) continue;
      if (tanker.contactCooldownTimer > 0 || gb.contactCooldownTimer > 0) continue;
      gb.takeDamage(2);
      tanker.takeDamage(2);
      tanker.contactCooldownTimer = ENEMY_CONTACT_COOLDOWN;
      gb.contactCooldownTimer = ENEMY_CONTACT_COOLDOWN;
      run.oilPrice += 6;
      spawnExplosion(gb.x, gb.y, 60, 0.7, COLORS.amber, entities, layers);
      CombatSystem.triggerScreenShake(14, 0.45);
      if (!tanker.alive) handleTankerDestroyed(tanker, entities, layers);
      if (!gb.alive) {
        spawnDeathSequence(gb.x, gb.y, 'large', COLORS.red, entities, layers);
      }
    }
  }
}

export function checkPickups(entities: GameEntities, layers: GameLayers, rng: SeededRNG): void {
  const run = getRun();
  const { playerShip, pickups } = entities;

  for (const pickup of pickups) {
    if (!pickup.alive) continue;
    if (distSq(pickup.x, pickup.y, playerShip.x, playerShip.y) >= pickup.collectRadius * pickup.collectRadius) continue;
    pickup.alive = false;
    liveTracking.pickupsCollected++;
    playSfx('pickup');

    if (pickup.pickupType === 'bomb') {
      detonateBomb(playerShip.x, playerShip.y, entities, layers, rng);
    } else if (pickup.pickupType === 'tanker_repair') {
      let mostDamaged: Tanker | null = null;
      let worstHp = Infinity;
      for (const tanker of entities.tankers) {
        if (!tanker.alive || tanker.completed) continue;
        if (tanker.hp < tanker.maxHp && tanker.hp < worstHp) {
          worstHp = tanker.hp;
          mostDamaged = tanker;
        }
      }
      if (mostDamaged) {
        const healed = mostDamaged.heal(2);
        run.oilPrice = Math.max(50, run.oilPrice - healed * 5);
      }
      spawnFlash(pickup.x, pickup.y, entities, layers, COLORS.phosphorGreen);
    } else if (pickup.pickupType === 'bonus_tanker') {
      const spawnX = run.cameraX + 100;
      const start = clampToChannel(spawnX, GAME_HEIGHT / 2 + (rng.next() - 0.5) * 200);
      const route: RoutePoint[] = [];
      const routePoints = 7;
      let baseY = start.y;
      for (let i = 0; i < routePoints; i++) {
        const t = i / (routePoints - 1);
        const x = spawnX + (WORLD_WIDTH - 100 - spawnX) * t;
        const drift = (rng.next() - 0.5) * (i === 0 || i === routePoints - 1 ? 40 : 120);
        const point = clampToChannel(x, baseY + drift);
        route.push(point);
        baseY = point.y;
      }
      const smoothed = computeSmoothedRoute(route);
      const bonusTanker = new Tanker(`BONUS-${run.totalConvoyTankers + 1}`, route, smoothed);
      entities.tankers.push(bonusTanker);
      layers.entityLayer.addChild(bonusTanker);
      run.totalConvoyTankers++;
      spawnFlash(pickup.x, pickup.y, entities, layers, 0xffff00);
    } else {
      CombatSystem.applyPickup(pickup.pickupType);
      spawnFlash(pickup.x, pickup.y, entities, layers, COLORS.phosphorGreen);
    }

    spawnFloatingScore(pickup.x, pickup.y - 10, 0, entities, layers, PICKUP_LABEL_COLORS[pickup.pickupType] || '#00ff41', false, PICKUP_LABELS[pickup.pickupType]);
  }
}

const BOMB_RADIUS = 400;
const BOMB_DAMAGE = 4;

function detonateBomb(cx: number, cy: number, entities: GameEntities, layers: GameLayers, rng: SeededRNG): void {
  const run = getRun();

  CombatSystem.triggerScreenShake(25, 0.7, cx, cy);

  spawnExplosion(cx, cy, 120, 0.8, COLORS.amber, entities, layers);
  spawnSecondaryExplosions(cx, cy, 8, 80, COLORS.red, entities, layers);
  spawnShockwave(cx, cy, entities, layers, 250, COLORS.amber);
  spawnEmbers(cx, cy, entities, layers, 14, 50);
  spawnWaterRipple(cx, cy, entities, layers, 100);

  const enemyGroups: Array<{ list: any[]; config: KillConfig; explosionSize: number; explosionAlpha: number }> = [
    { list: entities.fabs, config: KILL_CONFIGS.fab, explosionSize: 35, explosionAlpha: 0.4 },
    { list: entities.cmbs, config: KILL_CONFIGS.cmb, explosionSize: 45, explosionAlpha: 0.5 },
    { list: entities.gunboats, config: KILL_CONFIGS.gunboat, explosionSize: 55, explosionAlpha: 0.6 },
    { list: entities.drones, config: KILL_CONFIGS.drone, explosionSize: 30, explosionAlpha: 0.35 },
    { list: entities.helicopters, config: KILL_CONFIGS.helicopter, explosionSize: 45, explosionAlpha: 0.5 },
  ];

  for (const { list, config, explosionSize, explosionAlpha } of enemyGroups) {
    for (const enemy of list) {
      if ('cloaked' in enemy && enemy.cloaked) continue;
      if (!enemy.alive || distSq(cx, cy, enemy.x, enemy.y) >= BOMB_RADIUS * BOMB_RADIUS) continue;
      enemy.takeDamage(BOMB_DAMAGE);
      spawnExplosion(enemy.x, enemy.y, explosionSize, explosionAlpha, config.deathColor, entities, layers);
      if (!enemy.alive) {
        const score = CombatSystem.registerKill(enemy.scoreValue, enemy.x, enemy.y, cx, cy);
        spawnDeathSequence(enemy.x, enemy.y, config.deathSize, config.deathColor, entities, layers);
        spawnFloatingScore(enemy.x, enemy.y, score, entities, layers, config.scoreColor, run.comboMultiplier > 1);
        if (config.guaranteedPickup) spawnPickupAt(enemy.x, enemy.y, entities, layers, rng);
        else tryDropPickup(enemy.x, enemy.y, entities, layers, rng);
      }
    }
  }

  for (const mine of entities.mines) {
    if (!mine.alive || distSq(cx, cy, mine.x, mine.y) >= BOMB_RADIUS * BOMB_RADIUS) continue;
    mine.detonate();
    handleMineKill(mine, cx, cy, entities, layers, rng);
  }

  // Destroy all enemy missiles in radius
  for (const missile of entities.missiles) {
    if (!missile.alive || missile.isPlayerMissile) continue;
    if (distSq(cx, cy, missile.x, missile.y) < BOMB_RADIUS * BOMB_RADIUS) {
      missile.alive = false;
      spawnExplosion(missile.x, missile.y, 20, 0.25, COLORS.amber, entities, layers);
    }
  }
}
