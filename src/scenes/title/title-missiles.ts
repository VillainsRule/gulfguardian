import { Graphics } from 'pixi.js';
import { TITLE_MISSILE_MODEL, type TitleMissile, type AegisIntercept, type WireModel } from './title-models';

interface MissileContext {
  actionGraphics: Graphics;
  missileTimer: number;
  titleMissiles: TitleMissile[];
  aegisIntercepts: AegisIntercept[];
  explosions: { wx: number; wy: number; wz: number; age: number; maxAge: number }[];
  projectWorld: (wx: number, wy: number, wz: number) => { x: number; y: number; depth: number };
  drawWireModel: (g: Graphics, model: WireModel, wx: number, wy: number, wz: number, rotY: number, rotX: number, color: number, alpha: number, scale?: number, glowColor?: number) => void;
}

export function spawnMissiles(ctx: MissileContext, dt: number): void {
  ctx.missileTimer -= dt;
  if (ctx.missileTimer <= 0) {
    ctx.missileTimer = 0.8 + Math.random() * 2.0;
    const roll = Math.random();
    const willIntercept = Math.random() < 0.65;
    const spawnAngle = Math.random() * Math.PI * 2;

    if (roll < 0.40) {
      // Sea-skimmer: fast, low altitude, flies in level from far away
      const spawnDist = 250 + Math.random() * 150;
      const wx = Math.cos(spawnAngle) * spawnDist;
      const wz = Math.sin(spawnAngle) * spawnDist;
      const wy = -(10 + Math.random() * 10);
      const targetX = (Math.random() - 0.5) * 8;
      const targetZ = (Math.random() - 0.5) * 8;
      const dx = targetX - wx, dy = -8 - wy, dz = targetZ - wz;
      const d = Math.hypot(dx, dy, dz);
      const speed = 50 + Math.random() * 30;
      ctx.titleMissiles.push({
        wx, wy, wz,
        vwx: (dx / d) * speed, vwy: (dy / d) * speed * 0.3, vwz: (dz / d) * speed,
        age: 0, maxAge: 6.0 + Math.random() * 3.0,
        trail: [],
        intercepted: false,
        interceptTime: willIntercept ? 1.5 + Math.random() * 2.0 : -1,
        missileType: 'skimmer',
        terminalPhase: false,
      });
    } else if (roll < 0.75) {
      // High-altitude cruise: descending arc from far away
      const spawnDist = 300 + Math.random() * 200;
      const wx = Math.cos(spawnAngle) * spawnDist;
      const wz = Math.sin(spawnAngle) * spawnDist;
      const wy = -(60 + Math.random() * 60);
      const targetX = (Math.random() - 0.5) * 10;
      const targetZ = (Math.random() - 0.5) * 10;
      const dx = targetX - wx, dy = -8 - wy, dz = targetZ - wz;
      const d = Math.hypot(dx, dy, dz);
      const speed = 40 + Math.random() * 25;
      ctx.titleMissiles.push({
        wx, wy, wz,
        vwx: (dx / d) * speed, vwy: (dy / d) * speed, vwz: (dz / d) * speed,
        age: 0, maxAge: 7.0 + Math.random() * 4.0,
        trail: [],
        intercepted: false,
        interceptTime: willIntercept ? 2.0 + Math.random() * 2.5 : -1,
        missileType: 'cruise',
        terminalPhase: false,
      });
    } else {
      // Top-attack: steep approach from far distance and high altitude
      const spawnDist = 250 + Math.random() * 150;
      const wx = Math.cos(spawnAngle) * spawnDist;
      const wz = Math.sin(spawnAngle) * spawnDist;
      const wy = -(150 + Math.random() * 100);
      const targetX = (Math.random() - 0.5) * 8;
      const targetZ = (Math.random() - 0.5) * 8;
      const dx = targetX - wx, dy = -8 - wy, dz = targetZ - wz;
      const d = Math.hypot(dx, dy, dz);
      const speed = 35 + Math.random() * 20;
      ctx.titleMissiles.push({
        wx, wy, wz,
        vwx: (dx / d) * speed, vwy: (dy / d) * speed, vwz: (dz / d) * speed,
        age: 0, maxAge: 8.0 + Math.random() * 4.0,
        trail: [],
        intercepted: false,
        interceptTime: willIntercept ? 2.5 + Math.random() * 3.0 : -1,
        missileType: 'topattack',
        terminalPhase: false,
      });
    }
  }
}

export function updateMissiles(ctx: MissileContext, dt: number, elapsed: number): void {
  const g = ctx.actionGraphics;

  for (let i = ctx.titleMissiles.length - 1; i >= 0; i--) {
    const m = ctx.titleMissiles[i];
    m.age += dt;

    if (!m.intercepted && m.interceptTime > 0 && m.age >= m.interceptTime) {
      m.intercepted = true;
      const interceptSpeed = 120 + Math.random() * 40;
      const dx = m.wx, dy = m.wy, dz = m.wz;
      const d = Math.hypot(dx, dy, dz);
      const travelTime = d / interceptSpeed;
      ctx.aegisIntercepts.push({
        wx: 0, wy: -8, wz: 0,
        targetWx: m.wx + m.vwx * travelTime * 0.8,
        targetWy: m.wy + m.vwy * travelTime * 0.8,
        targetWz: m.wz + m.vwz * travelTime * 0.8,
        age: 0,
        maxAge: travelTime,
        trail: [],
      });
    }

    if (m.age > m.maxAge) {
      ctx.explosions.push({ wx: m.wx, wy: m.wy, wz: m.wz, age: 0, maxAge: 0.8 });
      ctx.titleMissiles.splice(i, 1);
      continue;
    }

    // Missile flight physics based on type
    const hDx = -m.wx, hDy = -8 - m.wy, hDz = -m.wz;
    const hDist = Math.hypot(hDx, hDy, hDz);

    if (m.missileType === 'skimmer') {
      if (hDist < 40 && !m.terminalPhase) {
        m.terminalPhase = true;
        m.vwy -= 8;
      }
      if (m.terminalPhase) {
        m.vwy += 6 * dt;
      }
      if (hDist > 5) {
        m.vwx += (hDx / hDist) * 1.5 * dt;
        m.vwz += (hDz / hDist) * 1.5 * dt;
      }
    } else if (m.missileType === 'cruise') {
      if (hDist < 60 && !m.terminalPhase) {
        m.terminalPhase = true;
      }
      const homeStr = m.terminalPhase ? 4.0 : 2.0;
      if (hDist > 5) {
        m.vwx += (hDx / hDist) * homeStr * dt;
        m.vwy += (hDy / hDist) * homeStr * dt;
        m.vwz += (hDz / hDist) * homeStr * dt;
      }
    } else {
      if (hDist > 5) {
        m.vwx += (hDx / hDist) * 2.5 * dt;
        m.vwy += (hDy / hDist) * 2.5 * dt;
        m.vwz += (hDz / hDist) * 2.5 * dt;
      }
    }

    m.wx += m.vwx * dt; m.wy += m.vwy * dt; m.wz += m.vwz * dt;
    m.trail.push({ x: m.wx, y: m.wy, z: m.wz });
    if (m.trail.length > 30) m.trail.shift();

    const mHeadingY = Math.atan2(m.vwz, m.vwx);
    const mPitch = Math.atan2(m.vwy, Math.hypot(m.vwx, m.vwz));

    // Draw exhaust/smoke trail
    for (let j = 0; j < m.trail.length - 1; j++) {
      const t = j / m.trail.length;
      const p1 = ctx.projectWorld(m.trail[j].x, m.trail[j].y, m.trail[j].z);
      const p2 = ctx.projectWorld(m.trail[j + 1].x, m.trail[j + 1].y, m.trail[j + 1].z);
      g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y)
        .stroke({ width: 3.0 - t * 1.5, color: 0xff6600, alpha: t * 0.5 });
      g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y)
        .stroke({ width: 6.0 - t * 3.0, color: 0xff3300, alpha: t * 0.12 });
      if (j % 2 === 0) {
        const smokeOffset = Math.sin(elapsed * 3 + j) * 3;
        g.circle(p1.x + smokeOffset, p1.y + smokeOffset * 0.7, 2.0 + t * 3)
          .fill({ color: 0x888877, alpha: t * 0.1 });
      }
    }

    // Draw 3D wireframe missile model
    ctx.drawWireModel(g, TITLE_MISSILE_MODEL, m.wx, m.wy, m.wz,
      mHeadingY, mPitch, 0xff3333, 0.75, 0.8, 0xffaa00);

    // Exhaust flame at tail
    const mp = ctx.projectWorld(m.wx, m.wy, m.wz);
    const mHorizSpeed = Math.hypot(m.vwx, m.vwz);
    const mSpeed = Math.hypot(mHorizSpeed, m.vwy);
    const mTailX = m.wx - (mSpeed > 0.1 ? m.vwx / mSpeed : Math.cos(mHeadingY)) * 6;
    const mTailY = m.wy - (mSpeed > 0.1 ? m.vwy / mSpeed : 0) * 6;
    const mTailZ = m.wz - (mSpeed > 0.1 ? m.vwz / mSpeed : Math.sin(mHeadingY)) * 6;
    const mtp = ctx.projectWorld(mTailX, mTailY, mTailZ);
    const mFlicker = 0.4 + Math.sin(elapsed * 30 + i * 5) * 0.2;
    g.circle(mtp.x, mtp.y, 3).fill({ color: 0xffaa00, alpha: mFlicker });
    g.circle(mtp.x, mtp.y, 7).fill({ color: 0xff3333, alpha: mFlicker * 0.15 });
    g.circle(mtp.x, mtp.y, 1.5).fill({ color: 0xffffff, alpha: mFlicker * 0.7 });

    // White-hot nose tip
    const mNoseX = m.wx + (mSpeed > 0.1 ? m.vwx / mSpeed : Math.cos(mHeadingY)) * 7;
    const mNoseY = m.wy + (mSpeed > 0.1 ? m.vwy / mSpeed : 0) * 7;
    const mNoseZ = m.wz + (mSpeed > 0.1 ? m.vwz / mSpeed : Math.sin(mHeadingY)) * 7;
    const mnp = ctx.projectWorld(mNoseX, mNoseY, mNoseZ);
    g.circle(mnp.x, mnp.y, 1.5).fill({ color: 0xffffff, alpha: 0.6 });
    g.circle(mnp.x, mnp.y, 3.5).fill({ color: 0xff6633, alpha: 0.15 });

    // Launch flash
    if (m.age < 0.3) {
      const fp = m.trail[0] ? ctx.projectWorld(m.trail[0].x, m.trail[0].y, m.trail[0].z) : mp;
      g.circle(fp.x, fp.y, 10).fill({ color: 0xffaa00, alpha: 0.25 * (1 - m.age / 0.3) });
    }
  }
}
