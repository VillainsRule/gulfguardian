import { Container, Graphics } from 'pixi.js';
import { COLORS } from '@/app/constants';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export class ImpactSpark extends Container {
  private graphics: Graphics;
  private timer: number = 0;
  private duration: number = 0.25;
  public finished: boolean = false;
  public priority: number = 0;
  private sparks: Spark[] = [];
  private flashTimer: number = 0.06;
  private color: number;

  constructor(x: number, y: number, incomingAngle: number, color: number = COLORS.amber) {
    super();
    this.position.set(x, y);
    this.color = color;
    this.graphics = new Graphics();
    this.addChild(this.graphics);

    // Sparks fly in a 120-degree cone OPPOSITE to incoming angle
    const bounceAngle = incomingAngle + Math.PI;
    const count = 4 + Math.floor(Math.random() * 3); // 4-6 sparks
    for (let i = 0; i < count; i++) {
      const spreadAngle = bounceAngle + (Math.random() - 0.5) * (Math.PI * 2 / 3);
      const speed = 120 + Math.random() * 160;
      this.sparks.push({
        x: 0,
        y: 0,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed,
        life: 0.12 + Math.random() * 0.12,
        maxLife: 0.24,
        size: 0.8 + Math.random() * 1.2,
      });
    }
  }

  update(dt: number): void {
    if (this.finished) return;
    this.timer += dt;
    this.flashTimer -= dt;

    let allDead = true;
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      allDead = false;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.94;
      s.vy *= 0.94;
      s.life -= dt;
    }

    if (allDead && this.flashTimer <= 0) {
      this.finished = true;
      this.visible = false;
      return;
    }

    const g = this.graphics;
    g.clear();

    // Central white flash
    if (this.flashTimer > 0) {
      const flashAlpha = (this.flashTimer / 0.06) * 0.95;
      g.circle(0, 0, 5).fill({ color: 0xffffff, alpha: flashAlpha });
      g.circle(0, 0, 9).fill({ color: this.color, alpha: flashAlpha * 0.4 });
    }

    // Draw sparks
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      const t = s.life / s.maxLife;
      // White core dot
      g.circle(s.x, s.y, s.size * 0.7).fill({ color: 0xffffff, alpha: t });
      // Colored trail line
      const norm = Math.sqrt(s.vx * s.vx + s.vy * s.vy) || 1;
      const trailLen = Math.min(8, norm * 0.05);
      const tx = s.x - (s.vx / norm) * trailLen;
      const ty = s.y - (s.vy / norm) * trailLen;
      g.moveTo(s.x, s.y).lineTo(tx, ty).stroke({ width: s.size, color: this.color, alpha: t * 0.85 });
    }
  }
}
