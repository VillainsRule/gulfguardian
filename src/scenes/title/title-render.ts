import { Graphics } from 'pixi.js';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/app/constants';
import { projectVertex, type OceanSparkle, type Vec3 } from './title-models';

interface DrawEnvironmentContext {
  environmentGraphics: Graphics;
  oceanSparkles: OceanSparkle[];
  projectWorld: (wx: number, wy: number, wz: number) => { x: number; y: number; depth: number };
  tankerRotation: number;
  elapsed: number;
}

interface DrawTankerContext {
  tankerGraphics: Graphics;
  projCenterX: number;
  projCenterY: number;
  projScale: number;
  projBobRotX: number;
  tankerRotation: number;
  tankerModel: { vertices: Vec3[]; edges: [number, number][]; depthHints: number[] };
  projectWorld: (wx: number, wy: number, wz: number) => { x: number; y: number; depth: number };
  elapsed: number;
  fwdTurretAngle: number;
  ciwsTurretAngle: number;
  gunMuzzleFlash: number;
  gunMuzzleFlashTurret: 'fwd' | 'ciws';
}

export function drawTitleEnvironment(ctx: DrawEnvironmentContext): void {
  const g = ctx.environmentGraphics;
  g.clear();

  const { elapsed } = ctx;
  const horizonY = GAME_HEIGHT * 0.39;
  const seaTop = horizonY + 12;

  g.moveTo(0, horizonY).lineTo(GAME_WIDTH, horizonY)
    .stroke({ width: 1.2, color: COLORS.phosphorGreen, alpha: 0.12 });
  g.moveTo(0, horizonY).lineTo(GAME_WIDTH, horizonY)
    .stroke({ width: 4, color: COLORS.phosphorGreen, alpha: 0.03 });

  const vanishX = GAME_WIDTH / 2;
  const vanishY = horizonY + 6;
  const seaBottom = GAME_HEIGHT;

  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const perspT = t * t;
    const y = seaTop + perspT * (seaBottom - seaTop);
    const wave = Math.sin(elapsed * 0.7 + t * 12) * (2 + t * 14);
    const wave2 = Math.cos(elapsed * 0.5 + t * 6 + 1.3) * (1 + t * 6);
    const alpha = 0.04 + t * 0.08;
    const width = 0.5 + t * 2.0;
    g.moveTo(0, y + wave + wave2)
      .lineTo(GAME_WIDTH, y - wave * 0.3 + wave2 * 0.5)
      .stroke({ width, color: COLORS.darkGreen, alpha });
  }

  const numVLines = 18;
  for (let i = 0; i < numVLines; i++) {
    const t = (i / (numVLines - 1)) * 2 - 1;
    const bottomX = vanishX + t * GAME_WIDTH * 0.8;
    const topX = vanishX + t * 80;
    const scrollOffset = (elapsed * 0.15 + i * 0.1) % 1.0;
    const alpha = 0.02 + Math.abs(t) * 0.03;
    const startT = 0.15 + scrollOffset * 0.05;
    const sx = topX + (bottomX - topX) * startT;
    const sy = vanishY + (seaBottom - vanishY) * startT;
    g.moveTo(sx, sy)
      .lineTo(bottomX, seaBottom)
      .stroke({ width: 0.6, color: COLORS.darkGreen, alpha });
  }

  const chopSeed = 42;
  for (let i = 0; i < 45; i++) {
    const hash = Math.sin(i * 127.1 + chopSeed) * 43758.5453;
    const rx = hash - Math.floor(hash);
    const hash2 = Math.sin(i * 269.5 + chopSeed) * 43758.5453;
    const ry = hash2 - Math.floor(hash2);
    const x = rx * GAME_WIDTH;
    const depthT = ry;
    const y = seaTop + depthT * depthT * (seaBottom - seaTop - 40);
    const chopLen = 8 + depthT * 20;
    const chopWave = Math.sin(elapsed * 1.2 + i * 2.7) * (2 + depthT * 5);
    const alpha = 0.03 + depthT * 0.06;
    g.moveTo(x - chopLen / 2, y + chopWave)
      .lineTo(x + chopLen / 2, y + chopWave - 1)
      .stroke({ width: 0.6 + depthT * 0.8, color: COLORS.phosphorGreen, alpha });
  }

  const sparkleWaterY = -7;
  for (const sp of ctx.oceanSparkles) {
    const sparkDriftX = Math.sin(elapsed * sp.driftX + sp.phase * 3.7) * 8;
    const sparkDriftZ = Math.cos(elapsed * sp.driftZ + sp.phase * 2.3) * 6;
    const sparkleP = ctx.projectWorld(sp.wx + sparkDriftX, sparkleWaterY, sp.wz + sparkDriftZ);
    if (sparkleP.y < seaTop || sparkleP.y > seaBottom || sparkleP.x < 0 || sparkleP.x > GAME_WIDTH) continue;

    const raw = Math.sin(elapsed * sp.speed + sp.phase);
    const twinkle = raw > 0.7 ? Math.pow((raw - 0.7) / 0.3, 2) : 0;
    const sparkAlpha = twinkle * 0.35;
    if (sparkAlpha < 0.01) continue;

    const depthFactor = Math.max(0, Math.min(1, (sparkleP.y - seaTop) / (seaBottom - seaTop)));
    const finalAlpha = sparkAlpha * (0.3 + depthFactor * 0.7);
    const size = sp.size * (0.4 + depthFactor * 0.6);

    g.circle(sparkleP.x, sparkleP.y, size).fill({ color: 0xffffff, alpha: finalAlpha });
    g.circle(sparkleP.x, sparkleP.y, size * 2.5).fill({ color: 0x00ccff, alpha: finalAlpha * 0.2 });

    if (twinkle > 0.5) {
      const glintLen = 3 + depthFactor * 6;
      g.moveTo(sparkleP.x - glintLen / 2, sparkleP.y)
        .lineTo(sparkleP.x + glintLen / 2, sparkleP.y)
        .stroke({ width: 0.5, color: 0xffffff, alpha: finalAlpha * 0.5 });
    }
  }

  for (let i = 0; i < 6; i++) {
    const bandPhase = elapsed * 0.3 + i * 1.7;
    const bandT = (Math.sin(bandPhase) + 1) * 0.5;
    const bandY = seaTop + bandT * bandT * (seaBottom - seaTop) * 0.8;
    const bandAlpha = 0.015 * Math.pow(Math.sin(elapsed * 0.8 + i * 2.1), 2);
    const bandWave = Math.sin(elapsed * 0.5 + i * 3) * 15;
    g.moveTo(GAME_WIDTH * 0.1 + bandWave, bandY)
      .lineTo(GAME_WIDTH * 0.9 + bandWave * 0.5, bandY + 1)
      .stroke({ width: 1.5 + bandT * 2, color: 0x00ff41, alpha: bandAlpha });
  }

  const sternX = -65;
  const waterY = -7;
  const sternProj = ctx.projectWorld(sternX, waterY, 0);

  for (let i = 0; i < 6; i++) {
    const turbAngle = elapsed * 4.5 + i * (Math.PI * 2 / 6);
    const turbR = 2.5 + Math.sin(elapsed * 2 + i);
    const tp = ctx.projectWorld(sternX - 3 + Math.cos(turbAngle) * turbR, waterY, Math.sin(turbAngle) * turbR);
    g.circle(tp.x, tp.y, 1.2).stroke({ width: 0.6, color: COLORS.phosphorGreen, alpha: 0.06 });
  }

  for (let i = 0; i < 4; i++) {
    const washT = (elapsed * 0.8 + i * 0.25) % 1.0;
    const washR = 2 + washT * 8;
    const wp = ctx.projectWorld(sternX - 3 - washT * 15, waterY, 0);
    g.circle(wp.x, wp.y, washR * 1.3).stroke({ width: 0.6, color: COLORS.phosphorGreen, alpha: 0.05 * (1 - washT) });
  }

  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const dist = 5 + i * 14;
    const spread = 2 + i * 5;
    const noise1 = Math.sin(elapsed * 2.4 + i * 1.7) * 2;
    const alpha = 0.08 - t * 0.05;
    const portPt = ctx.projectWorld(sternX - dist, waterY, -(spread + noise1));
    const starPt = ctx.projectWorld(sternX - dist, waterY, spread + noise1);
    const nearPt = ctx.projectWorld(sternX - dist * 0.3, waterY, 0);
    g.moveTo(sternProj.x, sternProj.y).lineTo(nearPt.x, nearPt.y).lineTo(portPt.x, portPt.y)
      .stroke({ width: 1.0 + t * 0.5, color: COLORS.phosphorGreen, alpha });
    g.moveTo(sternProj.x, sternProj.y).lineTo(nearPt.x, nearPt.y).lineTo(starPt.x, starPt.y)
      .stroke({ width: 1.0 + t * 0.5, color: COLORS.phosphorGreen, alpha });
    if (i > 2) {
      for (let j = 0; j < 3; j++) {
        const foamHash = Math.sin(i * 73.1 + j * 37.7) * 43758.5453;
        const foamZ = (foamHash - Math.floor(foamHash) - 0.5) * spread * 2;
        const fp = ctx.projectWorld(sternX - dist + Math.sin(elapsed * 1.5 + i + j) * 3, waterY, foamZ);
        g.circle(fp.x, fp.y, 0.6).fill({ color: COLORS.phosphorGreen, alpha: alpha * 0.4 });
      }
    }
  }

  const bowX = 70;
  const bowProj = ctx.projectWorld(bowX, waterY, 0);
  for (let i = 0; i < 5; i++) {
    const bwDist = 3 + i * 5;
    const bwSpread = 2 + i * 3;
    const alpha = 0.10 - (i / 4) * 0.04;
    const portBow = ctx.projectWorld(bowX - bwDist, waterY, -bwSpread);
    const starBow = ctx.projectWorld(bowX - bwDist, waterY, bwSpread);
    g.moveTo(bowProj.x, bowProj.y).lineTo(portBow.x, portBow.y)
      .stroke({ width: 1.0, color: COLORS.phosphorGreen, alpha });
    g.moveTo(bowProj.x, bowProj.y).lineTo(starBow.x, starBow.y)
      .stroke({ width: 1.0, color: COLORS.phosphorGreen, alpha });
  }

  for (let i = 0; i < 8; i++) {
    const sprayPhase = elapsed * 3.5 + i * 0.8;
    const sprayT = sprayPhase % 1.0;
    const side = i % 2 === 0 ? -1 : 1;
    const sp = ctx.projectWorld(
      bowX - sprayT * 6,
      waterY - sprayT * 3 + Math.cos(sprayPhase * 1.7) * 1.5,
      side * (2 + sprayT * 4),
    );
    g.circle(sp.x, sp.y, 0.8 + sprayT * 0.4).fill({ color: COLORS.phosphorGreen, alpha: 0.10 * (1 - sprayT) });
  }

  for (let i = 0; i < 6; i++) {
    const rippleT = (elapsed * 0.6 + i * 0.17) % 1.0;
    const rippleX = -50 + i * 20;
    const rippleR = 2 + rippleT * 10;
    const rp = ctx.projectWorld(rippleX, waterY, (i % 2 === 0 ? 1 : -1) * (10 + rippleT * 5));
    g.circle(rp.x, rp.y, rippleR).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.05 * (1 - rippleT) });
  }

  for (let i = 0; i < 8; i++) {
    const shimmer = Math.sin(elapsed * 2.5 + i * 1.4) * 2;
    const reflX = Math.sin(elapsed * 0.3 + i * 0.7) * 12;
    const reflZ = 8 + i * 3;
    const rp1 = ctx.projectWorld(reflX + shimmer, waterY, -reflZ);
    const rp2 = ctx.projectWorld(reflX + shimmer, waterY, reflZ);
    g.moveTo(rp1.x, rp1.y).lineTo(rp2.x, rp2.y)
      .stroke({ width: 0.8, color: COLORS.phosphorGreen, alpha: 0.05 - (i / 7) * 0.03 });
  }

  for (let i = 0; i < 4; i++) {
    const swellZ = -40 + i * 25;
    const swellPhase = elapsed * 0.4 + i * 1.2;
    const pts: Array<{ x: number; y: number }> = [];
    for (let j = 0; j <= 10; j++) {
      const sx = -80 + j * 16;
      const sy = -7 + Math.sin(swellPhase + j * 0.5) * 1.5;
      pts.push(ctx.projectWorld(sx, sy, swellZ + Math.sin(elapsed * 0.7 + j * 0.3) * 3));
    }
    for (let j = 0; j < pts.length - 1; j++) {
      g.moveTo(pts[j].x, pts[j].y).lineTo(pts[j + 1].x, pts[j + 1].y)
        .stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.03 });
    }
  }

  const orbitAngle = ctx.tankerRotation;
  const numTerrainPoints = 80;
  const terrainWidth = GAME_WIDTH * 3;

  const bgIranPts: Array<[number, number]> = [];
  for (let i = 0; i <= numTerrainPoints; i++) {
    const t = i / numTerrainPoints;
    const worldAngle = t * Math.PI * 2;
    const screenT = ((worldAngle - orbitAngle) / (Math.PI * 2)) % 1;
    const normalizedT = ((screenT % 1) + 1) % 1;
    const screenX = normalizedT * terrainWidth - terrainWidth / 2 + GAME_WIDTH / 2;
    if (screenX < -200 || screenX > GAME_WIDTH + 200) continue;

    const peak = Math.sin(worldAngle * 2 + 0.3) * 50
      + Math.sin(worldAngle * 5 + 1.8) * 25
      + Math.cos(worldAngle * 3 + 0.5) * 18
      + Math.sin(worldAngle * 8 + 3.1) * 10;
    const y = horizonY - 90 - peak;
    const viewAngleDiff = Math.abs(normalizedT - 0.5);
    const perspScale = 1.0 - viewAngleDiff * 0.6;
    bgIranPts.push([screenX, horizonY - (horizonY - y) * Math.max(0, perspScale)]);
  }

  bgIranPts.sort((a, b) => a[0] - b[0]);
  if (bgIranPts.length > 1) {
    const extBg: Array<[number, number]> = [[-10, bgIranPts[0][1]], ...bgIranPts, [GAME_WIDTH + 10, bgIranPts[bgIranPts.length - 1][1]]];
    const fillPts = [...extBg, [GAME_WIDTH + 10, 0], [-10, 0]];
    g.poly(fillPts.flatMap((p) => [p[0], p[1]])).fill({ color: COLORS.panelBg, alpha: 0.12 });
    for (let i = 0; i < extBg.length - 1; i++) {
      const [ax, ay] = extBg[i];
      const [bx, by] = extBg[i + 1];
      if (Math.abs(bx - ax) > 300) continue;
      g.moveTo(ax, ay).lineTo(bx, by).stroke({ width: 1.5, color: COLORS.phosphorGreen, alpha: 0.08 });
    }
  }

  const iranPts: Array<[number, number]> = [];
  for (let i = 0; i <= numTerrainPoints; i++) {
    const t = i / numTerrainPoints;
    const worldAngle = t * Math.PI * 2;
    const screenT = ((worldAngle - orbitAngle) / (Math.PI * 2)) % 1;
    const normalizedT = ((screenT % 1) + 1) % 1;
    const screenX = normalizedT * terrainWidth - terrainWidth / 2 + GAME_WIDTH / 2;
    if (screenX < -200 || screenX > GAME_WIDTH + 200) continue;

    const peak = Math.sin(worldAngle * 3) * 35
      + Math.sin(worldAngle * 7 + 1.2) * 18
      + Math.cos(worldAngle * 5 + 0.8) * 12
      + Math.sin(worldAngle * 11 + 2.5) * 8
      + Math.cos(worldAngle * 15 + 0.4) * 5;
    const y = horizonY - 60 - peak;
    const viewAngleDiff = Math.abs(normalizedT - 0.5);
    const perspScale = 1.0 - viewAngleDiff * 0.6;
    iranPts.push([screenX, horizonY - (horizonY - y) * Math.max(0, perspScale)]);
  }

  iranPts.sort((a, b) => a[0] - b[0]);
  if (iranPts.length > 1) {
    const extIran: Array<[number, number]> = [[-10, iranPts[0][1]], ...iranPts, [GAME_WIDTH + 10, iranPts[iranPts.length - 1][1]]];
    const fillPts = [...extIran, [GAME_WIDTH + 10, horizonY], [-10, horizonY]];
    g.poly(fillPts.flatMap((p) => [p[0], p[1]])).fill({ color: COLORS.panelBg, alpha: 0.30 });

    for (let i = 0; i < extIran.length - 1; i++) {
      const [ax, ay] = extIran[i];
      const [bx, by] = extIran[i + 1];
      if (Math.abs(bx - ax) > 300) continue;
      g.moveTo(ax, ay + 6).lineTo(bx, by + 6).stroke({ width: 6, color: COLORS.phosphorGreen, alpha: 0.03 });
      g.moveTo(ax, ay).lineTo(bx, by).stroke({ width: 2.4, color: COLORS.phosphorGreen, alpha: 0.24 });
    }

    for (let i = 2; i < iranPts.length - 2; i += 6) {
      const [sx, sy] = iranPts[i];
      if (sy > horizonY - 15) continue;
      const structH = 4 + Math.sin(i * 7.3) * 2;
      const structW = 3;
      g.rect(sx - structW / 2, horizonY - structH - 2, structW, structH)
        .stroke({ width: 0.6, color: COLORS.phosphorGreen, alpha: 0.08 });
      if (Math.sin(elapsed * 2 + i * 1.3) > 0.7) {
        g.circle(sx, horizonY - structH - 3, 0.8)
          .fill({ color: COLORS.phosphorGreen, alpha: 0.15 });
      }
    }
  }

  for (let i = 0; i < 3; i++) {
    const hazeY = horizonY - 4 + i * 5;
    g.moveTo(0, hazeY).lineTo(GAME_WIDTH, hazeY)
      .stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.03 + i * 0.01 });
  }

  const islandDefs = [
    { angle: 0.8, size: 18, height: 8 },
    { angle: 1.4, size: 10, height: 5 },
    { angle: 2.1, size: 14, height: 7 },
    { angle: 2.6, size: 12, height: 6 },
    { angle: 3.3, size: 8, height: 4 },
    { angle: 3.8, size: 6, height: 3 },
    { angle: 4.4, size: 9, height: 5 },
    { angle: 5.0, size: 8, height: 4 },
  ];

  for (const island of islandDefs) {
    const screenT = ((island.angle - orbitAngle) / (Math.PI * 2)) % 1;
    const normalizedT = ((screenT % 1) + 1) % 1;
    const screenX = normalizedT * terrainWidth - terrainWidth / 2 + GAME_WIDTH / 2;
    if (screenX < -50 || screenX > GAME_WIDTH + 50) continue;

    const viewDist = Math.abs(normalizedT - 0.5);
    const perspScale = Math.max(0, 1.0 - viewDist * 0.8);
    const islandY = horizonY + 20 + viewDist * 40;
    const w = island.size * perspScale * 3;
    const h = island.height * perspScale * 2;
    if (w < 2) continue;

    const pts: [number, number][] = [];
    for (let j = 0; j <= 14; j++) {
      const a = (j / 14) * Math.PI;
      const rx = w * (0.9 + Math.sin(a * 3 + island.angle) * 0.1);
      const ry = h * (0.85 + Math.cos(a * 5 + island.angle) * 0.15);
      pts.push([screenX + Math.cos(a) * rx - rx, islandY - Math.sin(a) * ry]);
    }
    g.poly(pts.flatMap((p) => [p[0], p[1]])).fill({ color: COLORS.panelBg, alpha: 0.12 * perspScale });
    for (let j = 0; j < pts.length - 1; j++) {
      g.moveTo(pts[j][0], pts[j][1])
        .lineTo(pts[j + 1][0], pts[j + 1][1])
        .stroke({ width: 1.2, color: COLORS.phosphorGreen, alpha: 0.14 * perspScale });
    }
  }
}

export function drawTitleTanker(ctx: DrawTankerContext): void {
  const g = ctx.tankerGraphics;
  g.clear();

  const { vertices, edges, depthHints } = ctx.tankerModel;
  const projected = vertices.map((vertex) =>
    projectVertex(vertex, ctx.tankerRotation, ctx.projCenterX, ctx.projCenterY, ctx.projScale, ctx.projBobRotX),
  );

  const edgeOrder = edges
    .map(([a, b], index) => ({
      a,
      b,
      avgDepth: (projected[a].depth + projected[b].depth) / 2 + (depthHints[a] + depthHints[b]) * 0.5,
      index,
    }))
    .sort((lhs, rhs) => lhs.avgDepth - rhs.avgDepth || lhs.index - rhs.index);

  const waterlineY = -7.0;
  for (const edge of edgeOrder) {
    const pa = projected[edge.a];
    const pb = projected[edge.b];
    const depthFade = Math.max(0, Math.min(1, (edge.avgDepth + 50) / 95));
    const span = Math.hypot(pb.x - pa.x, pb.y - pa.y);

    const va = vertices[edge.a];
    const vb = vertices[edge.b];
    const avgWorldY = (va.y + vb.y) / 2;
    const underwaterFactor = avgWorldY < waterlineY ? 0.35 : 1.0;
    const edgeColor = avgWorldY < waterlineY ? COLORS.darkGreen : COLORS.phosphorGreen;

    const glowAlpha = (0.05 + depthFade * 0.11) * underwaterFactor;
    const strokeAlpha = (0.22 + depthFade * 0.66) * underwaterFactor;
    const strokeWidth = 0.65 + Math.min(1.5, span / 42);

    g.moveTo(pa.x, pa.y).lineTo(pb.x, pb.y).stroke({ width: strokeWidth + 1.5, color: edgeColor, alpha: glowAlpha });
    g.moveTo(pa.x, pa.y).lineTo(pb.x, pb.y).stroke({ width: strokeWidth, color: edgeColor, alpha: strokeAlpha });
  }

  projected.forEach((p, index) => {
    const v = vertices[index];
    const isUnderwater = v.y < waterlineY;
    const uf = isUnderwater ? 0.35 : 1.0;
    const dotColor = isUnderwater ? COLORS.darkGreen : COLORS.phosphorGreen;
    const depthFade = Math.max(0, Math.min(1, (p.depth + 50 + depthHints[index]) / 95));
    const radius = 0.5 + depthFade * 1.05;
    const dotAlpha = (0.1 + depthFade * 0.35) * uf;
    g.circle(p.x, p.y, radius + 0.9).fill({ color: dotColor, alpha: dotAlpha * 0.18 });
    g.circle(p.x, p.y, radius).fill({ color: dotColor, alpha: dotAlpha });
  });

  const fwdGunBaseX = 57;
  const fwdGunBaseY = 9.5;
  const fwdBarrelLen = 18;
  const fwdTipX = fwdGunBaseX + Math.cos(ctx.fwdTurretAngle) * fwdBarrelLen;
  const fwdTipZ = Math.sin(ctx.fwdTurretAngle) * fwdBarrelLen;
  const fwdBase = ctx.projectWorld(fwdGunBaseX, fwdGunBaseY, 0);
  const fwdTip = ctx.projectWorld(fwdTipX, fwdGunBaseY - 1, fwdTipZ);
  g.moveTo(fwdBase.x, fwdBase.y).lineTo(fwdTip.x, fwdTip.y)
    .stroke({ width: 1.8, color: COLORS.phosphorGreen, alpha: 0.5 });
  g.circle(fwdBase.x, fwdBase.y, 3).stroke({ width: 1.0, color: COLORS.phosphorGreen, alpha: 0.3 });
  if (ctx.gunMuzzleFlash > 0 && ctx.gunMuzzleFlashTurret === 'fwd') {
    const mfAlpha = ctx.gunMuzzleFlash / 0.06;
    g.circle(fwdTip.x, fwdTip.y, 5).fill({ color: 0xffffff, alpha: mfAlpha * 0.7 });
    g.circle(fwdTip.x, fwdTip.y, 10).fill({ color: 0xffcc44, alpha: mfAlpha * 0.25 });
  }

  const ciwsBaseX = -15;
  const ciwsBaseY = 10.5;
  const ciwsBarrelLen = 8;
  const ciwsTipX = ciwsBaseX + Math.cos(ctx.ciwsTurretAngle) * ciwsBarrelLen;
  const ciwsTipZ = Math.sin(ctx.ciwsTurretAngle) * ciwsBarrelLen;
  const ciwsBase = ctx.projectWorld(ciwsBaseX, ciwsBaseY, 0);
  const ciwsTip = ctx.projectWorld(ciwsTipX, ciwsBaseY + 0.5, ciwsTipZ);
  g.moveTo(ciwsBase.x, ciwsBase.y).lineTo(ciwsTip.x, ciwsTip.y)
    .stroke({ width: 1.2, color: COLORS.phosphorGreen, alpha: 0.4 });
  g.circle(ciwsBase.x, ciwsBase.y, 2).stroke({ width: 0.8, color: COLORS.phosphorGreen, alpha: 0.25 });
  if (ctx.gunMuzzleFlash > 0 && ctx.gunMuzzleFlashTurret === 'ciws') {
    const mfAlpha = ctx.gunMuzzleFlash / 0.06;
    g.circle(ciwsTip.x, ciwsTip.y, 3).fill({ color: 0xffffff, alpha: mfAlpha * 0.8 });
    g.circle(ciwsTip.x, ciwsTip.y, 7).fill({ color: 0x00ff41, alpha: mfAlpha * 0.3 });
  }

  const radarSpinAngle = ctx.elapsed * 2.0;
  const radarBaseX = 9;
  const radarBaseY = 30.5;
  const radarArmLen = 5;
  const radarEndAx = radarBaseX + Math.cos(radarSpinAngle) * radarArmLen;
  const radarEndAz = Math.sin(radarSpinAngle) * radarArmLen;
  const radarEndBx = radarBaseX - Math.cos(radarSpinAngle) * radarArmLen;
  const radarEndBz = -Math.sin(radarSpinAngle) * radarArmLen;
  const radarA = ctx.projectWorld(radarEndAx, radarBaseY, radarEndAz);
  const radarB = ctx.projectWorld(radarEndBx, radarBaseY, radarEndBz);
  const radarCenter = ctx.projectWorld(radarBaseX, radarBaseY, 0);
  g.moveTo(radarA.x, radarA.y).lineTo(radarB.x, radarB.y)
    .stroke({ width: 1.5, color: COLORS.phosphorGreen, alpha: 0.6 });
  g.circle(radarCenter.x, radarCenter.y, 1.5).fill({ color: COLORS.phosphorGreen, alpha: 0.4 });
}
