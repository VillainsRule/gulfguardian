import { Container, Graphics } from 'pixi.js';
import { COLORS, GAME_HEIGHT } from '@/app/constants';
import { getQuality, isMobileDetected } from '@/app/quality';

const WAKE_MAX_POINTS = 60;
const WAKE_BASE_SPAWN_INTERVAL = 0.03; // seconds between wake points at low speed
const WAKE_MIN_SPAWN_INTERVAL = 0.015; // seconds between wake points at high speed

// Module-level scratch arrays for wake chevron drawing — avoids per-frame allocation
const _portScratch: { lx: number; ly: number; t: number }[] = [];
const _starScratch: { lx: number; ly: number; t: number }[] = [];

export class PlayerShip extends Container {
  private shipGraphics: Graphics;
  private wakeGraphics: Graphics;
  private thrustGraphics: Graphics;
  private shieldGraphics: Graphics;

  public vx: number = 0;
  public vy: number = 0;

  // Asteroids-style physics
  public heading: number = 0; // Ship facing angle in radians (0 = right)
  public currentSpeed: number = 0;
  public throttle: number = 0;
  public isThrusting: boolean = false;

  // Visual state flags (set by GameScene)
  public overheatFlash: boolean = false;
  public shieldActive: boolean = false;

  // Wake trail
  private wakePoints: { x: number; y: number; age: number; size: number; side: -1 | 1 }[] = [];
  private wakeTimer: number = 0;

  // Bow spray particles (active when boosting)
  private bowSprayParticles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }[] = [];

  // Turret & radar rotation
  private turretTimer: number = 0;

  // Thrust flame animation
  private thrustFlickerTimer: number = 0;

  // Render throttling for mobile perf
  private _renderFrame: number = 0;
  private _renderSkip: number = 0;
  // Accumulated timer to replace Date.now() calls
  private _animTimer: number = 0;

  constructor() {
    super();

    this.wakeGraphics = new Graphics();
    this.addChild(this.wakeGraphics);

    this.thrustGraphics = new Graphics();
    this.addChild(this.thrustGraphics);

    this.shieldGraphics = new Graphics();
    this.addChild(this.shieldGraphics);

    this.shipGraphics = new Graphics();
    this.addChild(this.shipGraphics);

    this._renderSkip = getQuality().renderSkipCosmetic;
    this.drawShip();

    // Start facing right
    this.heading = 0;
    this.rotation = Math.PI / 2; // sprite drawn pointing up, so +90° = right
  }

  private drawShip(): void {
    const g = this.shipGraphics;
    g.clear();

    // Determine colors based on overheat state
    let hullColor: number = COLORS.cyan;
    let hullAlpha = 0.3;
    if (this.overheatFlash) {
      const flash = Math.sin(this._animTimer * 12.5); // was Date.now()/80
      hullColor = flash > 0 ? COLORS.red : COLORS.cyan;
      hullAlpha = flash > 0 ? 0.5 : 0.3;
    }

    // Main hull — sleeker destroyer shape
    g.moveTo(0, -15)
      .lineTo(-8, 5)
      .lineTo(-6, 12)
      .lineTo(6, 12)
      .lineTo(8, 5)
      .lineTo(0, -15)
      .fill({ color: hullColor, alpha: hullAlpha })
      .stroke({ width: 1.5, color: hullColor });

    // Deck details
    g.moveTo(-4, 0).lineTo(4, 0).stroke({ width: 1, color: hullColor });
    g.moveTo(-3, 4).lineTo(3, 4).stroke({ width: 1, color: hullColor });

    // Forward turret (near bow)
    const fwdTurretAngle = this.turretTimer * 0.5;
    g.circle(0, -8, 2.5).stroke({ width: 1, color: hullColor, alpha: 0.7 });
    const fwdBarrelLen = 6;
    g.moveTo(0, -8)
      .lineTo(Math.sin(fwdTurretAngle) * fwdBarrelLen, -8 - Math.cos(fwdTurretAngle) * fwdBarrelLen)
      .stroke({ width: 1.2, color: hullColor, alpha: 0.8 });

    // Aft turret (near stern)
    const aftTurretAngle = this.turretTimer * 0.3 + Math.PI;
    g.circle(0, 7, 2).stroke({ width: 1, color: hullColor, alpha: 0.7 });
    const aftBarrelLen = 5;
    g.moveTo(0, 7)
      .lineTo(Math.sin(aftTurretAngle) * aftBarrelLen, 7 - Math.cos(aftTurretAngle) * aftBarrelLen)
      .stroke({ width: 1.2, color: hullColor, alpha: 0.8 });

    // Radar array (rotating dish on superstructure)
    const radarAngle = this.turretTimer * 2.0;
    const radarArmLen = 4;
    g.circle(0, 1, 1.2).fill({ color: hullColor, alpha: 0.8 });
    g.moveTo(
      Math.sin(radarAngle) * -radarArmLen,
      1 + Math.cos(radarAngle) * -radarArmLen * 0.3
    ).lineTo(
      Math.sin(radarAngle) * radarArmLen,
      1 + Math.cos(radarAngle) * radarArmLen * 0.3
    ).stroke({ width: 1.5, color: hullColor, alpha: 0.9 });
  }

  private drawShield(): void {
    const g = this.shieldGraphics;
    g.clear();
    if (!this.shieldActive) return;

    const pulse = 0.3 + Math.sin(this._animTimer * 6.67) * 0.15; // was Date.now()/150
    const radius = 22 + Math.sin(this._animTimer * 5) * 2; // was Date.now()/200
    // Purple shield bubble
    g.circle(0, 0, radius)
      .fill({ color: 0x8844ff, alpha: pulse * 0.3 })
      .stroke({ width: 2, color: 0x8844ff, alpha: pulse + 0.2 });
    // Inner glow
    g.circle(0, 0, radius * 0.7)
      .stroke({ width: 1, color: 0xaa66ff, alpha: pulse * 0.5 });
  }

  /**
   * Asteroids-style movement: rotation + thrust + inertia.
   * The ship rotates freely and thrusts in the facing direction.
   */
  updateAsteroidsMovement(
    turnInput: number,    // -1 = left, +1 = right
    thrustInput: number,  // 1 = thrusting, 0 = not
    turnSpeed: number,
    thrustPower: number,
    drag: number,
    dt: number,
    minX: number,
    maxX: number,
  ): void {
    // Rotate ship
    this.heading += turnInput * turnSpeed * dt;

    // Apply thrust in facing direction
    this.isThrusting = thrustInput > 0;
    if (this.isThrusting) {
      this.vx += Math.cos(this.heading) * thrustPower * dt;
      this.vy += Math.sin(this.heading) * thrustPower * dt;
    }

    // Apply drag (friction)
    this.vx *= (1 - drag * dt);
    this.vy *= (1 - drag * dt);

    // Cap max speed
    const maxSpeed = 260;
    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > maxSpeed) {
      this.vx = (this.vx / spd) * maxSpeed;
      this.vy = (this.vy / spd) * maxSpeed;
    }

    // Move
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Clamp to bounds
    this.x = Math.max(minX, Math.min(maxX, this.x));
    this.y = Math.max(50, Math.min(GAME_HEIGHT - 70, this.y));

    // Reuse already-computed speed (was: redundant sqrt)
    this.currentSpeed = spd > maxSpeed ? maxSpeed : spd;

    // Update rotation — sprite drawn pointing up, heading 0 = right
    this.rotation = this.heading + Math.PI / 2;

    // Update visuals
    this.thrustFlickerTimer += dt;
    this.turretTimer += dt;
    this._animTimer += dt;
    this._renderFrame++;
    this.updateWake(dt);
    // Throttle cosmetic redraws on mobile (skip every Nth frame)
    if (this._renderSkip <= 0 || this._renderFrame % this._renderSkip === 0) {
      this.drawShip();
      this.drawThrust();
      this.drawShield();
    }
  }

  /**
   * River Raid-style movement: ship always faces right, moves in both axes.
   * The camera auto-scrolls; the caller clamps X to screen bounds.
   * currentSpeed is set by the caller to include scroll speed for wake effects.
   */
  updateRiverRaidMovement(
    horizontalInput: number, // -1 = back (left), +1 = forward (right)
    verticalInput: number,   // -1 = up, +1 = down
    hSpeed: number,
    vSpeed: number,
    dt: number,
  ): void {
    // Ship always faces right — no rotation
    this.heading = 0;
    this.rotation = Math.PI / 2;

    const accel = 14.0; // responsiveness — snappy arcade feel

    // Vertical movement with smoothing
    const targetVy = verticalInput * vSpeed;
    this.vy += (targetVy - this.vy) * Math.min(1, accel * dt);
    if (Math.abs(verticalInput) < 0.01 && Math.abs(this.vy) < 2) this.vy = 0;

    // Horizontal movement with smoothing
    const targetVx = horizontalInput * hSpeed;
    this.vx += (targetVx - this.vx) * Math.min(1, accel * dt);
    if (Math.abs(horizontalInput) < 0.01 && Math.abs(this.vx) < 2) this.vx = 0;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.y = Math.max(50, Math.min(GAME_HEIGHT - 70, this.y));

    // Show thrust visual when moving (currentSpeed set by caller to include scroll)
    this.isThrusting = this.currentSpeed > 30;

    // Update visuals
    this.thrustFlickerTimer += dt;
    this.turretTimer += dt;
    this._animTimer += dt;
    this._renderFrame++;
    this.updateWake(dt);
    // Throttle cosmetic redraws on mobile (skip every Nth frame)
    if (this._renderSkip <= 0 || this._renderFrame % this._renderSkip === 0) {
      this.drawShip();
      this.drawThrust();
      this.drawShield();
    }
  }

  /** Legacy method for backward compat — just delegates */
  updateForwardMovement(
    dx: number,
    dy: number,
    moveSpeed: number,
    dt: number,
    minX: number,
    maxX: number,
  ): void {
    // Convert WASD to Asteroids: left/right = turn, up = thrust
    const turnInput = dx;
    const thrustInput = dy < 0 ? 1 : 0;
    this.updateAsteroidsMovement(turnInput, thrustInput, 3.5, moveSpeed * 2, 2.5, dt, minX, maxX);
  }

  private drawThrust(): void {
    const g = this.thrustGraphics;
    g.clear();

    if (!this.isThrusting) return;

    // Flickering engine flame at the stern
    const flicker = 0.6 + Math.sin(this.thrustFlickerTimer * 40) * 0.3 + Math.sin(this.thrustFlickerTimer * 67) * 0.1;
    const flameLen = (8 + Math.sin(this.thrustFlickerTimer * 25) * 4) * flicker;
    const flameWidth = 3 + Math.sin(this.thrustFlickerTimer * 33) * 1.5;

    // Outer flame (cyan)
    g.moveTo(-flameWidth, 12)
      .lineTo(0, 12 + flameLen)
      .lineTo(flameWidth, 12)
      .fill({ color: COLORS.cyan, alpha: 0.5 * flicker });

    // Inner hot core (white)
    g.moveTo(-flameWidth * 0.4, 12)
      .lineTo(0, 12 + flameLen * 0.6)
      .lineTo(flameWidth * 0.4, 12)
      .fill({ color: 0xffffff, alpha: 0.6 * flicker });

    // Engine glow
    g.circle(0, 12, 4 + flameLen * 0.2).fill({ color: COLORS.cyan, alpha: 0.12 * flicker });
  }

  private updateWake(dt: number): void {
    // Age existing points
    for (const p of this.wakePoints) {
      p.age += dt;
    }
    // Remove old points (swap-and-pop to avoid O(n) splice)
    for (let i = this.wakePoints.length - 1; i >= 0; i--) {
      if (this.wakePoints[i].age >= 1.5) {
        this.wakePoints[i] = this.wakePoints[this.wakePoints.length - 1];
        this.wakePoints.pop();
      }
    }

    // Spawn wake when moving — speed-dependent density
    if (this.currentSpeed > 20) {
      this.wakeTimer -= dt;
      // Faster speed = denser wake (shorter spawn interval)
      const speedFactor = Math.min(1, this.currentSpeed / 200);
      const spawnInterval = WAKE_BASE_SPAWN_INTERVAL - (WAKE_BASE_SPAWN_INTERVAL - WAKE_MIN_SPAWN_INTERVAL) * speedFactor;
      if (this.wakeTimer <= 0) {
        this.wakeTimer = spawnInterval;
        // Stern is opposite of heading
        const sternAngle = this.heading + Math.PI;
        const sternX = this.x + Math.cos(sternAngle) * 15;
        const sternY = this.y + Math.sin(sternAngle) * 15;
        const perpX = Math.cos(sternAngle + Math.PI / 2);
        const perpY = Math.sin(sternAngle + Math.PI / 2);
        const spread = 5 + this.currentSpeed * 0.02;
        const baseSize = 1.5 + this.currentSpeed * 0.008;
        this.wakePoints.push(
          { x: sternX + perpX * spread, y: sternY + perpY * spread, age: 0, size: baseSize, side: 1 },
          { x: sternX - perpX * spread, y: sternY - perpY * spread, age: 0, size: baseSize, side: -1 },
        );
        const maxWake = getQuality().wakeTrailLength * 2;
        while (this.wakePoints.length > maxWake) {
          // Swap-and-pop from front (avoids O(n) splice)
          this.wakePoints[0] = this.wakePoints[this.wakePoints.length - 1];
          this.wakePoints.pop();
        }
      }
    }

    // Bow spray when boosting (speed > 150) — skip on low quality
    if (this.currentSpeed > 150 && getQuality().enableBowSpray) {
      // Cache trig once for all spray particles this frame
      const cosH = Math.cos(this.heading);
      const sinH = Math.sin(this.heading);
      const perpAngle = this.heading + Math.PI / 2;
      const cosP = Math.cos(perpAngle);
      const sinP = Math.sin(perpAngle);
      const bowX = this.x + cosH * 15;
      const bowY = this.y + sinH * 15;
      // Spawn 1-2 bow spray particles per frame
      const spawnCount = 1 + (Math.random() > 0.5 ? 1 : 0);
      for (let i = 0; i < spawnCount; i++) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const perpSpeed = (20 + Math.random() * 20) * side;
        const fwdSpeed = -(15 + Math.random() * 20);
        this.bowSprayParticles.push({
          x: bowX,
          y: bowY,
          vx: cosH * fwdSpeed + cosP * perpSpeed,
          vy: sinH * fwdSpeed + sinP * perpSpeed,
          life: 0.3 + Math.random() * 0.2,
          maxLife: 0.5,
          size: 0.8 + Math.random() * 0.7,
        });
      }
      // Cap at 20 particles (swap-and-pop avoids O(n) splice)
      while (this.bowSprayParticles.length > 20) {
        this.bowSprayParticles[0] = this.bowSprayParticles[this.bowSprayParticles.length - 1];
        this.bowSprayParticles.pop();
      }
    }

    // Update bow spray
    for (const p of this.bowSprayParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= dt;
    }
    // Swap-and-pop removal to avoid per-frame array allocation
    for (let i = this.bowSprayParticles.length - 1; i >= 0; i--) {
      if (this.bowSprayParticles[i].life <= 0) {
        this.bowSprayParticles[i] = this.bowSprayParticles[this.bowSprayParticles.length - 1];
        this.bowSprayParticles.pop();
      }
    }

    this.drawWake();
  }

  private drawWake(): void {
    const g = this.wakeGraphics;
    g.clear();

    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const mobile = isMobileDetected();

    for (const p of this.wakePoints) {
      const t = 1 - p.age / 1.5; // 1 = new, 0 = expired
      const alpha = t * t * 0.25; // quadratic falloff — subtle near stern
      const size = p.size + (1 - t) * 2;

      // Convert world coords to local coords
      const wx = p.x - this.x;
      const wy = p.y - this.y;
      let localX = wx * cos - wy * sin;
      const localY = wx * sin + wy * cos;

      // V-spread: push wake outward based on age for chevron shape
      localX += p.side * p.age * 10;

      g.circle(localX, localY, size).fill({ color: COLORS.cyan, alpha });

      // Bright white core for fresh points — skip on mobile
      if (!mobile && t > 0.7) {
        g.circle(localX, localY, size * 0.4).fill({ color: 0xffffff, alpha: (t - 0.7) * 0.8 });
      }
    }

    // Skip chevron connecting lines on mobile (saves many stroke calls)
    if (!mobile) {
      // Reuse module-level scratch arrays (avoids per-frame allocation)
      _portScratch.length = 0;
      _starScratch.length = 0;
      for (const p of this.wakePoints) {
        const t = 1 - p.age / 1.5;
        const wx = p.x - this.x;
        const wy = p.y - this.y;
        let localX = wx * cos - wy * sin;
        const localY = wx * sin + wy * cos;
        localX += p.side * p.age * 10;
        if (p.side === 1) _starScratch.push({ lx: localX, ly: localY, t });
        else _portScratch.push({ lx: localX, ly: localY, t });
      }
      const pairCount = Math.min(_portScratch.length, _starScratch.length);
      for (let i = 0; i < pairCount; i += 2) {
        const alpha = _portScratch[i].t * 0.1;
        if (alpha < 0.01) continue;
        g.moveTo(_portScratch[i].lx, _portScratch[i].ly)
          .lineTo(_starScratch[i].lx, _starScratch[i].ly)
          .stroke({ width: 0.5, color: COLORS.cyan, alpha });
      }
    }

    // Draw bow spray particles
    for (const p of this.bowSprayParticles) {
      const t = p.life / p.maxLife;
      const wx = p.x - this.x;
      const wy = p.y - this.y;
      const localX = wx * cos - wy * sin;
      const localY = wx * sin + wy * cos;
      const alpha = t * 0.6;
      g.circle(localX, localY, p.size).fill({ color: COLORS.cyan, alpha });
      // White core on fresh particles — skip on mobile
      if (!mobile && t > 0.6) {
        g.circle(localX, localY, p.size * 0.4).fill({ color: 0xffffff, alpha: (t - 0.6) * 2.0 });
      }
    }
  }
}
