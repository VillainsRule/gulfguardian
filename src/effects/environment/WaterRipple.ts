import { Container, Graphics } from 'pixi.js';

export class WaterRipple extends Container {
  private graphics: Graphics;
  private timer: number = 0;
  private duration: number;
  private maxRadius: number;
  public finished: boolean = false;
  public priority: number = 0;
  private color: number;

  constructor(x: number, y: number, maxRadius: number = 30, duration: number = 1.5, color: number = 0x004466) {
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

    // Outer expanding ring
    const outerRadius = this.maxRadius * t;
    const outerAlpha = (1 - t) * 0.2;
    g.circle(0, 0, outerRadius).stroke({ width: 1.0, color: this.color, alpha: outerAlpha });

    // Middle ring — slightly delayed
    if (t > 0.1) {
      const midT = (t - 0.1) / 0.9;
      const midRadius = this.maxRadius * 0.7 * midT;
      const midAlpha = (1 - midT) * 0.15;
      g.circle(0, 0, midRadius).stroke({ width: 0.7, color: this.color, alpha: midAlpha });
    }

    // Inner ring — more delayed, tighter
    if (t < 0.6) {
      const innerT = t / 0.6;
      const innerRadius = this.maxRadius * 0.4 * innerT;
      const innerAlpha = (1 - innerT) * 0.12;
      g.circle(0, 0, innerRadius).stroke({ width: 0.5, color: this.color, alpha: innerAlpha });
    }

    // Faint filled splash disc at the center (early phase)
    if (t < 0.3) {
      const discAlpha = (1 - t / 0.3) * 0.08;
      const discR = this.maxRadius * 0.25 * (t / 0.3);
      g.circle(0, 0, discR).fill({ color: 0xffffff, alpha: discAlpha });
    }
  }
}
