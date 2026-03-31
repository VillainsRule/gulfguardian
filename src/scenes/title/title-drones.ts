import { Graphics } from 'pixi.js';
import { TITLE_DRONE_MODEL, type TitleDrone, type WireModel } from './title-models';

interface DroneContext {
  actionGraphics: Graphics;
  droneTimer: number;
  titleDrones: TitleDrone[];
  explosions: { wx: number; wy: number; wz: number; age: number; maxAge: number }[];
  projectWorld: (wx: number, wy: number, wz: number) => { x: number; y: number; depth: number };
  drawWireModel: (g: Graphics, model: WireModel, wx: number, wy: number, wz: number, rotY: number, rotX: number, color: number, alpha: number, scale?: number, glowColor?: number) => void;
}

export function spawnDrones(ctx: DroneContext, dt: number): void {
  ctx.droneTimer -= dt;
  if (ctx.droneTimer <= 0 && ctx.titleDrones.length < 5) {
    ctx.droneTimer = 3.0 + Math.random() * 4.0;
    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 80;
    const wx = Math.cos(angle) * dist;
    const wz = Math.sin(angle) * dist;
    const wy = -(25 + Math.random() * 20);
    const speed = 12 + Math.random() * 8;
    const d = Math.hypot(wx, wy + 8, wz);
    const willBeShot = Math.random() < 0.7;
    ctx.titleDrones.push({
      wx, wy, wz,
      vwx: (-wx / d) * speed, vwy: ((-8 - wy) / d) * speed, vwz: (-wz / d) * speed,
      age: 0,
      maxAge: willBeShot ? 4 + Math.random() * 4 : 15 + Math.random() * 5,
      trail: [],
      destroyed: false,
      spinY: Math.random() * Math.PI * 2,
    });
  }
}

export function updateDrones(ctx: DroneContext, dt: number, elapsed: number): void {
  const g = ctx.actionGraphics;

  for (let i = ctx.titleDrones.length - 1; i >= 0; i--) {
    const drone = ctx.titleDrones[i];
    drone.age += dt;

    if (drone.age > drone.maxAge && !drone.destroyed) {
      drone.destroyed = true;
      ctx.explosions.push({ wx: drone.wx, wy: drone.wy, wz: drone.wz, age: 0, maxAge: 1.2 });
      ctx.titleDrones.splice(i, 1);
      continue;
    }

    const dx = -drone.wx, dy = -8 - drone.wy, dz = -drone.wz;
    const d = Math.hypot(dx, dy, dz);
    if (d > 2) {
      const homeStr = 0.3;
      drone.vwx += (dx / d) * homeStr * dt * 60;
      drone.vwy += (dy / d) * homeStr * dt * 60;
      drone.vwz += (dz / d) * homeStr * dt * 60;
      const spd = Math.hypot(drone.vwx, drone.vwy, drone.vwz);
      const maxSpd = 20;
      if (spd > maxSpd) {
        drone.vwx *= maxSpd / spd;
        drone.vwy *= maxSpd / spd;
        drone.vwz *= maxSpd / spd;
      }
    }

    drone.wx += drone.vwx * dt;
    drone.wy += drone.vwy * dt;
    drone.wz += drone.vwz * dt;
    drone.trail.push({ x: drone.wx, y: drone.wy, z: drone.wz });
    if (drone.trail.length > 12) drone.trail.shift();

    // Compute heading from velocity for orientation
    const headingY = Math.atan2(drone.vwz, drone.vwx);
    drone.spinY += dt * 0.8; // gentle roll wobble

    // Draw exhaust trail
    for (let j = 0; j < drone.trail.length - 1; j++) {
      const t = j / drone.trail.length;
      const p1 = ctx.projectWorld(drone.trail[j].x, drone.trail[j].y, drone.trail[j].z);
      const p2 = ctx.projectWorld(drone.trail[j + 1].x, drone.trail[j + 1].y, drone.trail[j + 1].z);
      g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y)
        .stroke({ width: 1.8, color: 0xff6600, alpha: t * 0.25 });
    }

    // Draw 3D wireframe drone model
    const droneRoll = Math.sin(drone.spinY) * 0.15;
    ctx.drawWireModel(g, TITLE_DRONE_MODEL, drone.wx, drone.wy, drone.wz,
      headingY, droneRoll, 0xffaa00, 0.7, 1.0, 0xff3333);

    // Engine glow at tail
    const tailX = drone.wx - Math.cos(headingY) * 5;
    const tailZ = drone.wz - Math.sin(headingY) * 5;
    const tp = ctx.projectWorld(tailX, drone.wy, tailZ);
    const flicker = 0.3 + Math.sin(elapsed * 25 + i * 3) * 0.15;
    g.circle(tp.x, tp.y, 2).fill({ color: 0xff6600, alpha: flicker });
    g.circle(tp.x, tp.y, 4).fill({ color: 0xff3333, alpha: flicker * 0.2 });

    // Pulsing sensor dot at nose
    const noseX = drone.wx + Math.cos(headingY) * 6;
    const noseZ = drone.wz + Math.sin(headingY) * 6;
    const np = ctx.projectWorld(noseX, drone.wy, noseZ);
    g.circle(np.x, np.y, 1).fill({ color: 0xff3333, alpha: 0.4 + Math.sin(elapsed * 6 + i) * 0.2 });
  }
}
