import { GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';
import { getRun, WORLD_WIDTH, SCROLL_SPEED } from '@/core/run-state';
import { InputManager } from '@/core/input';
import { GameEntities, GameLayers } from './game-types';

const ZOOM_DURATION = 2.0;

// Start: full world visible, centered on strait
const START_SCALE = GAME_WIDTH / WORLD_WIDTH; // 0.16
const START_PIVOT_X = WORLD_WIDTH / 2;        // 4000
const START_PIVOT_Y = GAME_HEIGHT / 2;        // 360

// End: normal play viewport at cameraX=0
const END_SCALE = 1.0;
const END_PIVOT_X = GAME_WIDTH / 2;           // 640
const END_PIVOT_Y = GAME_HEIGHT / 2;          // 360

// Formation entrance: entities sail in from off-screen left during zoom
const FORMATION_START_TANKER_X = -300;
const FORMATION_START_PLAYER_X = -150;  // ahead of tankers (rightmost)
const FORMATION_END_PLAYER_X = 450;     // auto-cruise position at cameraX=0

export interface OpeningZoomState {
  active: boolean;
  timer: number;
}

export function createOpeningZoomState(enabled: boolean): OpeningZoomState {
  return {
    active: enabled,
    timer: 0,
  };
}

/**
 * Animate a cinematic zoom from overhead map view to normal play position,
 * while sailing the convoy formation in from off-screen left.
 * Returns true while the zoom is still active.
 */
export function updateOpeningZoom(
  state: OpeningZoomState,
  layers: GameLayers,
  input: InputManager,
  dt: number,
  entities: GameEntities,
): boolean {
  if (!state.active) return false;

  // Check for skip (any key, click, or touch)
  const skip = input.wasAnyJustPressed() || input.consumeClick();

  state.timer += dt;
  let t = Math.min(1, state.timer / ZOOM_DURATION);
  if (skip) t = 1;

  // Ease-out cubic
  const eased = 1 - (1 - t) * (1 - t) * (1 - t);

  // --- Camera zoom ---
  const scale = START_SCALE + (END_SCALE - START_SCALE) * eased;
  const pivotX = START_PIVOT_X + (END_PIVOT_X - START_PIVOT_X) * eased;
  const pivotY = START_PIVOT_Y + (END_PIVOT_Y - START_PIVOT_Y) * eased;

  layers.worldLayer.pivot.set(pivotX, pivotY);
  layers.worldLayer.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  layers.worldLayer.scale.set(scale);

  // Hide HUD during zoom
  layers.uiLayer.visible = false;

  // --- Formation entrance: slide entities from left ---
  const run = getRun();
  const player = entities.playerShip;

  // Player slides from off-screen left to auto-cruise position
  player.x = FORMATION_START_PLAYER_X + (FORMATION_END_PLAYER_X - FORMATION_START_PLAYER_X) * eased;
  player.y = run.playerY;
  player.isThrusting = true;
  player.currentSpeed = SCROLL_SPEED;
  player.heading = 0;

  // Tankers slide from off-screen left to their route start positions
  for (const tanker of entities.tankers) {
    const endX = tanker.route[0].x;
    const endY = tanker.route[0].y;
    tanker.x = FORMATION_START_TANKER_X + (endX - FORMATION_START_TANKER_X) * eased;
    tanker.y = endY;
  }

  if (t >= 1) {
    // Zoom + entrance complete — restore normal coordinate system
    state.active = false;
    layers.worldLayer.pivot.set(0, 0);
    layers.worldLayer.position.set(0, 0);
    layers.worldLayer.scale.set(1.0);
    layers.uiLayer.visible = true;

    // Sync run state for gameplay
    run.playerX = player.x;
    run.playerY = player.y;
    run.cameraX = 0;
  }

  return true;
}
