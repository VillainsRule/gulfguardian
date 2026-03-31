import { Container, Graphics } from 'pixi.js';
import { COLORS } from '@/app/constants';

interface CausticBlob {
  x: number;
  y: number;
  rx: number;
  ry: number;
  phase: number;
  speed: number;
  driftX: number;
}

/**
 * Animated water shimmer — subtle caustic-like patterns in the water channel.
 * Very low alpha, cheap to render (6-8 slowly-drifting ellipses).
 * Adds life to the ocean surface.
 */
export class WaterShimmer extends Container {
  private graphics: Graphics;
  private blobs: CausticBlob[] = [];
  private timer: number = 0;

  constructor(startX: number, channelY: number, channelHeight: number) {
    super();
    this.graphics = new Graphics();
    this.addChild(this.graphics);

    // Spawn caustic blobs spread across the visible channel
    const count = 7;
    for (let i = 0; i < count; i++) {
      this.blobs.push({
        x: startX + i * 180 + Math.random() * 100,
        y: channelY + Math.random() * channelHeight,
        rx: 20 + Math.random() * 30,
        ry: 10 + Math.random() * 15,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        driftX: 5 + Math.random() * 10,
      });
    }
  }

  update(dt: number): void {
    this.timer += dt;
    const g = this.graphics;
    g.clear();

    for (const blob of this.blobs) {
      // Gentle sine-based breathing and drifting
      const breathe = 1 + Math.sin(this.timer * blob.speed + blob.phase) * 0.3;
      const x = blob.x + Math.sin(this.timer * 0.2 + blob.phase) * blob.driftX;
      const y = blob.y + Math.cos(this.timer * 0.15 + blob.phase * 1.3) * 8;
      const rx = blob.rx * breathe;
      const ry = blob.ry * breathe;
      const alpha = 0.015 + Math.sin(this.timer * blob.speed * 0.7 + blob.phase) * 0.01;

      g.ellipse(x, y, rx, ry).fill({ color: COLORS.cyan, alpha });
    }
  }
}
