import { GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';
import { getRun, SCROLL_SPEED, WORLD_WIDTH } from '@/core/run-state';
import { InputManager } from '@/core/input';
import { PlayerShip } from '@/entities/player/PlayerShip';

export const ENTER_DURATION = 2.0; // seconds to slide in

export interface PlayerEntranceState {
  playerEntering: boolean;
  playerEnterTimer: number;
  playerAutoCruise: boolean;
}

export function createPlayerEntranceState(autoPlayEnabled: boolean): PlayerEntranceState {
  return {
    playerEntering: !autoPlayEnabled,
    playerEnterTimer: 0,
    playerAutoCruise: false,
  };
}

/**
 * Animate the player ship sliding in from off-screen right.
 * Returns true while the entrance animation is still playing.
 */
export function updatePlayerEntrance(
  state: PlayerEntranceState,
  player: PlayerShip,
  dt: number,
): boolean {
  if (!state.playerEntering) return false;

  const run = getRun();
  state.playerEnterTimer += dt;
  const t = Math.min(1, state.playerEnterTimer / ENTER_DURATION);
  // Ease-out cubic for smooth deceleration
  const eased = 1 - (1 - t) * (1 - t) * (1 - t);
  const startX = GAME_WIDTH + 40;
  const targetX = run.cameraX + 450;
  player.x = startX + (targetX - startX) * eased;
  player.y = run.playerY;
  run.playerX = player.x;
  // Give the ship a sense of speed with wake
  player.currentSpeed = 200 * (1 - eased);
  player.isThrusting = true;
  // Still auto-scroll camera during entrance
  run.cameraX = Math.min(run.cameraX + SCROLL_SPEED * dt, WORLD_WIDTH - GAME_WIDTH);
  run.scrollSpeed = SCROLL_SPEED;
  if (t >= 1) {
    state.playerEntering = false;
    state.playerAutoCruise = true;
    player.x = run.cameraX + 450;
    player.vx = 0;
    player.vy = 0;
  }
  return true;
}

/**
 * Auto-cruise: hold formation ahead of tankers until player gives input.
 * Returns true while auto-cruising.
 */
export function updateAutoCruise(
  state: PlayerEntranceState,
  player: PlayerShip,
  input: InputManager,
  autoPlayEnabled: boolean,
  dt: number,
): boolean {
  if (!state.playerAutoCruise) return false;

  const hasInput = autoPlayEnabled ||
    Math.abs(input.getMoveAnalogX()) > 0.1 ||
    Math.abs(input.getMoveAnalogY()) > 0.1 ||
    input.isFireAny() ||
    input.isMouseDown() ||
    input.isRightMouseDown() ||
    input.isMissile();

  if (hasInput) {
    state.playerAutoCruise = false;
    return false;
  }

  const run = getRun();
  // Auto-scroll camera
  run.cameraX = Math.min(run.cameraX + SCROLL_SPEED * dt, WORLD_WIDTH - GAME_WIDTH);
  run.scrollSpeed = SCROLL_SPEED;
  run.scrollSpeedMultiplier = 1.0;

  // Hold formation position ahead of tankers
  player.x = run.cameraX + 450;
  player.vx = 0;
  player.vy = 0;

  // Gentle cruise wake
  player.currentSpeed = SCROLL_SPEED;
  player.isThrusting = true;

  // Update visuals (wake, turret, thrust graphics)
  player.updateRiverRaidMovement(0, 0, 0, 0, dt);

  // Sync run state
  run.playerX = player.x;
  run.playerY = player.y;
  run.shipHeading = 0;
  run.shipCurrentSpeed = SCROLL_SPEED;
  run.shipThrottle = 0;

  return true;
}
