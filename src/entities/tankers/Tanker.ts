import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';
import { RoutePoint, getSmoothedY } from './tanker-routes';
import { pushOutOfIsland, pushOffCoast } from '@/scenes/game/map-renderer';
import { getIranCoastY, getOmanCoastY } from '@/scenes/game/map-data';
import { registerVar } from '@/debug/tuning-registry';
import { getQuality } from '@/app/quality';
import { CircularBuffer } from '@/utils/circular-buffer';

export let TANKER_HP = 5;
export let TANKER_SPEED = 65;
export let TANKER_MIN_SEPARATION = 75;
export let TANKER_REPULSION_STRENGTH = 100;

registerVar({ key: 'tanker.hp', label: 'Tanker HP', category: 'Tankers', min: 1, max: 20, step: 1, get: () => TANKER_HP, set: v => { TANKER_HP = v; }, default: 5 });
registerVar({ key: 'tanker.speed', label: 'Tanker Speed', category: 'Tankers', min: 10, max: 200, step: 5, get: () => TANKER_SPEED, set: v => { TANKER_SPEED = v; }, default: 65 });

let nextTankerId = 1;

export class Tanker extends Container {
  public id: number;
  public hp: number = TANKER_HP;
  public maxHp: number = TANKER_HP;
  public name: string;
  public route: RoutePoint[];           // original sparse route (kept for compatibility)
  public smoothedRoute: RoutePoint[];   // pre-computed dense route
  public routeIndex: number = 0;
  public speed: number = TANKER_SPEED;
  public alive: boolean = true;
  public completed: boolean = false;
  public contactCooldownTimer: number = 0;
  public lossProcessed: boolean = false;

  private shipGraphics: Graphics;
  private smokeGraphics: Graphics;
  private routeGraphics: Graphics;
  private nameText: Text;
  private hpGraphics: Graphics;
  private smokeParticles: { x: number; y: number; age: number; size: number; vx: number; vy: number }[] = [];
  private smokeTimer: number = 0;
  private prevY: number = 0;
  private hitFlashTimer: number = 0;
  private damageFlashTimer: number = 0;
  private wakeGraphics: Graphics;
  private wakePoints: CircularBuffer<{ x: number; y: number }>;
  private wakeTimer: number = 0;
  private baseSpeed: number = TANKER_SPEED;
  private speedDriftTimer: number = 0;
  private speedDriftPhase: number = 0;
  private _renderFrame: number = 0;
  private readonly _renderSkip: number;
  private yVelocity: number = 0;
  private readonly _enableRouteLines: boolean;
  private _routeDrawn: boolean = false;
  private _routeStartX: number = 0;

  constructor(name: string, route: RoutePoint[], smoothedRoute: RoutePoint[]) {
    super();
    this.id = nextTankerId++;
    this.name = name;
    this.route = route;
    this.smoothedRoute = smoothedRoute;

    if (route.length > 0) {
      this.x = route[0].x;
      this.y = route[0].y;
      this.prevY = this.y;
    }
    this.routeIndex = 1;

    // Each tanker gets a unique speed drift phase for natural variation
    this.speedDriftPhase = this.id * 2.3;
    const quality = getQuality();
    this._renderSkip = quality.renderSkipCosmetic;
    this._enableRouteLines = quality.enableRouteLines;

    // Wake effect (behind everything)
    this.wakePoints = new CircularBuffer<{ x: number; y: number }>(30);
    this.wakeGraphics = new Graphics();
    this.addChild(this.wakeGraphics);

    // Route line (drawn in world coords, added first so it's behind the ship)
    this.routeGraphics = new Graphics();
    this.addChild(this.routeGraphics);

    this.smokeGraphics = new Graphics();
    this.addChild(this.smokeGraphics);

    this.shipGraphics = new Graphics();
    this.drawShip();
    this.addChild(this.shipGraphics);

    this.nameText = new Text({
      text: name,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 9,
        fill: TEXT_COLORS.phosphorGreen,
      }),
      resolution: TEXT_RESOLUTION,
    });
    this.nameText.anchor.set(0.5, 0);
    this.nameText.position.set(0, 14);
    this.addChild(this.nameText);

    this.hpGraphics = new Graphics();
    this.hpGraphics.position.set(-15, -18);
    this.addChild(this.hpGraphics);
    this.drawHP();
  }

  private drawShip(color: number = COLORS.phosphorGreen): void {
    const g = this.shipGraphics;
    g.clear();
    g.moveTo(0, -12)
      .lineTo(-6, -4)
      .lineTo(-6, 10)
      .lineTo(6, 10)
      .lineTo(6, -4)
      .lineTo(0, -12)
      .fill({ color, alpha: 0.2 })
      .stroke({ width: 1, color });
    g.moveTo(-4, 2).lineTo(4, 2).stroke({
      width: 0.5,
      color,
      alpha: 0.5,
    });
  }

  private drawHP(): void {
    const g = this.hpGraphics;
    g.clear();
    const w = 30;
    const h = 3;
    g.rect(0, 0, w, h).stroke({
      width: 0.5,
      color: COLORS.darkGreen,
    });
    const fill = this.hp / this.maxHp;
    const color =
      fill > 0.6 ? COLORS.phosphorGreen : fill > 0.3 ? COLORS.amber : COLORS.red;
    g.rect(0, 0, w * fill, h).fill({ color, alpha: 0.7 });
  }

  /**
   * Draw the planned route as a dashed line ahead of the tanker.
   * Route is drawn once into routeGraphics in world coords (offset from initial tanker X),
   * then repositioned each frame by adjusting the graphics X offset — avoids iterating
   * 300+ route points every frame.
   */
  drawRouteLine(cameraX: number, screenWidth: number): void {
    if (!this.alive || this.completed) {
      if (this._routeDrawn) { this.routeGraphics.clear(); this._routeDrawn = false; }
      return;
    }
    if (!this._enableRouteLines) return;

    if (!this._routeDrawn) {
      // Draw entire route once, in coordinates relative to initial tanker position
      this._routeStartX = this.x;
      const g = this.routeGraphics;
      g.clear();

      const dashLen = 8;
      const gapLen = 6;
      let drawing = true;
      let segLen = 0;

      for (let i = 0; i < this.smoothedRoute.length - 1; i++) {
        const a = this.smoothedRoute[i];
        const b = this.smoothedRoute[i + 1];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.01) continue;
        const nx = dx / len;
        const ny = dy / len;

        let pos = 0;
        while (pos < len) {
          const remaining = drawing ? dashLen - segLen : gapLen - segLen;
          const step = Math.min(remaining, len - pos);

          if (drawing) {
            const sx = a.x + nx * pos - this._routeStartX;
            const sy = a.y + ny * pos - this.y;
            const ex = a.x + nx * (pos + step) - this._routeStartX;
            const ey = a.y + ny * (pos + step) - this.y;
            g.moveTo(sx, sy).lineTo(ex, ey)
              .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.2 });
          }

          segLen += step;
          pos += step;
          const threshold = drawing ? dashLen : gapLen;
          if (segLen >= threshold) {
            segLen = 0;
            drawing = !drawing;
          }
        }
      }
      this._routeDrawn = true;
    }

    // Reposition the cached route graphics to track tanker movement
    this.routeGraphics.x = this._routeStartX - this.x;
  }

  update(dt: number, allTankers?: Tanker[]): void {
    if (!this.alive || this.completed) return;

    if (this.contactCooldownTimer > 0) {
      this.contactCooldownTimer = Math.max(0, this.contactCooldownTimer - dt);
    }

    // Check completion: if we've reached the end of the route
    const endX = this.smoothedRoute[this.smoothedRoute.length - 1].x;
    if (this.x >= endX) {
      this.completed = true;
      return;
    }

    // Gentle speed drift for natural-looking movement (±8% variation)
    this.speedDriftTimer += dt;
    const drift = Math.sin(this.speedDriftTimer * 0.4 + this.speedDriftPhase) * 0.05
      + Math.sin(this.speedDriftTimer * 0.17 + this.speedDriftPhase * 1.7) * 0.03;
    this.speed = this.baseSpeed * (1 + drift);

    // Look up the target Y from the pre-computed smoothed route at our current world X
    const routeTargetY = getSmoothedY(this.smoothedRoute, this.x);

    // Force-based movement for smooth, non-twitchy behavior
    // 1. Route-following force (primary guidance)
    const routeForce = (routeTargetY - this.y) * 1.5;

    // 2. Center-seeking force — gently pull toward channel midpoint
    const iranY = getIranCoastY(this.x);
    const omanY = getOmanCoastY(this.x);
    const channelCenter = (iranY + omanY) / 2;
    const centerForce = (channelCenter - this.y) * 0.3;

    // 3. Edge avoidance — stronger push when near coastlines
    const COAST_MARGIN = 40;
    let edgeForce = 0;
    if (this.y < iranY + COAST_MARGIN) {
      edgeForce = (iranY + COAST_MARGIN - this.y) * 2.0;
    } else if (this.y > omanY - COAST_MARGIN) {
      edgeForce = (omanY - COAST_MARGIN - this.y) * 2.0;
    }

    // 4. Tanker-tanker repulsion force
    let repulsionForce = 0;
    if (allTankers) {
      for (const other of allTankers) {
        if (other === this || !other.alive || other.completed) continue;
        const dx = Math.abs(other.x - this.x);
        if (dx > 150) continue;
        const dy = this.y - other.y;
        const absDy = Math.abs(dy);
        if (absDy < TANKER_MIN_SEPARATION) {
          const overlap = TANKER_MIN_SEPARATION - absDy;
          const sign = dy >= 0 ? 1 : (dy < 0 ? -1 : (this.id > other.id ? 1 : -1));
          const xFactor = 1 - Math.min(1, Math.max(0, (dx - 50) / 100));
          repulsionForce += sign * (overlap / TANKER_MIN_SEPARATION) * TANKER_REPULSION_STRENGTH * xFactor;
        }
      }
    }

    // Combine forces with velocity damping to prevent twitchiness
    const totalForce = routeForce + centerForce * 0.3 + edgeForce + repulsionForce;
    const DAMPING = 0.85;
    this.yVelocity = this.yVelocity * DAMPING + totalForce * dt;
    // Clamp velocity to prevent wild movement
    const maxVel = this.speed * 0.8;
    this.yVelocity = Math.max(-maxVel, Math.min(maxVel, this.yVelocity));
    this.y += this.yVelocity * dt;

    // Move forward (x movement is handled by the camera clamping in GameScene,
    // but we still advance x so the route lookup works)
    this.x += this.speed * dt;

    // Safety fallback: push out of islands and off coastlines
    const corrected = pushOutOfIsland(this.x, this.y);
    this.x = corrected.x;
    this.y = corrected.y;
    const coastCorrected = pushOffCoast(this.x, this.y);
    this.x = coastCorrected.x;
    this.y = coastCorrected.y;

    // Rotation: point in direction of movement
    const moveDy = this.y - this.prevY;
    const moveAngle = Math.atan2(moveDy, this.speed * dt);
    this.rotation = moveAngle + Math.PI / 2;
    this.prevY = this.y;

    // Wake + smoke — throttled on mobile
    this._renderFrame++;
    const shouldRender = this._renderSkip <= 0 || this._renderFrame % this._renderSkip === 0;
    if (shouldRender) this.updateWake(dt);

    // Damage smoke when HP is low
    if (this.hp < this.maxHp && shouldRender) {
      this.updateSmoke(dt);
    }

    // Sprite flash on hit (brief red flash)
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) {
        this.drawShip(this.hp > 0 && this.hp / this.maxHp <= 0.34 ? COLORS.red : COLORS.phosphorGreen);
      }
    }

    // Sustained red flash when critically damaged
    if (this.hp > 0 && this.hp / this.maxHp <= 0.34 && this.hitFlashTimer <= 0) {
      this.damageFlashTimer += dt;
      const flash = Math.sin(this.damageFlashTimer * Math.PI * 3) > 0;
      this.drawShip(flash ? COLORS.red : COLORS.phosphorGreen);
    }
  }

  private updateWake(dt: number): void {
    this.wakeTimer -= dt;
    if (this.wakeTimer <= 0) {
      this.wakeTimer = 0.05;
      this.wakePoints.push({ x: this.x, y: this.y });
    }

    const g = this.wakeGraphics;
    g.clear();
    const len = this.wakePoints.length;
    if (len < 2) return;

    // Cache trig once for all wake points
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);

    for (let i = 0; i < len - 1; i++) {
      const t = 1 - i / len; // 1=newest, 0=oldest
      const alpha = t * 0.12;
      if (alpha < 0.01) continue;

      const spread = 2 + (1 - t) * 12;
      const wp = this.wakePoints.get(len - 1 - i);

      // Convert to local space
      const wx = wp.x - this.x;
      const wy = wp.y - this.y;
      const lx = wx * cos - wy * sin;
      const ly = wx * sin + wy * cos;

      // Left and right wake lines
      g.circle(lx - spread * 0.5, ly, 1 + (1 - t) * 1.5).fill({ color: 0x004466, alpha });
      g.circle(lx + spread * 0.5, ly, 1 + (1 - t) * 1.5).fill({ color: 0x004466, alpha });
    }
  }

  private updateSmoke(dt: number): void {
    const damageRatio = 1 - this.hp / this.maxHp;

    // Spawn smoke more frequently as damage increases
    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.08 + (1 - damageRatio) * 0.12;
      this.smokeParticles.push({
        x: this.x + (Math.random() - 0.5) * 8,
        y: this.y + (Math.random() - 0.5) * 8,
        age: 0,
        size: 2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 15,
        vy: -20 - Math.random() * 20,
      });
    }

    // Update particles
    for (const p of this.smokeParticles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 6;
    }
    // In-place removal to avoid per-frame array allocation
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      if (this.smokeParticles[i].age >= 1.2) {
        this.smokeParticles[i] = this.smokeParticles[this.smokeParticles.length - 1];
        this.smokeParticles.pop();
      }
    }
    // Cap particles using swap-and-pop from front (avoids O(n) splice)
    while (this.smokeParticles.length > 20) {
      this.smokeParticles[0] = this.smokeParticles[this.smokeParticles.length - 1];
      this.smokeParticles.pop();
    }

    // Draw smoke
    const g = this.smokeGraphics;
    g.clear();
    // Cache trig once for all smoke particles
    const smokeCos = Math.cos(-this.rotation);
    const smokeSin = Math.sin(-this.rotation);
    for (const p of this.smokeParticles) {
      const t = p.age / 1.2;
      const alpha = (1 - t) * 0.3 * damageRatio;
      const lx = p.x - this.x;
      const ly = p.y - this.y;
      const localX = lx * smokeCos - ly * smokeSin;
      const localY = lx * smokeSin + ly * smokeCos;
      // Dark smoke with orange tint at base
      const color = t < 0.3 ? 0x664422 : 0x333333;
      g.circle(localX, localY, p.size).fill({ color, alpha });
    }
  }

  heal(amount: number): number {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.drawHP();
    if (this.hp >= this.maxHp) {
      this.drawShip(COLORS.phosphorGreen);
      this.damageFlashTimer = 0;
    }
    return this.hp - before; // return actual HP healed
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.drawHP();
    this.hitFlashTimer = 0.15;
    this.drawShip(COLORS.red);
    if (this.hp <= 0) {
      this.alive = false;
      this.alpha = 0.3;
    }
  }
}

export function resetTankerIdCounter(): void {
  nextTankerId = 1;
}
