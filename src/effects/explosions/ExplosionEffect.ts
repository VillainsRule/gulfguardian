import { Container, Graphics } from 'pixi.js';
import { COLORS } from '@/app/constants';
import { getQuality } from '@/app/quality';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  isSpark?: boolean;
}

export class ExplosionEffect extends Container {
  private graphics: Graphics;
  private timer: number = 0;
  private duration: number;
  private maxRadius: number;
  public finished: boolean = false;
  public priority: number = 2;
  private color: number;
  private particles: Particle[] = [];
  private simplified: boolean;

  constructor(
    x: number,
    y: number,
    maxRadius: number = 30,
    duration: number = 0.4,
    color: number = COLORS.amber
  ) {
    super();
    this.position.set(x, y);
    this.maxRadius = maxRadius;
    this.duration = duration;
    this.color = color;
    this.graphics = new Graphics();
    this.addChild(this.graphics);

    const quality = getQuality();
    this.simplified = quality.simplifiedExplosions;

    // Additive blend mode for hot glow on high quality
    if (quality.enableGlow) {
      this.graphics.blendMode = 'add';
    }
    const numParticles = Math.max(2, Math.floor((Math.floor(maxRadius / 4) + 3) * quality.particleMultiplier));
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      this.particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: duration * (0.5 + Math.random() * 0.5),
        maxLife: duration,
        size: 1.2 + Math.random() * 2.5,
      });
    }

    // Hot shrapnel sparks — fast, bright, short-lived
    const numSparks = Math.max(1, Math.floor((2 + Math.floor(Math.random() * 3)) * quality.particleMultiplier));
    for (let i = 0; i < numSparks; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 160 + Math.random() * 220;
      this.particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: duration * (0.25 + Math.random() * 0.25),
        maxLife: duration * 0.5,
        size: 0.8 + Math.random() * 1.0,
        isSpark: true,
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

    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }

    const g = this.graphics;
    g.clear();

    const radius = this.maxRadius * t;
    const alpha = 1 - t;

    if (this.simplified) {
      // Mobile: minimal rendering — shockwave ring + particle dots only
      g.circle(0, 0, radius).stroke({ width: 2, color: this.color, alpha });
      for (const p of this.particles) {
        if (p.life <= 0) continue;
        const pAlpha = (p.life / p.maxLife) * 0.9;
        g.circle(p.x, p.y, p.size).fill({ color: p.isSpark ? 0xffffff : this.color, alpha: pAlpha });
      }
      return;
    }

    // Bright initial flash (first 40% of duration) — hotter and wider
    if (t < 0.4) {
      const flashT = t / 0.4;
      const flashAlpha = (1 - flashT) * 0.95;
      const flashRadius = this.maxRadius * 0.55 * (1 + flashT);
      g.circle(0, 0, flashRadius).fill({ color: 0xffffff, alpha: flashAlpha });
    }

    // Inner hot core — brighter, lingers longer
    if (t < 0.75) {
      const coreAlpha = (1 - t / 0.75) * 0.7;
      const coreRadius = this.maxRadius * 0.4 * (0.5 + t);
      g.circle(0, 0, coreRadius).fill({ color: this.color, alpha: coreAlpha });
    }

    // Expanding shockwave ring — thicker
    g.circle(0, 0, radius).stroke({ width: 3.5, color: this.color, alpha });

    // Secondary inner ring — brighter
    if (t < 0.7) {
      const innerAlpha = (1 - t / 0.7) * 0.55;
      g.circle(0, 0, radius * 0.5).stroke({ width: 2, color: 0xffffff, alpha: innerAlpha });
    }

    // Filled expanding area — bolder
    g.circle(0, 0, radius * 0.7).fill({ color: this.color, alpha: alpha * 0.3 });

    // Draw debris particles
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      const pAlpha = (p.life / p.maxLife) * 0.9;
      if (p.isSpark) {
        // Hot white/yellow sparks with short trail
        g.circle(p.x, p.y, p.size).fill({ color: 0xffffff, alpha: pAlpha });
        // Spark trail (line toward origin)
        const trailLen = Math.min(14, Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 0.06);
        const norm = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
        const tx = p.x - (p.vx / norm) * trailLen;
        const ty = p.y - (p.vy / norm) * trailLen;
        g.moveTo(p.x, p.y).lineTo(tx, ty).stroke({ width: 0.5, color: COLORS.yellow, alpha: pAlpha * 0.6 });
      } else {
        g.circle(p.x, p.y, p.size).fill({ color: this.color, alpha: pAlpha });
      }
    }
  }
}
