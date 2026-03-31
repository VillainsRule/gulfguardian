import { Graphics } from 'pixi.js';
import { COLORS } from '@/app/constants';
import { TITLE_FAB_MODEL, type TitleFAB, type WireModel } from './title-models';

interface FABContext {
  actionGraphics: Graphics;
  fabTimer: number;
  titleFABs: TitleFAB[];
  explosions: { wx: number; wy: number; wz: number; age: number; maxAge: number }[];
  projectWorld: (wx: number, wy: number, wz: number) => { x: number; y: number; depth: number };
  drawWireModel: (g: Graphics, model: WireModel, wx: number, wy: number, wz: number, rotY: number, rotX: number, color: number, alpha: number, scale?: number, glowColor?: number) => void;
}

export function spawnFABs(ctx: FABContext, dt: number): void {
  ctx.fabTimer -= dt;
  if (ctx.fabTimer <= 0 && ctx.titleFABs.length < 3) {
    ctx.fabTimer = 5.0 + Math.random() * 6.0;
    const angle = Math.random() * Math.PI * 2;
    ctx.titleFABs.push({
      worldAngle: angle,
      distance: 120 + Math.random() * 60,
      speed: 0.08 + Math.random() * 0.05,
      age: 0,
      maxAge: 8 + Math.random() * 6,
      sinePhase: Math.random() * Math.PI * 2,
      headingY: angle + Math.PI / 2,
    });
  }
}

export function updateFABs(ctx: FABContext, dt: number, elapsed: number): void {
  const g = ctx.actionGraphics;

  for (let i = ctx.titleFABs.length - 1; i >= 0; i--) {
    const fab = ctx.titleFABs[i];
    fab.age += dt;
    if (fab.age > fab.maxAge) {
      const fabWx = Math.cos(fab.worldAngle) * fab.distance;
      const fabWz = Math.sin(fab.worldAngle) * fab.distance;
      const fabWy = -6 + Math.sin(fab.age * 1.5) * 2;
      ctx.explosions.push({ wx: fabWx, wy: fabWy, wz: fabWz, age: 0, maxAge: 1.0 });
      ctx.titleFABs.splice(i, 1);
      continue;
    }
    fab.worldAngle += fab.speed * dt;
    fab.distance -= dt * 3;
    fab.headingY = fab.worldAngle + Math.PI / 2;

    const fabWx = Math.cos(fab.worldAngle) * fab.distance;
    const fabWz = Math.sin(fab.worldAngle) * fab.distance;
    const fabWy = -6 + Math.sin(elapsed * 2 + fab.sinePhase) * 2;
    const fabBob = Math.sin(elapsed * 3.5 + fab.sinePhase) * 0.08;

    // Draw wake trail behind FAB
    const fwdAngle = fab.headingY;
    for (let w = 0; w < 6; w++) {
      const wt = w / 5;
      const wakeDist = 3 + w * 4;
      const wakeSpread = 1 + w * 1.5;
      const wakeNoise = Math.sin(elapsed * 2 + w * 1.3) * 1;
      const portWake = ctx.projectWorld(
        fabWx - Math.cos(fwdAngle) * wakeDist,
        -6,
        fabWz - Math.sin(fwdAngle) * wakeDist - wakeSpread
      );
      const starWake = ctx.projectWorld(
        fabWx - Math.cos(fwdAngle) * wakeDist,
        -6,
        fabWz - Math.sin(fwdAngle) * wakeDist + wakeSpread
      );
      const wAlpha = 0.06 * (1 - wt);
      g.circle(portWake.x, portWake.y, 0.8).fill({ color: COLORS.phosphorGreen, alpha: wAlpha });
      g.circle(starWake.x, starWake.y, 0.8).fill({ color: COLORS.phosphorGreen, alpha: wAlpha });
    }

    // Draw 3D wireframe FAB model
    ctx.drawWireModel(g, TITLE_FAB_MODEL, fabWx, fabWy, fabWz,
      fwdAngle, fabBob, 0xff3333, 0.6, 0.9, 0xff6600);

    // Engine glow at stern
    const sternWx = fabWx - Math.cos(fwdAngle) * 6;
    const sternWz = fabWz - Math.sin(fwdAngle) * 6;
    const sp = ctx.projectWorld(sternWx, fabWy, sternWz);
    const fabFlicker = 0.25 + Math.sin(elapsed * 20 + i * 4) * 0.1;
    g.circle(sp.x, sp.y, 1.5).fill({ color: 0xff6600, alpha: fabFlicker });
  }
}
