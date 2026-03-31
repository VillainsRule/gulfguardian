import { getIslandCollision, pushOffCoast } from '@/scenes/game/map-renderer';

export interface RoutePoint {
  x: number;
  y: number;
}

// Convoy routes span the full 8000px world width
// Tankers travel left-to-right, converging to the center of the strait
// through the narrows (x=3200–5600), then spreading out again.
// The strait center is ~y=350 at the narrows.

export const CONVOY_ROUTE_TOP: RoutePoint[] = [
  { x: 100,  y: 295 },  // start north of center
  { x: 1200, y: 300 },
  { x: 2400, y: 318 },  // begin steering toward center
  { x: 3400, y: 335 },  // converge to shipping lane
  { x: 4200, y: 338 },  // through the narrows
  { x: 5200, y: 332 },
  { x: 6200, y: 315 },  // start spreading
  { x: 7200, y: 305 },
  { x: 8100, y: 300 },
];

export const CONVOY_ROUTE_MID: RoutePoint[] = [
  { x: 100,  y: 350 },  // start center
  { x: 1400, y: 348 },
  { x: 2600, y: 350 },
  { x: 3600, y: 352 },  // through the narrows — stay center
  { x: 4400, y: 350 },
  { x: 5400, y: 348 },
  { x: 6400, y: 350 },
  { x: 7400, y: 352 },
  { x: 8100, y: 350 },
];

export const CONVOY_ROUTE_BOT: RoutePoint[] = [
  { x: 100,  y: 405 },  // start south of center
  { x: 1200, y: 400 },
  { x: 2400, y: 382 },  // begin steering toward center
  { x: 3400, y: 368 },  // converge to shipping lane
  { x: 4200, y: 365 },  // through the narrows
  { x: 5200, y: 370 },
  { x: 6200, y: 388 },  // start spreading
  { x: 7200, y: 398 },
  { x: 8100, y: 402 },
];

export const CONVOY_ROUTES = [CONVOY_ROUTE_TOP, CONVOY_ROUTE_MID, CONVOY_ROUTE_BOT];

export const TANKER_NAMES = [
  'MT AURORA',
  'MT VALIANT',
  'MT PACIFIC',
];

// Legacy exports for compatibility
export const INBOUND_ROUTE = CONVOY_ROUTE_TOP;
export const OUTBOUND_ROUTE = CONVOY_ROUTE_BOT;

// ─── Pre-computed smooth routes ───

const SAMPLE_STEP = 20; // sample every 20px across the 8000px world
const ISLAND_MARGIN = 30; // extra clearance around islands

/** Interpolate Y from a sparse route at a given X */
function interpolateRouteY(route: RoutePoint[], x: number): number {
  if (x <= route[0].x) return route[0].y;
  if (x >= route[route.length - 1].x) return route[route.length - 1].y;
  for (let i = 0; i < route.length - 1; i++) {
    if (x >= route[i].x && x <= route[i + 1].x) {
      const t = (x - route[i].x) / (route[i + 1].x - route[i].x);
      return route[i].y + (route[i + 1].y - route[i].y) * t;
    }
  }
  return route[route.length - 1].y;
}

/**
 * Pre-compute a dense, smooth route that avoids all islands and coastlines.
 * 1. Sample base route at fine intervals
 * 2. Push points out of obstacles with margin
 * 3. Smooth the result so there are no sudden jumps
 */
export function computeSmoothedRoute(baseRoute: RoutePoint[]): RoutePoint[] {
  const startX = baseRoute[0].x;
  const endX = baseRoute[baseRoute.length - 1].x;
  const points: RoutePoint[] = [];

  // Step 1: Sample and deflect around obstacles
  for (let x = startX; x <= endX; x += SAMPLE_STEP) {
    let y = interpolateRouteY(baseRoute, x);

    // Check for island collision at this point and push away
    const island = getIslandCollision(x, y);
    if (island) {
      // Push above or below based on which side the route approaches from
      const aboveDist = Math.abs(y - (island.cy - island.height / 2 - ISLAND_MARGIN));
      const belowDist = Math.abs(y - (island.cy + island.height / 2 + ISLAND_MARGIN));
      if (aboveDist < belowDist) {
        y = island.cy - island.height / 2 - ISLAND_MARGIN;
      } else {
        y = island.cy + island.height / 2 + ISLAND_MARGIN;
      }
    }

    // Also push off coastlines
    const corrected = pushOffCoast(x, y);
    y = corrected.y;

    points.push({ x, y });
  }

  // Step 2: Smooth with multiple passes to eliminate jitter
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 1; i < points.length - 1; i++) {
      points[i].y = points[i - 1].y * 0.25 + points[i].y * 0.5 + points[i + 1].y * 0.25;
    }
  }

  // Step 3: Verify no point is still inside an obstacle after smoothing
  for (const p of points) {
    const island = getIslandCollision(p.x, p.y);
    if (island) {
      const aboveDist = Math.abs(p.y - (island.cy - island.height / 2 - ISLAND_MARGIN));
      const belowDist = Math.abs(p.y - (island.cy + island.height / 2 + ISLAND_MARGIN));
      if (aboveDist < belowDist) {
        p.y = island.cy - island.height / 2 - ISLAND_MARGIN;
      } else {
        p.y = island.cy + island.height / 2 + ISLAND_MARGIN;
      }
    }
    const corrected = pushOffCoast(p.x, p.y);
    p.y = corrected.y;
  }

  return points;
}

/** Look up the smoothed Y position for a given world X */
export function getSmoothedY(smoothedRoute: RoutePoint[], worldX: number): number {
  if (worldX <= smoothedRoute[0].x) return smoothedRoute[0].y;
  if (worldX >= smoothedRoute[smoothedRoute.length - 1].x) return smoothedRoute[smoothedRoute.length - 1].y;

  // Binary search-ish: routes are evenly spaced by SAMPLE_STEP
  const startX = smoothedRoute[0].x;
  const idx = Math.floor((worldX - startX) / SAMPLE_STEP);
  const i = Math.min(idx, smoothedRoute.length - 2);
  const a = smoothedRoute[i];
  const b = smoothedRoute[i + 1];
  const t = (worldX - a.x) / (b.x - a.x);
  return a.y + (b.y - a.y) * t;
}

// Cache pre-computed routes (computed once on first access)
let _smoothedRoutes: RoutePoint[][] | null = null;

export function getSmoothedRoutes(): RoutePoint[][] {
  if (!_smoothedRoutes) {
    _smoothedRoutes = CONVOY_ROUTES.map(r => computeSmoothedRoute(r));
  }
  return _smoothedRoutes;
}
