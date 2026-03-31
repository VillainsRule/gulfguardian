import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';
import { DRONE_STATS } from './enemy-types';
import { Tanker } from '@/entities/tankers/Tanker';
import { getQuality } from '@/app/quality';

export type DroneDirection = 'top' | 'bottom' | 'behind';

let nextDroneId = 1;

export class Drone extends Container {
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
  public spawnDirection: DroneDirection;
  public targetTanker: Tanker | null = null;
  public impactDetonationRequested: boolean = false;

  private droneGraphics: Graphics;
  private trailGraphics: Graphics;
  private hpGraphics: Graphics;
  private labelText: Text;
  private engineTimer: number = 0;
  private flashTimer: number = 0;
  private _renderFrame: number = 0;
  private readonly _renderSkip: number;

  constructor(x: number, y: number, spawnDirection: DroneDirection) {
    super();
    this.id = nextDroneId++;
    this.hp = DRONE_STATS.hp;
    this.maxHp = DRONE_STATS.hp;
    this.speed = DRONE_STATS.speed;
    this.damage = DRONE_STATS.damage;
    this.attackRange = DRONE_STATS.attackRange;
    this.attackCooldown = DRONE_STATS.attackCooldown;
    this.scoreValue = DRONE_STATS.scoreValue;
    this.spawnDirection = spawnDirection;

    this.position.set(x, y);

    this.trailGraphics = new Graphics();
    this.addChild(this.trailGraphics);

    this.droneGraphics = new Graphics();
    this.addChild(this.droneGraphics);

    this.hpGraphics = new Graphics();
    this.hpGraphics.position.set(-8, -16);
    this.addChild(this.hpGraphics);
    this.drawHP();

    const quality = getQuality();
    this._renderSkip = quality.renderSkipCosmetic;

    this.labelText = new Text({
      text: 'UAV',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 7, fill: TEXT_COLORS.amber }),
      resolution: TEXT_RESOLUTION,
    });
    this.labelText.anchor.set(0.5, 0);
    this.labelText.position.set(0, 9);
    this.labelText.visible = quality.enableEntityLabels;
    this.addChild(this.labelText);

    this.drawDrone();
  }

  private drawHP(): void {
    const g = this.hpGraphics;
    g.clear();
    const w = 16;
    const h = 2;
    g.rect(0, 0, w, h).stroke({ width: 0.5, color: COLORS.amber, alpha: 0.5 });
    const fill = Math.max(0, this.hp / this.maxHp);
    g.rect(0, 0, w * fill, h).fill({ color: COLORS.amber, alpha: 0.8 });
  }

  private drawDrone(): void {
    const g = this.droneGraphics;
    g.clear();

    const damageRatio = 1 - this.hp / this.maxHp;
    const bodyAlpha = damageRatio > 0.5 ? 0.3 : 0.5;

    // Diamond/arrow drone shape — small and sleek
    g.moveTo(0, -8)
      .lineTo(-6, 0)
      .lineTo(-3, 5)
      .lineTo(3, 5)
      .lineTo(6, 0)
      .lineTo(0, -8)
      .fill({ color: COLORS.amber, alpha: bodyAlpha })
      .stroke({ width: 1.2, color: COLORS.amber });

    // Wings
    g.moveTo(-6, 0).lineTo(-10, 2).lineTo(-6, 3)
      .fill({ color: COLORS.amber, alpha: bodyAlpha * 0.7 })
      .stroke({ width: 0.8, color: COLORS.amber, alpha: 0.7 });
    g.moveTo(6, 0).lineTo(10, 2).lineTo(6, 3)
      .fill({ color: COLORS.amber, alpha: bodyAlpha * 0.7 })
      .stroke({ width: 0.8, color: COLORS.amber, alpha: 0.7 });

    // Center eye/sensor
    g.circle(0, -1, 1.2).fill({ color: COLORS.red, alpha: 0.9 });

    // Damage cracks
    if (damageRatio > 0.5) {
      g.moveTo(-3, -4).lineTo(2, 3).stroke({ width: 0.8, color: 0xff6600, alpha: 0.7 });
    }
  }

  update(dt: number, tankers: Tanker[], playerX?: number, playerY?: number): void {
    if (!this.alive) return;

    // Pick target: nearest tanker OR player if closer
    let nearestDist = Infinity;
    let targetX = this.x;
    let targetY = this.y;
    let targetIsTanker = false;
    let nearestTanker: Tanker | null = null;

    // Use squared distances to avoid sqrt in targeting comparisons
    for (const t of tankers) {
      if (!t.alive || t.completed) continue;
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < nearestDist) {
        nearestDist = dSq;
        targetX = t.x;
        targetY = t.y;
        targetIsTanker = true;
        nearestTanker = t;
      }
    }

    // 30% of drones prefer attacking the player when nearby
    if (playerX !== undefined && playerY !== undefined && (this.id % 10 < 3)) {
      const pdx = playerX - this.x;
      const pdy = playerY - this.y;
      const playerDistSq = pdx * pdx + pdy * pdy;
      if (playerDistSq < 250000) { // 500 * 500
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

        // No island/coast collision — drones are airborne
        this.rotation = Math.atan2(ny, nx) + Math.PI / 2;
      }

      // Kamikaze attack: deal damage on close range then self-destruct
      this.attackTimer -= dt;
      if (dist < this.attackRange && this.attackTimer <= 0 && targetIsTanker && nearestTanker) {
        nearestTanker.takeDamage(this.damage);
        this.impactDetonationRequested = true;
        this.alive = false;
        this.visible = false;
      }
    }

    this.engineTimer += dt;
    this._renderFrame++;
    if (this._renderSkip <= 0 || this._renderFrame % this._renderSkip === 0) {
      this.drawEngine();
    }

    // Flash when damaged
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.droneGraphics.alpha = this.flashTimer % 0.1 > 0.05 ? 0.3 : 1.0;
    } else {
      this.droneGraphics.alpha = 1.0;
    }
  }

  private drawEngine(): void {
    const g = this.trailGraphics;
    g.clear();
    // Propulsion trail behind the drone
    const flicker = 0.5 + Math.sin(this.engineTimer * 50) * 0.5;
    const trailLen = 5 + Math.sin(this.engineTimer * 35) * 2;
    g.moveTo(-2, 5)
      .lineTo(0, 5 + trailLen)
      .lineTo(2, 5)
      .fill({ color: COLORS.amber, alpha: 0.3 * flicker });
    g.moveTo(-0.6, 5)
      .lineTo(0, 5 + trailLen * 0.5)
      .lineTo(0.6, 5)
      .fill({ color: 0xffcc44, alpha: 0.4 * flicker });
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.flashTimer = 0.2;
    this.drawHP();
    if (this.hp <= 0) {
      this.alive = false;
      this.visible = false;
    }
  }
}

export function resetDroneIdCounter(): void {
  nextDroneId = 1;
}
