import { registerVar } from '@/debug/tuning-registry';

export const WORLD_WIDTH = 8000;
export let SCROLL_SPEED = 35; // Slowed down for more tactical gameplay

export let STARTING_HP = 8;
export let STARTING_MISSILES = 8;
export let MAX_MISSILES = 20;

registerVar({ key: 'world.scrollSpeed', label: 'Scroll Speed', category: 'Movement', min: 5, max: 120, step: 5, get: () => SCROLL_SPEED, set: v => { SCROLL_SPEED = v; }, default: 35 });
registerVar({ key: 'player.startingHP', label: 'Starting HP', category: 'Player', min: 1, max: 30, step: 1, get: () => STARTING_HP, set: v => { STARTING_HP = v; }, default: 8 });
registerVar({ key: 'player.startingMissiles', label: 'Starting Missiles', category: 'Player', min: 0, max: 50, step: 1, get: () => STARTING_MISSILES, set: v => { STARTING_MISSILES = v; }, default: 8 });
registerVar({ key: 'player.maxMissiles', label: 'Max Missiles', category: 'Player', min: 1, max: 50, step: 1, get: () => MAX_MISSILES, set: v => { MAX_MISSILES = v; }, default: 20 });

export interface RunState {
  score: number;
  oilFlow: number;
  threatLevel: number;
  missionTime: number;
  seed: string;
  missionOutcome: 'active' | 'victory' | 'defeat';

  playerHP: number;
  playerMaxHP: number;
  playerX: number;
  playerY: number;
  playerRotation: number;
  playerSpeed: number;

  missileCount: number;
  gunHeat: number;         // 0.0–1.0, rises when firing
  gunOverheated: boolean;  // true when heat hit 1.0, clears at 0.3
  missileReloadTimer: number;
  maxMissiles: number;

  rapidFireActive: boolean;
  rapidFireTimer: number;

  shieldActive: boolean;
  shieldTimer: number;

  multifireActive: boolean;
  multifireTimer: number;

  mirvActive: boolean;
  mirvTimer: number;

  faeActive: boolean;
  faeTimer: number;

  comboCount: number;
  comboTimer: number;
  comboMultiplier: number;
  bestCombo: number;

  cameraX: number;
  scrollSpeed: number;
  worldWidth: number;

  tankersSaved: number;
  tankersLost: number;
  totalConvoyTankers: number;
  requiredConvoyTankers: number;
  enemiesDestroyed: number;
  wave: number;

  screenShakeTimer: number;
  screenShakeDuration: number;
  screenShakeIntensity: number;
  screenShakeSourceX: number;
  screenShakeSourceY: number;

  // Hitstop — brief time dilation on impactful kills
  hitStopTimer: number;
  hitStopScale: number;

  // River Raid-style auto-scroll
  scrollSpeedMultiplier: number; // 0.4 .. 2.0, controls auto-scroll pace

  // Boat physics
  shipHeading: number;     // Current facing angle in radians
  shipThrottle: number;    // 0..1 throttle
  shipCurrentSpeed: number; // Actual speed after inertia

  oilPrice: number; // $/barrel — rises with tanker damage, falls with repairs/deliveries
  budget: number; // Running cost in dollars — missiles, shells, tanker losses, player destruction

  activeTankerIds: number[];
  activeEnemyIds: number[];
  activeProjectileIds: number[];
  activeMineIds: number[];
  playerContactCooldown: number;
}

export function createRunState(seed?: string): RunState {
  return {
    score: 0,
    oilFlow: 100,
    threatLevel: 5,
    missionTime: 0,
    seed: seed || `gulfguardian-${Date.now()}`,
    missionOutcome: 'active',
    playerHP: STARTING_HP,
    playerMaxHP: STARTING_HP,
    playerX: 250,  // PLAYER_SCREEN_X_OFFSET — matches auto-scroll starting position
    playerY: 360,
    playerRotation: 0,
    playerSpeed: 0,
    missileCount: STARTING_MISSILES,
    maxMissiles: MAX_MISSILES,
    missileReloadTimer: 0,
    gunHeat: 0,
    gunOverheated: false,
    rapidFireActive: false,
    rapidFireTimer: 0,
    shieldActive: false,
    shieldTimer: 0,
    multifireActive: false,
    multifireTimer: 0,
    mirvActive: false,
    mirvTimer: 0,
    faeActive: false,
    faeTimer: 0,
    comboCount: 0,
    comboTimer: 0,
    comboMultiplier: 1,
    bestCombo: 0,
    cameraX: 0,
    scrollSpeed: SCROLL_SPEED,
    worldWidth: WORLD_WIDTH,
    tankersSaved: 0,
    tankersLost: 0,
    totalConvoyTankers: 3,
    requiredConvoyTankers: 3,
    enemiesDestroyed: 0,
    wave: 0,
    screenShakeTimer: 0,
    screenShakeDuration: 0,
    screenShakeIntensity: 0,
    screenShakeSourceX: 0,
    screenShakeSourceY: 0,
    hitStopTimer: 0,
    hitStopScale: 1,
    scrollSpeedMultiplier: 1.0,
    shipHeading: -Math.PI / 2, // Facing up initially
    shipThrottle: 0,
    shipCurrentSpeed: 0,
    oilPrice: 72,
    budget: 0,
    activeTankerIds: [],
    activeEnemyIds: [],
    activeProjectileIds: [],
    activeMineIds: [],
    playerContactCooldown: 0,
  };
}

let currentRun: RunState | null = null;

export function startRun(seed?: string): RunState {
  currentRun = createRunState(seed);
  return currentRun;
}

export function getRun(): RunState {
  if (!currentRun) throw new Error('No active run');
  return currentRun;
}

export function endRun(): void {
  currentRun = null;
}
