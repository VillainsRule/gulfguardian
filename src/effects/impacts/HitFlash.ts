import { Container, Graphics } from 'pixi.js';
import { COLORS } from '@/app/constants';

export class HitFlash extends Container {
  private graphics: Graphics;
  private timer: number = 0;
  private duration: number = 0.18;
  public finished: boolean = false;
  public priority: number = 0;
  private color: number;

  constructor(x: number, y: number, color: number = COLORS.cyan) {
    super();
    this.position.set(x, y);
    this.color = color;
    this.graphics = new Graphics();
    // Bigger initial flash with white hot center
    this.graphics.circle(0, 0, 7).fill({ color: 0xffffff, alpha: 0.95 });
    this.graphics.circle(0, 0, 14).fill({ color, alpha: 0.85 });
    // Outer ring
    this.graphics.circle(0, 0, 18).stroke({ width: 2, color, alpha: 0.55 });
    this.addChild(this.graphics);
  }

  update(dt: number): void {
    if (this.finished) return;
    this.timer += dt;
    const t = this.timer / this.duration;
    if (t >= 1) {
      this.finished = true;
      this.visible = false;
      return;
    }
    this.alpha = 1 - t;
    this.scale.set(1 + t * 3.5);
  }
}
