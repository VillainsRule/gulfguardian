import { ExplosionEffect } from '@/effects/explosions/ExplosionEffect';
import { DeathSequenceEffect } from '@/effects/explosions/DeathSequenceEffect';
import { ShockwaveRing } from '@/effects/explosions/ShockwaveRing';
import { EmberParticles } from '@/effects/explosions/EmberParticles';
import { HitFlash } from '@/effects/impacts/HitFlash';
import { ImpactSpark } from '@/effects/impacts/ImpactSpark';
import { MuzzleBlast } from '@/effects/impacts/MuzzleBlast';
import { FloatingScore } from '@/effects/text/FloatingScore';
import { WaterRipple } from '@/effects/environment/WaterRipple';
import { SplashdownEffect } from '@/effects/environment/SplashdownEffect';
import { OilSlick } from '@/effects/environment/OilSlick';
import { Pickup, rollPickupDrop } from '@/entities/pickups/Pickup';
import { SeededRNG } from '@/core/rng';
import { COLORS } from '@/app/constants';
import { getRun } from '@/core/run-state';
import { clampToChannel } from './map-renderer';
import { GameEntities, GameLayers } from './game-types';
import { getQuality } from '@/app/quality';

/** Evict the oldest effect with priority strictly below minPriority. */
function evictLowestPriority(entities: GameEntities, layers: GameLayers, minPriority: number): boolean {
  for (let i = 0; i < entities.effects.length; i++) {
    if (entities.effects[i].priority < minPriority) {
      layers.effectLayer.removeChild(entities.effects[i]);
      entities.effects.splice(i, 1);
      return true;
    }
  }
  return false;
}

/** Returns true if there's room — either under budget, or we evicted a lower-priority effect. */
function canSpawnOrEvict(entities: GameEntities, layers: GameLayers, priority: number): boolean {
  if (entities.effects.length < getQuality().maxConcurrentEffects) return true;
  if (priority > 0) return evictLowestPriority(entities, layers, priority);
  return false;
}

export function spawnExplosion(
  x: number, y: number, radius: number, duration: number, color: number,
  entities: GameEntities, layers: GameLayers,
): void {
  if (!canSpawnOrEvict(entities, layers, 2)) return;
  const exp = new ExplosionEffect(x, y, radius, duration, color);
  entities.effects.push(exp);
  layers.effectLayer.addChild(exp);
}

export function spawnFlash(
  x: number, y: number,
  entities: GameEntities, layers: GameLayers,
  color?: number,
): void {
  if (!canSpawnOrEvict(entities, layers, 0)) return;
  const flash = new HitFlash(x, y, color);
  entities.effects.push(flash);
  layers.effectLayer.addChild(flash);
}

export function spawnFloatingScore(
  x: number, y: number, score: number,
  entities: GameEntities, layers: GameLayers,
  color?: string, isCombo?: boolean,
  customText?: string,
): void {
  if (!canSpawnOrEvict(entities, layers, 0)) return;
  const text = new FloatingScore(x, y - 15, score, color, isCombo, customText);
  entities.effects.push(text);
  layers.effectLayer.addChild(text);
}

export function spawnWaterRipple(
  x: number, y: number,
  entities: GameEntities, layers: GameLayers,
  radius?: number,
): void {
  if (!canSpawnOrEvict(entities, layers, 0)) return;
  const ripple = new WaterRipple(x, y, radius);
  entities.effects.push(ripple);
  layers.effectLayer.addChild(ripple);
}

/** Spawn a multi-phase death sequence (fragments, explosions, debris, smoke) */
export function spawnDeathSequence(
  x: number, y: number,
  size: 'small' | 'medium' | 'large',
  color: number,
  entities: GameEntities, layers: GameLayers,
): void {
  if (!canSpawnOrEvict(entities, layers, 2)) return;
  const quality = getQuality();
  // Cap concurrent death sequences on mobile to prevent overlapping per-frame spikes
  if (quality.maxDeathSequences > 0) {
    let activeDeaths = 0;
    for (const e of entities.effects) {
      if (e instanceof DeathSequenceEffect && !e.finished) activeDeaths++;
    }
    if (activeDeaths >= quality.maxDeathSequences) return;
  }
  // On low quality, always use 'small' preset; on medium, cap at 'medium'
  let effectiveSize = size;
  if (quality.level === 'low') effectiveSize = 'small';
  else if (quality.level === 'medium' && size === 'large') effectiveSize = 'medium';
  const seq = new DeathSequenceEffect(x, y, effectiveSize, color);
  entities.effects.push(seq);
  layers.effectLayer.addChild(seq);
}

/** Spawn secondary explosions around a point for dramatic death effects */
export function spawnSecondaryExplosions(
  x: number, y: number, count: number, baseRadius: number, color: number,
  entities: GameEntities, layers: GameLayers,
): void {
  const quality = getQuality();
  if (!quality.enableSecondaryExplosions) return;
  const scaledCount = Math.max(2, Math.floor(count * quality.particleMultiplier));
  for (let i = 0; i < scaledCount; i++) {
    if (!canSpawnOrEvict(entities, layers, 1)) break;
    const delay = i * 0.08;
    const offsetX = (Math.random() - 0.5) * baseRadius * 1.5;
    const offsetY = (Math.random() - 0.5) * baseRadius * 1.5;
    const r = baseRadius * (0.4 + Math.random() * 0.6);
    // Stagger with setTimeout-like approach via delayed spawn
    const exp = new ExplosionEffect(x + offsetX, y + offsetY, r, 0.35 + Math.random() * 0.2, color);
    // Offset the timer to create staggered effect
    (exp as any).timer = -delay;
    entities.effects.push(exp);
    layers.effectLayer.addChild(exp);
  }
}

/** Spawn missile splashdown water effect */
export function spawnSplashdown(
  x: number, y: number,
  entities: GameEntities, layers: GameLayers,
): void {
  if (!getQuality().enableSplashdowns || !canSpawnOrEvict(entities, layers, 1)) return;
  const splash = new SplashdownEffect(x, y);
  entities.effects.push(splash);
  layers.effectLayer.addChild(splash);
}

/** Spawn oil slick at damaged tanker position */
export function spawnOilSlick(
  x: number, y: number,
  entities: GameEntities, layers: GameLayers,
): void {
  if (!canSpawnOrEvict(entities, layers, 0)) return;
  const slick = new OilSlick(x, y);
  entities.effects.push(slick);
  layers.effectLayer.addChild(slick);
}

export function spawnImpactSpark(
  x: number, y: number, incomingAngle: number,
  entities: GameEntities, layers: GameLayers,
  color?: number,
): void {
  if (!canSpawnOrEvict(entities, layers, 0)) return;
  const spark = new ImpactSpark(x, y, incomingAngle, color);
  entities.effects.push(spark);
  layers.effectLayer.addChild(spark);
}

export function spawnMuzzleBlast(
  x: number, y: number, angle: number,
  entities: GameEntities, layers: GameLayers,
  color?: number,
): void {
  if (!canSpawnOrEvict(entities, layers, 0)) return;
  const blast = new MuzzleBlast(x, y, angle, color);
  entities.effects.push(blast);
  layers.effectLayer.addChild(blast);
}

export function spawnShockwave(
  x: number, y: number,
  entities: GameEntities, layers: GameLayers,
  radius?: number, color?: number,
): void {
  if (!canSpawnOrEvict(entities, layers, 1)) return;
  const ring = new ShockwaveRing(x, y, radius, undefined, color);
  entities.effects.push(ring);
  layers.effectLayer.addChild(ring);
}

export function spawnEmbers(
  x: number, y: number,
  entities: GameEntities, layers: GameLayers,
  count?: number, spread?: number,
): void {
  if (!getQuality().enableEmbers || !canSpawnOrEvict(entities, layers, 1)) return;
  const quality = getQuality();
  const scaledCount = count ? Math.max(3, Math.floor(count * quality.particleMultiplier)) : undefined;
  const embers = new EmberParticles(x, y, scaledCount, spread);
  entities.effects.push(embers);
  layers.effectLayer.addChild(embers);
}

export function tryDropPickup(
  x: number, y: number,
  entities: GameEntities, layers: GameLayers, rng: SeededRNG,
): void {
  const run = getRun();
  const type = rollPickupDrop(() => rng.next(), {
    missileCount: run.missileCount,
    maxMissiles: run.maxMissiles,
    playerHP: run.playerHP,
    playerMaxHP: run.playerMaxHP,
    rapidFireActive: run.rapidFireActive,
    shieldActive: run.shieldActive,
    multifireActive: run.multifireActive,
    mirvActive: run.mirvActive,
    faeActive: run.faeActive,
  });
  if (type) {
    spawnPickupAt(x, y, entities, layers, rng, type);
  }
}

export function spawnPickupAt(
  x: number, y: number,
  entities: GameEntities, layers: GameLayers, rng: SeededRNG,
  type?: string,
): void {
  const clamped = clampToChannel(x, y);
  const pickupType = type || rollPickupDrop(() => rng.next()) || 'score';
  const pickup = new Pickup(clamped.x, clamped.y, pickupType as any);
  entities.pickups.push(pickup);
  layers.entityLayer.addChild(pickup);
}
