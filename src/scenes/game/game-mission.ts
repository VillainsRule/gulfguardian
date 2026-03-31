import { Container } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';
import { COLORS } from '@/app/constants';
import { getRun, startRun, WORLD_WIDTH } from '@/core/run-state';
import { SceneManager } from '@/core/scene-manager';
import { CombatSystem } from '@/systems/combat/combat-system';
import { DeathSequenceEffect } from '@/effects/explosions/DeathSequenceEffect';
import { playSfx } from '@/audio/sfx';
import { recordRun } from '@/debug/StatsRecorder';
import { trackMissionEnd, trackTankerLost } from '@/analytics/analytics';
import { GameEntities, GameLayers } from './game-types';
import { createGameOverOverlay, updateGameOverOverlay } from './game-ui';
import { AutoPlayController } from '@/debug/AutoPlayController';

// Ending zoom-out constants
const END_ZOOM_DURATION = 4.0;
const END_ZOOM_TARGET_SCALE = GAME_WIDTH / WORLD_WIDTH; // zoom out to see full map

export interface MissionEndState {
  gameOverContainer: Container | null;
  gameOverTimer: number;
  playerDying: boolean;
  playerDeathTimer: number;
  endingZoom: boolean;
  endingZoomTimer: number;
  endingZoomStartScale: number;
  endingZoomStartPivotX: number;
  endingZoomStartPivotY: number;
  missionEnded: boolean;
}

export function createMissionEndState(): MissionEndState {
  return {
    gameOverContainer: null,
    gameOverTimer: 0,
    playerDying: false,
    playerDeathTimer: 0,
    endingZoom: false,
    endingZoomTimer: 0,
    endingZoomStartScale: 1.0,
    endingZoomStartPivotX: 0,
    endingZoomStartPivotY: 0,
    missionEnded: false,
  };
}

/** Start the ending zoom-out effect, centering on the current camera position */
function startEndingZoom(state: MissionEndState, layers: GameLayers): void {
  const run = getRun();
  state.endingZoom = true;
  state.endingZoomTimer = 0;
  state.endingZoomStartScale = 1.0;
  // Current viewport center in world coords
  state.endingZoomStartPivotX = run.cameraX + GAME_WIDTH / 2;
  state.endingZoomStartPivotY = GAME_HEIGHT / 2;
}

/** Update the ending zoom-out animation. Returns true while active. */
export function updateEndingZoom(state: MissionEndState, layers: GameLayers, dt: number): boolean {
  if (!state.endingZoom) return false;

  state.endingZoomTimer += dt;
  const t = Math.min(1, state.endingZoomTimer / END_ZOOM_DURATION);

  // Ease-in-out cubic
  const eased = t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const scale = state.endingZoomStartScale + (END_ZOOM_TARGET_SCALE - state.endingZoomStartScale) * eased;
  const pivotX = state.endingZoomStartPivotX + (WORLD_WIDTH / 2 - state.endingZoomStartPivotX) * eased;
  const pivotY = state.endingZoomStartPivotY + (GAME_HEIGHT / 2 - state.endingZoomStartPivotY) * eased;

  layers.worldLayer.pivot.set(pivotX, pivotY);
  layers.worldLayer.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  layers.worldLayer.scale.set(scale);

  // Fade out HUD during zoom
  layers.uiLayer.alpha = Math.max(0, 1 - eased * 1.5);

  if (t >= 1) {
    state.endingZoom = false;
    return false;
  }
  return true;
}

export function endMission(
  run: ReturnType<typeof getRun>,
  sceneManager: SceneManager,
  autoPlayEnabled: boolean,
  autoPlayController: AutoPlayController,
  batchState: { batchRemaining: number; batchSeed?: string; batchWins?: number; batchLosses?: number },
): void {
  if (autoPlayEnabled) {
    recordRun(run, autoPlayController.smartness);

    // Track batch wins/losses
    if (run.missionOutcome === 'victory') {
      if (batchState.batchWins !== undefined) batchState.batchWins++;
    } else {
      if (batchState.batchLosses !== undefined) batchState.batchLosses++;
    }

    if (batchState.batchRemaining > 0) {
      batchState.batchRemaining--;
    }

    if (batchState.batchRemaining > 0) {
      console.log(`[AutoPlay] Batch: ${batchState.batchRemaining} runs remaining`);
      // Start a fresh run and re-enter game scene immediately (no fade)
      startRun(batchState.batchSeed);
      sceneManager.switchToImmediate('game');
      return;
    }
    // Final run done — stats accumulate; user can download from Stats tab
    console.log('[AutoPlay] Batch complete. Use Stats tab to download all results.');
  }
  sceneManager.switchTo('debrief');
}

/**
 * Check win/lose conditions. Returns true if the game loop should stop updating.
 */
export function checkMissionEnd(
  state: MissionEndState,
  run: ReturnType<typeof getRun>,
  dt: number,
  entities: GameEntities,
  layers: GameLayers,
  sceneManager: SceneManager,
  autoPlayEnabled: boolean,
  autoPlayController: AutoPlayController,
  batchState: { batchRemaining: number; batchSeed?: string; batchWins?: number; batchLosses?: number },
): boolean {
  // Prevent re-triggering after mission has ended (e.g., during fade transitions)
  if (state.missionEnded) return true;

  // Ending zoom-out animation (runs alongside game over overlay)
  if (state.endingZoom) {
    updateEndingZoom(state, layers, dt);
  }

  if (state.gameOverContainer) {
    state.gameOverTimer -= dt;
    updateGameOverOverlay(state.gameOverContainer);
    if (state.gameOverTimer <= 0 && !state.endingZoom) {
      // Restore world layer before scene transition
      layers.worldLayer.pivot.set(0, 0);
      layers.worldLayer.position.set(0, 0);
      layers.worldLayer.scale.set(1.0);
      layers.uiLayer.alpha = 1;
      state.missionEnded = true;
      endMission(run, sceneManager, autoPlayEnabled, autoPlayController, batchState);
    }
    return true;
  }

  const aliveTankers = entities.tankers.filter(t => t.alive);

  if (aliveTankers.length === 0 && run.tankersSaved < run.requiredConvoyTankers) {
    run.missionOutcome = 'defeat';
    trackMissionEnd('tankers_lost');
    if (autoPlayEnabled) {
      state.missionEnded = true;
      endMission(run, sceneManager, autoPlayEnabled, autoPlayController, batchState);
      return true;
    }
    state.gameOverContainer = createGameOverOverlay(run, 'GAME OVER');
    state.gameOverTimer = END_ZOOM_DURATION + 2.0;
    startEndingZoom(state, layers);
    layers.uiLayer.addChild(state.gameOverContainer);
    return true;
  }
  if (run.playerHP <= 0 && !state.playerDying) {
    if (autoPlayEnabled) {
      run.missionOutcome = 'defeat';
      trackMissionEnd('player_killed');
      state.missionEnded = true;
      endMission(run, sceneManager, autoPlayEnabled, autoPlayController, batchState);
      return true;
    }
    // Start spectacular death explosion sequence
    state.playerDying = true;
    state.playerDeathTimer = 2.5;

    const player = entities.playerShip;

    // Large death sequence effect on the player ship
    const deathFx = new DeathSequenceEffect(player.x, player.y, 'large', COLORS.cyan);
    entities.effects.push(deathFx);
    layers.effectLayer.addChild(deathFx);

    // Secondary explosion slightly offset for extra spectacle
    const deathFx2 = new DeathSequenceEffect(player.x - 10, player.y + 5, 'medium', COLORS.amber);
    entities.effects.push(deathFx2);
    layers.effectLayer.addChild(deathFx2);

    // Massive screen shake
    CombatSystem.triggerScreenShake(25, 1.5, player.x, player.y);

    // Hide the player ship
    player.visible = false;

    playSfx('bigExplode');
    return true;
  }
  if (state.playerDying) {
    state.playerDeathTimer -= dt;
    if (state.playerDeathTimer <= 0) {
      run.missionOutcome = 'defeat';
      trackMissionEnd('player_killed');
      state.gameOverContainer = createGameOverOverlay(run, 'GAME OVER');
      state.gameOverTimer = END_ZOOM_DURATION + 2.0;
      startEndingZoom(state, layers);
      layers.uiLayer.addChild(state.gameOverContainer);
      state.playerDying = false;
    }
    return true;
  }
  if (run.cameraX >= WORLD_WIDTH - GAME_WIDTH && run.tankersSaved >= run.requiredConvoyTankers && aliveTankers.every(t => t.completed)) {
    run.missionOutcome = 'victory';
    run.oilPrice = Math.max(50, run.oilPrice - 10);
    trackMissionEnd();
    if (autoPlayEnabled) {
      state.missionEnded = true;
      endMission(run, sceneManager, autoPlayEnabled, autoPlayController, batchState);
      return true;
    }
    // Show victory overlay with zoom-out
    state.gameOverContainer = createGameOverOverlay(run, 'MISSION ACCOMPLISHED');
    state.gameOverTimer = END_ZOOM_DURATION + 2.0;
    startEndingZoom(state, layers);
    layers.uiLayer.addChild(state.gameOverContainer);
    return true;
  }
  return false;
}
