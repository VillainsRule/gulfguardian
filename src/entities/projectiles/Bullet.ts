import { COLORS } from '@/app/constants';
import { getQuality } from '@/app/quality';
import { CircularBuffer } from '@/utils/circular-buffer';

interface TrailPoint { x: number; y: number }

/**
 * Bullet — pure data object (no Pixi Container).
 * All rendering is handled by BulletRenderer for batched drawing.
 */
export class Bullet {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public damage: number;
  public lifetime: number;
  public radius: number;
  public alive: boolean = true;
  public isPlayerBullet: boolean;
  public missedSplash: boolean = false;
  public rapidFire: boolean;

  public rotation: number;
  /** Pre-computed cos/sin of rotation — set once in constructor, avoids trig per frame in renderer */
  public cosR: number;
  public sinR: number;
  public trailPoints: CircularBuffer<TrailPoint>;
  public age: number = 0;

  private readonly _maxTrail: number;

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
    rapidFire: boolean = false,
  ) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.lifetime = lifetime;
    this.radius = radius;
    this.isPlayerBullet = isPlayer;
    this.rapidFire = rapidFire;

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
    this.rotation = Math.atan2(dy, dx) + Math.PI / 2;
    this.cosR = Math.cos(this.rotation);
    this.sinR = Math.sin(this.rotation);

    this._maxTrail = getQuality().maxBulletTrailPoints;
    // Pre-allocate circular buffer — zero allocations during gameplay
    this.trailPoints = new CircularBuffer<TrailPoint>(Math.max(this._maxTrail, 1));
  }

  getColor(): number {
    if (!this.isPlayerBullet) return COLORS.red;
    return this.rapidFire ? 0x88ccff : COLORS.amber;
  }

  update(dt: number): void {
    if (!this.alive) return;

    this.age += dt;

    if (this._maxTrail > 0) {
      this.trailPoints.push({ x: this.x, y: this.y });
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.alive = false;
      this.missedSplash = true;
    }

    if (this.y < -50 || this.y > 770) {
      this.alive = false;
    }
  }
}
