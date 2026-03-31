import { Container, Graphics } from 'pixi.js';
import { COLORS } from '@/app/constants';
import { getQuality } from '@/app/quality';

interface Fragment {
  points: number[]; // flat array [x0,y0, x1,y1, x2,y2]
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  alpha: number;
}

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  life: number;
  maxLife: number;
}

interface SinkingShadow {
  x: number;
  y: number;
  vy: number;
  size: number;
  growRate: number;
  alpha: number;
  delay: number;
}

interface SmokePuff {
  x: number;
  y: number;
  radius: number;
  growRate: number;
  alpha: number;
  delay: number;
}

interface InlineExplosion {
  x: number;
  y: number;
  delay: number;
  timer: number;
  duration: number;
  maxRadius: number;
  color: number;
}

type DeathSize = 'small' | 'medium' | 'large';

interface DeathPreset {
  fragments: number;
  explosions: number;
  debris: number;
  smokePuffs: number;
  duration: number;
  fragmentSpread: number;
  explosionSpread: number;
  initialFlashRadius: number;
  fireGlowRadius: number;
  fireGlowDuration: number;
}

const PRESETS: Record<DeathSize, DeathPreset> = {
  small: { fragments: 6, explosions: 6, debris: 18, smokePuffs: 6, duration: 1.0, fragmentSpread: 18, explosionSpread: 32, initialFlashRadius: 20, fireGlowRadius: 16, fireGlowDuration: 0.6 },
  medium: { fragments: 9, explosions: 8, debris: 24, smokePuffs: 8, duration: 1.2, fragmentSpread: 26, explosionSpread: 48, initialFlashRadius: 30, fireGlowRadius: 24, fireGlowDuration: 0.8 },
  large: { fragments: 12, explosions: 12, debris: 32, smokePuffs: 10, duration: 1.6, fragmentSpread: 34, explosionSpread: 65, initialFlashRadius: 45, fireGlowRadius: 35, fireGlowDuration: 1.2 },
};

// Mobile-optimized presets: far fewer elements to reduce per-frame draw calls
const MOBILE_PRESETS: Record<DeathSize, DeathPreset> = {
  small: { fragments: 3, explosions: 2, debris: 6, smokePuffs: 2, duration: 0.7, fragmentSpread: 16, explosionSpread: 28, initialFlashRadius: 18, fireGlowRadius: 0, fireGlowDuration: 0 },
  medium: { fragments: 4, explosions: 3, debris: 8, smokePuffs: 2, duration: 0.8, fragmentSpread: 22, explosionSpread: 40, initialFlashRadius: 25, fireGlowRadius: 0, fireGlowDuration: 0 },
  large: { fragments: 5, explosions: 4, debris: 10, smokePuffs: 3, duration: 1.0, fragmentSpread: 28, explosionSpread: 50, initialFlashRadius: 35, fireGlowRadius: 0, fireGlowDuration: 0 },
};

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export class DeathSequenceEffect extends Container {
  private graphics: Graphics;
  private timer: number = 0;
  private totalDuration: number;
  public finished: boolean = false;
  public priority: number = 2;

  private fragments: Fragment[] = [];
  private explosions: InlineExplosion[] = [];
  private debris: Debris[] = [];
  private smokePuffs: SmokePuff[] = [];
  private sinkingShadows: SinkingShadow[] = [];
  private sinkDuration: number;
  private color: number;
  private initialFlashRadius: number;
  private fireGlowRadius: number;
  private fireGlowDuration: number;
  private simplified: boolean;

  /** World-space positions where debris has splashed into water — consumed by game loop */
  public pendingSplashes: { x: number; y: number }[] = [];

  constructor(x: number, y: number, size: DeathSize, color: number = COLORS.red) {
    super();
    this.position.set(x, y);
    this.color = color;
    this.graphics = new Graphics();
    this.addChild(this.graphics);

    const quality = getQuality();
    this.simplified = quality.simplifiedDeaths;
    const presetTable = this.simplified ? MOBILE_PRESETS : PRESETS;
    const preset = presetTable[size];
    this.totalDuration = preset.duration;
    this.initialFlashRadius = preset.initialFlashRadius;
    this.fireGlowRadius = preset.fireGlowRadius;
    this.fireGlowDuration = preset.fireGlowDuration;
    const rand = seededRand(Math.floor(x * 100 + y * 7));

    // Generate fragments (triangular shards of the hull)
    for (let i = 0; i < preset.fragments; i++) {
      const angle = (i / preset.fragments) * Math.PI * 2 + rand() * 0.5;
      const dist = 2 + rand() * preset.fragmentSpread * 0.3;
      const fragSize = 4 + rand() * 6;
      // Triangle points relative to fragment center
      const points = [
        -fragSize * 0.5 + rand() * 2, -fragSize * 0.6,
        fragSize * 0.5 + rand() * 2, -fragSize * 0.3,
        rand() * 2 - 1, fragSize * 0.5,
      ];
      this.fragments.push({
        points,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        vx: Math.cos(angle) * (80 + rand() * 140),
        vy: Math.sin(angle) * (80 + rand() * 140),
        rotation: rand() * Math.PI * 2,
        rotSpeed: (rand() - 0.5) * 12,
        alpha: 1.0,
      });
    }

    // Generate staggered explosions
    for (let i = 0; i < preset.explosions; i++) {
      const delay = 0.05 + i * 0.1 + rand() * 0.05;
      const offsetX = (rand() - 0.5) * preset.explosionSpread * 1.5;
      const offsetY = (rand() - 0.5) * preset.explosionSpread * 1.5;
      this.explosions.push({
        x: offsetX,
        y: offsetY,
        delay,
        timer: 0,
        duration: 0.3 + rand() * 0.2,
        maxRadius: preset.explosionSpread * (0.5 + rand() * 0.6),
        color: rand() > 0.4 ? color : COLORS.amber,
      });
    }

    // Generate debris particles
    const debrisColors = [color, COLORS.amber, 0xff6600, 0x333333, 0x666666];
    for (let i = 0; i < preset.debris; i++) {
      const angle = rand() * Math.PI * 2;
      const speed = 50 + rand() * 150;
      this.debris.push({
        x: (rand() - 0.5) * 6,
        y: (rand() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1 + rand() * 2.5,
        color: debrisColors[Math.floor(rand() * debrisColors.length)],
        life: 0.3 + rand() * 0.7,
        maxLife: 0.3 + rand() * 0.7,
      });
    }

    // Generate smoke puffs
    for (let i = 0; i < preset.smokePuffs; i++) {
      this.smokePuffs.push({
        x: (rand() - 0.5) * preset.explosionSpread,
        y: (rand() - 0.5) * preset.explosionSpread,
        radius: 3 + rand() * 4,
        growRate: 15 + rand() * 20,
        alpha: 0.3 + rand() * 0.15,
        delay: 0.2 + rand() * 0.3,
      });
    }

    // Generate sinking shadows (subtle silhouettes drifting down after destruction)
    // Skip on mobile — they're subtle and add 1-2.5s of extra per-frame rendering
    const numShadows = this.simplified ? 0 : (size === 'large' ? 5 : size === 'medium' ? 4 : 3);
    this.sinkDuration = numShadows > 0 ? preset.duration + 2.5 : preset.duration;
    for (let i = 0; i < numShadows; i++) {
      const angle = (i / numShadows) * Math.PI * 2 + rand() * 0.8;
      const dist = 4 + rand() * preset.fragmentSpread * 0.4;
      this.sinkingShadows.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        vy: 12 + rand() * 10,
        size: 4 + rand() * 5,
        growRate: 2 + rand() * 2,
        alpha: 0.10 + rand() * 0.05,
        delay: preset.duration * 0.4 + rand() * preset.duration * 0.3,
      });
    }
  }

  update(dt: number): void {
    if (this.finished) return;
    this.timer += dt;

    if (this.timer >= this.sinkDuration) {
      this.finished = true;
      this.visible = false;
      return;
    }

    const g = this.graphics;
    g.clear();

    const t = Math.min(1, this.timer / this.totalDuration);

    // --- Initial bright flash (first 15% of duration) ---
    if (t < 0.15) {
      const flashT = t / 0.15;
      const flashAlpha = (1 - flashT) * 0.9;
      const flashRadius = this.initialFlashRadius * (0.5 + flashT * 1.5);
      g.circle(0, 0, flashRadius).fill({ color: 0xffffff, alpha: flashAlpha });
      g.circle(0, 0, flashRadius * 0.6).fill({ color: 0xffffaa, alpha: flashAlpha * 0.7 });
    }

    // --- Fire glow (persistent orange/red glow) — skip on mobile (3 circles/frame saved) ---
    if (!this.simplified && this.timer < this.fireGlowDuration) {
      const fireT = this.timer / this.fireGlowDuration;
      const fireAlpha = (1 - fireT * fireT) * 0.4;
      const fireRadius = this.fireGlowRadius * (0.8 + fireT * 0.8);
      g.circle(0, 0, fireRadius).fill({ color: 0xff4400, alpha: fireAlpha });
      g.circle(0, 0, fireRadius * 0.6).fill({ color: 0xff8800, alpha: fireAlpha * 0.6 });
      const flicker = Math.sin(this.timer * 20) * 0.15 + 0.85;
      g.circle(0, 0, fireRadius * 0.3 * flicker).fill({ color: 0xffcc00, alpha: fireAlpha * 0.5 });
    }

    // --- Phase 1: Fragments break apart ---
    for (const frag of this.fragments) {
      frag.x += frag.vx * dt;
      frag.y += frag.vy * dt;
      frag.vx *= 0.97;
      frag.vy *= 0.97;
      frag.rotation += frag.rotSpeed * dt;
      frag.alpha = Math.max(0, 1 - t * 1.5);

      if (frag.alpha <= 0) continue;

      // Draw rotated triangle fragment
      const cos = Math.cos(frag.rotation);
      const sin = Math.sin(frag.rotation);
      const p = frag.points;
      const x0 = frag.x + p[0] * cos - p[1] * sin;
      const y0 = frag.y + p[0] * sin + p[1] * cos;
      const x1 = frag.x + p[2] * cos - p[3] * sin;
      const y1 = frag.y + p[2] * sin + p[3] * cos;
      const x2 = frag.x + p[4] * cos - p[5] * sin;
      const y2 = frag.y + p[4] * sin + p[5] * cos;

      g.moveTo(x0, y0)
        .lineTo(x1, y1)
        .lineTo(x2, y2)
        .closePath()
        .fill({ color: this.color, alpha: frag.alpha * 0.6 });
      if (!this.simplified) {
        g.stroke({ width: 1.5, color: this.color, alpha: frag.alpha });
      }
    }

    // --- Phase 2: Staggered explosions ---
    for (const exp of this.explosions) {
      if (this.timer < exp.delay) continue;
      exp.timer += dt;
      const et = exp.timer / exp.duration;
      if (et >= 1) continue;

      const radius = exp.maxRadius * et;
      const alpha = 1 - et;

      // White flash for first 30%
      if (et < 0.3) {
        const flashAlpha = (1 - et / 0.3) * 0.7;
        g.circle(exp.x, exp.y, exp.maxRadius * 0.35 * (1 + et))
          .fill({ color: 0xffffff, alpha: flashAlpha });
      }

      // Hot core
      if (et < 0.5) {
        const coreAlpha = (1 - et / 0.5) * 0.5;
        g.circle(exp.x, exp.y, exp.maxRadius * 0.3 * (0.5 + et))
          .fill({ color: exp.color, alpha: coreAlpha });
      }

      // Shockwave ring
      g.circle(exp.x, exp.y, radius)
        .stroke({ width: 2, color: exp.color, alpha });

      // Inner ring — skip on mobile
      if (!this.simplified && et < 0.6) {
        g.circle(exp.x, exp.y, radius * 0.5)
          .stroke({ width: 1, color: 0xffffff, alpha: (1 - et / 0.6) * 0.3 });
      }
    }

    // --- Phase 3: Debris rain ---
    for (const d of this.debris) {
      const prevLife = d.life;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.95;
      d.vy *= 0.95;
      d.vy += 40 * dt; // gravity
      d.life -= dt;

      // When debris expires, emit a small water splash at that position
      if (d.life <= 0 && prevLife > 0) {
        this.pendingSplashes.push({ x: this.x + d.x, y: this.y + d.y });
      }
      if (d.life <= 0) continue;

      const dAlpha = (d.life / d.maxLife) * 0.8;
      g.circle(d.x, d.y, d.size).fill({ color: d.color, alpha: dAlpha });
    }

    // --- Phase 4: Smoke cloud ---
    for (const s of this.smokePuffs) {
      if (this.timer < s.delay) continue;
      const sAge = this.timer - s.delay;
      const sDuration = this.totalDuration - s.delay;
      const sT = Math.min(1, sAge / sDuration);

      const radius = s.radius + s.growRate * sAge;
      const alpha = s.alpha * (1 - sT) * (1 - sT);
      if (alpha < 0.01) continue;

      const color = sT < 0.3 ? 0x664422 : 0x222222;
      g.circle(s.x, s.y, radius).fill({ color, alpha });
    }

    // --- Phase 5: Sinking shadows (subtle dark silhouettes drifting down) ---
    for (const sh of this.sinkingShadows) {
      if (this.timer < sh.delay) continue;
      const sAge = this.timer - sh.delay;
      const sFadeDuration = this.sinkDuration - sh.delay;
      const sT = Math.min(1, sAge / sFadeDuration);

      sh.y += sh.vy * dt;
      sh.vy *= 0.995; // slow deceleration

      const currentSize = sh.size + sh.growRate * sAge;
      const fadeIn = Math.min(1, sAge / 0.3); // fade in over 0.3s
      const fadeOut = 1 - sT;
      const alpha = sh.alpha * fadeIn * fadeOut * fadeOut;
      if (alpha < 0.005) continue;

      // Draw as a dark ellipse (wider than tall, like a sinking hull shadow)
      g.ellipse(sh.x, sh.y, currentSize * 1.4, currentSize * 0.7)
        .fill({ color: 0x001122, alpha });
    }
  }
}
