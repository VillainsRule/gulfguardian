import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';
import { GUNBOAT_STATS } from './enemy-types';
import { pushOutOfIsland, pushOffCoast } from '@/scenes/game/map-renderer';
import { getQuality, isMobileDetected } from '@/app/quality';
import { CircularBuffer } from '@/utils/circular-buffer';

let nextGunboatId = 1;

export class Gunboat extends Container {
  public id: number;
  public hp: number;
  public maxHp: number;
  public speed: number;
  public damage: number;
  public attackRange: number;
  public attackCooldown: number;
  public attackTimer: number;
  public scoreValue: number;
  public alive: boolean = true;
  public contactCooldownTimer: number = 0;

  private baseGraphics: Graphics;
  private smokeGraphics: Graphics;
  private hpGraphics: Graphics;
  private labelText: Text;
  private flashTimer: number = 0;
  private patrolCenterY: number;
  private patrolTimer: number = 0;
  private smokeParticles: { x: number; y: number; age: number; size: number; vx: number; vy: number }[] = [];
  private smokeTimer: number = 0;
  private wakeGraphics: Graphics;
  private wakePoints: CircularBuffer<{ x: number; y: number }>;
  private wakeTimer: number = 0;
  private _renderFrame: number = 0;
  private readonly _renderSkip: number;

  constructor(x: number, y: number) {
    super();
    this.id = nextGunboatId++;
    this.hp = GUNBOAT_STATS.hp;
    this.maxHp = GUNBOAT_STATS.hp;
    this.speed = GUNBOAT_STATS.speed;
    this.damage = GUNBOAT_STATS.damage;
    this.attackRange = GUNBOAT_STATS.attackRange;
    this.attackCooldown = GUNBOAT_STATS.attackCooldown;
    this.attackTimer = this.attackCooldown * 0.3;
    this.scoreValue = GUNBOAT_STATS.scoreValue;
    this.patrolCenterY = y;

    this.position.set(x, y);

    const maxWake = Math.floor(18 * getQuality().particleMultiplier);
    this.wakePoints = new CircularBuffer<{ x: number; y: number }>(maxWake || 1);
    this.wakeGraphics = new Graphics();
    this.addChild(this.wakeGraphics);

    this.smokeGraphics = new Graphics();
    this.addChild(this.smokeGraphics);

    this.baseGraphics = new Graphics();
    this.drawBase();
    this.addChild(this.baseGraphics);

    this.hpGraphics = new Graphics();
    this.hpGraphics.position.set(-18, -22);
    this.addChild(this.hpGraphics);
    this.drawHP();

    const quality = getQuality();
    this._renderSkip = quality.renderSkipCosmetic;

    this.labelText = new Text({
      text: `GUNBOAT`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 9, fontWeight: 'bold', fill: TEXT_COLORS.red }),
      resolution: TEXT_RESOLUTION,
    });
    this.labelText.anchor.set(0.5, 0);
    this.labelText.position.set(0, 18);
    this.labelText.visible = quality.enableEntityLabels;
    this.addChild(this.labelText);
  }

  private drawBase(): void {
    const g = this.baseGraphics;
    g.clear();

    const damageRatio = 1 - this.hp / this.maxHp;
    const hullAlpha = damageRatio > 0.66 ? 0.3 : 0.5;

    // Larger ship shape - diamond with wings
    g.moveTo(0, -14)
      .lineTo(-10, -2)
      .lineTo(-12, 6)
      .lineTo(-8, 12)
      .lineTo(8, 12)
      .lineTo(12, 6)
      .lineTo(10, -2)
      .lineTo(0, -14)
      .fill({ color: COLORS.red, alpha: hullAlpha })
      .stroke({ width: 2, color: COLORS.red });
    // Deck detail
    g.moveTo(-6, 2).lineTo(6, 2).stroke({ width: 1, color: COLORS.red, alpha: 0.6 });
    g.moveTo(-4, 6).lineTo(4, 6).stroke({ width: 1, color: COLORS.red, alpha: 0.6 });
    // Superstructure
    g.rect(-3, -4, 6, 5).fill({ color: COLORS.red, alpha: 0.3 }).stroke({ width: 0.5, color: COLORS.red, alpha: 0.5 });
    // Turret circle
    g.circle(0, -1, 3).stroke({ width: 1, color: COLORS.red, alpha: 0.7 });
    // Turret barrel (rotating based on patrol timer)
    const turretAngle = this.patrolTimer * 0.8;
    const barrelLen = 8;
    g.moveTo(0, -1)
      .lineTo(Math.sin(turretAngle) * barrelLen, -1 - Math.cos(turretAngle) * barrelLen)
      .stroke({ width: 1.5, color: COLORS.red, alpha: 0.8 });

    // Crack lines based on damage
    if (damageRatio > 0.33) {
      const seed = this.id * 12345;
      const c1x = ((seed * 7 + 3) % 12) - 6;
      const c1y = ((seed * 13 + 5) % 16) - 8;
      g.moveTo(c1x - 5, c1y - 3).lineTo(c1x + 6, c1y + 3).stroke({ width: 0.8, color: COLORS.amber, alpha: 0.7 });
      g.moveTo(c1x + 3, c1y - 5).lineTo(c1x - 2, c1y + 4).stroke({ width: 0.8, color: COLORS.amber, alpha: 0.6 });
      g.moveTo(c1x - 3, c1y + 1).lineTo(c1x + 4, c1y - 2).stroke({ width: 0.7, color: COLORS.amber, alpha: 0.5 });
    }
    if (damageRatio > 0.66) {
      const seed = this.id * 54321;
      const c2x = ((seed * 11 + 7) % 14) - 7;
      const c2y = ((seed * 17 + 2) % 16) - 8;
      g.moveTo(c2x - 6, c2y).lineTo(c2x + 5, c2y + 2).stroke({ width: 1.0, color: COLORS.amber, alpha: 0.8 });
      g.moveTo(c2x, c2y - 6).lineTo(c2x + 2, c2y + 5).stroke({ width: 0.8, color: 0xff6600, alpha: 0.7 });
      g.moveTo(c2x - 4, c2y + 3).lineTo(c2x + 6, c2y - 2).stroke({ width: 0.7, color: 0xff6600, alpha: 0.6 });
      g.moveTo(c2x + 4, c2y + 1).lineTo(c2x - 3, c2y - 4).stroke({ width: 0.6, color: 0xff6600, alpha: 0.5 });
      g.moveTo(c2x - 2, c2y + 5).lineTo(c2x + 3, c2y - 1).stroke({ width: 0.6, color: 0xff6600, alpha: 0.4 });
    }
  }

  private drawHP(): void {
    const g = this.hpGraphics;
    g.clear();
    const w = 36;
    const h = 3;
    g.rect(0, 0, w, h).stroke({ width: 0.5, color: COLORS.red, alpha: 0.5 });
    const fill = this.hp / this.maxHp;
    g.rect(0, 0, w * fill, h).fill({ color: COLORS.red, alpha: 0.8 });
  }

  update(dt: number): void {
    if (!this.alive) return;
    if (this.contactCooldownTimer > 0) {
      this.contactCooldownTimer = Math.max(0, this.contactCooldownTimer - dt);
    }
    this.attackTimer -= dt;
    this.patrolTimer += dt;

    // Slow patrol movement - bobbing up and down
    this.y = this.patrolCenterY + Math.sin(this.patrolTimer * 0.5) * 40;

    // Push out of islands and off coastlines
    const corrected = pushOutOfIsland(this.x, this.y);
    this.x = corrected.x;
    this.y = corrected.y;
    const coastCorrected = pushOffCoast(this.x, this.y);
    this.x = coastCorrected.x;
    this.y = coastCorrected.y;

    this._renderFrame++;
    const shouldRender = this._renderSkip <= 0 || this._renderFrame % this._renderSkip === 0;
    // Redraw for turret rotation and damage cracks — throttled on mobile
    if (shouldRender) this.drawBase();

    // Wake effect — throttled on mobile
    if (shouldRender) this.updateWake(dt);

    // Flash when damaged
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.baseGraphics.alpha = this.flashTimer % 0.1 > 0.05 ? 0.3 : 1.0;
    } else {
      this.baseGraphics.alpha = 1.0;
    }

    // Listing wobble at heavy damage
    const damageRatio = 1 - this.hp / this.maxHp;
    if (damageRatio > 0.66) {
      this.baseGraphics.rotation = Math.sin(this.patrolTimer * 6) * 0.05;
    } else {
      this.baseGraphics.rotation = 0;
    }

    // Damage smoke — throttled on mobile
    if (this.hp < this.maxHp && shouldRender) {
      this.updateSmoke(dt);
    }
  }

  private updateWake(dt: number): void {
    this.wakeTimer -= dt;
    if (this.wakeTimer <= 0) {
      this.wakeTimer = 0.08;
      this.wakePoints.push({ x: this.x, y: this.y });
    }

    const g = this.wakeGraphics;
    g.clear();
    const len = this.wakePoints.length;
    if (len < 2) return;

    for (let i = 0; i < len - 1; i++) {
      const t = 1 - i / len;
      const alpha = t * 0.08;
      if (alpha < 0.01) continue;
      const spread = 1.5 + (1 - t) * 8;
      const wp = this.wakePoints.get(len - 1 - i);
      const lx = wp.x - this.x;
      const ly = wp.y - this.y;
      g.circle(lx - spread * 0.5, ly, 0.8 + (1 - t) * 1.2).fill({ color: 0x004466, alpha });
      g.circle(lx + spread * 0.5, ly, 0.8 + (1 - t) * 1.2).fill({ color: 0x004466, alpha });
    }
  }

  private updateSmoke(dt: number): void {
    const damageRatio = 1 - this.hp / this.maxHp;

    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.06 + (1 - damageRatio) * 0.1;
      this.smokeParticles.push({
        x: (Math.random() - 0.5) * 10,
        y: (Math.random() - 0.5) * 10,
        age: 0,
        size: 2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 12,
        vy: -25 - Math.random() * 20,
      });
    }

    for (const p of this.smokeParticles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 7;
    }
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      if (this.smokeParticles[i].age >= 1.0) {
        this.smokeParticles[i] = this.smokeParticles[this.smokeParticles.length - 1];
        this.smokeParticles.pop();
      }
    }
    const maxSmoke = getQuality().maxSmokeParticles;
    while (this.smokeParticles.length > maxSmoke) {
      this.smokeParticles[0] = this.smokeParticles[this.smokeParticles.length - 1];
      this.smokeParticles.pop();
    }

    const g = this.smokeGraphics;
    g.clear();
    for (const p of this.smokeParticles) {
      const t = p.age / 1.0;
      const alpha = (1 - t) * 0.35 * damageRatio;
      const color = t < 0.25 ? 0x664422 : 0x333333;
      g.circle(p.x, p.y, p.size).fill({ color, alpha });
    }
  }

  canFire(): boolean {
    return this.alive && this.attackTimer <= 0;
  }

  resetFireTimer(): void {
    this.attackTimer = this.attackCooldown;
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.flashTimer = 0.3;
    this.drawHP();
    if (this.hp <= 0) {
      this.alive = false;
      this.visible = false;
    }
  }
}

export function resetGunboatIdCounter(): void {
  nextGunboatId = 1;
}
