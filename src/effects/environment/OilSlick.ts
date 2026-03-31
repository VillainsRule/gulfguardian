import { Container, Graphics } from 'pixi.js';

export class OilSlick extends Container {
  private graphics: Graphics;
  private timer: number = 0;
  private duration: number = 5.0;
  public finished: boolean = false;
  public priority: number = 0;

  constructor(x: number, y: number) {
    super();
    this.position.set(x, y);
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

    // Expanding dark oil patch
    const growT = Math.min(1, t * 3); // reaches full size at 33% of duration
    const radius = 15 + growT * 25;
    const fadeAlpha = t < 0.5 ? 0.1 : 0.1 * (1 - (t - 0.5) / 0.5);

    // Dark oil fill
    g.ellipse(0, 0, radius, radius * 0.6).fill({ color: 0x111100, alpha: fadeAlpha });

    // Iridescent edge ring
    if (fadeAlpha > 0.02) {
      g.ellipse(0, 0, radius * 0.9, radius * 0.55).stroke({
        width: 1.5,
        color: 0x221133,
        alpha: fadeAlpha * 0.6,
      });
    }
  }
}
