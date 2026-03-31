import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';
import { FAB_STATS } from './enemy-types';
import { Tanker } from '@/entities/tankers/Tanker';
import { pushOutOfIsland, pushOffCoast } from '@/scenes/game/map-renderer';
import { getQuality, isMobileDetected } from '@/app/quality';
import { CircularBuffer } from '@/utils/circular-buffer';

let nextFabId = 1;

export class FastAttackBoat extends Container {
  public id: number;
  public hp: number;
  public maxHp: number;
  public speed: number;
  public damage: number;
  public attackRange: number;
  public attackCooldown: number;
  public attackTimer: number = 0;
  public scoreValue: number;
  public alive: boolean = true;
  public targetTanker: Tanker | null = null;
  public contactCooldownTimer: number = 0;

  private shipGraphics: Graphics;
  private trailGraphics: Graphics;
  private smokeGraphics: Graphics;
  private hpGraphics: Graphics;
  private labelText: Text;
  private engineTimer: number = 0;
  private flashTimer: number = 0;
  private smokeParticles: { x: number; y: number; age: number; size: number; vx: number; vy: number }[] = [];
  private smokeTimer: number = 0;
  private wakeGraphics: Graphics;
  private wakePoints: CircularBuffer<{ x: number; y: number }>;
  private wakeTimer: number = 0;
  private _renderFrame: number = 0;
  private readonly _renderSkip: number;

  constructor(x: number, y: number) {
    super();
    this.id = nextFabId++;
    this.hp = FAB_STATS.hp;
    this.maxHp = FAB_STATS.hp;
    this.speed = FAB_STATS.speed;
    this.damage = FAB_STATS.damage;
    this.attackRange = FAB_STATS.attackRange;
    this.attackCooldown = FAB_STATS.attackCooldown;
    this.scoreValue = FAB_STATS.scoreValue;

    this.position.set(x, y);

    const maxWake = Math.floor(20 * getQuality().particleMultiplier);
    this.wakePoints = new CircularBuffer<{ x: number; y: number }>(maxWake || 1);
    this.wakeGraphics = new Graphics();
    this.addChild(this.wakeGraphics);

    this.smokeGraphics = new Graphics();
    this.addChild(this.smokeGraphics);

    this.trailGraphics = new Graphics();
    this.addChild(this.trailGraphics);

    this.shipGraphics = new Graphics();
    this.addChild(this.shipGraphics);

    this.hpGraphics = new Graphics();
    this.hpGraphics.position.set(-10, -18);
    this.addChild(this.hpGraphics);
    this.drawHP();

    const quality = getQuality();
    this._renderSkip = quality.renderSkipCosmetic;

    this.labelText = new Text({
      text: 'FAB',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 8, fill: TEXT_COLORS.red }),
      resolution: TEXT_RESOLUTION,
    });
    this.labelText.anchor.set(0.5, 0);
    this.labelText.position.set(0, 10);
    this.labelText.visible = quality.enableEntityLabels;
    this.addChild(this.labelText);

    this.drawShip();
  }

  private drawHP(): void {
    const g = this.hpGraphics;
    g.clear();
    const w = 20;
    const h = 2;
    g.rect(0, 0, w, h).stroke({ width: 0.5, color: COLORS.red, alpha: 0.5 });
    const fill = Math.max(0, this.hp / this.maxHp);
    g.rect(0, 0, w * fill, h).fill({ color: COLORS.red, alpha: 0.8 });
  }

  private drawShip(): void {
    const g = this.shipGraphics;
    g.clear();

    const damageRatio = 1 - this.hp / this.maxHp;

    // Hull color darkens with damage
    const hullAlpha = damageRatio > 0.66 ? 0.25 : 0.4;

    // Sleeker hull shape
    g.moveTo(0, -10)
      .lineTo(-5, 2)
      .lineTo(-4, 7)
      .lineTo(4, 7)
      .lineTo(5, 2)
      .lineTo(0, -10)
      .fill({ color: COLORS.red, alpha: hullAlpha })
      .stroke({ width: 1.5, color: COLORS.red });
    // Cockpit
    g.circle(0, -2, 1.5).fill({ color: COLORS.red, alpha: 0.8 });

    // Crack lines based on damage
    if (damageRatio > 0.33) {
      const seed = this.id * 12345;
      const c1x = ((seed * 7 + 3) % 6) - 3;
      const c1y = ((seed * 13 + 5) % 10) - 5;
      g.moveTo(c1x - 3, c1y - 3).lineTo(c1x + 4, c1y + 2).stroke({ width: 0.8, color: COLORS.amber, alpha: 0.7 });
      g.moveTo(c1x + 1, c1y - 4).lineTo(c1x - 2, c1y + 3).stroke({ width: 0.8, color: COLORS.amber, alpha: 0.6 });
    }
    if (damageRatio > 0.66) {
      const seed = this.id * 54321;
      const c2x = ((seed * 11 + 7) % 6) - 3;
      const c2y = ((seed * 17 + 2) % 8) - 4;
      g.moveTo(c2x - 4, c2y).lineTo(c2x + 3, c2y + 1).stroke({ width: 1.0, color: COLORS.amber, alpha: 0.8 });
      g.moveTo(c2x, c2y - 3).lineTo(c2x + 1, c2y + 4).stroke({ width: 0.8, color: 0xff6600, alpha: 0.7 });
      g.moveTo(c2x - 2, c2y + 2).lineTo(c2x + 4, c2y - 1).stroke({ width: 0.6, color: 0xff6600, alpha: 0.5 });
    }
  }

  update(dt: number, tankers: Tanker[], playerX?: number, playerY?: number): void {
    if (!this.alive) return;

    if (this.contactCooldownTimer > 0) {
      this.contactCooldownTimer = Math.max(0, this.contactCooldownTimer - dt);
    }

    // Pick target: nearest tanker OR player if closer
    let nearestDist = Infinity;
    let targetX = this.x;
    let targetY = this.y;
    let targetIsTanker = false;
    let nearestTanker: Tanker | null = null;

    // Use squared distances to avoid sqrt in targeting comparisons
    let nearestDistSq = Infinity;
    for (const t of tankers) {
      if (!t.alive || t.completed) continue;
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < nearestDistSq) {
        nearestDistSq = dSq;
        nearestDist = dSq; // store squared for comparison
        targetX = t.x;
        targetY = t.y;
        targetIsTanker = true;
        nearestTanker = t;
      }
    }

    // 40% of FABs prefer attacking the player when nearby
    if (playerX !== undefined && playerY !== undefined && (this.id % 5 < 2)) {
      const pdx = playerX - this.x;
      const pdy = playerY - this.y;
      const playerDistSq = pdx * pdx + pdy * pdy;
      if (playerDistSq < 160000) { // 400 * 400
        nearestDist = playerDistSq;
        targetX = playerX;
        targetY = playerY;
        targetIsTanker = false;
        nearestTanker = null;
      }
    }

    this.targetTanker = nearestTanker;

    if (nearestDist < Infinity) {
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        const nx = dx / dist;
        const ny = dy / dist;
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;

        // Push out of islands and off coastlines
        const corrected = pushOutOfIsland(this.x, this.y);
        this.x = corrected.x;
        this.y = corrected.y;
        const coastCorrected = pushOffCoast(this.x, this.y);
        this.x = coastCorrected.x;
        this.y = coastCorrected.y;

        this.rotation = Math.atan2(ny, nx) + Math.PI / 2;
      }

      this.attackTimer -= dt;
      if (dist < this.attackRange && this.attackTimer <= 0 && targetIsTanker && nearestTanker) {
        nearestTanker.takeDamage(this.damage);
        this.attackTimer = this.attackCooldown;
      }
    }

    this.engineTimer += dt;
    this._renderFrame++;
    const shouldRender = this._renderSkip <= 0 || this._renderFrame % this._renderSkip === 0;
    if (shouldRender) this.drawEngine();
    if (shouldRender) this.updateWake(dt);

    // Flash when damaged
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.shipGraphics.alpha = this.flashTimer % 0.1 > 0.05 ? 0.3 : 1.0;
    } else {
      this.shipGraphics.alpha = 1.0;
    }

    // Damage smoke — throttle on mobile
    if (this.hp < this.maxHp) {
      if (shouldRender) this.updateSmoke(dt);
      // Redraw ship when damaged (for crack lines + wobble) — throttled
      if (shouldRender) this.drawShip();
    }

    // Listing wobble at heavy damage
    const damageRatio = 1 - this.hp / this.maxHp;
    if (damageRatio > 0.66) {
      this.shipGraphics.rotation = (Math.sin(this.engineTimer * 8) * 0.04);
    } else {
      this.shipGraphics.rotation = 0;
    }
  }

  private updateWake(dt: number): void {
    this.wakeTimer -= dt;
    if (this.wakeTimer <= 0) {
      this.wakeTimer = 0.06;
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
      const t = 1 - i / len;
      const alpha = t * 0.07;
      if (alpha < 0.01) continue;
      const spread = 1 + (1 - t) * 5;
      const wp = this.wakePoints.get(len - 1 - i);
      const wx = wp.x - this.x;
      const wy = wp.y - this.y;
      const lx = wx * cos - wy * sin;
      const ly = wx * sin + wy * cos;
      g.circle(lx - spread * 0.4, ly, 0.6 + (1 - t) * 1.0).fill({ color: 0x003355, alpha });
      g.circle(lx + spread * 0.4, ly, 0.6 + (1 - t) * 1.0).fill({ color: 0x003355, alpha });
    }
  }

  private updateSmoke(dt: number): void {
    const damageRatio = 1 - this.hp / this.maxHp;

    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.08 + (1 - damageRatio) * 0.12;
      this.smokeParticles.push({
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 6,
        age: 0,
        size: 1.5 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 8,
        vy: -18 - Math.random() * 14,
      });
    }

    for (const p of this.smokeParticles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 5;
    }
    // In-place removal (swap-and-pop) to avoid per-frame array allocation
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      if (this.smokeParticles[i].age >= 0.8) {
        this.smokeParticles[i] = this.smokeParticles[this.smokeParticles.length - 1];
        this.smokeParticles.pop();
      }
    }
    const maxSmoke = Math.max(4, Math.floor(12 * getQuality().particleMultiplier));
    while (this.smokeParticles.length > maxSmoke) {
      this.smokeParticles[0] = this.smokeParticles[this.smokeParticles.length - 1];
      this.smokeParticles.pop();
    }

    const g = this.smokeGraphics;
    g.clear();
    for (const p of this.smokeParticles) {
      const t = p.age / 0.8;
      const alpha = (1 - t) * 0.3 * damageRatio;
      const color = t < 0.25 ? 0x664422 : 0x333333;
      g.circle(p.x, p.y, p.size).fill({ color, alpha });
    }
  }

  private drawEngine(): void {
    const g = this.trailGraphics;
    g.clear();
    // Small engine flame
    const flicker = 0.6 + Math.sin(this.engineTimer * 45) * 0.4;
    const flameLen = 4 + Math.sin(this.engineTimer * 30) * 2;
    g.moveTo(-2, 7)
      .lineTo(0, 7 + flameLen)
      .lineTo(2, 7)
      .fill({ color: COLORS.red, alpha: 0.4 * flicker });
    g.moveTo(-0.8, 7)
      .lineTo(0, 7 + flameLen * 0.5)
      .lineTo(0.8, 7)
      .fill({ color: 0xffaa66, alpha: 0.5 * flicker });
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.flashTimer = 0.25;
    this.drawHP();
    if (this.hp <= 0) {
      this.alive = false;
      this.visible = false;
    }
  }
}

export function resetFabIdCounter(): void {
  nextFabId = 1;
}
