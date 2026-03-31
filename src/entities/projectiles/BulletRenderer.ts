import { Graphics } from 'pixi.js';
import { COLORS } from '@/app/constants';
import { getQuality, isMobileDetected } from '@/app/quality';
import { Bullet } from './Bullet';

export class BulletRenderer {
  public readonly graphics: Graphics;
  private readonly isMobile: boolean;
  private _renderFrame: number = 0;

  constructor() {
    this.graphics = new Graphics();
    this.isMobile = isMobileDetected();
  }

  render(bullets: Bullet[]): void {
    const g = this.graphics;

    if (this.isMobile) {
      this._renderFrame++;
      if (this._renderFrame % 2 !== 0) return;
    }

    g.clear();

    if (bullets.length === 0) return;

    if (this.isMobile) {
      for (const bullet of bullets) {
        if (!bullet.alive) continue;
        const color = bullet.getColor();
        g.circle(bullet.x, bullet.y, 3).fill({ color, alpha: 1.0 });
        g.circle(bullet.x, bullet.y, 1.5).fill({ color: 0xffffff, alpha: 0.9 });
      }
      return;
    }

    const quality = getQuality();
    const isLow = quality.level === 'low';
    const skipGlow = !quality.enableGlow;

    for (const bullet of bullets) {
      if (!bullet.alive) continue;
      const color = bullet.getColor();
      this.drawBulletBody(g, bullet, color);
      this.drawBulletTrail(g, bullet, color, isLow, skipGlow);
    }
  }

  private drawBulletBody(g: Graphics, bullet: Bullet, color: number): void {
    // Use pre-computed cos/sin from bullet — avoids trig per bullet per frame
    const cos = bullet.cosR;
    const sin = bullet.sinR;
    const bx = bullet.x;
    const by = bullet.y;

    g.circle(bx, by, 5).fill({ color, alpha: 0.2 });

    // Simplified: removed 0*cos and 0*sin terms (multiply by zero = zero)
    const p1x = bx + 6 * sin;
    const p1y = by - 6 * cos;
    const p2x = bx + (-2) * cos - 3 * sin;
    const p2y = by + (-2) * sin + 3 * cos;
    const p3x = bx + 2 * cos - 3 * sin;
    const p3y = by + 2 * sin + 3 * cos;

    g.moveTo(p1x, p1y)
      .lineTo(p2x, p2y)
      .lineTo(p3x, p3y)
      .lineTo(p1x, p1y)
      .fill({ color, alpha: 1.0 });

    const coreX = bx + 2 * sin;
    const coreY = by - 2 * cos;
    g.circle(coreX, coreY, 2).fill({ color: 0xffffff, alpha: 0.95 });
  }

  private drawBulletTrail(g: Graphics, bullet: Bullet, color: number, isLow: boolean, skipGlow: boolean): void {
    const trail = bullet.trailPoints;
    if (trail.length < 2) return;

    const showDots = !isLow;
    const showGlow = !skipGlow && bullet.isPlayerBullet;

    // Single consolidated loop — was 3 separate loops before
    let prevX = trail.get(0).x;
    let prevY = trail.get(0).y;
    for (let i = 1; i < trail.length; i++) {
      const pt = trail.get(i);
      const t = i / trail.length;

      // Trail line stroke
      const alpha = t * 0.6;
      g.moveTo(prevX, prevY)
        .lineTo(pt.x, pt.y)
        .stroke({ width: 1 + t, color, alpha });

      // Glow stroke (wider, translucent) — player bullets only, non-low quality
      if (showGlow) {
        g.moveTo(prevX, prevY)
          .lineTo(pt.x, pt.y)
          .stroke({ width: 4 + t * 2, color, alpha: t * 0.15 });
      }

      // Dot overlay on recent trail points — non-low quality
      if (showDots && t >= 0.5) {
        g.circle(pt.x, pt.y, 0.8)
          .fill({ color: 0xffffff, alpha: t * 0.4 });
      }

      prevX = pt.x;
      prevY = pt.y;
    }

    if (!bullet.isPlayerBullet) {
      const pulse = 0.2 + Math.sin(bullet.age * 15) * 0.12;
      g.circle(bullet.x, bullet.y, 9).fill({ color: COLORS.red, alpha: pulse });
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
