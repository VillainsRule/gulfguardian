import { Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '@/app/constants';

// ─── Types ───

export interface CelebrationParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  trail: Array<{ x: number; y: number }>;
}

export interface DustParticle {
  x: number; y: number;
  vx: number; vy: number;
  phase: number;
}

export interface ShockwaveRing {
  x: number; y: number;
  timer: number;
  duration: number;
  maxRadius: number;
}

// ─── Particle creation ───

const CELEBRATION_COLORS = [0x00ff41, 0x00cc33, 0x00ff88, 0x00e5ff];
const SECONDARY_COLORS = [0x00ff41, 0x00e5ff, 0x00ff88];

/** Spawn a radial burst of celebration particles. */
export function createCelebrationBurst(
  cx: number, cy: number, count: number, secondary: boolean = false,
): CelebrationParticle[] {
  const colors = secondary ? SECONDARY_COLORS : CELEBRATION_COLORS;
  const particles: CelebrationParticle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * (secondary ? 0.4 : 0.3);
    const speed = secondary ? 60 + Math.random() * 150 : 100 + Math.random() * 250;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: secondary ? 1.5 + Math.random() * 0.5 : 2.0 + Math.random() * 0.5,
      maxLife: secondary ? 2.0 : 2.5,
      size: 1 + Math.random() * (secondary ? 1.5 : 2),
      color: colors[Math.floor(Math.random() * colors.length)],
      trail: [],
    });
  }
  return particles;
}

/** Create initial dust particles for the background. */
export function createDustParticles(count: number): DustParticle[] {
  const particles: DustParticle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      vx: (Math.random() - 0.5) * 4,
      vy: -(2 + Math.random() * 4),
      phase: Math.random() * Math.PI * 2,
    });
  }
  return particles;
}

// ─── Scanlines ───

/** Create a static scanline overlay Graphics object. */
export function createScanlines(): Graphics {
  const g = new Graphics();
  for (let y = 0; y < GAME_HEIGHT; y += 3) {
    g.rect(0, y, GAME_WIDTH, 1).fill({ color: 0x000000, alpha: 0.05 });
  }
  g.eventMode = 'none';
  return g;
}

// ─── Update functions ───

/** Update and render celebration particles + shockwave rings. */
export function updateParticles(
  particles: CelebrationParticle[],
  shockwaves: ShockwaveRing[],
  pg: Graphics,
  dt: number,
): void {
  pg.clear();

  // Draw shockwaves
  for (const sw of shockwaves) {
    const t = sw.timer / sw.duration;
    const radius = sw.maxRadius * t;
    const alpha = (1 - t) * (1 - t) * 0.5;
    pg.circle(sw.x, sw.y, radius).stroke({ width: 2, color: COLORS.phosphorGreen, alpha });
    pg.circle(sw.x, sw.y, radius * 0.8).stroke({ width: 1, color: COLORS.phosphorGreen, alpha: alpha * 0.5 });
  }

  if (particles.length > 0) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      // Store trail position
      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 3) p.trail.shift();
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; // gravity
      p.vx *= 0.99; // drag
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      const alpha = Math.min(1, p.life / (p.maxLife * 0.3));
      // Draw trail
      if (p.trail) {
        for (let ti = 0; ti < p.trail.length; ti++) {
          const trailAlpha = alpha * 0.3 * (ti / p.trail.length);
          pg.circle(p.trail[ti].x, p.trail[ti].y, p.size * 0.6).fill({ color: p.color, alpha: trailAlpha });
        }
      }
      pg.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: alpha * 0.6 });
    }
  }
}

/** Advance shockwave timers, removing expired ones. */
export function updateShockwaves(shockwaves: ShockwaveRing[], dt: number): void {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.timer += dt;
    if (sw.timer >= sw.duration) {
      shockwaves.splice(i, 1);
    }
  }
}

/** Draw the scrolling background grid. */
export function drawGrid(g: Graphics, gridOffset: number): void {
  g.clear();
  const gridSpacing = 40;
  for (let x = 0; x < GAME_WIDTH; x += gridSpacing) {
    g.moveTo(x, 0).lineTo(x, GAME_HEIGHT).stroke({ width: 0.5, color: COLORS.gridLine, alpha: 0.08 });
  }
  for (let y = -gridSpacing + gridOffset; y < GAME_HEIGHT + gridSpacing; y += gridSpacing) {
    g.moveTo(0, y).lineTo(GAME_WIDTH, y).stroke({ width: 0.5, color: COLORS.gridLine, alpha: 0.08 });
  }
}

/** Update and render dust particles. */
export function updateDust(
  g: Graphics, dustParticles: DustParticle[], elapsed: number, dt: number,
): void {
  g.clear();
  for (const p of dustParticles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y < 0) p.y += GAME_HEIGHT;
    if (p.x < 0) p.x += GAME_WIDTH;
    if (p.x > GAME_WIDTH) p.x -= GAME_WIDTH;
    const alpha = 0.04 + 0.04 * Math.sin(elapsed * 2 + p.phase);
    g.circle(p.x, p.y, 1).fill({ color: COLORS.phosphorGreen, alpha });
  }
}
