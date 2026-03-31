import { Graphics } from 'pixi.js';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/app/constants';
import type { TitleDebris, WaterSplash, FlakBurst, DistantFlash } from './title-models';

interface ParticleContext {
  actionGraphics: Graphics;
  titleDebris: TitleDebris[];
  waterSplashes: WaterSplash[];
  flakBursts: FlakBurst[];
  explosions: { wx: number; wy: number; wz: number; age: number; maxAge: number }[];
  distantFlashes: DistantFlash[];
  flashTimer: number;
  tankerRotation: number;
  cameraBobX: number;
  cameraBobY: number;
  projectWorld: (wx: number, wy: number, wz: number) => { x: number; y: number; depth: number };
}

export function spawnDistantFlashes(ctx: ParticleContext, dt: number): void {
  ctx.flashTimer -= dt;
  if (ctx.flashTimer <= 0) {
    ctx.flashTimer = 1.0 + Math.random() * 3.0;
    ctx.distantFlashes.push({
      screenAngle: Math.random() * Math.PI * 2,
      heightOffset: 20 + Math.random() * 30,
      age: 0,
      maxAge: 0.4 + Math.random() * 0.6,
      intensity: 0.5 + Math.random() * 0.5,
    });
  }
}

export function updateDebris(ctx: ParticleContext, dt: number): void {
  const g = ctx.actionGraphics;

  for (let i = ctx.titleDebris.length - 1; i >= 0; i--) {
    const db = ctx.titleDebris[i];
    db.age += dt;
    if (db.age > db.maxAge) { ctx.titleDebris.splice(i, 1); continue; }

    if (!db.sinking) {
      db.vwy += 18 * dt;
      db.wx += db.vwx * dt;
      db.wy += db.vwy * dt;
      db.wz += db.vwz * dt;
      db.rotation += db.rotSpeed * dt;
      db.vwx *= 0.995;
      db.vwz *= 0.995;

      if (db.wy >= -6) {
        db.wy = -6;
        db.sinking = true;
        db.vwx *= 0.2;
        db.vwz *= 0.2;
        db.vwy = db.sinkSpeed;
        ctx.waterSplashes.push({ wx: db.wx, wz: db.wz, age: 0, maxAge: 0.5 });
      }
    } else {
      db.wy += db.sinkSpeed * dt;
      db.vwx *= 0.98;
      db.vwz *= 0.98;
      db.wx += db.vwx * dt;
      db.wz += db.vwz * dt;
      db.rotation += db.rotSpeed * dt * 0.3;
    }

    const dp = ctx.projectWorld(db.wx, db.wy, db.wz);
    const lifeT = db.age / db.maxAge;
    const alpha = db.sinking
      ? Math.max(0, 0.5 * (1 - (db.age - 0.5) / db.maxAge))
      : Math.max(0, 0.8 * (1 - lifeT * 0.3));

    const sz = db.size;
    const cos = Math.cos(db.rotation);
    const sin = Math.sin(db.rotation);
    const drawColor = db.sinking ? 0x334455 : db.color;
    g.moveTo(dp.x + cos * sz, dp.y + sin * sz)
      .lineTo(dp.x + cos * (-sz * 0.5) - sin * (sz * 0.8), dp.y + sin * (-sz * 0.5) + cos * (sz * 0.8))
      .lineTo(dp.x + cos * (-sz * 0.5) + sin * (sz * 0.8), dp.y + sin * (-sz * 0.5) - cos * (sz * 0.8))
      .closePath()
      .fill({ color: drawColor, alpha });

    if (!db.sinking && db.age < 0.8) {
      const smokeAlpha = 0.12 * (1 - db.age / 0.8);
      g.circle(dp.x - db.vwx * 0.02, dp.y - db.vwy * 0.02, 1.5).fill({ color: 0x888877, alpha: smokeAlpha });
    }
  }
}

export function updateWaterSplashes(ctx: ParticleContext, dt: number): void {
  const g = ctx.actionGraphics;

  for (let i = ctx.waterSplashes.length - 1; i >= 0; i--) {
    const ws = ctx.waterSplashes[i];
    ws.age += dt;
    if (ws.age > ws.maxAge) { ctx.waterSplashes.splice(i, 1); continue; }
    const t = ws.age / ws.maxAge;
    const sp = ctx.projectWorld(ws.wx, -6, ws.wz);
    const r = 3 + t * 10;
    g.circle(sp.x, sp.y, r).stroke({ width: 1.5 - t, color: 0x88ccff, alpha: 0.3 * (1 - t) });
    if (t < 0.3) {
      g.circle(sp.x, sp.y, 2).fill({ color: 0xffffff, alpha: 0.4 * (1 - t / 0.3) });
    }
  }
}

export function updateFlakBursts(ctx: ParticleContext, dt: number): void {
  const g = ctx.actionGraphics;

  for (let i = ctx.flakBursts.length - 1; i >= 0; i--) {
    const fb = ctx.flakBursts[i];
    fb.age += dt;
    if (fb.age > fb.maxAge) { ctx.flakBursts.splice(i, 1); continue; }
    const t = fb.age / fb.maxAge;
    const fp = ctx.projectWorld(fb.wx, fb.wy, fb.wz);
    g.circle(fp.x, fp.y, 2 + t * 5).fill({ color: 0xccccaa, alpha: 0.15 * (1 - t) });
  }
}

export function updateExplosions(ctx: ParticleContext, dt: number, elapsed: number): void {
  const g = ctx.actionGraphics;

  for (let i = ctx.explosions.length - 1; i >= 0; i--) {
    const ex = ctx.explosions[i];
    ex.age += dt;
    if (ex.age > ex.maxAge) { ctx.explosions.splice(i, 1); continue; }
    const t = ex.age / ex.maxAge;
    const ep = ctx.projectWorld(ex.wx, ex.wy, ex.wz);
    const r1 = 5 + t * 22;
    const r2 = 3 + t * 14;
    g.circle(ep.x, ep.y, r1).stroke({ width: 2, color: 0xffaa00, alpha: 0.4 * (1 - t) });
    g.circle(ep.x, ep.y, r2).fill({ color: 0xff3333, alpha: 0.25 * (1 - t) });
    if (t < 0.3) {
      g.circle(ep.x, ep.y, 3 + t * 10).fill({ color: 0xffffff, alpha: 0.5 * (1 - t / 0.3) });
    }
    for (let s = 0; s < 8; s++) {
      const sa = s * (Math.PI * 2 / 8) + t * 3;
      const sr = r1 * (0.5 + Math.sin(sa * 3) * 0.5);
      g.circle(ep.x + Math.cos(sa) * sr, ep.y + Math.sin(sa) * sr, 1.5)
        .fill({ color: 0xffaa00, alpha: 0.3 * (1 - t) });
    }
    if (ex.age < 0.1) {
      ctx.cameraBobX += (Math.random() - 0.5) * 2;
      ctx.cameraBobY += (Math.random() - 0.5) * 1.5;
    }
  }
}

export function updateDistantFlashes(ctx: ParticleContext, dt: number): void {
  const g = ctx.actionGraphics;
  const flashHorizonY = GAME_HEIGHT * 0.39;
  const orbitAngle = ctx.tankerRotation;
  const terrainWidth = GAME_WIDTH * 3;

  for (let i = ctx.distantFlashes.length - 1; i >= 0; i--) {
    const f = ctx.distantFlashes[i];
    f.age += dt;
    if (f.age > f.maxAge) { ctx.distantFlashes.splice(i, 1); continue; }
    const t = f.age / f.maxAge;
    const screenT = ((f.screenAngle - orbitAngle) / (Math.PI * 2)) % 1;
    const normalizedT = ((screenT % 1) + 1) % 1;
    const screenX = normalizedT * terrainWidth - terrainWidth / 2 + GAME_WIDTH / 2;
    if (screenX < -50 || screenX > GAME_WIDTH + 50) continue;
    const flashY = flashHorizonY - f.heightOffset;
    const alpha = f.intensity * (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8);
    g.circle(screenX, flashY, 6 + t * 15).fill({ color: 0xffaa00, alpha: alpha * 0.12 });
    g.circle(screenX, flashY, 3 + t * 8).fill({ color: 0xff6633, alpha: alpha * 0.08 });
    const glowY = flashHorizonY - 5;
    g.moveTo(screenX - 20, glowY).lineTo(screenX + 20, glowY)
      .stroke({ width: 3, color: 0xffaa00, alpha: alpha * 0.04 });
  }
}
