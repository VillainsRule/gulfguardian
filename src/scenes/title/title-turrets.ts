import { Graphics } from 'pixi.js';
import type { TitleBullet, TitleDrone, TitleMissile, TitleFAB, TitleDebris, FlakBurst, WaterSplash } from './title-models';

// Turret world positions (must match drawTanker turret base coords)
const FWD_TURRET_WX = 57;
const FWD_TURRET_WY = 9.5;
const CIWS_TURRET_WX = -15;
const CIWS_TURRET_WY = 10.5;

interface TurretContext {
  actionGraphics: Graphics;
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
  titleDrones: TitleDrone[];
  titleMissiles: TitleMissile[];
  titleFABs: TitleFAB[];
  titleBullets: TitleBullet[];
  titleDebris: TitleDebris[];
  flakBursts: FlakBurst[];
  waterSplashes: WaterSplash[];
  explosions: { wx: number; wy: number; wz: number; age: number; maxAge: number }[];
  cameraBobX: number;
  cameraBobY: number;
  projectWorld: (wx: number, wy: number, wz: number) => { x: number; y: number; depth: number };
}

export function updateTurretTargeting(ctx: TurretContext, dt: number, elapsed: number): void {
  ctx.gunBurstTimer -= dt;
  ctx.gunMuzzleFlash = Math.max(0, ctx.gunMuzzleFlash - dt);

  if (ctx.gunBurstTimer <= 0 && ctx.gunBurstCount <= 0) {
    const threats: { wx: number; wy: number; wz: number }[] = [];
    for (const drone of ctx.titleDrones) {
      threats.push({ wx: drone.wx, wy: drone.wy, wz: drone.wz });
    }
    for (const m of ctx.titleMissiles) {
      threats.push({ wx: m.wx, wy: m.wy, wz: m.wz });
    }
    for (const fab of ctx.titleFABs) {
      const fabWx = Math.cos(fab.worldAngle) * fab.distance;
      const fabWz = Math.sin(fab.worldAngle) * fab.distance;
      threats.push({ wx: fabWx, wy: -6, wz: fabWz });
    }

    let bestTarget: { wx: number; wy: number; wz: number } | null = null;
    let bestTurret: 'fwd' | 'ciws' = 'fwd';
    let bestDist = Infinity;

    for (const t of threats) {
      const dFwd = Math.hypot(t.wx - FWD_TURRET_WX, t.wy - FWD_TURRET_WY, t.wz);
      const dCiws = Math.hypot(t.wx - CIWS_TURRET_WX, t.wy - CIWS_TURRET_WY, t.wz);
      if (dFwd < 200 && dFwd < bestDist) {
        bestDist = dFwd;
        bestTarget = t;
        bestTurret = 'fwd';
      }
      if (dCiws < 150 && dCiws < bestDist) {
        bestDist = dCiws;
        bestTarget = t;
        bestTurret = 'ciws';
      }
    }

    if (bestTarget) {
      ctx.gunTargetWx = bestTarget.wx;
      ctx.gunTargetWy = bestTarget.wy;
      ctx.gunTargetWz = bestTarget.wz;
      ctx.activeTurretId = bestTurret;

      const turretBaseX = bestTurret === 'fwd' ? FWD_TURRET_WX : CIWS_TURRET_WX;
      const targetAngle = Math.atan2(bestTarget.wz, bestTarget.wx - turretBaseX);
      if (bestTurret === 'fwd') {
        ctx.fwdTurretTargetAngle = targetAngle;
        ctx.gunBurstCount = 4 + Math.floor(Math.random() * 3);
      } else {
        ctx.ciwsTurretTargetAngle = targetAngle;
        ctx.gunBurstCount = 12 + Math.floor(Math.random() * 9);
      }
      ctx.gunBurstTimer = 0.03;
    } else {
      ctx.fwdTurretTargetAngle = Math.sin(elapsed * 0.3) * 0.8;
      ctx.ciwsTurretTargetAngle = Math.sin(elapsed * 0.7 + 2) * 1.0;
      ctx.gunBurstTimer = 0.3 + Math.random() * 0.3;
    }
  }

  // Fire burst bullets from the active turret
  if (ctx.gunBurstCount > 0 && ctx.gunBurstTimer <= 0) {
    ctx.gunBurstCount--;
    const isCiws = ctx.activeTurretId === 'ciws';
    ctx.gunBurstTimer = isCiws ? 0.025 : 0.08;

    const turretBaseX = isCiws ? CIWS_TURRET_WX : FWD_TURRET_WX;
    const turretBaseY = isCiws ? CIWS_TURRET_WY : FWD_TURRET_WY;
    const turretAngle = isCiws ? ctx.ciwsTurretAngle : ctx.fwdTurretAngle;
    const barrelLen = isCiws ? 8 : 18;
    const muzzleWx = turretBaseX + Math.cos(turretAngle) * barrelLen;
    const muzzleWy = turretBaseY - 1;
    const muzzleWz = Math.sin(turretAngle) * barrelLen;

    const dx = ctx.gunTargetWx - muzzleWx;
    const dy = ctx.gunTargetWy - muzzleWy;
    const dz = ctx.gunTargetWz - muzzleWz;
    const d = Math.hypot(dx, dy, dz);
    if (d > 1) {
      const bulletSpeed = isCiws ? 280 + Math.random() * 30 : 200 + Math.random() * 30;
      const spread = isCiws ? 0.04 : 0.02;
      const spreadX = (Math.random() - 0.5) * spread;
      const spreadY = (Math.random() - 0.5) * spread;
      const spreadZ = (Math.random() - 0.5) * spread;
      const bulletColor = isCiws
        ? (ctx.gunBurstCount % 2 === 0 ? 0x00ff41 : 0xffcc44)
        : (Math.random() < 0.3 ? 0xffffff : 0xffcc44);
      const bulletSize = isCiws ? 1.5 : 2.5;
      ctx.titleBullets.push({
        wx: muzzleWx, wy: muzzleWy, wz: muzzleWz,
        vwx: (dx / d + spreadX) * bulletSpeed,
        vwy: (dy / d + spreadY) * bulletSpeed,
        vwz: (dz / d + spreadZ) * bulletSpeed,
        age: 0,
        maxAge: 0.7,
        trail: [{ x: muzzleWx, y: muzzleWy, z: muzzleWz }],
        color: bulletColor,
        size: bulletSize,
      });
      ctx.gunMuzzleFlash = 0.06;
      ctx.gunMuzzleFlashTurret = ctx.activeTurretId;
    }

    if (ctx.gunBurstCount <= 0) {
      ctx.gunBurstTimer = 0.15 + Math.random() * 0.4;
    }
  }
}

export function updateBullets(ctx: TurretContext, dt: number, elapsed: number): void {
  const g = ctx.actionGraphics;

  for (let i = ctx.titleBullets.length - 1; i >= 0; i--) {
    const b = ctx.titleBullets[i];
    b.age += dt;
    if (b.age > b.maxAge) {
      ctx.flakBursts.push({ wx: b.wx, wy: b.wy, wz: b.wz, age: 0, maxAge: 0.3 });
      ctx.titleBullets.splice(i, 1);
      continue;
    }

    b.wx += b.vwx * dt;
    b.wy += b.vwy * dt;
    b.wz += b.vwz * dt;
    b.trail.push({ x: b.wx, y: b.wy, z: b.wz });
    if (b.trail.length > 6) b.trail.shift();

    // Check collision with threats
    let bulletHit = false;
    let hitWx = 0, hitWy = 0, hitWz = 0;
    let hitVwx = 0, hitVwy = 0, hitVwz = 0;
    let hitColor = 0xffaa00;

    for (let di = ctx.titleDrones.length - 1; di >= 0; di--) {
      const drone = ctx.titleDrones[di];
      const dist = Math.hypot(b.wx - drone.wx, b.wy - drone.wy, b.wz - drone.wz);
      if (dist < 10) {
        hitWx = drone.wx; hitWy = drone.wy; hitWz = drone.wz;
        hitVwx = drone.vwx * 0.3; hitVwy = drone.vwy * 0.3; hitVwz = drone.vwz * 0.3;
        hitColor = 0xffaa00;
        ctx.titleDrones.splice(di, 1);
        bulletHit = true;
        break;
      }
    }
    if (!bulletHit) {
      for (let mi = ctx.titleMissiles.length - 1; mi >= 0; mi--) {
        const m = ctx.titleMissiles[mi];
        const dist = Math.hypot(b.wx - m.wx, b.wy - m.wy, b.wz - m.wz);
        if (dist < 8) {
          hitWx = m.wx; hitWy = m.wy; hitWz = m.wz;
          hitVwx = m.vwx * 0.2; hitVwy = m.vwy * 0.2; hitVwz = m.vwz * 0.2;
          hitColor = 0xff3333;
          ctx.titleMissiles.splice(mi, 1);
          bulletHit = true;
          break;
        }
      }
    }

    if (bulletHit) {
      ctx.explosions.push({ wx: hitWx, wy: hitWy, wz: hitWz, age: 0, maxAge: 0.5 });
      ctx.cameraBobX += (Math.random() - 0.5) * 3;
      ctx.cameraBobY += (Math.random() - 0.5) * 2;
      const debrisCount = 6 + Math.floor(Math.random() * 7);
      for (let d = 0; d < debrisCount; d++) {
        const angle = Math.random() * Math.PI * 2;
        const upAngle = Math.random() * Math.PI * 0.6 - Math.PI * 0.3;
        const speed = 15 + Math.random() * 45;
        const colors = [hitColor, 0xff6600, 0xff3333, 0xffaa00, 0x884422];
        ctx.titleDebris.push({
          wx: hitWx, wy: hitWy, wz: hitWz,
          vwx: hitVwx + Math.cos(angle) * Math.cos(upAngle) * speed,
          vwy: hitVwy + Math.sin(upAngle) * speed * -0.5,
          vwz: hitVwz + Math.sin(angle) * Math.cos(upAngle) * speed,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 12,
          size: 1.5 + Math.random() * 2.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          age: 0,
          maxAge: 3.0 + Math.random() * 2.0,
          sinking: false,
          sinkSpeed: 3 + Math.random() * 4,
        });
      }
      ctx.titleBullets.splice(i, 1);
      continue;
    }

    // Draw tracer bullet
    const bp = ctx.projectWorld(b.wx, b.wy, b.wz);
    g.circle(bp.x, bp.y, b.size).fill({ color: 0xffffff, alpha: 0.9 });
    g.circle(bp.x, bp.y, b.size * 2).fill({ color: b.color, alpha: 0.3 });

    // Draw tracer trail
    for (let j = 0; j < b.trail.length - 1; j++) {
      const t = (j + 1) / b.trail.length;
      const p1 = ctx.projectWorld(b.trail[j].x, b.trail[j].y, b.trail[j].z);
      const p2 = ctx.projectWorld(b.trail[j + 1].x, b.trail[j + 1].y, b.trail[j + 1].z);
      g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y)
        .stroke({ width: b.size, color: b.color, alpha: t * 0.6 });
      g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y)
        .stroke({ width: b.size * 2, color: b.color, alpha: t * 0.12 });
    }
  }
}
