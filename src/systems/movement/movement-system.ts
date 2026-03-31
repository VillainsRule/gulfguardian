import { InputManager } from '@/core/input';
import { PlayerShip } from '@/entities/player/PlayerShip';
import { getRun, SCROLL_SPEED, WORLD_WIDTH } from '@/core/run-state';
import { GAME_WIDTH } from '@/app/constants';
import { pushOutOfIsland, pushOffCoast } from '@/scenes/game/map-renderer';
import { registerVar } from '@/debug/tuning-registry';

export let VERTICAL_SPEED = 330;    // px/s vertical movement speed
export let HORIZONTAL_SPEED = 330;  // px/s horizontal movement speed
export const PLAYER_MIN_X_OFFSET = 80;   // Furthest back (left edge of screen)
export const PLAYER_MAX_X_OFFSET = 1150;  // Furthest forward (~90% of screen width)

registerVar({ key: 'movement.verticalSpeed', label: 'Vertical Speed', category: 'Movement', min: 50, max: 600, step: 10, get: () => VERTICAL_SPEED, set: v => { VERTICAL_SPEED = v; }, default: 330 });
registerVar({ key: 'movement.horizontalSpeed', label: 'Horizontal Speed', category: 'Movement', min: 50, max: 600, step: 10, get: () => HORIZONTAL_SPEED, set: v => { HORIZONTAL_SPEED = v; }, default: 330 });

export function updatePlayerMovement(
  player: PlayerShip,
  input: InputManager,
  dt: number
): void {
  const run = getRun();

  // WASD / analog joystick movement input
  const horizontalInput = input.getMoveAnalogX();
  const verticalInput = input.getMoveAnalogY();

  // Fixed scroll speed at 1.0x (no player-controlled acceleration)
  run.scrollSpeedMultiplier = 1.0;

  // Auto-scroll the camera
  const effectiveSpeed = SCROLL_SPEED;
  run.cameraX = Math.min(run.cameraX + effectiveSpeed * dt, WORLD_WIDTH - GAME_WIDTH);
  run.scrollSpeed = effectiveSpeed;

  // Movement speeds
  let vSpeed = VERTICAL_SPEED;
  let hSpeed = HORIZONTAL_SPEED;

  // Slow down the further right the player goes on screen
  const screenX = player.x - run.cameraX;
  const rightRatio = Math.max(0, (screenX - PLAYER_MIN_X_OFFSET) / (PLAYER_MAX_X_OFFSET - PLAYER_MIN_X_OFFSET));
  const rightSlowdown = 1.0 - rightRatio * 0.6; // Up to 60% slower at far right
  hSpeed *= rightSlowdown;
  vSpeed *= rightSlowdown;

  // Update player movement (both axes)
  player.updateRiverRaidMovement(horizontalInput, verticalInput, hSpeed, vSpeed, dt);

  // Clamp player X within screen-relative bounds
  const minX = run.cameraX + PLAYER_MIN_X_OFFSET;
  const maxX = run.cameraX + PLAYER_MAX_X_OFFSET;
  player.x = Math.max(minX, Math.min(maxX, player.x));

  // Push player out of islands
  const corrected = pushOutOfIsland(player.x, player.y);
  player.x = corrected.x;
  player.y = corrected.y;

  // Push player off coastlines (prevent land traversal)
  const prevY = player.y;
  const coastCorrected = pushOffCoast(player.x, player.y);
  player.x = coastCorrected.x;
  player.y = coastCorrected.y;
  if (coastCorrected.y !== prevY) {
    if (prevY < coastCorrected.y) player.vy = Math.max(0, player.vy);
    else player.vy = Math.min(0, player.vy);
  }

  // Re-clamp after island/coast corrections
  player.x = Math.max(minX, Math.min(maxX, player.x));

  // Set wake speed to include effective forward scroll speed
  player.currentSpeed = Math.sqrt(
    (player.vx + effectiveSpeed) * (player.vx + effectiveSpeed) +
    player.vy * player.vy
  );

  run.playerX = player.x;
  run.playerY = player.y;
  run.playerRotation = player.rotation;
  run.shipHeading = 0; // Always facing right
  run.shipCurrentSpeed = effectiveSpeed;
  run.shipThrottle = 0;
}
