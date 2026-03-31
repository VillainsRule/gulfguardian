import { RunState } from '@/core/run-state';
import { GameEntities } from '@/scenes/game/game-types';
import { SeededRNG } from '@/core/rng';
import { GAME_WIDTH } from '@/app/constants';

export interface AIOutput {
  moveX: number;    // -1..1
  moveY: number;    // -1..1
  fireX: number;    // -1..1
  fireY: number;    // -1..1
  wantMissile: boolean;
}

type TargetType = 'fab' | 'cmb' | 'gunboat' | 'drone' | 'helicopter' | 'mine';

interface CombatTarget {
  x: number;
  y: number;
  alive: boolean;
  priority: number;
  dangerScore: number;
  targetType: TargetType;
  vx?: number;
  vy?: number;
}

export class AutoPlayController {
  public smartness = 0.5;
  private rng = new SeededRNG('autoplay-default');

  private reactionTimer = 0;
  private currentMoveX = 0;
  private currentMoveY = 0;
  private missileTimer = 0;
  private jitterTimer = 0;
  private jitterX = 0;
  private jitterY = 0;
  private burstCooldown = false;

  resetForRun(seed: string, smartness: number): void {
    this.smartness = smartness;
    this.rng = new SeededRNG(`${seed}|autoplay|${smartness.toFixed(3)}`);
    this.reactionTimer = 0;
    this.currentMoveX = 0;
    this.currentMoveY = 0;
    this.missileTimer = 0;
    this.jitterTimer = 0;
    this.jitterX = 0;
    this.jitterY = 0;
    this.burstCooldown = false;
  }

  private random(): number {
    return this.rng.next();
  }

  update(dt: number, entities: GameEntities, run: RunState): AIOutput {
    const s = this.smartness;
    const px = run.playerX;
    const py = run.playerY;
    const cameraX = run.cameraX;

    // ── Reaction delay: dumber AI updates decisions less frequently ──
    this.reactionTimer -= dt;
    const reactionInterval = 0.02 + (1 - s) * 0.3; // 20ms (smart) to 320ms (dumb)

    // ── Jitter: dumber AI has random movement noise ──
    this.jitterTimer -= dt;
    if (this.jitterTimer <= 0) {
      this.jitterTimer = 0.1 + (1 - s) * 0.3;
      const jitterMag = (1 - s) * 0.4;
      this.jitterX = (this.random() - 0.5) * 2 * jitterMag;
      this.jitterY = (this.random() - 0.5) * 2 * jitterMag;
    }

    if (this.reactionTimer <= 0) {
      this.reactionTimer = reactionInterval;
      this.computeMovement(entities, run, px, py, cameraX, s);
    }

    // ── Combat: fire at enemies ──
    const combat = this.computeCombat(entities, run, px, py, cameraX, s, dt);

    return {
      moveX: clamp(this.currentMoveX + this.jitterX, -1, 1),
      moveY: clamp(this.currentMoveY + this.jitterY, -1, 1),
      fireX: combat.fireX,
      fireY: combat.fireY,
      wantMissile: combat.wantMissile,
    };
  }

  private computeMovement(
    entities: GameEntities, run: RunState,
    px: number, py: number, cameraX: number, s: number
  ): void {
    let moveX = 0;
    let moveY = 0;

    // ── 1. Dodge incoming missiles ──
    let dodgeX = 0;
    let dodgeY = 0;
    for (const m of entities.missiles) {
      if (!m.alive || m.isPlayerMissile) continue;
      const dx = m.x - px;
      const dy = m.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq > 300 * 300) continue; // Too far

      // Check if missile heading toward us
      const dot = dx * m.vx + dy * m.vy;
      if (dot > 0) continue; // Moving away

      const dist = Math.sqrt(distSq) || 1;
      const urgency = Math.max(0, 1 - dist / 300);

      // Move perpendicular to missile's velocity
      const mvLen = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1;
      const perpX = -m.vy / mvLen;
      const perpY = m.vx / mvLen;

      // Choose direction that moves us away
      const sign = (perpX * -dx + perpY * -dy) > 0 ? 1 : -1;
      dodgeX += perpX * sign * urgency * 2;
      dodgeY += perpY * sign * urgency * 2;
    }

    // ── 2. Avoid mines ──
    for (const mine of entities.mines) {
      if (!mine.alive) continue;
      const dx = mine.x - px;
      const dy = mine.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq > 200 * 200) continue;
      const dist = Math.sqrt(distSq) || 1;
      const urgency = Math.max(0, 1 - dist / 200);
      dodgeX -= (dx / dist) * urgency * 1.5;
      dodgeY -= (dy / dist) * urgency * 1.5;
    }

    // ── 3. Avoid enemies that are too close (FABs, drones, gunboats, helicopters) ──
    const closeEnemies = [
      ...entities.fabs, ...entities.drones,
    ];
    for (const e of closeEnemies) {
      if (!e.alive) continue;
      const dx = e.x - px;
      const dy = e.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq > 150 * 150) continue;
      const dist = Math.sqrt(distSq) || 1;
      const urgency = Math.max(0, 1 - dist / 150);
      dodgeX -= (dx / dist) * urgency;
      dodgeY -= (dy / dist) * urgency;
    }

    // ── 3b. Avoid gunboats (larger avoidance radius) ──
    for (const gb of entities.gunboats) {
      if (!gb.alive) continue;
      const dx = gb.x - px;
      const dy = gb.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq > 250 * 250) continue;
      const dist = Math.sqrt(distSq) || 1;
      const urgency = Math.max(0, 1 - dist / 250);
      dodgeX -= (dx / dist) * urgency * 1.2;
      dodgeY -= (dy / dist) * urgency * 1.2;
    }

    // ── 3c. Dodge helicopter attacks (they fire from further away) ──
    for (const heli of entities.helicopters) {
      if (!heli.alive) continue;
      const dx = heli.x - px;
      const dy = heli.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq > 300 * 300) continue;
      const dist = Math.sqrt(distSq) || 1;
      // Steer perpendicular to helicopter approach for evasion
      const urgency = Math.max(0, 1 - dist / 300) * 0.8;
      const perpX = -dy / dist;
      const perpY = dx / dist;
      const sign = (perpX * -dx + perpY * -dy) > 0 ? 1 : -1;
      dodgeX += perpX * sign * urgency;
      dodgeY += perpY * sign * urgency;
    }

    // ── 3d. Dodge enemy bullets (CMB fire and gunboat bullets) ──
    if (s > 0.3) {
      for (const b of entities.bullets) {
        if (!b.alive || b.isPlayerBullet) continue;
        const dx = b.x - px;
        const dy = b.y - py;
        const distSq = dx * dx + dy * dy;
        if (distSq > 200 * 200) continue;

        // Check if bullet heading toward us
        const dot = dx * b.vx + dy * b.vy;
        if (dot > 0) continue; // Moving away

        const dist = Math.sqrt(distSq) || 1;
        const urgency = Math.max(0, 1 - dist / 200) * s;

        // Move perpendicular to bullet velocity
        const bvLen = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
        const perpX = -b.vy / bvLen;
        const perpY = b.vx / bvLen;
        const sign = (perpX * -dx + perpY * -dy) > 0 ? 1 : -1;
        dodgeX += perpX * sign * urgency * 1.5;
        dodgeY += perpY * sign * urgency * 1.5;
      }
    }

    // ── 3e. Seek pickups (smart AI moves toward nearby pickups) ──
    let pickupX = 0;
    let pickupY = 0;
    if (s > 0.4) {
      let bestPickupDist = Infinity;
      let bestPx = 0;
      let bestPy = 0;
      let bestPriority = 0;
      for (const p of entities.pickups) {
        if (!p.alive) continue;
        const dx = p.x - px;
        const dy = p.y - py;
        const distSq = dx * dx + dy * dy;
        if (distSq > 300 * 300) continue;

        // Prioritize health when HP is low, missiles when low on missiles
        let priority = 1;
        if (p.pickupType === 'health' || p.pickupType === 'tanker_repair') {
          priority = s > 0.7 && run.playerHP <= 3 ? 3 : 1.5;
        } else if (p.pickupType === 'missiles' || p.pickupType === 'mirv') {
          priority = run.missileCount <= 1 ? 2 : 1.2;
        } else if (p.pickupType === 'bomb' || p.pickupType === 'fae') {
          priority = 2;
        } else if (p.pickupType === 'shield') {
          priority = 1.8;
        }

        const effectiveDist = Math.sqrt(distSq) / priority;
        if (effectiveDist < bestPickupDist) {
          bestPickupDist = effectiveDist;
          bestPx = dx;
          bestPy = dy;
          bestPriority = priority;
        }
      }
      if (bestPickupDist < Infinity) {
        const dist = Math.sqrt(bestPx * bestPx + bestPy * bestPy) || 1;
        const pull = Math.min(0.6, bestPriority * 0.25) * s;
        pickupX = (bestPx / dist) * pull;
        pickupY = (bestPy / dist) * pull;
      }
    }

    // ── 4. Stay in safe zone (center of channel) ──
    const channelCenterY = 350; // Approximate center of navigable water
    const yDeviation = (py - channelCenterY) / 200;
    const centerPull = -yDeviation * 0.3;

    // ── 5. Stay roughly in the middle-front of screen ──
    const screenX = px - cameraX;
    const targetScreenX = 400 + s * 200; // Smart AI pushes forward more
    const xPull = (targetScreenX - screenX) / 400;

    // ── 6. Protect tankers: position between threats and nearest tanker ──
    let protectX = 0;
    let protectY = 0;
    if (s > 0.3) {
      // Smart AI protects the most vulnerable tanker
      let bestTanker: { x: number; y: number; alive: boolean; hp?: number } | null = null;
      let lowestHP = Infinity;
      let tankerAvgY = 0;
      let tankerCount = 0;
      for (const t of entities.tankers) {
        if (!t.alive) continue;
        const hp = (t as any).hp ?? Infinity;
        tankerAvgY += t.y;
        tankerCount++;
        if (hp < lowestHP) {
          lowestHP = hp;
          bestTanker = t;
        }
      }
      if (bestTanker) {
        const nearestThreat = this.findNearestThreat(entities, bestTanker.x, bestTanker.y);
        if (nearestThreat) {
          const midX = (bestTanker.x + nearestThreat.x) / 2;
          const midY = (bestTanker.y + nearestThreat.y) / 2;
          protectX = (midX - px) / 400 * s;
          protectY = (midY - py) / 400 * s;
        }
      }

      // ── 6b. Formation escort: stay ahead/beside the convoy ──
      if (tankerCount > 0 && s > 0.5) {
        tankerAvgY /= tankerCount;
        // Gently pull toward convoy Y to escort alongside
        const formationPull = (tankerAvgY - py) / 300 * s * 0.3;
        protectY += formationPull;
      }
    }

    // ── 7. Wave-adaptive behavior: later waves → more defensive ──
    const waveFactor = Math.min(1, run.wave / 5); // 0 to 1 over 5 waves
    const defensiveBoost = 1 + waveFactor * 0.5 * s; // Dodge harder in later waves

    // Combine all forces (weighted by smartness)
    moveX = dodgeX * s * defensiveBoost + xPull * 0.5 + protectX + pickupX;
    moveY = dodgeY * s * defensiveBoost + centerPull + protectY + pickupY;

    // Normalize
    const len = Math.sqrt(moveX * moveX + moveY * moveY) || 1;
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }

    this.currentMoveX = moveX;
    this.currentMoveY = moveY;
  }

  private computeCombat(
    entities: GameEntities, run: RunState,
    px: number, py: number, cameraX: number, s: number, dt: number
  ): { fireX: number; fireY: number; wantMissile: boolean } {
    let fireX = 0;
    let fireY = 0;
    let wantMissile = false;

    // Find target
    const target = this.findFireTarget(entities, px, py, cameraX, s);
    if (target) {
      let aimX = target.x - px;
      let aimY = target.y - py;

      // Smart AI leads targets
      if (s > 0.4 && (target.vx !== undefined || target.vy !== undefined)) {
        const bulletSpeed = 720;
        const dist = Math.sqrt(aimX * aimX + aimY * aimY) || 1;
        const travelTime = dist / bulletSpeed;
        const leadFactor = Math.min(1, (s - 0.4) * 1.67); // 0 to 1 for smartness 0.4-1.0
        aimX += (target.vx || 0) * travelTime * leadFactor;
        aimY += (target.vy || 0) * travelTime * leadFactor;
      }

      // Add inaccuracy for dumber AI
      const inaccuracy = (1 - s) * 0.5;
      aimX += (this.random() - 0.5) * inaccuracy * 200;
      aimY += (this.random() - 0.5) * inaccuracy * 200;

      const len = Math.sqrt(aimX * aimX + aimY * aimY) || 1;
      fireX = aimX / len;
      fireY = aimY / len;

      // Gun heat discipline: burst-fire with hysteresis
      if (s > 0.3) {
        const stopThreshold = s > 0.6 ? 0.6 : 0.8;
        const resumeThreshold = s > 0.6 ? 0.3 : 0.5;

        if (this.burstCooldown) {
          if (run.gunHeat <= resumeThreshold) {
            this.burstCooldown = false;
          }
        } else if (run.gunHeat > stopThreshold) {
          this.burstCooldown = true;
        }

        if (this.burstCooldown) {
          fireX = 0;
          fireY = 0;
        }
      }
      // Dumb AI (s <= 0.3) has no heat discipline - fires until system forces overheat
    } else if (s < 0.3) {
      // Dumb AI sometimes fires randomly
      if (this.random() < 0.02) {
        fireX = 1;
        fireY = (this.random() - 0.5) * 0.5;
      }
    }

    // Missile usage
    this.missileTimer -= dt;
    if (this.missileTimer <= 0 && run.missileCount > 0 && target) {
      const dist = Math.sqrt((target.x - px) ** 2 + (target.y - py) ** 2);

      if (s > 0.3) {
        // Priority targets that warrant missiles
        const isHighValue = target.targetType === 'gunboat' ||
          target.targetType === 'cmb' ||
          target.targetType === 'helicopter';
        const isMediumValue = target.targetType === 'drone' ||
          target.targetType === 'fab';

        // Count nearby threats (broader radius for better awareness)
        let nearbyThreats = 0;
        const allEnemies = [...entities.fabs, ...entities.gunboats, ...entities.drones, ...entities.helicopters];
        for (const e of allEnemies) {
          if (!e.alive) continue;
          if ((e.x - px) ** 2 + (e.y - py) ** 2 < 350 * 350) nearbyThreats++;
        }

        // Wave-adaptive: use missiles more freely as waves progress
        const wave = run.wave || 1;
        const useFreely = wave >= 3;
        // Lower thresholds for multi-threat missile use
        const multiThreatThreshold = wave <= 2 ? 3 : 2;

        // Use missiles on high-value targets within range (CMBs can be far)
        const effectiveRange = target.targetType === 'cmb' ? 900 : 600;
        const shouldFire =
          (isHighValue && dist < effectiveRange) ||
          (isMediumValue && dist < 400 && nearbyThreats >= 2) ||
          (nearbyThreats >= multiThreatThreshold) ||
          (useFreely && (isHighValue || (isMediumValue && dist < 500))) ||
          (run.missileCount >= 4 && dist < 500); // spend missiles when stocked up

        if (shouldFire) {
          wantMissile = true;
          // Smarter AI fires missiles faster
          this.missileTimer = s > 0.6 ? 0.6 + (1 - s) * 1.0 : 1.0 + (1 - s) * 2.0;

          // Aim missile at the actual target direction
          const mAimX = target.x - px;
          const mAimY = target.y - py;
          const mLen = Math.sqrt(mAimX * mAimX + mAimY * mAimY) || 1;
          fireX = mAimX / mLen;
          fireY = mAimY / mLen;
        }
      } else {
        // Dumb: fire missiles semi-randomly
        if (this.random() < 0.03 * s + 0.01) {
          wantMissile = true;
          this.missileTimer = 0.5 + this.random() * 3;
        }
      }
    }

    return { fireX, fireY, wantMissile };
  }

  private findFireTarget(
    entities: GameEntities, px: number, py: number, cameraX: number, s: number
  ): CombatTarget | null {
    const allTargets: CombatTarget[] = [];
    const screenRight = cameraX + GAME_WIDTH + 100;
    const screenLeft = cameraX - 100;

    const addTargets = (
      list: { x: number; y: number; alive: boolean; vx?: number; vy?: number }[],
      targetType: TargetType,
      priority: number,
      dangerBase: number,
    ) => {
      for (const e of list) {
        if (!e.alive) continue;
        if (e.x < screenLeft || e.x > screenRight) continue;
        const dist = Math.sqrt((e.x - px) ** 2 + (e.y - py) ** 2);
        // Danger score combines base danger with proximity
        const dangerScore = dangerBase + Math.max(0, 1 - dist / 500) * 3;
        // IMPORTANT: never spread Pixi/Container-backed entities here.
        // Their x/y can be prototype accessors and won't survive object spread,
        // which yields undefined aim vectors and prevents autoplay from firing.
        allTargets.push({
          x: e.x,
          y: e.y,
          alive: e.alive,
          priority,
          dangerScore,
          targetType,
          vx: e.vx,
          vy: e.vy,
        });
      }
    };

    addTargets(entities.fabs, 'fab', 1, 2);
    addTargets(entities.cmbs, 'cmb', 3, 1);       // CMBs are dangerous but far away
    addTargets(entities.gunboats, 'gunboat', 4, 4);   // Gunboats are very dangerous
    addTargets(entities.drones, 'drone', 2, 3);     // Drones are fast and suicidal
    addTargets(entities.helicopters, 'helicopter', 3, 3.5);
    addTargets(entities.mines, 'mine', 0.5, 0.5);  // Low danger unless very close

    if (allTargets.length === 0) return null;

    if (s > 0.6) {
      // Smart: prioritize by danger score and target class priority.
      allTargets.sort((a, b) => (b.dangerScore + b.priority * 0.8) - (a.dangerScore + a.priority * 0.8));
      return allTargets[0];
    } else if (s > 0.3) {
      // Medium: weighted random from top threats
      allTargets.sort((a, b) => (b.dangerScore + b.priority * 0.8) - (a.dangerScore + a.priority * 0.8));
      const idx = Math.floor(this.random() * Math.min(3, allTargets.length));
      return allTargets[idx];
    } else {
      // Dumb: random target
      return allTargets[Math.floor(this.random() * allTargets.length)];
    }
  }

  private findNearestThreat(
    entities: GameEntities, x: number, y: number
  ): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;

    const check = (list: { x: number; y: number; alive: boolean }[]) => {
      for (const e of list) {
        if (!e.alive) continue;
        const d = (e.x - x) ** 2 + (e.y - y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
    };

    check(entities.fabs);
    check(entities.cmbs);
    check(entities.gunboats);
    check(entities.drones);
    check(entities.helicopters);
    return best;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
