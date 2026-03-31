import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';
import { HELICOPTER_STATS } from './enemy-types';
import { Tanker } from '@/entities/tankers/Tanker';
import { getQuality } from '@/app/quality';

export type HeloSpawnDirection = 'top' | 'bottom' | 'behind';

let nextHeloId = 1;

export class AttackHelicopter extends Container {
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
  public spawnDirection: HeloSpawnDirection;
  /** true = prefers targeting the player; false = prefers targeting tankers */
  public prefersPlayer: boolean;

  private bodyGraphics: Graphics;
  private rotorGraphics: Graphics;
  private hpGraphics: Graphics;
  private labelText: Text;
  private rotorTimer: number = 0;
  private engineTimer: number = 0;
  private flashTimer: number = 0;
  private _renderFrame: number = 0;
  private readonly _renderSkip: number;
  private holdOffsetY: number = 0;
  private holdTimer: number = 0;
  private inPosition: boolean = false;
  private targetX: number = 0;
  private targetY: number = 0;

  constructor(x: number, y: number, spawnDirection: HeloSpawnDirection) {
    super();
    this.id = nextHeloId++;
    this.hp = HELICOPTER_STATS.hp;
    this.maxHp = HELICOPTER_STATS.hp;
    this.speed = HELICOPTER_STATS.speed;
    this.damage = HELICOPTER_STATS.damage;
    this.attackRange = HELICOPTER_STATS.attackRange;
    this.attackCooldown = HELICOPTER_STATS.attackCooldown;
    this.scoreValue = HELICOPTER_STATS.scoreValue;
    this.spawnDirection = spawnDirection;
    this.prefersPlayer = this.id % 2 === 0;

    this.position.set(x, y);

    this.bodyGraphics = new Graphics();
    this.addChild(this.bodyGraphics);

    this.rotorGraphics = new Graphics();
    this.addChild(this.rotorGraphics);

    this.hpGraphics = new Graphics();
    this.hpGraphics.position.set(-10, -20);
    this.addChild(this.hpGraphics);
    this.drawHP();

    const quality = getQuality();
    this._renderSkip = quality.renderSkipCosmetic;

    this.labelText = new Text({
      text: 'HELO',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 7, fill: TEXT_COLORS.red }),
      resolution: TEXT_RESOLUTION,
    });
    this.labelText.anchor.set(0.5, 0);
    this.labelText.position.set(0, 25);
    this.labelText.visible = quality.enableEntityLabels;
    this.addChild(this.labelText);

    this.drawBody();
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

  private drawBody(): void {
    const g = this.bodyGraphics;
    g.clear();

    const damageRatio = 1 - this.hp / this.maxHp;
    const bodyAlpha = damageRatio > 0.5 ? 0.35 : 0.55;

    // Fuselage — rounded body wider at cockpit, tapering to rear
    g.moveTo(0, -8)
      .lineTo(-4, -6)
      .lineTo(-5, -2)
      .lineTo(-4, 4)
      .lineTo(-2, 6)
      .lineTo(2, 6)
      .lineTo(4, 4)
      .lineTo(5, -2)
      .lineTo(4, -6)
      .lineTo(0, -8)
      .fill({ color: COLORS.red, alpha: bodyAlpha })
      .stroke({ width: 1.2, color: COLORS.red });

    // Tail boom — long thin rectangle
    g.rect(-1.5, 6, 3, 16)
      .fill({ color: COLORS.red, alpha: bodyAlpha * 0.6 })
      .stroke({ width: 0.8, color: COLORS.red, alpha: 0.7 });

    // Tail fin — small vertical stabilizer
    g.moveTo(0, 19).lineTo(-3, 23).lineTo(0, 22)
      .fill({ color: COLORS.red, alpha: bodyAlpha * 0.7 })
      .stroke({ width: 0.6, color: COLORS.red, alpha: 0.6 });

    // Tail rotor — small vertical line at tail tip
    g.moveTo(0, 22).lineTo(-5, 21).stroke({ width: 1, color: COLORS.red, alpha: 0.7 });
    g.moveTo(0, 22).lineTo(-5, 23).stroke({ width: 1, color: COLORS.red, alpha: 0.7 });
    g.circle(-5, 22, 0.8).fill({ color: COLORS.red, alpha: 0.6 });

    // Stub wings / weapon pylons
    g.moveTo(-5, 0).lineTo(-9, 1).lineTo(-8, 3).lineTo(-5, 2)
      .fill({ color: COLORS.red, alpha: bodyAlpha * 0.6 })
      .stroke({ width: 0.6, color: COLORS.red, alpha: 0.6 });
    g.moveTo(5, 0).lineTo(9, 1).lineTo(8, 3).lineTo(5, 2)
      .fill({ color: COLORS.red, alpha: bodyAlpha * 0.6 })
      .stroke({ width: 0.6, color: COLORS.red, alpha: 0.6 });

    // Bubble cockpit canopy — larger elliptical shape
    g.ellipse(0, -5, 3, 2.5).fill({ color: 0xff6666, alpha: 0.4 });
    // Glass highlight
    g.moveTo(-1, -6.5).lineTo(1, -6).stroke({ width: 0.6, color: 0xffaaaa, alpha: 0.4 });

    // Skids / landing gear
    g.moveTo(-3, 5).lineTo(-3, 7).stroke({ width: 0.8, color: COLORS.red, alpha: 0.5 });
    g.moveTo(-4, 7).lineTo(-2, 7).stroke({ width: 0.8, color: COLORS.red, alpha: 0.5 });
    g.moveTo(3, 5).lineTo(3, 7).stroke({ width: 0.8, color: COLORS.red, alpha: 0.5 });
    g.moveTo(4, 7).lineTo(2, 7).stroke({ width: 0.8, color: COLORS.red, alpha: 0.5 });

    // Damage cracks
    if (damageRatio > 0.5) {
      g.moveTo(-3, -5).lineTo(2, 4).stroke({ width: 0.8, color: 0xff6600, alpha: 0.7 });
      g.moveTo(3, -3).lineTo(-1, 5).stroke({ width: 0.6, color: 0xff6600, alpha: 0.5 });
    }
  }

  private drawRotor(): void {
    const g = this.rotorGraphics;
    g.clear();

    const angle = this.rotorTimer * 15; // Fast spin
    const len = 14;

    // Rotor blur disc — semi-transparent sweep area
    g.circle(0, -8, len).fill({ color: COLORS.red, alpha: 0.06 });
    g.circle(0, -8, len * 0.7).fill({ color: COLORS.red, alpha: 0.04 });

    // Two-blade rotor as spinning cross
    const c1 = Math.cos(angle);
    const s1 = Math.sin(angle);
    const c2 = Math.cos(angle + Math.PI / 2);
    const s2 = Math.sin(angle + Math.PI / 2);

    g.moveTo(c1 * -len, s1 * -len + (-8))
      .lineTo(c1 * len, s1 * len + (-8))
      .stroke({ width: 1.2, color: COLORS.red, alpha: 0.5 });
    g.moveTo(c2 * -len, s2 * -len + (-8))
      .lineTo(c2 * len, s2 * len + (-8))
      .stroke({ width: 1.0, color: COLORS.red, alpha: 0.35 });

    // Hub
    g.circle(0, -8, 1.5).fill({ color: COLORS.red, alpha: 0.6 });
  }

  update(dt: number, tankers: Tanker[], playerX?: number, playerY?: number): void {
    if (!this.alive) return;

    // Pick target based on preference
    let tgtX = this.x;
    let tgtY = this.y;
    let hasTarget = false;

    if (this.prefersPlayer && playerX !== undefined && playerY !== undefined) {
      tgtX = playerX;
      tgtY = playerY;
      hasTarget = true;
    }

    if (!hasTarget || !this.prefersPlayer) {
      // Find nearest tanker
      let nearestDist = Infinity;
      for (const t of tankers) {
        if (!t.alive || t.completed) continue;
        const dx = t.x - this.x;
        const dy = t.y - this.y;
        const d = dx * dx + dy * dy; // squared distance for comparison
        if (d < nearestDist) {
          nearestDist = d;
          tgtX = t.x;
          tgtY = t.y;
          hasTarget = true;
        }
      }
      // Fallback to player if no tanker available
      if (!hasTarget && playerX !== undefined && playerY !== undefined) {
        tgtX = playerX;
        tgtY = playerY;
        hasTarget = true;
      }
    }

    this.targetX = tgtX;
    this.targetY = tgtY;

    if (hasTarget) {
      const dx = tgtX - this.x;
      const dy = tgtY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > this.attackRange) {
        // Fly toward target
        this.inPosition = false;
        const nx = dx / dist;
        const ny = dy / dist;
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;
        this.rotation = Math.atan2(ny, nx) + Math.PI / 2;
      } else {
        // Hold at standoff — gentle orbit
        this.inPosition = true;
        this.holdTimer += dt;
        this.holdOffsetY = Math.sin(this.holdTimer * 0.8) * 15;
        this.y += (this.holdOffsetY * 0.3) * dt;

        // Slowly drift to maintain standoff if target moves closer
        if (dist < this.attackRange * 0.5) {
          const nx = dx / dist;
          const ny = dy / dist;
          this.x -= nx * this.speed * 0.4 * dt;
          this.y -= ny * this.speed * 0.4 * dt;
        }

        // Face target
        this.rotation = Math.atan2(dy, dx) + Math.PI / 2;
      }
    }

    // Update attack timer
    this.attackTimer -= dt;

    // Animate
    this.rotorTimer += dt;
    this.engineTimer += dt;
    this._renderFrame++;
    if (this._renderSkip <= 0 || this._renderFrame % this._renderSkip === 0) {
      this.drawRotor();
    }

    // Flash when damaged
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.bodyGraphics.alpha = this.flashTimer % 0.1 > 0.05 ? 0.3 : 1.0;
    } else {
      this.bodyGraphics.alpha = 1.0;
    }
  }

  canFire(): boolean {
    return this.alive && this.inPosition && this.attackTimer <= 0;
  }

  resetFireTimer(): void {
    this.attackTimer = this.attackCooldown;
  }

  getTargetPosition(): { x: number; y: number } {
    return { x: this.targetX, y: this.targetY };
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.flashTimer = 0.2;
    this.drawHP();
    this.drawBody();
    if (this.hp <= 0) {
      this.alive = false;
      this.visible = false;
    }
  }
}

export function resetHelicopterIdCounter(): void {
  nextHeloId = 1;
}
