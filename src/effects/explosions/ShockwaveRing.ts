import { Container, Graphics } from 'pixi.js';

export class ShockwaveRing extends Container {
  private graphics: Graphics;
  private timer: number = 0;
  private duration: number;
  private maxRadius: number;
  public finished: boolean = false;
  public priority: number = 1;
  private color: number;

  constructor(
    x: number,
    y: number,
    maxRadius: number = 180,
    duration: number = 0.3,
    color: number = 0xffffff,
  ) {
    super();
    this.position.set(x, y);
    this.maxRadius = maxRadius;
    this.duration = duration;
    this.color = color;
    this.graphics = new Graphics();
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

    const g = this.graphics;
    g.clear();

    // easeOutQuad: fast initial expansion, slows down
    const eased = 1 - (1 - t) * (1 - t);
    const radius = this.maxRadius * eased;
    const ringWidth = 4.5 * (1 - t) + 1.0;
    const alpha = (1 - t) * (1 - t) * 0.85;

    // Filled center bloom — faint hot glow inside the ring
    if (t < 0.5) {
      const bloomAlpha = (1 - t / 0.5) * 0.15;
      g.circle(0, 0, radius * 0.4).fill({ color: this.color, alpha: bloomAlpha });
    }

    // Main ring
    g.circle(0, 0, radius).stroke({ width: ringWidth, color: this.color, alpha });

    // Inner ring for depth — stronger
    if (t < 0.7) {
      const innerAlpha = alpha * 0.7;
      g.circle(0, 0, radius * 0.7).stroke({ width: ringWidth * 0.6, color: this.color, alpha: innerAlpha });
    }
  }
}
