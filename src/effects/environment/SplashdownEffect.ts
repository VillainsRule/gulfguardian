import { Container, Graphics } from 'pixi.js';
import { COLORS } from '@/app/constants';

interface SprayParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

export class SplashdownEffect extends Container {
  private graphics: Graphics;
  private timer: number = 0;
  private duration: number = 0.8;
  public finished: boolean = false;
  public priority: number = 1;
  private particles: SprayParticle[] = [];

  constructor(x: number, y: number) {
    super();
    this.position.set(x, y);
    this.graphics = new Graphics();
    this.addChild(this.graphics);

    // Spawn spray droplets arcing upward
    const count = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4; // mostly upward
      const speed = 30 + Math.random() * 50;
      this.particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.3,
        size: 0.8 + Math.random() * 1.2,
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

    // Update particles (gravity pulls them back down)
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; // gravity
      p.life -= dt;
    }

    const g = this.graphics;
    g.clear();

    // Phase 1: impact flash (0-20%)
    if (t < 0.2) {
      const flashT = t / 0.2;
      const flashAlpha = (1 - flashT) * 0.6;
      const flashR = 4 + flashT * 6;
      g.circle(0, 0, flashR).fill({ color: 0xffffff, alpha: flashAlpha });
    }

    // Phase 2: spray particles (0-60%)
    if (t < 0.6) {
      for (const p of this.particles) {
        if (p.life <= 0) continue;
        const pAlpha = Math.max(0, p.life / 0.6) * 0.5;
        g.circle(p.x, p.y, p.size).fill({ color: 0xffffff, alpha: pAlpha });
      }
      // Small vertical splash lines
      const splashH = (1 - t / 0.6) * 12;
      const splashAlpha = (1 - t / 0.6) * 0.35;
      g.moveTo(-1, 0).lineTo(-2, -splashH).stroke({ width: 0.8, color: COLORS.cyan, alpha: splashAlpha });
      g.moveTo(1, 0).lineTo(2, -splashH).stroke({ width: 0.8, color: COLORS.cyan, alpha: splashAlpha });
      g.moveTo(0, 0).lineTo(0, -splashH * 1.3).stroke({ width: 1, color: 0xffffff, alpha: splashAlpha * 0.8 });
    }

    // Phase 3: expanding water rings (20-100%)
    if (t > 0.2) {
      const ringT = (t - 0.2) / 0.8;
      const ringAlpha = (1 - ringT) * 0.12;
      const ringR = 5 + ringT * 20;
      g.circle(0, 0, ringR).stroke({ width: 0.8, color: 0x004466, alpha: ringAlpha });
      if (ringT < 0.6) {
        const innerR = ringR * 0.55;
        g.circle(0, 0, innerR).stroke({ width: 0.5, color: 0x004466, alpha: ringAlpha * 0.6 });
      }
    }
  }
}
