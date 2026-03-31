import { COLORS, GAME_WIDTH } from '@/app/constants';
import { getRun } from '@/core/run-state';
import { SCORING } from '@/data/scoring';
import { Encounter } from '@/data/encounters';
import { FastAttackBoat } from '@/entities/enemies/FastAttackBoat';
import { CoastalMissileBattery } from '@/entities/enemies/CoastalMissileBattery';
import { Gunboat } from '@/entities/enemies/Gunboat';
import { Drone } from '@/entities/enemies/Drone';
import { AttackHelicopter } from '@/entities/enemies/AttackHelicopter';
import { Mine } from '@/entities/hazards/Mine';
import { CombatSystem } from '@/systems/combat/combat-system';
import { GameEntities, GameLayers } from './game-types';
import { clampToChannel, getIranCoastY } from './map-renderer';
import { spawnExplosion, spawnFlash, spawnSplashdown } from './game-effects';
import { playLoopSfx } from '@/audio/sfx';
import { fireCMBAtTarget, fireGunboatSpread, fireHelicopterAtTarget } from './game-combat';
import { SeededRNG } from '@/core/rng';

// Bring enemies ~2 seconds closer to the screen edge (70px at 35px/sec scroll)
const SPAWN_ADVANCE = 70;

// Per-type position jitter ranges (pixels). Seeded RNG keeps daily/challenge deterministic.
const POSITION_JITTER: Record<string, { dx: number; dy: number }> = {
  fab:        { dx: 60, dy: 80 },
  mine:       { dx: 40, dy: 50 },
  cmb:        { dx: 60, dy: 0 },   // Y clamped to coast anyway
  gunboat:    { dx: 60, dy: 60 },
  drone:      { dx: 0,  dy: 80 },  // X is off-screen; only vary approach Y
  helicopter: { dx: 0,  dy: 60 },
};

// Water channel Y bounds for clamping jittered positions
const CHANNEL_Y_MIN = 185;
const CHANNEL_Y_MAX = 475;

// Reusable array for active tankers — avoids per-frame allocation from .filter()
const _activeTankers: any[] = [];

export function spawnEncounter(encounter: Encounter, entities: GameEntities, layers: GameLayers, rng: SeededRNG): void {
  for (const spawn of encounter.enemies) {
    const isBehind = (spawn.type === 'drone' || spawn.type === 'helicopter')
      && spawn.spawnDirection === 'behind';

    // Apply seeded position jitter so each run feels different
    const jitter = POSITION_JITTER[spawn.type] || { dx: 0, dy: 0 };
    const jitterX = jitter.dx > 0 ? rng.nextRange(-jitter.dx, jitter.dx) : 0;
    const jitterY = jitter.dy > 0 ? rng.nextRange(-jitter.dy, jitter.dy) : 0;

    const spawnX = (isBehind ? spawn.x : spawn.x - SPAWN_ADVANCE) + jitterX;
    const spawnY = spawn.y + jitterY;

    let entity: any;
    switch (spawn.type) {
      case 'fab':
        entity = new FastAttackBoat(spawnX, Math.max(CHANNEL_Y_MIN, Math.min(CHANNEL_Y_MAX, spawnY)));
        entities.fabs.push(entity);
        break;
      case 'cmb': {
        const coastY = getIranCoastY(spawnX);
        const inlandY = Math.min(spawnY, coastY - 15);
        entity = new CoastalMissileBattery(spawnX, inlandY);
        entities.cmbs.push(entity);
        break;
      }
      case 'mine': {
        const clamped = clampToChannel(spawnX, spawnY);
        entity = new Mine(clamped.x, clamped.y);
        entities.mines.push(entity);
        break;
      }
      case 'gunboat':
        entity = new Gunboat(spawnX, Math.max(CHANNEL_Y_MIN, Math.min(CHANNEL_Y_MAX, spawnY)));
        entities.gunboats.push(entity);
        break;
      case 'drone': {
        const dir = spawn.spawnDirection || 'top';
        let droneX = spawnX;
        if (dir === 'behind') droneX = getRun().cameraX - 50;
        entity = new Drone(droneX, spawnY, dir);
        entities.drones.push(entity);
        break;
      }
      case 'helicopter': {
        const heloDir = spawn.spawnDirection || 'top';
        let heloX = spawnX;
        if (heloDir === 'behind') heloX = getRun().cameraX - 50;
        entity = new AttackHelicopter(heloX, spawnY, heloDir);
        entities.helicopters.push(entity);
        playLoopSfx('heliRotor', `heli_rotor_${entity.id}`);
        break;
      }
    }
    if (entity) {
      // Stagger initial attack timers so enemies in the same wave don't fire in sync
      if ('attackTimer' in entity && 'attackCooldown' in entity) {
        entity.attackTimer = rng.nextRange(0, entity.attackCooldown * 0.6);
      }
      layers.entityLayer.addChild(entity);
      spawnFlash(entity.x, entity.y, entities, layers, 0xffffff);
    }
  }
}

export function updateEntities(dt: number, entities: GameEntities, layers: GameLayers, rng: SeededRNG): void {
  const run = getRun();
  const { tankers, fabs, cmbs, gunboats, mines, missiles, pickups } = entities;

  for (const tanker of tankers) {
    tanker.update(dt, tankers);
    if (tanker.alive && !tanker.completed) {
      const routeEndX = tanker.smoothedRoute[tanker.smoothedRoute.length - 1]?.x ?? tanker.x;
      const nearRouteEnd = routeEndX - tanker.x <= 328;
      const backZoneMax = nearRouteEnd ? routeEndX : run.cameraX + 328;
      const backZoneMin = nearRouteEnd ? Math.min(run.cameraX + 188, backZoneMax) : run.cameraX + 188;
      tanker.x = Math.max(backZoneMin, Math.min(tanker.x, backZoneMax));
      tanker.drawRouteLine(run.cameraX, GAME_WIDTH);
    }
    if (tanker.completed && tanker.alive) {
      run.score += SCORING.TANKER_DELIVERED;
      run.tankersSaved++;
      run.oilFlow = Math.min(100, run.oilFlow + 5);
      run.oilPrice = Math.max(50, run.oilPrice - 8);
      CombatSystem.resupplyFromTanker();
      tanker.alive = false;
    }
  }

  // Build active tankers list in-place (reuses module-level array)
  _activeTankers.length = 0;
  for (const t of tankers) {
    if (t.alive && !t.completed) _activeTankers.push(t);
  }
  const activeTankers = _activeTankers;
  for (const fab of fabs) fab.update(dt, activeTankers, entities.playerShip.x, entities.playerShip.y);
  for (const drone of entities.drones) {
    drone.update(dt, activeTankers, entities.playerShip.x, entities.playerShip.y);
    if (drone.impactDetonationRequested) {
      drone.impactDetonationRequested = false;
      spawnExplosion(drone.x, drone.y, 35, 0.35, COLORS.amber, entities, layers);
      spawnSplashdown(drone.x, drone.y, entities, layers);
    }
  }
  for (const cmb of cmbs) {
    cmb.update(dt);
    if (cmb.canFire()) fireCMBAtTarget(cmb, entities, layers, rng);
  }
  for (const gunboat of gunboats) {
    gunboat.update(dt);
    if (gunboat.canFire()) fireGunboatSpread(gunboat, entities, layers);
  }
  for (const helo of entities.helicopters) {
    helo.update(dt, activeTankers, entities.playerShip.x, entities.playerShip.y);
    if (helo.canFire()) fireHelicopterAtTarget(helo, entities, layers);
  }
  for (const mine of mines) mine.update(dt);
  for (const missile of missiles) {
    missile.update(dt);
    if (missile.splashRequested) {
      missile.splashRequested = false;
      spawnSplashdown(missile.x, missile.y, entities, layers);
    }
  }
  for (const pickup of pickups) pickup.update(dt, entities.playerShip.x, entities.playerShip.y);
}
