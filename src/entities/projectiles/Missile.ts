import { Container, Graphics } from 'pixi.js';
import { COLORS } from '@/app/constants';
import { getQuality } from '@/app/quality';
import { registerVar } from '@/debug/tuning-registry';

let nextMissileId = 1;

/** Maximum speed multiplier missiles accelerate to */
export let ACCEL_MULTIPLIER = 2.5;
/** How quickly missiles accelerate (higher = faster ramp) */
export let ACCEL_RATE = 1.6;
/** Turn rate for homing missiles (radians/sec) */
export let HOMING_TURN_RATE = 4;
/** Seconds of straight flight before homing activates */
export let HOMING_DELAY = 0.5;

registerVar({ key: 'missile.accelMultiplier', label: 'Accel Multiplier', category: 'Missiles', min: 1, max: 5, step: 0.1, get: () => ACCEL_MULTIPLIER, set: v => { ACCEL_MULTIPLIER = v; }, default: 2.5 });
registerVar({ key: 'missile.accelRate', label: 'Accel Rate', category: 'Missiles', min: 0.1, max: 5, step: 0.1, get: () => ACCEL_RATE, set: v => { ACCEL_RATE = v; }, default: 1.6 });
registerVar({ key: 'missile.homingTurnRate', label: 'Homing Turn Rate', category: 'Missiles', min: 0.5, max: 12, step: 0.5, get: () => HOMING_TURN_RATE, set: v => { HOMING_TURN_RATE = v; }, default: 4 });
registerVar({ key: 'missile.homingDelay', label: 'Homing Delay', category: 'Missiles', min: 0, max: 3, step: 0.1, get: () => HOMING_DELAY, set: v => { HOMING_DELAY = v; }, default: 0.5 });

export class Missile extends Container {
  public id: number;
  public vx: number;
  public vy: number;
  public speed: number;
  public damage: number;
  public lifetime: number;
  public radius: number;
  public blastRadius: number;
  public alive: boolean = true;
  public isPlayerMissile: boolean;
  public canTriggerImpactPowerups: boolean;
  public targetX: number;
  public targetY: number;
  public splashRequested: boolean = false;

  private missileGraphics: Graphics;
  private trailGraphics: Graphics;
  private smokePoints: SmokeParticle[] = [];
  private flickerTimer: number = 0;
  private age: number = 0;
  private smokeSpawnTimer: number = 0;
  private retargetCounter: number = 0;
  private _renderFrame: number = 0;
  private readonly _renderSkip: number;
  private readonly _enableGlow: boolean;
  private readonly _maxSmoke: number;

  /** The base speed the missile was created with (before acceleration) */
  private baseSpeed: number;
  /** Maximum speed after full acceleration */
  private maxSpeed: number;
  /** Current direction angle */
  private fixedAngle: number;
  /** Cached trig values — computed once per frame in update(), reused in smoke spawn + drawTrail() */
  private _cosAngle: number = 0;
  private _sinAngle: number = 0;
  // Homing constants moved to module-level mutable vars for tuning
  /** Reference to homing target — missile steers toward it while alive */
  private homingTarget: { x: number; y: number; alive: boolean } | null = null;
  /** Reference to all enemies for auto-targeting (player missiles only) */
  private enemyListProvider: (() => { x: number; y: number; alive: boolean }[]) | null = null;

  constructor(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    speed: number,
    damage: number,
    lifetime: number,
    radius: number,
    isPlayer: boolean,
    canTriggerImpactPowerups: boolean = isPlayer,
    homingTarget?: { x: number; y: number; alive: boolean } | null,
    blastRadius: number = 0,
  ) {
    super();
    this.id = nextMissileId++;
    this.position.set(x, y);
    this.targetX = targetX;
    this.targetY = targetY;
    this.baseSpeed = speed;
    this.maxSpeed = speed * ACCEL_MULTIPLIER;
    this.speed = speed * 0.5; // Start at half speed — quick off the rail
    this.damage = damage;
    this.lifetime = lifetime;
    this.radius = radius;
    this.isPlayerMissile = isPlayer;
    this.canTriggerImpactPowerups = canTriggerImpactPowerups;
    this.blastRadius = blastRadius;

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.fixedAngle = Math.atan2(dy, dx);
    this._cosAngle = Math.cos(this.fixedAngle);
    this._sinAngle = Math.sin(this.fixedAngle);
    this.vx = (dx / dist) * this.speed;
    this.vy = (dy / dist) * this.speed;
    this.rotation = this.fixedAngle + Math.PI / 2;
    this.homingTarget = homingTarget ?? null;
    this.enemyListProvider = null;

    const quality = getQuality();
    this._renderSkip = quality.renderSkipCosmetic;
    this._enableGlow = quality.enableMissileGlow;
    this._maxSmoke = quality.maxMissileSmokeParticles;

    this.trailGraphics = new Graphics();
    this.addChild(this.trailGraphics);

    this.missileGraphics = new Graphics();
    this.addChild(this.missileGraphics);
  }

  /** Set a provider that returns all enemies — missile will auto-target nearest */
  setEnemyListProvider(provider: () => { x: number; y: number; alive: boolean }[]): void {
    this.enemyListProvider = provider;
  }

  /** Find and lock onto the nearest alive enemy */
  private acquireNearestTarget(): void {
    if (!this.enemyListProvider) return;
    const enemies = this.enemyListProvider();
    let bestDist = Infinity;
    let bestTarget: { x: number; y: number; alive: boolean } | null = null;

    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestTarget = e;
      }
    }

    if (bestTarget) {
      this.homingTarget = bestTarget;
    }
  }

  private drawMissile(): void {
    const g = this.missileGraphics;
    g.clear();
    const color = this.isPlayerMissile ? COLORS.amber : COLORS.red;
    const accelT = Math.min(1.0, this.age * ACCEL_RATE);

    // Outer glow — grows brighter as missile accelerates (skip on mobile)
    if (this._enableGlow) {
      const glowAlpha = 0.1 + accelT * 0.15;
      const glowSize = 9 + accelT * 4;
      g.circle(0, 0, glowSize).fill({ color, alpha: glowAlpha });
    }

    // Missile body — sleeker shape
    g.moveTo(0, -10)
      .lineTo(-3, 3)
      .lineTo(-1, 6)
      .lineTo(1, 6)
      .lineTo(3, 3)
      .lineTo(0, -10)
      .fill({ color, alpha: 0.9 });

    // Fins
    g.moveTo(-3, 3).lineTo(-5, 7).lineTo(-1, 5).fill({ color, alpha: 0.6 });
    g.moveTo(3, 3).lineTo(5, 7).lineTo(1, 5).fill({ color, alpha: 0.6 });

    // Hot white core at nose
    g.circle(0, -3, 2.5).fill({ color: 0xffffff, alpha: 0.8 });

    // Engine flare — grows with acceleration
    const flareLen = 6 + accelT * 12;
    const flareWidth = 2 + accelT * 2;
    g.moveTo(-flareWidth, 6)
      .lineTo(0, 6 + flareLen)
      .lineTo(flareWidth, 6)
      .fill({ color, alpha: 0.5 + accelT * 0.3 });

    // Inner hot engine flare
    g.moveTo(-flareWidth * 0.4, 6)
      .lineTo(0, 6 + flareLen * 0.7)
      .lineTo(flareWidth * 0.4, 6)
      .fill({ color: 0xffffff, alpha: 0.4 + accelT * 0.3 });
  }

  update(dt: number): void {
    if (!this.alive) return;

    this.flickerTimer += dt;
    this.age += dt;

    // ── Acceleration ──
    // Missile starts nearly stationary and accelerates dramatically
    const accelT = Math.min(1.0, this.age * ACCEL_RATE);
    // Cubic ease-in for dramatic slow-to-fast feel
    const easedT = accelT * accelT * accelT;
    this.speed = this.baseSpeed * 0.5 + (this.maxSpeed - this.baseSpeed * 0.5) * easedT;

    // ── Homing: steer toward target if alive ──
    // Throttle retargeting to every 6 frames (~100ms) to reduce enemy list allocation
    if (this.isPlayerMissile && this.enemyListProvider) {
      this.retargetCounter++;
      if (this.retargetCounter >= 6 || !this.homingTarget || !this.homingTarget.alive) {
        this.retargetCounter = 0;
        this.acquireNearestTarget();
      }
    }
    if (this.age >= HOMING_DELAY && this.homingTarget && this.homingTarget.alive) {
      const dx = this.homingTarget.x - this.x;
      const dy = this.homingTarget.y - this.y;
      const desiredAngle = Math.atan2(dy, dx);
      let angleDiff = desiredAngle - this.fixedAngle;
      // Normalize to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      const maxTurn = HOMING_TURN_RATE * dt;
      if (Math.abs(angleDiff) <= maxTurn) {
        this.fixedAngle = desiredAngle;
      } else {
        this.fixedAngle += Math.sign(angleDiff) * maxTurn;
      }
      this.rotation = this.fixedAngle + Math.PI / 2;
    }

    // ── Update cached trig + velocity from current angle and speed ──
    this._cosAngle = Math.cos(this.fixedAngle);
    this._sinAngle = Math.sin(this.fixedAngle);
    this.vx = this._cosAngle * this.speed;
    this.vy = this._sinAngle * this.speed;

    // ── Spawn smoke trail particles ──
    this.smokeSpawnTimer -= dt;
    if (this.smokeSpawnTimer <= 0) {
      // Spawn rate increases with speed (more exhaust at higher speeds)
      const spawnRate = 0.01 + (1 - easedT) * 0.03;
      this.smokeSpawnTimer = spawnRate;

      // Smoke spawns at the engine (behind missile) — uses cached trig
      const exhaustX = this.x - this._cosAngle * 8;
      const exhaustY = this.y - this._sinAngle * 8;

      // Slight random spread
      const spread = 2 + easedT * 4;

      // Pre-cap: drop oldest if at limit, before pushing
      if (this.smokePoints.length >= this._maxSmoke) {
        this.smokePoints[0] = this.smokePoints[this.smokePoints.length - 1];
        this.smokePoints.pop();
      }
      this.smokePoints.push({
        x: exhaustX + (Math.random() - 0.5) * spread,
        y: exhaustY + (Math.random() - 0.5) * spread,
        age: 0,
        maxAge: 0.6 + Math.random() * 0.8,
        size: 1.5 + Math.random() * 2 + easedT * 2,
        driftX: -this._cosAngle * (10 + easedT * 30) + (Math.random() - 0.5) * 25,
        driftY: -this._sinAngle * (10 + easedT * 30) + (Math.random() - 0.5) * 25,
      });
    }

    // Update smoke particles
    for (const p of this.smokePoints) {
      p.age += dt;
      p.x += p.driftX * dt;
      p.y += p.driftY * dt;
      p.size += dt * 4;
    }
    // Remove expired smoke (swap-and-pop to avoid per-frame array allocation)
    for (let i = this.smokePoints.length - 1; i >= 0; i--) {
      if (this.smokePoints[i].age >= this.smokePoints[i].maxAge) {
        this.smokePoints[i] = this.smokePoints[this.smokePoints.length - 1];
        this.smokePoints.pop();
      }
    }
    // Cap already enforced pre-push above — no splice needed

    // ── Move missile ──
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.alive = false;
      this.splashRequested = true;
    }

    // Kill if way off screen vertically (no splash — invisible)
    if (this.y < -100 || this.y > 820) {
      this.alive = false;
    }

    // Redraw missile (engine flare changes with speed) — throttled on mobile
    this._renderFrame++;
    const shouldRender = this._renderSkip <= 0 || this._renderFrame % this._renderSkip === 0;
    if (shouldRender) {
      this.drawMissile();
      this.drawTrail();
    }

    // Engine flicker effect — more intense at higher speeds
    const flickerAlpha = 0.5 + Math.sin(this.flickerTimer * 35) * 0.3;
    this.missileGraphics.alpha = 0.7 + flickerAlpha * 0.3;
  }

  private drawTrail(): void {
    const g = this.trailGraphics;
    g.clear();

    // Use cached trig (rotation = fixedAngle + PI/2, so -rotation negates it)
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);

    // Draw smoke particles (in world space, converted to local)
    for (const p of this.smokePoints) {
      const t = p.age / p.maxAge; // 0→1
      const alpha = (1 - t) * 0.4;
      if (alpha < 0.01) continue;

      // Convert world position to local space
      const worldX = p.x - this.x;
      const worldY = p.y - this.y;
      const lx = worldX * cos - worldY * sin;
      const ly = worldX * sin + worldY * cos;

      const smokeColor = 0xccaa88;
      g.circle(lx, ly, p.size).fill({ color: smokeColor, alpha: alpha * 0.4 });
      if (this._enableGlow && t < 0.25) {
        const coreAlpha = (1 - t / 0.25) * 0.5;
        g.circle(lx, ly, p.size * 0.4).fill({ color: 0xffffff, alpha: coreAlpha });
      }
    }

    // Hot exhaust line right behind the missile
    const color = this.isPlayerMissile ? COLORS.amber : COLORS.red;
    const exhaustLen = 4 + this.speed * 0.015;
    g.moveTo(0, 6).lineTo(0, 6 + exhaustLen).stroke({ width: 2, color, alpha: 0.7 });
    g.moveTo(0, 6).lineTo(0, 6 + exhaustLen * 0.6).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });

    // Heat shimmer — subtle wobbling transparent circles behind exhaust (skip on mobile)
    if (this._enableGlow) {
      const shimmerT = this.age * 8;
      for (let i = 1; i <= 3; i++) {
        const wobbleX = Math.sin(shimmerT + i * 2.1) * (2 + i);
        const wobbleY = 6 + exhaustLen + i * 6 + Math.cos(shimmerT + i * 1.7) * 2;
        g.circle(wobbleX, wobbleY, 3 + i).fill({ color, alpha: 0.04 });
      }
    }
  }
}

interface SmokeParticle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  size: number;
  driftX: number;
  driftY: number;
}

export function resetMissileIdCounter(): void {
  nextMissileId = 1;
}
