import { Graphics } from 'pixi.js';
import { COLORS } from '@/app/constants';
import type { AegisIntercept, DistantFlash, Explosion, FlakBurst, TitleBullet, TitleDebris, TitleDrone, TitleFAB, TitleMissile, WaterSplash, WireModel } from './title-models';
import { spawnDrones, updateDrones } from './title-drones';
import { spawnMissiles, updateMissiles } from './title-missiles';
import { spawnFABs, updateFABs } from './title-fabs';
import { updateTurretTargeting, updateBullets } from './title-turrets';
import { spawnDistantFlashes, updateDebris, updateWaterSplashes, updateFlakBursts, updateExplosions, updateDistantFlashes } from './title-particles';

interface TitleActionContext {
  actionGraphics: Graphics;
  droneTimer: number;
  missileTimer: number;
  fabTimer: number;
  flashTimer: number;
  titleDrones: TitleDrone[];
  titleMissiles: TitleMissile[];
  titleFABs: TitleFAB[];
  aegisIntercepts: AegisIntercept[];
  explosions: Explosion[];
  distantFlashes: DistantFlash[];
  titleBullets: TitleBullet[];
  titleDebris: TitleDebris[];
  waterSplashes: WaterSplash[];
  flakBursts: FlakBurst[];
  gunBurstTimer: number;
  gunBurstCount: number;
  gunMuzzleFlash: number;
  gunMuzzleFlashTurret: 'fwd' | 'ciws';
  gunTargetWx: number;
  gunTargetWy: number;
  gunTargetWz: number;
  activeTurretId: 'fwd' | 'ciws';
  fwdTurretAngle: number;
  fwdTurretTargetAngle: number;
  ciwsTurretAngle: number;
  ciwsTurretTargetAngle: number;
  tankerRotation: number;
  cameraBobX: number;
  cameraBobY: number;
  projectWorld: (wx: number, wy: number, wz: number) => { x: number; y: number; depth: number };
  drawWireModel: (g: Graphics, model: WireModel, wx: number, wy: number, wz: number, rotY: number, rotX: number, color: number, alpha: number, scale?: number, glowColor?: number) => void;
}

export function updateTitleAction(ctx: TitleActionContext, dt: number, elapsed: number): void {
  const g = ctx.actionGraphics;
  g.clear();

  // Spawn entities
  spawnDrones(ctx, dt);
  spawnMissiles(ctx, dt);
  spawnFABs(ctx, dt);
  spawnDistantFlashes(ctx, dt);

  // Update & draw entities
  updateDrones(ctx, dt, elapsed);
  updateMissiles(ctx, dt, elapsed);
  updateFABs(ctx, dt, elapsed);

  // AEGIS intercepts (kept inline — tightly coupled with missile state)
  updateAegisIntercepts(ctx, dt, elapsed);

  // Turret targeting and bullet fire
  updateTurretTargeting(ctx, dt, elapsed);
  updateBullets(ctx, dt, elapsed);

  // Particle effects
  updateDebris(ctx, dt);
  updateWaterSplashes(ctx, dt);
  updateFlakBursts(ctx, dt);
  updateExplosions(ctx, dt, elapsed);
  updateDistantFlashes(ctx, dt);
}

function updateAegisIntercepts(ctx: TitleActionContext, dt: number, elapsed: number): void {
  const g = ctx.actionGraphics;

  for (let i = ctx.aegisIntercepts.length - 1; i >= 0; i--) {
    const a = ctx.aegisIntercepts[i];
    a.age += dt;
    const t = Math.min(1, a.age / a.maxAge);
    a.wx = 0 * (1 - t) + a.targetWx * t + (1 - t) * t * (-15);
    a.wy = -8 * (1 - t) + a.targetWy * t + (1 - t) * t * (-30);
    a.wz = 0 * (1 - t) + a.targetWz * t;
    a.trail.push({ x: a.wx, y: a.wy, z: a.wz });
    if (a.trail.length > 12) a.trail.shift();

    if (a.age >= a.maxAge) {
      ctx.explosions.push({ wx: a.targetWx, wy: a.targetWy, wz: a.targetWz, age: 0, maxAge: 1.0 });
      // Spawn debris from intercept
      const dCount = 4 + Math.floor(Math.random() * 5);
      for (let d = 0; d < dCount; d++) {
        const ang = Math.random() * Math.PI * 2;
        const upAng = Math.random() * Math.PI * 0.5 - Math.PI * 0.25;
        const spd = 10 + Math.random() * 35;
        ctx.titleDebris.push({
          wx: a.targetWx, wy: a.targetWy, wz: a.targetWz,
          vwx: Math.cos(ang) * spd, vwy: Math.sin(upAng) * spd * -0.5, vwz: Math.sin(ang) * spd,
          rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 10,
          size: 1 + Math.random() * 2, color: [0xff3333, 0xff6600, 0xffaa00][Math.floor(Math.random() * 3)],
          age: 0, maxAge: 3 + Math.random() * 2, sinking: false, sinkSpeed: 3 + Math.random() * 3,
        });
      }
      ctx.cameraBobX += (Math.random() - 0.5) * 4;
      ctx.cameraBobY += (Math.random() - 0.5) * 3;
      for (let mi = ctx.titleMissiles.length - 1; mi >= 0; mi--) {
        const m = ctx.titleMissiles[mi];
        if (m.intercepted) {
          const dist = Math.hypot(m.wx - a.targetWx, m.wy - a.targetWy, m.wz - a.targetWz);
          if (dist < 60) {
            ctx.titleMissiles.splice(mi, 1);
          }
        }
      }
      ctx.aegisIntercepts.splice(i, 1);
      continue;
    }

    const ap = ctx.projectWorld(a.wx, a.wy, a.wz);
    g.circle(ap.x, ap.y, 2).fill({ color: COLORS.phosphorGreen, alpha: 0.8 });
    g.circle(ap.x, ap.y, 5).fill({ color: COLORS.phosphorGreen, alpha: 0.1 });

    for (let j = 0; j < a.trail.length - 1; j++) {
      const tt = j / a.trail.length;
      const p1 = ctx.projectWorld(a.trail[j].x, a.trail[j].y, a.trail[j].z);
      const p2 = ctx.projectWorld(a.trail[j + 1].x, a.trail[j + 1].y, a.trail[j + 1].z);
      g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y)
        .stroke({ width: 2.0 - tt * 1.0, color: COLORS.phosphorGreen, alpha: tt * 0.4 });
    }

    const launchP = ctx.projectWorld(0, -8, 0);
    if (t < 0.15) {
      g.circle(launchP.x, launchP.y, 8).fill({ color: COLORS.phosphorGreen, alpha: 0.15 * (1 - t / 0.15) });
    }
  }
}
