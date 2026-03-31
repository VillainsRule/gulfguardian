import { GAME_HEIGHT, GAME_WIDTH, COLORS } from '@/app/constants';
import { getRun, SCROLL_SPEED, WORLD_WIDTH } from '@/core/run-state';
import { PlayerShip } from '@/entities/player/PlayerShip';
import { HORIZONTAL_SPEED, PLAYER_MAX_X_OFFSET, PLAYER_MIN_X_OFFSET, VERTICAL_SPEED } from '@/systems/movement/movement-system';
import { CombatSystem } from '@/systems/combat/combat-system';
import { BUDGET_COSTS } from '@/data/scoring';
import { GameEntities, GameLayers } from './game-types';
import { firePlayerMissile } from './game-combat';
import { spawnFlash } from './game-effects';
import { pushOutOfIsland, pushOffCoast } from './map-renderer';
import { SeededRNG } from '@/core/rng';
import { playSfx } from '@/audio/sfx';
import { Bullet } from '@/entities/projectiles/Bullet';
import { PLAYER_GUN } from '@/entities/projectiles/projectile-types';
import { MslAwayState, showMslAway } from './game-ui';
import { Hud } from '@/ui/hud/Hud';
import { spawnMuzzleBlast } from './game-effects';
import { liveTracking } from '@/debug/StatsRecorder';
import { getQuality, isMobileDetected } from '@/app/quality';

export function updateAutoPlayMovement(
  player: PlayerShip,
  moveX: number,
  moveY: number,
  dt: number,
): void {
  const run = getRun();

  // Auto-scroll camera (same as regular movement)
  run.scrollSpeedMultiplier = 1.0;
  const effectiveSpeed = SCROLL_SPEED;
  run.cameraX = Math.min(run.cameraX + effectiveSpeed * dt, WORLD_WIDTH - GAME_WIDTH);
  run.scrollSpeed = effectiveSpeed;

  // Apply AI movement
  let hSpeed = HORIZONTAL_SPEED;
  let vSpeed = VERTICAL_SPEED;
  const screenX = player.x - run.cameraX;
  const rightRatio = Math.max(0, (screenX - PLAYER_MIN_X_OFFSET) / (PLAYER_MAX_X_OFFSET - PLAYER_MIN_X_OFFSET));
  const rightSlowdown = 1.0 - rightRatio * 0.6;
  hSpeed *= rightSlowdown;
  vSpeed *= rightSlowdown;
  player.updateRiverRaidMovement(moveX, moveY, hSpeed, vSpeed, dt);

  // Clamp player within screen bounds
  const minX = run.cameraX + PLAYER_MIN_X_OFFSET;
  const maxX = run.cameraX + PLAYER_MAX_X_OFFSET;
  player.x = Math.max(minX, Math.min(maxX, player.x));

  // Push out of islands and coastlines
  const corrected = pushOutOfIsland(player.x, player.y);
  player.x = corrected.x;
  player.y = corrected.y;
  const prevY = player.y;
  const coastCorrected = pushOffCoast(player.x, player.y);
  player.x = coastCorrected.x;
  player.y = coastCorrected.y;
  if (coastCorrected.y !== prevY) {
    if (prevY < coastCorrected.y) player.vy = Math.max(0, player.vy);
    else player.vy = Math.min(0, player.vy);
  }

  // Re-clamp after terrain corrections
  player.x = Math.max(minX, Math.min(maxX, player.x));

  // Clamp Y
  player.y = Math.max(50, Math.min(GAME_HEIGHT - 70, player.y));

  player.currentSpeed = Math.sqrt(
    (player.vx + effectiveSpeed) * (player.vx + effectiveSpeed) +
    player.vy * player.vy
  );

  // Sync run state
  run.playerX = player.x;
  run.playerY = player.y;
  run.playerRotation = player.rotation;
  run.shipHeading = 0;
  run.shipCurrentSpeed = effectiveSpeed;
  run.shipThrottle = 0;
}

interface AutoPlayCombatInput {
  fireX: number;
  fireY: number;
  wantMissile: boolean;
}

export function handleAutoPlayCombat(
  dt: number,
  ai: AutoPlayCombatInput,
  cooldowns: { missileCooldownTimer: number; gunCooldownTimer: number },
  entities: GameEntities,
  layers: GameLayers,
  rng: SeededRNG,
  mslAwayState: MslAwayState,
  hud: Hud,
  gunFireRate: number,
): void {
  cooldowns.missileCooldownTimer -= dt;
  cooldowns.gunCooldownTimer -= dt;
  const player = entities.playerShip;
  const run = getRun();

  // Gun fire
  if (ai.fireX !== 0 || ai.fireY !== 0) {
    if (cooldowns.gunCooldownTimer <= 0 && CombatSystem.tryFireGun()) {
      cooldowns.gunCooldownTimer = run.rapidFireActive ? gunFireRate * 0.5 : gunFireRate;
      const len = Math.sqrt(ai.fireX * ai.fireX + ai.fireY * ai.fireY) || 1;
      const toX = player.x + (ai.fireX / len) * 400;
      const toY = player.y + (ai.fireY / len) * 400;
      const fired = fireGunShot(player.x, player.y, toX, toY, entities, layers, rng);
      if (run.multifireActive) {
        const baseAngle = Math.atan2(toY - player.y, toX - player.x);
        for (const offset of [-0.15, 0.15]) {
          const a = baseAngle + offset;
          fireGunShot(player.x, player.y, player.x + Math.cos(a) * 400, player.y + Math.sin(a) * 400, entities, layers, rng);
        }
      }
      if (fired) playSfx('gunFire');
    }
  }

  // Missile fire
  if (ai.wantMissile && cooldowns.missileCooldownTimer <= 0 && CombatSystem.tryFireMissile()) {
    const rawFireX = ai.fireX === 0 && ai.fireY === 0 ? 1 : ai.fireX;
    const rawFireY = ai.fireX === 0 && ai.fireY === 0 ? 0 : ai.fireY;
    const fireLen = Math.sqrt(rawFireX * rawFireX + rawFireY * rawFireY) || 1;
    const missileTarget = {
      x: player.x + (rawFireX / fireLen) * 600,
      y: player.y + (rawFireY / fireLen) * 600,
    };
    firePlayerMissile(entities, layers, missileTarget, true);
    run.budget += BUDGET_COSTS.MISSILE_FIRED;
    liveTracking.missilesFired++;
    cooldowns.missileCooldownTimer = CombatSystem.getMissileFireCooldown();
    CombatSystem.triggerScreenShake(4, 0.15);
    spawnFlash(player.x - 15, player.y, entities, layers, COLORS.amber);
    showMslAway(mslAwayState, layers);
    hud.flashMissileCount();
  }
}

export function fireGunShot(
  fromX: number, fromY: number,
  toX: number, toY: number,
  entities: GameEntities,
  layers: GameLayers,
  rng: SeededRNG,
): boolean {
  // Enforce bullet cap on mobile to prevent FPS drops
  const quality = getQuality();
  const maxBullets = quality.maxActiveBullets;
  if (maxBullets > 0 && entities.bullets.length >= maxBullets) return false;

  const run = getRun();
  const spread = (rng.next() - 0.5) * 0.06;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx) + spread;
  const dist = 300;
  const tx = fromX + Math.cos(angle) * dist;
  const ty = fromY + Math.sin(angle) * dist;

  const muzzleX = fromX;
  const muzzleY = fromY;

  const bullet = new Bullet(
    muzzleX, muzzleY, tx, ty,
    PLAYER_GUN.speed, PLAYER_GUN.damage, PLAYER_GUN.lifetime, PLAYER_GUN.radius,
    true, run.rapidFireActive,
  );
  entities.bullets.push(bullet);
  // Bullets are now data-only; rendered by BulletRenderer (no addChild)
  run.budget += BUDGET_COSTS.SHELL_FIRED;
  liveTracking.shotsFired++;

  // Skip muzzle blast on mobile (20-40 effects/sec otherwise)
  if (quality.enableMuzzleBlast) {
    spawnMuzzleBlast(muzzleX, muzzleY, angle, entities, layers, run.rapidFireActive ? 0x88ccff : COLORS.amber);
  }

  if (!quality.renderSkipCosmetic) {
    CombatSystem.triggerScreenShake(2.0, 0.05);
  }

  return true;
}
