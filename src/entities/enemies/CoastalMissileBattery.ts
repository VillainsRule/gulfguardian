import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';
import { CMB_STATS } from './enemy-types';
import { getQuality } from '@/app/quality';

let nextCmbId = 1;

const UNCLOAK_DURATION = 8.0; // How long CMB stays visible after firing

export class CoastalMissileBattery extends Container {
  public id: number;
  public hp: number;
  public maxHp: number;
  public damage: number;
  public attackRange: number;
  public attackCooldown: number;
  public attackTimer: number;
  public scoreValue: number;
  public alive: boolean = true;
  public label: string;
  public cloaked: boolean = true;
  public uncloakTimer: number = 0;

  private baseGraphics: Graphics;
  private smokeGraphics: Graphics;
  private hpGraphics: Graphics;
  private labelText: Text;
  private rangeGraphics: Graphics;
  private flashTimer: number = 0;
  private smokeParticles: { x: number; y: number; age: number; size: number; vx: number; vy: number }[] = [];
  private smokeTimer: number = 0;
  private animTimer: number = 0;
  private _renderFrame: number = 0;
  private readonly _renderSkip: number;

  constructor(x: number, y: number, label?: string) {
    super();
    this.id = nextCmbId++;
    this.hp = CMB_STATS.hp;
    this.maxHp = CMB_STATS.hp;
    this.damage = CMB_STATS.damage;
    this.attackRange = CMB_STATS.attackRange;
    this.attackCooldown = CMB_STATS.attackCooldown;
    this.attackTimer = this.attackCooldown * 0.5;
    this.scoreValue = CMB_STATS.scoreValue;
    this.label = label || `CMB-${this.id}`;

    this.position.set(x, y);

    this.rangeGraphics = new Graphics();
    this.rangeGraphics
      .circle(0, 0, this.attackRange)
      .stroke({ width: 0.5, color: COLORS.red, alpha: 0.08 });
    this.addChild(this.rangeGraphics);

    this.smokeGraphics = new Graphics();
    this.addChild(this.smokeGraphics);

    this.baseGraphics = new Graphics();
    this.drawBase();
    this.addChild(this.baseGraphics);

    this.hpGraphics = new Graphics();
    this.hpGraphics.position.set(-12, -16);
    this.addChild(this.hpGraphics);
    this.drawHP();

    this.labelText = new Text({
      text: this.label,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 8, fill: TEXT_COLORS.red }),
      resolution: TEXT_RESOLUTION,
    });
    this.labelText.anchor.set(0.5, 0);
    this.labelText.position.set(0, 12);
    this.addChild(this.labelText);

    this._renderSkip = getQuality().renderSkipCosmetic;

    this.rangeGraphics.visible = false;
    this.baseGraphics.visible = false;
    this.hpGraphics.visible = false;
    this.labelText.visible = false;
    this.smokeGraphics.visible = false;
  }

  private drawHP(): void {
    const g = this.hpGraphics;
    g.clear();
    const w = 24;
    const h = 2;
    g.rect(0, 0, w, h).stroke({ width: 0.5, color: COLORS.red, alpha: 0.5 });
    const fill = Math.max(0, this.hp / this.maxHp);
    g.rect(0, 0, w * fill, h).fill({ color: COLORS.red, alpha: 0.8 });
  }

  private drawBase(): void {
    const g = this.baseGraphics;
    g.clear();

    const damageRatio = 1 - this.hp / this.maxHp;
    const baseAlpha = damageRatio > 0.66 ? 0.15 : 0.3;

    g.rect(-7, -7, 14, 14)
      .fill({ color: COLORS.red, alpha: baseAlpha })
      .stroke({ width: 1.5, color: COLORS.red });
    g.moveTo(-4, 0)
      .lineTo(4, 0)
      .stroke({ width: 1, color: COLORS.red, alpha: 0.7 });
    g.moveTo(0, -4)
      .lineTo(0, 4)
      .stroke({ width: 1, color: COLORS.red, alpha: 0.7 });

    // Crack lines based on damage
    if (damageRatio > 0.33) {
      const seed = this.id * 12345;
      const c1x = ((seed * 7 + 3) % 8) - 4;
      const c1y = ((seed * 13 + 5) % 8) - 4;
      g.moveTo(c1x - 4, c1y - 2).lineTo(c1x + 3, c1y + 3).stroke({ width: 0.8, color: COLORS.amber, alpha: 0.7 });
      g.moveTo(c1x + 2, c1y - 4).lineTo(c1x - 1, c1y + 2).stroke({ width: 0.8, color: COLORS.amber, alpha: 0.6 });
    }
    if (damageRatio > 0.66) {
      const seed = this.id * 54321;
      const c2x = ((seed * 11 + 7) % 8) - 4;
      const c2y = ((seed * 17 + 2) % 8) - 4;
      g.moveTo(c2x - 3, c2y - 1).lineTo(c2x + 4, c2y + 2).stroke({ width: 1.0, color: COLORS.amber, alpha: 0.8 });
      g.moveTo(c2x - 1, c2y - 5).lineTo(c2x + 2, c2y + 3).stroke({ width: 0.8, color: 0xff6600, alpha: 0.7 });
      g.moveTo(c2x - 4, c2y + 1).lineTo(c2x + 3, c2y - 2).stroke({ width: 0.6, color: 0xff6600, alpha: 0.5 });
    }
  }

  /** Reveal the CMB — called when it fires */
  uncloak(): void {
    this.cloaked = false;
    this.uncloakTimer = UNCLOAK_DURATION;
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.attackTimer -= dt;
    this.animTimer += dt;

    // Uncloak countdown — re-cloak when timer expires
    if (!this.cloaked) {
      this.uncloakTimer -= dt;
      if (this.uncloakTimer <= 0) {
        this.cloaked = true;
        this.uncloakTimer = 0;
      }
    }

    // Hide the battery while cloaked; only the range ring appears once revealed.
    this.rangeGraphics.visible = !this.cloaked;
    this.baseGraphics.visible = !this.cloaked;
    this.hpGraphics.visible = !this.cloaked;
    this.labelText.visible = !this.cloaked;
    this.smokeGraphics.visible = !this.cloaked;

    // Flash when damaged
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.baseGraphics.alpha = this.flashTimer % 0.1 > 0.05 ? 0.3 : 1.0;
    } else {
      this.baseGraphics.alpha = 1.0;
    }

    // Damage smoke and redraw — throttled on mobile
    this._renderFrame++;
    if (this.hp < this.maxHp && (this._renderSkip <= 0 || this._renderFrame % this._renderSkip === 0)) {
      this.updateSmoke(dt);
      this.drawBase();
    }
  }

  private updateSmoke(dt: number): void {
    const damageRatio = 1 - this.hp / this.maxHp;

    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.07 + (1 - damageRatio) * 0.1;
      this.smokeParticles.push({
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 0.5) * 8,
        age: 0,
        size: 1.5 + Math.random() * 2.5,
        vx: (Math.random() - 0.5) * 10,
        vy: -20 - Math.random() * 16,
      });
    }

    for (const p of this.smokeParticles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 6;
    }
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      if (this.smokeParticles[i].age >= 0.9) {
        this.smokeParticles[i] = this.smokeParticles[this.smokeParticles.length - 1];
        this.smokeParticles.pop();
      }
    }
    while (this.smokeParticles.length > 16) {
      this.smokeParticles[0] = this.smokeParticles[this.smokeParticles.length - 1];
      this.smokeParticles.pop();
    }

    const g = this.smokeGraphics;
    g.clear();
    for (const p of this.smokeParticles) {
      const t = p.age / 0.9;
      const alpha = (1 - t) * 0.3 * damageRatio;
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
    this.flashTimer = 0.25;
    this.drawHP();
    if (this.hp <= 0) {
      this.alive = false;
      this.visible = false;
    }
  }
}

export function resetCmbIdCounter(): void {
  nextCmbId = 1;
}
