import { Container, Graphics } from 'pixi.js';
import { COLORS } from '@/app/constants';

export class MuzzleBlast extends Container {
  private graphics: Graphics;
  private timer: number = 0;
  private duration: number = 0.10;
  public finished: boolean = false;
  public priority: number = 0;
  private blastAngle: number;
  private sparkOffsets: { dist: number; perpOffset: number; speed: number }[];
  private color: number;

  constructor(x: number, y: number, angle: number, color: number = COLORS.amber) {
    super();
    this.position.set(x, y);
    this.blastAngle = angle;
    this.color = color;
    this.graphics = new Graphics();
    this.addChild(this.graphics);

    // 2-3 forward-flying spark dots
    const sparkCount = 2 + Math.floor(Math.random() * 2);
    this.sparkOffsets = [];
    for (let i = 0; i < sparkCount; i++) {
      this.sparkOffsets.push({
        dist: 8 + Math.random() * 6,
        perpOffset: (Math.random() - 0.5) * 6,
        speed: 60 + Math.random() * 40,
      });
    }
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

    const scale = 1 + t * 0.3;
    const alpha = (1 - t) * 0.9;
    const cos = Math.cos(this.blastAngle);
    const sin = Math.sin(this.blastAngle);
    const perpCos = Math.cos(this.blastAngle + Math.PI / 2);
    const perpSin = Math.sin(this.blastAngle + Math.PI / 2);

    // Cone (triangle) in firing direction
    const coneLen = 24 * scale;
    const coneWidth = 8 * scale;
    const tipX = cos * coneLen;
    const tipY = sin * coneLen;
    const leftX = -perpCos * coneWidth;
    const leftY = -perpSin * coneWidth;
    const rightX = perpCos * coneWidth;
    const rightY = perpSin * coneWidth;

    g.moveTo(tipX, tipY)
      .lineTo(leftX, leftY)
      .lineTo(rightX, rightY)
      .lineTo(tipX, tipY)
      .fill({ color: this.color, alpha: alpha * 0.7 });

    // White center dot
    g.circle(cos * 4, sin * 4, 4 * (1 - t * 0.5)).fill({ color: 0xffffff, alpha });

    // Forward-flying spark dots
    for (const spark of this.sparkOffsets) {
      const dist = (spark.dist + spark.speed * this.timer) * scale;
      const sx = cos * dist + perpCos * spark.perpOffset;
      const sy = sin * dist + perpSin * spark.perpOffset;
      const sparkAlpha = alpha * 0.8;
      g.circle(sx, sy, 1.5).fill({ color: 0xffffff, alpha: sparkAlpha });
    }
  }
}
