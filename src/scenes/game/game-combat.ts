import { COLORS } from '@/app/constants';
import { playSfx } from '@/audio/sfx';
import { CombatSystem } from '@/systems/combat/combat-system';
import { Missile } from '@/entities/projectiles/Missile';
import { CoastalMissileBattery } from '@/entities/enemies/CoastalMissileBattery';
import { Gunboat } from '@/entities/enemies/Gunboat';
import { PLAYER_MISSILE, CMB_MISSILE, GUNBOAT_MISSILE, HELICOPTER_MISSILE, MIRV_SUBMISSILE } from '@/entities/projectiles/projectile-types';
import { AttackHelicopter } from '@/entities/enemies/AttackHelicopter';
import { SeededRNG } from '@/core/rng';
import { GameEntities, GameLayers } from './game-types';
import { spawnExplosion, spawnFlash, tryDropPickup } from './game-effects';

/**
 * Fire a player missile toward the target position.
 * Auto-targeting controls the initial launch direction only; player missiles always retain homing support.
 */
export function firePlayerMissile(
  entities: GameEntities, layers: GameLayers,
  target: { x: number; y: number },
  autoTargetLaunch: boolean = true,
): void {
  const sternX = entities.playerShip.x - 15;
  const sternY = entities.playerShip.y;

  const _reusableEnemyList: { x: number; y: number; alive: boolean }[] = [];
  const enemyListProvider = () => {
    _reusableEnemyList.length = 0;
    for (const fab of entities.fabs) if (fab.alive) _reusableEnemyList.push(fab);
    for (const cmb of entities.cmbs) if (cmb.alive && !cmb.cloaked) _reusableEnemyList.push(cmb);
    for (const gb of entities.gunboats) if (gb.alive) _reusableEnemyList.push(gb);
    for (const drone of entities.drones) if (drone.alive) _reusableEnemyList.push(drone);
    for (const helo of entities.helicopters) if (helo.alive) _reusableEnemyList.push(helo);
    for (const mine of entities.mines) if (mine.alive) _reusableEnemyList.push(mine);
    return _reusableEnemyList;
  };

  let launchTarget = target;
  if (autoTargetLaunch) {
    const enemies = enemyListProvider();
    let bestDist = Infinity;
    let bestEnemy: { x: number; y: number } | null = null;
    for (const e of enemies) {
      const dx = e.x - sternX;
      const dy = e.y - sternY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestEnemy = e;
      }
    }
    if (bestEnemy) {
      launchTarget = bestEnemy;
    }
  }

  const missile = new Missile(
    sternX, sternY, launchTarget.x, launchTarget.y,
    PLAYER_MISSILE.speed, PLAYER_MISSILE.damage, PLAYER_MISSILE.lifetime, PLAYER_MISSILE.radius,
    true, true, undefined, PLAYER_MISSILE.blastRadius,
  );

  missile.setEnemyListProvider(enemyListProvider);

  entities.missiles.push(missile);
  layers.entityLayer.addChild(missile);
  playSfx('missileLaunch');
}

/**
 * Spawn MIRV sub-missiles from a missile impact point, scattering toward nearby enemies.
 */
export function spawnMirvSubmissiles(
  impactX: number, impactY: number,
  entities: GameEntities, layers: GameLayers, rng: SeededRNG,
): void {
  const subCount = 3;
  for (let i = 0; i < subCount; i++) {
    const spreadAngle = ((i / subCount) * Math.PI * 2) + rng.next() * 0.5;
    const targetX = impactX + Math.cos(spreadAngle) * 200;
    const targetY = impactY + Math.sin(spreadAngle) * 200;

    const sub = new Missile(
      impactX, impactY, targetX, targetY,
      MIRV_SUBMISSILE.speed, MIRV_SUBMISSILE.damage,
      MIRV_SUBMISSILE.lifetime, MIRV_SUBMISSILE.radius,
      true, false, undefined, MIRV_SUBMISSILE.blastRadius,
    );

    const _reusableMirvList: { x: number; y: number; alive: boolean }[] = [];
    sub.setEnemyListProvider(() => {
      _reusableMirvList.length = 0;
      for (const fab of entities.fabs) if (fab.alive) _reusableMirvList.push(fab);
      for (const cmb of entities.cmbs) if (cmb.alive && !cmb.cloaked) _reusableMirvList.push(cmb);
      for (const gb of entities.gunboats) if (gb.alive) _reusableMirvList.push(gb);
      for (const drone of entities.drones) if (drone.alive) _reusableMirvList.push(drone);
      for (const helo of entities.helicopters) if (helo.alive) _reusableMirvList.push(helo);
      for (const mine of entities.mines) if (mine.alive) _reusableMirvList.push(mine);
      return _reusableMirvList;
    });

    entities.missiles.push(sub);
    layers.entityLayer.addChild(sub);
  }
  playSfx('missileLaunch');
}

export function fireCMBAtTarget(
  cmb: CoastalMissileBattery, entities: GameEntities, layers: GameLayers, rng: SeededRNG,
): void {
  const { playerShip, tankers, missiles } = entities;

  const targets: { x: number; y: number }[] = [];
  const playerDist = Math.sqrt((playerShip.x - cmb.x) ** 2 + (playerShip.y - cmb.y) ** 2);
  if (playerDist < cmb.attackRange) {
    targets.push({ x: playerShip.x, y: playerShip.y });
  }
  for (const t of tankers) {
    if (!t.alive || t.completed) continue;
    const td = Math.sqrt((t.x - cmb.x) ** 2 + (t.y - cmb.y) ** 2);
    if (td < cmb.attackRange) targets.push({ x: t.x, y: t.y });
  }
  if (targets.length > 0) {
    const target = targets[Math.floor(rng.next() * targets.length)];
    fireMissileFrom(cmb.x, cmb.y, target.x, target.y, CMB_MISSILE, missiles, layers);
    playSfx('enemyMissile');
    cmb.resetFireTimer();
    // Uncloak — firing reveals the shore battery
    cmb.uncloak();
    cmb.alpha = 1;
  }
}

export function fireGunboatSpread(gunboat: Gunboat, entities: GameEntities, layers: GameLayers): void {
  const { playerShip, missiles } = entities;
  const distanceToPlayer = Math.sqrt((playerShip.x - gunboat.x) ** 2 + (playerShip.y - gunboat.y) ** 2);
  if (distanceToPlayer > gunboat.attackRange) return;

  const baseAngle = Math.atan2(playerShip.y - gunboat.y, playerShip.x - gunboat.x);
  for (const offset of [-0.2, 0, 0.2]) {
    const angle = baseAngle + offset;
    const tx = gunboat.x + Math.cos(angle) * 300;
    const ty = gunboat.y + Math.sin(angle) * 300;
    fireMissileFrom(gunboat.x, gunboat.y, tx, ty, GUNBOAT_MISSILE, missiles, layers);
  }
  gunboat.resetFireTimer();
  playSfx('enemyMissile');
  CombatSystem.triggerScreenShake(3, 0.15);
}

export function fireHelicopterAtTarget(
  helo: AttackHelicopter, entities: GameEntities, layers: GameLayers,
): void {
  const { missiles } = entities;
  const target = helo.getTargetPosition();
  fireMissileFrom(helo.x, helo.y, target.x, target.y, HELICOPTER_MISSILE, missiles, layers);
  helo.resetFireTimer();
  playSfx('heliMissile');
}

function fireMissileFrom(
  fromX: number, fromY: number, toX: number, toY: number,
  spec: { speed: number; damage: number; lifetime: number; radius: number },
  missiles: Missile[], layers: GameLayers,
): void {
  const missile = new Missile(fromX, fromY, toX, toY, spec.speed, spec.damage, spec.lifetime, spec.radius, false);
  missiles.push(missile);
  layers.entityLayer.addChild(missile);
}

