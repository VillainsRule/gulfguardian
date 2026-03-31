import { Container, Graphics } from 'pixi.js';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';
import { isMobileDetected, getQuality } from '@/app/quality';

export interface RadarTarget {
  x: number;
  y: number;
  alive?: boolean;
}

const RADAR_RADIUS = 70;
const RADAR_RANGE = 1200; // world units
const RADAR_CX = GAME_WIDTH - 100;
const RADAR_CY = GAME_HEIGHT - 120;
const SWEEP_SPEED = Math.PI; // one revolution per 2s

export class Radar extends Container {
  private gfx: Graphics;
  private sweepAngle: number = 0;
  private blipTrails: { angle: number; dist: number; brightness: number }[] = [];

  constructor() {
    super();
    this.gfx = new Graphics();
    this.addChild(this.gfx);
  }

  update(playerX: number, playerY: number, enemies: RadarTarget[], dt: number): void {
    if (isMobileDetected() || getQuality().particleMultiplier < 0.6) {
      this.visible = false;
      return;
    }
    this.visible = true;

    this.sweepAngle += SWEEP_SPEED * dt;
    if (this.sweepAngle > Math.PI * 2) this.sweepAngle -= Math.PI * 2;

    const g = this.gfx;
    g.clear();

    const cx = RADAR_CX;
    const cy = RADAR_CY;
    const r = RADAR_RADIUS;

    // Background
    g.circle(cx, cy, r).fill({ color: 0x001100, alpha: 0.5 });
    g.circle(cx, cy, r).stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.3 });

    // Range rings
    g.circle(cx, cy, r * 0.5).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.15 });
    g.circle(cx, cy, r * 0.75).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.1 });

    // Crosshairs
    g.moveTo(cx - r, cy).lineTo(cx + r, cy).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.1 });
    g.moveTo(cx, cy - r).lineTo(cx, cy + r).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.1 });

    // Sweep line
    const sweepX = cx + Math.cos(this.sweepAngle) * r;
    const sweepY = cy + Math.sin(this.sweepAngle) * r;
    g.moveTo(cx, cy).lineTo(sweepX, sweepY).stroke({ width: 1.5, color: COLORS.phosphorGreen, alpha: 0.8 });

    // Sweep trail (fading arc)
    for (let i = 1; i <= 10; i++) {
      const trailAngle = this.sweepAngle - i * 0.06;
      const tx = cx + Math.cos(trailAngle) * r;
      const ty = cy + Math.sin(trailAngle) * r;
      g.moveTo(cx, cy).lineTo(tx, ty).stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.35 * (1 - i / 10) });
    }

    // Decay existing blip trails
    for (let i = this.blipTrails.length - 1; i >= 0; i--) {
      this.blipTrails[i].brightness -= dt * 0.5;
      if (this.blipTrails[i].brightness <= 0) {
        this.blipTrails.splice(i, 1);
      }
    }

    // Process enemies into blips
    for (const enemy of enemies) {
      if (enemy.alive === false) continue;

      const dx = enemy.x - playerX;
      const dy = enemy.y - playerY;
      const worldDist = Math.sqrt(dx * dx + dy * dy);
      if (worldDist > RADAR_RANGE) continue;

      const angle = Math.atan2(dy, dx);
      const radarDist = worldDist / RADAR_RANGE;

      // Check if sweep just passed this blip
      const angleDiff = Math.abs(((this.sweepAngle % (Math.PI * 2)) - ((angle + Math.PI * 2) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (angleDiff < 0.15) {
        // Refresh or add blip trail
        let found = false;
        for (const trail of this.blipTrails) {
          if (Math.abs(trail.angle - angle) < 0.2 && Math.abs(trail.dist - radarDist) < 0.1) {
            trail.brightness = 1;
            trail.angle = angle;
            trail.dist = radarDist;
            found = true;
            break;
          }
        }
        if (!found) {
          this.blipTrails.push({ angle, dist: radarDist, brightness: 1 });
        }
      }
    }

    // Draw blip trails
    for (const blip of this.blipTrails) {
      const bx = cx + Math.cos(blip.angle) * blip.dist * r;
      const by = cy + Math.sin(blip.angle) * blip.dist * r;
      const alpha = 0.15 + 0.7 * blip.brightness;
      g.circle(bx, by, 2).fill({ color: COLORS.phosphorGreen, alpha });
      if (blip.brightness > 0.5) {
        g.circle(bx, by, 5).fill({ color: COLORS.phosphorGreen, alpha: blip.brightness * 0.12 });
      }
    }

    // Center dot (player)
    g.circle(cx, cy, 2).fill({ color: COLORS.cyan, alpha: 0.8 });
  }
}
