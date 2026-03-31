import { WORLD_WIDTH } from '@/core/run-state';

export interface MapCoord {
  x: number;
  y: number;
}

/** Island definition for collision checking */
export interface IslandDef {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/** All islands in the map — used for collision */
export const ISLANDS: IslandDef[] = [
  { cx: 1400, cy: 195, width: 320, height: 40 },   // Qeshm
  { cx: 1900, cy: 250, width: 80, height: 25 },     // Hormuz
  { cx: 2800, cy: 210, width: 100, height: 22 },    // Larak
  { cx: 1650, cy: 240, width: 50, height: 18 },     // Hengam
  { cx: 600, cy: 310, width: 45, height: 16 },      // Abu Musa
  { cx: 3600, cy: 280, width: 30, height: 12 },     // Narrows islet 1
  { cx: 4200, cy: 300, width: 25, height: 10 },     // Narrows islet 2
  { cx: 450, cy: 285, width: 35, height: 14 },      // Greater Tunb
  { cx: 350, cy: 320, width: 22, height: 10 },      // Lesser Tunb
  { cx: 150, cy: 370, width: 40, height: 15 },      // Sirri
  { cx: 200, cy: 170, width: 20, height: 8 },       // Forur
];

/** Collision margin added around islands */
const ISLAND_COLLISION_MARGIN = 8;

/** Check if a point is inside any island (ellipse + margin). Returns the island if hit, null otherwise. */
export function getIslandCollision(x: number, y: number): IslandDef | null {
  for (const island of ISLANDS) {
    const rx = (island.width / 2) + ISLAND_COLLISION_MARGIN;
    const ry = (island.height / 2) + ISLAND_COLLISION_MARGIN;
    const dx = x - island.cx;
    const dy = y - island.cy;
    if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
      return island;
    }
  }
  return null;
}

/** Push a point outside the nearest island boundary. Returns corrected {x, y}. */
export function pushOutOfIsland(x: number, y: number): { x: number; y: number } {
  const island = getIslandCollision(x, y);
  if (!island) return { x, y };

  const rx = (island.width / 2) + ISLAND_COLLISION_MARGIN;
  const ry = (island.height / 2) + ISLAND_COLLISION_MARGIN;
  const dx = x - island.cx;
  const dy = y - island.cy;

  // Push outward along the direction from island center
  const angle = Math.atan2(dy / ry, dx / rx);
  return {
    x: island.cx + Math.cos(angle) * rx * 1.02,
    y: island.cy + Math.sin(angle) * ry * 1.02,
  };
}

// ─── Coastline generation (cached for collision) ───

export const COAST_STEP = 40;
const COAST_COLLISION_MARGIN = 10;

function generateIranCoast(): MapCoord[] {
  const coast: MapCoord[] = [];
  for (let x = 0; x <= WORLD_WIDTH; x += COAST_STEP) {
    const t = x / WORLD_WIDTH;
    let baseY: number;

    if (t < 0.15) {
      baseY = 80;
    } else if (t < 0.25) {
      const localT = (t - 0.15) / 0.10;
      baseY = 80 + localT * 70;
    } else if (t < 0.35) {
      baseY = 150 - Math.sin((t - 0.25) / 0.10 * Math.PI) * 20;
    } else if (t < 0.45) {
      const localT = (t - 0.35) / 0.10;
      baseY = 150 - localT * 50;
    } else if (t < 0.70) {
      baseY = 100 + Math.sin((t - 0.45) * 12) * 15;
    } else {
      baseY = 100 - (t - 0.70) * 60;
    }

    const noise = Math.sin(x * 0.008) * 12 + Math.sin(x * 0.023) * 6 + Math.cos(x * 0.003) * 8;
    coast.push({ x, y: baseY + noise });
  }
  return coast;
}

function generateOmanCoast(): MapCoord[] {
  const coast: MapCoord[] = [];
  for (let x = 0; x <= WORLD_WIDTH; x += COAST_STEP) {
    const t = x / WORLD_WIDTH;
    let baseY: number;

    if (t < 0.20) {
      baseY = 680;
    } else if (t < 0.30) {
      const localT = (t - 0.20) / 0.10;
      baseY = 680 - localT * 80;
    } else if (t < 0.40) {
      const localT = (t - 0.30) / 0.10;
      baseY = 600 - localT * 180;
    } else if (t < 0.50) {
      const localT = (t - 0.40) / 0.10;
      const peak = Math.sin(localT * Math.PI);
      baseY = 420 - peak * 50;
    } else if (t < 0.60) {
      const localT = (t - 0.50) / 0.10;
      baseY = 420 + localT * 120;
    } else if (t < 0.75) {
      const localT = (t - 0.60) / 0.15;
      baseY = 540 + localT * 80;
    } else {
      baseY = 620 + (t - 0.75) * 100;
    }

    const noise = Math.sin(x * 0.007) * 10 + Math.sin(x * 0.019) * 7 + Math.cos(x * 0.004) * 5;
    coast.push({ x, y: baseY + noise });
  }
  return coast;
}

// Cached coastlines (deterministic, generated once)
let _iranCoast: MapCoord[] | null = null;
let _omanCoast: MapCoord[] | null = null;

export function getIranCoast(): MapCoord[] {
  if (!_iranCoast) _iranCoast = generateIranCoast();
  return _iranCoast;
}

export function getOmanCoast(): MapCoord[] {
  if (!_omanCoast) _omanCoast = generateOmanCoast();
  return _omanCoast;
}

/** Interpolate the coastline Y at a given world X */
export function getCoastY(coast: MapCoord[], worldX: number): number {
  if (worldX <= coast[0].x) return coast[0].y;
  if (worldX >= coast[coast.length - 1].x) return coast[coast.length - 1].y;

  // Find bracketing segment (coast is sorted by x, spaced COAST_STEP apart)
  const idx = Math.floor(worldX / COAST_STEP);
  const i = Math.min(idx, coast.length - 2);
  const a = coast[i];
  const b = coast[i + 1];
  const t = (worldX - a.x) / (b.x - a.x);
  return a.y + (b.y - a.y) * t;
}

/** Push a point off coastline if it's on land. Returns corrected {x, y}. */
export function pushOffCoast(x: number, y: number): { x: number; y: number } {
  const iranY = getCoastY(getIranCoast(), x) + COAST_COLLISION_MARGIN;
  const omanY = getCoastY(getOmanCoast(), x) - COAST_COLLISION_MARGIN;

  let correctedY = y;
  if (y < iranY) correctedY = iranY;       // Above Iran coast → push south
  if (y > omanY) correctedY = omanY;       // Below Oman coast → push north
  return { x, y: correctedY };
}

/** Check whether a point is in the water channel (between the two coastlines). */
export function isInChannel(x: number, y: number): boolean {
  const iranY = getCoastY(getIranCoast(), x) + COAST_COLLISION_MARGIN;
  const omanY = getCoastY(getOmanCoast(), x) - COAST_COLLISION_MARGIN;
  return y >= iranY && y <= omanY && getIslandCollision(x, y) === null;
}

/** Clamp a Y coordinate into the water channel at a given X. */
export function clampToChannel(x: number, y: number): { x: number; y: number } {
  const iranY = getCoastY(getIranCoast(), x) + COAST_COLLISION_MARGIN + 20;
  const omanY = getCoastY(getOmanCoast(), x) - COAST_COLLISION_MARGIN - 20;
  let correctedY = Math.max(iranY, Math.min(omanY, y));
  // Also push out of islands
  const corrected = pushOutOfIsland(x, correctedY);
  return corrected;
}

/** Get the Iran coast Y at a given world X (for placing inland entities). */
export function getIranCoastY(worldX: number): number {
  return getCoastY(getIranCoast(), worldX);
}

/** Get the Oman coast Y at a given world X. */
export function getOmanCoastY(worldX: number): number {
  return getCoastY(getOmanCoast(), worldX);
}
