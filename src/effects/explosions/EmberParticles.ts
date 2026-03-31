import { Container, Graphics } from 'pixi.js';

const EMBER_COLORS = [0xff6600, 0xff4400, 0xffaa00, 0xff8800];

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

export class EmberParticles extends Container {
  private graphics: Graphics;
  private timer: number;
  public finished: boolean = false;
  public priority: number = 1;
  private embers: Ember[] = [];

  constructor(
    x: number,
    y: number,
    count: number = 10,
    spread: number = 30,
  ) {
    super();
    this.position.set(x, y);
    // Start with negative timer so embers appear as explosion fades
    this.timer = -0.15;
    this.graphics = new Graphics();
    this.addChild(this.graphics);

    const actualCount = count - 2 + Math.floor(Math.random() * 5); // 8-12 range
    for (let i = 0; i < actualCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * spread;
      this.embers.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 20,
        vy: -(10 + Math.random() * 20), // float upward
        life: 1.0 + Math.random() * 1.0,
        maxLife: 2.0,
        size: 0.8 + Math.random() * 1.5,
        color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
      });
    }
  }

  update(dt: number): void {
    if (this.finished) return;
    this.timer += dt;

    // Still in delay phase
    if (this.timer < 0) return;

    let allDead = true;
    for (const e of this.embers) {
      if (e.life <= 0) continue;
      allDead = false;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vy -= 2 * dt; // gentle upward drift acceleration
      e.life -= dt;
    }

    if (allDead) {
      this.finished = true;
      this.visible = false;
      return;
    }

    const g = this.graphics;
    g.clear();

    for (let i = 0; i < this.embers.length; i++) {
      const e = this.embers[i];
      if (e.life <= 0) continue;
      const t = e.life / e.maxLife;
      // Flicker with sin for organic fire feel
      const flicker = 0.5 + 0.5 * Math.sin(this.timer * 10 + i * 2.3);
      const alpha = t * flicker * 0.8;
      g.circle(e.x, e.y, e.size).fill({ color: e.color, alpha });
      // White hot core on brighter flickers
      if (flicker > 0.7) {
        g.circle(e.x, e.y, e.size * 0.4).fill({ color: 0xffffff, alpha: alpha * 0.6 });
      }
    }
  }
}
