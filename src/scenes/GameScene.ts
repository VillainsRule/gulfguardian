import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { IScene, SceneManager } from '@/core/scene-manager';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { getQuality, updateFPSMonitor } from '@/app/quality';
import { InputManager } from '@/core/input';
import { getRun, startRun, WORLD_WIDTH, SCROLL_SPEED } from '@/core/run-state';
import { SeededRNG } from '@/core/rng';
import { PlayerShip } from '@/entities/player/PlayerShip';
import { Tanker, resetTankerIdCounter } from '@/entities/tankers/Tanker';
import { CONVOY_ROUTES, TANKER_NAMES, getSmoothedRoutes } from '@/entities/tankers/tanker-routes';
import { resetFabIdCounter } from '@/entities/enemies/FastAttackBoat';
import { resetCmbIdCounter } from '@/entities/enemies/CoastalMissileBattery';
import { resetGunboatIdCounter } from '@/entities/enemies/Gunboat';
import { resetDroneIdCounter } from '@/entities/enemies/Drone';
import { resetHelicopterIdCounter } from '@/entities/enemies/AttackHelicopter';
import { resetMineIdCounter } from '@/entities/hazards/Mine';
import { resetMissileIdCounter } from '@/entities/projectiles/Missile';
import { Hud } from '@/ui/hud/Hud';
import { Radar, RadarTarget } from '@/ui/hud/Radar';
import { PauseOverlay } from '@/ui/overlays/PauseOverlay';
import { MonitorFrame } from '@/ui/overlays/MonitorFrame';
import { ScanlineOverlay } from '@/effects/screen/ScanlineOverlay';
import { VignetteOverlay } from '@/effects/screen/VignetteOverlay';
import { WaterShimmer } from '@/effects/environment/WaterShimmer';
import { updatePlayerMovement } from '@/systems/movement/movement-system';
import { CombatSystem } from '@/systems/combat/combat-system';
import { SCORING, BUDGET_COSTS } from '@/data/scoring';
import { getEncountersForCamera } from '@/data/encounters';
import { playSfx, stopAllLoops } from '@/audio/sfx';
import { DeathSequenceEffect } from '@/effects/explosions/DeathSequenceEffect';
import { GameEntities, GameLayers } from './game/game-types';
import { drawMap } from './game/map-renderer';
import { checkCollisions, checkPickups } from './game/game-collisions';
import {
  AlertState, createAlertState, showAlert, updateAlert,
  StreakState, createStreakState, showStreakAnnouncement, updateStreakText,
  MslAwayState, createMslAwayState, updateMslAway,
  TickerState, createNewsTicker, updateNewsTicker,
  createGameOverOverlay, updateGameOverOverlay,
  createHintsOverlay,
} from './game/game-ui';
import {
  ScreenEffectsState, createScreenEffectsState,
  triggerKillFlash, triggerDamageFlash, triggerTankerDamageFlash, updateScreenEffects,
} from './game/game-screen-effects';
import { spawnEncounter, updateEntities } from './game/game-spawner';
import { spawnOilSlick, spawnWaterRipple } from './game/game-effects';
import { cleanupEntities } from './game/entity-cleanup';
import { ControlPanel } from '@/debug/ControlPanel';
import { AutoPlayController } from '@/debug/AutoPlayController';
import { resetLiveTracking } from '@/debug/StatsRecorder';
import { registerVar } from '@/debug/tuning-registry';

// Extracted sub-modules
import { PlayerEntranceState, createPlayerEntranceState, updatePlayerEntrance, updateAutoCruise } from './game/game-player-entrance';
import { OpeningZoomState, createOpeningZoomState, updateOpeningZoom } from './game/game-opening-zoom';
import { updateAutoPlayMovement, handleAutoPlayCombat } from './game/game-autoplay';
import { handleCombatInput } from './game/game-input';
import { MissionEndState, createMissionEndState, checkMissionEnd } from './game/game-mission';
import { BulletRenderer } from '@/entities/projectiles/BulletRenderer';
import { isMobileDetected } from '@/app/quality';
import { GameControls, getZoomLevel } from '@/ui/overlays/GameControls';
import { trackSectorReached, trackKillMilestone } from '@/analytics/analytics';

let GUN_FIRE_RATE = 0.05;
registerVar({ key: 'combat.gunFireRate', label: 'Gun Fire Rate', category: 'Weapons', min: 0.01, max: 0.3, step: 0.01, get: () => GUN_FIRE_RATE, set: v => { GUN_FIRE_RATE = v; }, default: 0.05 });

const STREAK_MILESTONES: Record<number, string> = {
  5: 'RAMPAGE!', 10: 'UNSTOPPABLE!', 15: 'GODLIKE!', 20: 'LEGENDARY!',
};

export class GameScene implements IScene {
  private sceneManager: SceneManager;
  private input!: InputManager;
  private rng!: SeededRNG;
  // Deterministic benchmark scope:
  // - Decision stream + autoplay combat randomness are seeded and repeatable.
  // - Visual-only effects (screen shake jitter, cosmetic particles) may still vary.
  private autoPlayCombatRng!: SeededRNG;

  private entities!: GameEntities;
  private layers!: GameLayers;

  private hud!: Hud;
  private radar!: Radar;

  private pauseOverlay!: PauseOverlay;
  private monitorFrame!: MonitorFrame;
  private waterShimmer: WaterShimmer | null = null;

  private isPaused = false;
  private missionTime = 0;
  private prevCameraX = 0;
  private missileCooldownTimer = 0;
  private gunCooldownTimer = 0;

  // UI state (delegated to game-ui module)
  private alertState!: AlertState;
  private streakState!: StreakState;
  private mslAwayState!: MslAwayState;
  private tickerState!: TickerState;
  private screenFx!: ScreenEffectsState;

  // Overlays
  private hintsContainer: Container | null = null;
  private hintsTimer = 0;

  // Tracking
  private prevTankerHPs: Map<number, number> = new Map();
  private processedTankerLosses: Set<number> = new Set();
  private prevPlayerHP = 5;
  private lastComboCount = 0;
  private hitFreezeTimer = 0;
  private lastTrackedWave = -1;
  private lastTrackedKillMilestone = 0;

  // Opening zoom + player entrance + mission end (delegated)
  private zoomState!: OpeningZoomState;
  private entranceState!: PlayerEntranceState;
  private missionState!: MissionEndState;

  // Debug: variable control panel & auto-play
  private controlPanel!: ControlPanel;
  private controlPanelOpen = false;
  private autoPlayEnabled = false;
  private autoPlayController = new AutoPlayController();
  private batchRemaining = 0;
  private batchTotal = 0;
  private batchWins = 0;
  private batchLosses = 0;
  private batchSeed: string | null = null;
  private gameSpeedMultiplier = 1;
  private batchHud: Container | null = null;
  private batchHudTexts: { progress: Text; record: Text } | null = null;
  private bulletRenderer!: BulletRenderer;
  private gameControls!: GameControls;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
  }

  enter(stage: Container): void {
    // Lock page scrolling during gameplay so SEO content doesn't appear
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = 'hidden';

    const run = getRun();
    this.input = new InputManager();
    playSfx('gameStart');
    this.rng = new SeededRNG(run.seed);
    this.autoPlayCombatRng = new SeededRNG(`${run.seed}|autoplay-combat`);
    if (this.autoPlayEnabled) {
      this.autoPlayController.resetForRun(run.seed, this.controlPanel?.smartness ?? this.autoPlayController.smartness);
    }

    // Reset ID counters
    resetTankerIdCounter();
    resetFabIdCounter();
    resetCmbIdCounter();
    resetGunboatIdCounter();
    resetMineIdCounter();
    resetDroneIdCounter();
    resetHelicopterIdCounter();
    resetMissileIdCounter();

    // Reset state
    this.isPaused = false;
    this.missionTime = 0;
    this.prevCameraX = 0;
    this.missileCooldownTimer = 0;
    this.gunCooldownTimer = 0;
    this.prevPlayerHP = run.playerHP;
    this.processedTankerLosses.clear();
    this.hitFreezeTimer = 0;
    this.lastComboCount = 0;
    this.lastTrackedWave = -1;
    this.lastTrackedKillMilestone = 0;
    this.controlPanelOpen = false;
    resetLiveTracking();

    // Initialize delegated state
    this.zoomState = createOpeningZoomState(!this.autoPlayEnabled);
    this.entranceState = createPlayerEntranceState(this.autoPlayEnabled);
    if (this.zoomState.active) {
      this.entranceState.playerEntering = false; // delay entrance until zoom finishes
    }
    this.missionState = createMissionEndState();

    // Initialize UI state
    this.alertState = createAlertState();
    this.streakState = createStreakState();
    this.mslAwayState = createMslAwayState();
    this.screenFx = createScreenEffectsState();

    // Set up layers
    const worldLayer = new Container();
    const mapLayer = new Container();
    const entityLayer = new Container();
    const effectLayer = new Container();
    const uiLayer = new Container();

    worldLayer.addChild(mapLayer);
    worldLayer.addChild(entityLayer);
    worldLayer.addChild(effectLayer);
    stage.addChild(worldLayer);
    stage.addChild(uiLayer);

    this.layers = { worldLayer, mapLayer, entityLayer, effectLayer, uiLayer };

    drawMap(mapLayer);

    // Player — starts off-screen left (zoom entrance) or off-screen right (no-zoom fallback)
    const playerShip = new PlayerShip();
    const enterStartX = this.zoomState.active ? -150 : GAME_WIDTH + 40;
    playerShip.position.set(enterStartX, run.playerY);
    run.playerX = enterStartX;
    entityLayer.addChild(playerShip);

    // Convoy
    const smoothedRoutes = getSmoothedRoutes();
    const tankers: Tanker[] = [];
    for (let i = 0; i < CONVOY_ROUTES.length; i++) {
      const route = [...CONVOY_ROUTES[i]];
      const name = TANKER_NAMES[i % TANKER_NAMES.length];
      const tanker = new Tanker(name, route, smoothedRoutes[i]);
      tankers.push(tanker);
      entityLayer.addChild(tanker);
    }

    // During zoom entrance, tankers start off-screen left
    if (this.zoomState.active) {
      for (const tanker of tankers) {
        tanker.x = -300;
      }
    }

    this.entities = {
      playerShip, tankers,
      fabs: [], cmbs: [], gunboats: [], drones: [], helicopters: [], mines: [],
      missiles: [], bullets: [], pickups: [], effects: [],
    };

    // Batch bullet renderer — single Graphics for all bullets
    this.bulletRenderer = new BulletRenderer();
    entityLayer.addChild(this.bulletRenderer.graphics);

    // Track tanker HP
    this.prevTankerHPs.clear();
    for (const tanker of tankers) {
      this.prevTankerHPs.set(tanker.id, tanker.hp);
    }

    // HUD + frame
    this.hud = new Hud();
    uiLayer.addChild(this.hud);

    this.radar = new Radar();
    uiLayer.addChild(this.radar);

    this.monitorFrame = new MonitorFrame();
    uiLayer.addChild(this.monitorFrame);

    // Cool visual overlays (high quality only)
    const quality = getQuality();
    if (quality.enableScanlines) {
      uiLayer.addChild(new ScanlineOverlay());
    }
    if (quality.enableVignette) {
      uiLayer.addChild(new VignetteOverlay());
    }

    // Water shimmer effect (high quality only)
    if (quality.enableWaterShimmer) {
      this.waterShimmer = new WaterShimmer(0, 200, 300);
      mapLayer.addChild(this.waterShimmer);
    }

    this.pauseOverlay = new PauseOverlay();
    uiLayer.addChild(this.pauseOverlay);

    // Debug control panel
    this.controlPanel = new ControlPanel();
    this.controlPanel.autoPlayEnabled = this.autoPlayEnabled;
    this.controlPanel.onAutoPlayToggle = () => {
      this.autoPlayEnabled = !this.autoPlayEnabled;
      this.controlPanel.autoPlayEnabled = this.autoPlayEnabled;
      if (this.autoPlayEnabled) {
        this.entranceState.playerAutoCruise = false;
        this.autoPlayController.smartness = this.controlPanel.smartness;
        this.autoPlayController.resetForRun(run.seed, this.controlPanel.smartness);
      }
    };
    this.controlPanel.onClose = () => {
      this.controlPanelOpen = false;
      this.controlPanel.hide();
      this.isPaused = false;
      this.autoPlayController.smartness = this.controlPanel.smartness;
    };
    this.controlPanel.onBatchRun = (count: number) => {
      // Stats accumulate across batches — user can clear manually from Stats tab
      this.batchRemaining = count;
      this.batchTotal = count;
      this.batchWins = 0;
      this.batchLosses = 0;
      this.batchSeed = run.seed;
      this.autoPlayEnabled = true;
      this.controlPanel.autoPlayEnabled = true;
      this.entranceState.playerAutoCruise = false;
      this.autoPlayController.smartness = this.controlPanel.smartness;
      this.autoPlayController.resetForRun(this.batchSeed, this.controlPanel.smartness);
      this.gameSpeedMultiplier = this.controlPanel.gameSpeed;
      this.controlPanelOpen = false;
      this.controlPanel.hide();
      this.isPaused = false;
      resetLiveTracking();
      this.createBatchHud();
      startRun(this.batchSeed);
      this.sceneManager.switchToImmediate('game');
    };
    this.controlPanel.onGameSpeedChange = (speed: number) => {
      this.gameSpeedMultiplier = speed;
    };
    this.controlPanel.onViewStats = () => {
      // Switch to Stats tab in the panel
      (this.controlPanel as any).activeCategory = 'Stats';
      (this.controlPanel as any).scrollOffset = 0;
      (this.controlPanel as any).buildCategories();
      (this.controlPanel as any).refreshSliders();
    };
    uiLayer.addChild(this.controlPanel);

    // Hints overlay
    this.hintsTimer = 4.0;
    this.hintsContainer = createHintsOverlay();
    uiLayer.addChild(this.hintsContainer);


    // Mobile touch controls (joysticks + missile button)
    this.input.initMobileControls(uiLayer);

    // Game controls (top-right: music toggle + fullscreen toggle)
    this.gameControls = new GameControls();
    uiLayer.addChild(this.gameControls);

    // News ticker
    this.tickerState = createNewsTicker();
    uiLayer.addChild(this.tickerState.container);
  }

  exit(): void {
    document.documentElement.style.overflow = '';
    this.removeBatchHud();
    this.input.destroy();
    this.bulletRenderer.destroy();
    this.gameControls.destroy();
    this.entities.tankers = [];
    this.entities.fabs = [];
    this.entities.cmbs = [];
    this.entities.gunboats = [];
    this.entities.drones = [];
    this.entities.mines = [];
    this.entities.missiles = [];
    this.entities.bullets = [];
    this.entities.pickups = [];
    this.entities.effects = [];
    stopAllLoops();
  }

  update(dt: number): void {
    // Apply game speed multiplier during autoplay
    if (this.autoPlayEnabled && this.gameSpeedMultiplier > 1) {
      dt *= this.gameSpeedMultiplier;
    }

    const run = getRun();

    // Micro-hitstop: dilate time on impactful kills for visceral crunch
    if (run.hitStopTimer > 0) {
      run.hitStopTimer -= dt;
      dt *= run.hitStopScale;
      if (run.hitStopTimer <= 0) {
        run.hitStopScale = 1;
      }
    }

    // Control panel toggle (backtick)
    if (this.input.wasJustPressed('Backquote')) {
      this.controlPanelOpen = !this.controlPanelOpen;
      if (this.controlPanelOpen) {
        this.controlPanel.autoPlayEnabled = this.autoPlayEnabled;
        this.controlPanel.show();
        this.isPaused = true;
      } else {
        this.controlPanel.hide();
        this.isPaused = false;
        this.autoPlayController.smartness = this.controlPanel.smartness;
      }
      this.input.clearFrame();
      return;
    }
    if (this.controlPanelOpen) {
      this.controlPanel.handleInput(this.input);
      this.input.clearFrame();
      return;
    }

    // Pause handling
    if (this.input.isPause()) {
      this.isPaused = !this.isPaused;
      this.isPaused ? this.pauseOverlay.show() : this.pauseOverlay.hide();
    }
    if (this.isPaused && this.input.isDown('KeyQ')) {
      run.missionOutcome = 'defeat';
      this.input.clearFrame();
      this.sceneManager.switchTo('debrief');
      return;
    }
    if (this.isPaused) {
      this.input.clearFrame();
      return;
    }

    // Opening zoom + formation entrance — skip all gameplay while active
    if (this.zoomState.active) {
      updateOpeningZoom(this.zoomState, this.layers, this.input, dt, this.entities);
      if (!this.zoomState.active) {
        // Zoom + entrance finished — go straight to auto-cruise
        this.entranceState.playerEntering = false;
        this.entranceState.playerAutoCruise = true;
      }
      this.input.clearFrame();
      return;
    }

    // Game over overlay active — only run mission-end logic, skip all game systems
    if (this.missionState.gameOverContainer || this.missionState.missionEnded) {
      const batchState = {
        batchRemaining: this.batchRemaining,
        batchSeed: this.batchSeed ?? run.seed,
        batchWins: this.batchWins,
        batchLosses: this.batchLosses,
      };
      checkMissionEnd(this.missionState, run, dt, this.entities, this.layers, this.sceneManager, this.autoPlayEnabled, this.autoPlayController, batchState);
      this.batchRemaining = batchState.batchRemaining;
      this.batchWins = batchState.batchWins ?? this.batchWins;
      this.batchLosses = batchState.batchLosses ?? this.batchLosses;
      if (this.batchRemaining === 0 && this.batchSeed !== null) {
        this.batchSeed = null;
        this.removeBatchHud();
      }
      this.input.clearFrame();
      return;
    }

    this.missionTime += dt;
    run.missionTime = this.missionTime;

    // Hints overlay fade/dismiss
    if (this.hintsTimer > 0 && this.hintsContainer) {
      if (this.input.isMoveUp() || this.input.isMoveDown() || this.input.isMoveLeft() || this.input.isMoveRight() ||
          this.input.isFireUp() || this.input.isFireDown() || this.input.isFireLeft() || this.input.isFireRight()) {
        this.hintsTimer = Math.min(this.hintsTimer, 0.5);
      }
      this.hintsTimer -= dt;
      this.hintsContainer.alpha = Math.min(1, this.hintsTimer / 1.0);
      if (this.hintsTimer <= 0) {
        this.layers.uiLayer.removeChild(this.hintsContainer);
        this.hintsContainer = null;
      }
    }

    // News ticker
    updateNewsTicker(this.tickerState, dt);

    // Consume zoom input (disabled in River Raid mode)
    this.input.consumeZoomDelta();

    // Player ship reference
    const player = this.entities.playerShip;

    this.prevCameraX = run.cameraX;

    // Player entrance animation
    updatePlayerEntrance(this.entranceState, player, dt);

    // Auto-cruise: hold formation ahead of tankers until player input
    updateAutoCruise(this.entranceState, player, this.input, this.autoPlayEnabled, dt);

    // Auto-play AI update
    let aiOutput: ReturnType<AutoPlayController['update']> | null = null;
    if (this.autoPlayEnabled && !this.missionState.playerDying && !this.entranceState.playerEntering) {
      aiOutput = this.autoPlayController.update(dt, this.entities, run);
    }

    // Player movement (skip if dying, entering, or auto-cruising)
    if (!this.missionState.playerDying && !this.entranceState.playerEntering && !this.entranceState.playerAutoCruise) {
      if (aiOutput) {
        updateAutoPlayMovement(player, aiOutput.moveX, aiOutput.moveY, dt);
      } else {
        updatePlayerMovement(this.entities.playerShip, this.input, dt);
      }
    } else if (this.missionState.playerDying) {
      // Still scroll camera while dying
      run.cameraX = Math.min(run.cameraX + run.scrollSpeed * dt, WORLD_WIDTH - GAME_WIDTH);
    }

    // World layer follows camera (skip if ending zoom is controlling the transform)
    if (!this.missionState.endingZoom) {
      const zoom = getZoomLevel();
      this.layers.worldLayer.scale.set(zoom);
      if (zoom > 1.0) {
        const focusX = player.x;
        const focusY = Math.min(Math.max(player.y, GAME_HEIGHT / (2 * zoom)), GAME_HEIGHT - GAME_HEIGHT / (2 * zoom));
        this.layers.worldLayer.x = GAME_WIDTH / 2 - focusX * zoom;
        this.layers.worldLayer.y = GAME_HEIGHT / 2 - focusY * zoom;
      } else if (zoom < 1.0) {
        // Zoomed out: center the view with camera offset
        this.layers.worldLayer.x = -run.cameraX * zoom + (GAME_WIDTH * (1 - zoom)) / 2;
        this.layers.worldLayer.y = (GAME_HEIGHT * (1 - zoom)) / 2;
      } else {
        this.layers.worldLayer.x = -run.cameraX;
        this.layers.worldLayer.y = 0;
      }
    }

    // Screen shake (skip during ending zoom)
    if (run.screenShakeTimer > 0 && !this.missionState.endingZoom) {
      run.screenShakeTimer -= dt;
      const shakeProgress = run.screenShakeDuration > 0.001
        ? Math.max(0, Math.min(1, run.screenShakeTimer / run.screenShakeDuration))
        : 0;
      const shake = Math.min(run.screenShakeIntensity * shakeProgress, 30);

      let biasX = 0, biasY = 0;
      if (run.screenShakeSourceX !== 0 || run.screenShakeSourceY !== 0) {
        const screenCenterWorldX = run.cameraX + GAME_WIDTH / 2;
        const screenCenterWorldY = GAME_HEIGHT / 2;
        const dx = screenCenterWorldX - run.screenShakeSourceX;
        const dy = screenCenterWorldY - run.screenShakeSourceY;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        biasX = (dx / d) * shake * 0.4;
        biasY = (dy / d) * shake * 0.4;
      }
      this.layers.worldLayer.x += (Math.random() - 0.5) * shake * 0.6 + biasX;
      this.layers.worldLayer.y += (Math.random() - 0.5) * shake * 0.6 + biasY;

      if (run.screenShakeIntensity > 12) {
        this.layers.worldLayer.rotation = (Math.random() - 0.5) * shake * 0.002;
      }

      if (run.screenShakeTimer <= 0) {
        this.layers.worldLayer.rotation = 0;
      }
    }

    // Combat (skip if dying, entering, or auto-cruising)
    // Mobile: slightly slower fire rate to reduce bullet count
    const effectiveFireRate = isMobileDetected() ? Math.max(GUN_FIRE_RATE, 0.18) : GUN_FIRE_RATE;
    const cooldowns = { missileCooldownTimer: this.missileCooldownTimer, gunCooldownTimer: this.gunCooldownTimer };
    if (!this.missionState.playerDying && !this.entranceState.playerEntering && !this.entranceState.playerAutoCruise) {
      if (aiOutput) {
        handleAutoPlayCombat(dt, aiOutput, cooldowns, this.entities, this.layers, this.autoPlayCombatRng, this.mslAwayState, this.hud, effectiveFireRate);
      } else {
        handleCombatInput(dt, this.input, cooldowns, this.entities, this.layers, this.rng, this.mslAwayState, this.hud, effectiveFireRate, () => this.getWorldMousePos());
      }
    }
    this.missileCooldownTimer = cooldowns.missileCooldownTimer;
    this.gunCooldownTimer = cooldowns.gunCooldownTimer;
    CombatSystem.updateCooldowns(dt);

    // Encounter spawning
    for (const encounter of getEncountersForCamera(run.cameraX, this.prevCameraX)) {
      if (encounter.label) showAlert(this.alertState, encounter.label, this.layers);
      spawnEncounter(encounter, this.entities, this.layers, this.rng);
    }

    // Hit-freeze
    if (this.hitFreezeTimer > 0) {
      this.hitFreezeTimer -= dt;
    } else {
      updateEntities(dt, this.entities, this.layers, this.rng);
    }

    // Collisions
    checkCollisions(this.entities, this.layers, this.rng, run.cameraX);
    checkPickups(this.entities, this.layers, this.rng);

    // Kill streak detection
    if (run.comboCount > this.lastComboCount) {
      triggerKillFlash(this.screenFx, this.layers);
    }
    if (run.comboCount > this.lastComboCount && run.comboCount >= 2) {
      this.hitFreezeTimer = 0.035;

      const milestone = STREAK_MILESTONES[run.comboCount];
      if (milestone) {
        showStreakAnnouncement(this.streakState, milestone, this.layers);
        CombatSystem.triggerScreenShake(10, 0.3);
        playSfx('combo');
      }
    }
    this.lastComboCount = run.comboCount;

    // Detect tanker damage
    for (const tanker of this.entities.tankers) {
      const prevHP = this.prevTankerHPs.get(tanker.id) ?? tanker.maxHp;
      if (!tanker.alive && !tanker.completed && !tanker.lossProcessed && !this.processedTankerLosses.has(tanker.id)) {
        run.oilFlow = Math.max(0, run.oilFlow - SCORING.TANKER_LOST_PENALTY);
        run.tankersLost++;
        run.budget += BUDGET_COSTS.TANKER_LOST;
        run.oilPrice += 15;
        spawnOilSlick(tanker.x, tanker.y, this.entities, this.layers);
        tanker.lossProcessed = true;
        this.processedTankerLosses.add(tanker.id);
      }
      if (tanker.hp < prevHP) {
        triggerTankerDamageFlash(this.screenFx, this.layers, prevHP - tanker.hp);
        spawnOilSlick(tanker.x, tanker.y, this.entities, this.layers);
        playSfx('tankerHorn');
        if (tanker.hp <= 0) this.hud.showWarning('TANKER LOST - OIL SUPPLY CRITICAL');
        else if (tanker.hp <= tanker.maxHp * 0.33) this.hud.showWarning('TANKER CRITICAL - PROTECT CONVOY');
        else this.hud.showWarning('TANKER UNDER ATTACK');
      }
      this.prevTankerHPs.set(tanker.id, tanker.hp);
    }

    // Detect player damage
    if (run.playerHP < this.prevPlayerHP) {
      triggerDamageFlash(this.screenFx, this.layers, this.prevPlayerHP - run.playerHP);
      playSfx('playerHit');
    }
    this.prevPlayerHP = run.playerHP;

    // Update screen effects
    updateScreenEffects(this.screenFx, dt, this.layers);
    updateMslAway(this.mslAwayState, dt, this.layers);

    // FPS monitor + auto-downgrade
    if (updateFPSMonitor(dt)) {
      showAlert(this.alertState, 'REDUCING QUALITY', this.layers);
    }

    // Water shimmer update (high quality only)
    if (this.waterShimmer) {
      this.waterShimmer.update(dt);
    }

    // Effects — with off-screen culling
    const cullLeft = run.cameraX - 300;
    const cullRight = run.cameraX + GAME_WIDTH + 300;
    for (const effect of this.entities.effects) {
      const ex = effect.x;
      if (ex < cullLeft || ex > cullRight) {
        effect.finished = true;
        effect.visible = false;
        continue;
      }
      effect.visible = true;
      effect.update(dt);
      if (effect instanceof DeathSequenceEffect && effect.pendingSplashes.length > 0) {
        for (const splash of effect.pendingSplashes) {
          spawnWaterRipple(splash.x, splash.y, this.entities, this.layers, 12);
        }
        effect.pendingSplashes.length = 0;
      }
    }

    // Bullet updates (data-only, no per-bullet Graphics)
    const skipBulletRipple = isMobileDetected();
    for (const bullet of this.entities.bullets) {
      bullet.update(dt);
      if (bullet.missedSplash) {
        bullet.missedSplash = false;
        if (!skipBulletRipple) {
          spawnWaterRipple(bullet.x, bullet.y, this.entities, this.layers, 8);
        }
      }
    }
    // Batch render all bullets into a single Graphics
    this.bulletRenderer.render(this.entities.bullets);

    cleanupEntities(this.entities, this.layers);
    updateAlert(this.alertState, dt, this.layers);
    updateStreakText(this.streakState, dt, this.layers);

    // Threat/wave progress
    const progress = run.cameraX / (WORLD_WIDTH - GAME_WIDTH);
    run.threatLevel = Math.min(5, Math.ceil(progress * 5));
    run.wave = Math.floor(progress * 5);

    // Analytics: sector progression + kill milestones
    if (run.wave > this.lastTrackedWave && run.wave >= 1) {
      this.lastTrackedWave = run.wave;
      trackSectorReached(run.wave);
    }
    const KILL_MILESTONES = [10, 25, 50, 75, 100];
    for (const m of KILL_MILESTONES) {
      if (run.enemiesDestroyed >= m && this.lastTrackedKillMilestone < m) {
        this.lastTrackedKillMilestone = m;
        trackKillMilestone(m);
      }
    }


    // Sync player visual state
    player.overheatFlash = run.gunOverheated;
    player.shieldActive = run.shieldActive;

    // HUD + Monitor + Radar
    this.hud.updateFromRun(run);
    this.monitorFrame.update(dt, run);

    // Radar: feed all enemy positions
    const radarEnemies: RadarTarget[] = [
      ...this.entities.fabs as any[],
      ...this.entities.cmbs as any[],
      ...this.entities.gunboats as any[],
      ...this.entities.drones as any[],
      ...this.entities.helicopters as any[],
      ...this.entities.mines as any[],
    ];
    this.radar.update(player.x, player.y, radarEnemies, dt);

    // Mobile joystick rendering
    this.input.mobileControls?.draw();

    // Update zoom controls UI
    this.gameControls.update();

    // Batch progress HUD
    if (this.batchRemaining > 0) this.updateBatchHud();

    // Win/Lose checks
    const batchState = {
      batchRemaining: this.batchRemaining,
      batchSeed: this.batchSeed ?? run.seed,
      batchWins: this.batchWins,
      batchLosses: this.batchLosses,
    };
    if (checkMissionEnd(this.missionState, run, dt, this.entities, this.layers, this.sceneManager, this.autoPlayEnabled, this.autoPlayController, batchState)) {
      this.batchRemaining = batchState.batchRemaining;
      this.batchWins = batchState.batchWins ?? this.batchWins;
      this.batchLosses = batchState.batchLosses ?? this.batchLosses;
      if (this.batchRemaining === 0) {
        this.batchSeed = null;
        this.removeBatchHud();
      }
      this.input.clearFrame();
      return;
    }

    this.input.clearFrame();
  }

  resize(_w: number, _h: number): void {}

  private getWorldMousePos(): { x: number; y: number } {
    const run = getRun();
    const gamePos = this.input.getGameMousePos();
    return { x: gamePos.x + run.cameraX, y: gamePos.y };
  }

  private createBatchHud(): void {
    this.removeBatchHud();
    const container = new Container();

    const bg = new Graphics();
    bg.roundRect(GAME_WIDTH - 260, 5, 250, 42, 4)
      .fill({ color: 0x000000, alpha: 0.75 })
      .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.5 });
    container.addChild(bg);

    const progressText = new Text({
      text: `BATCH: 1/${this.batchTotal}`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
    });
    progressText.position.set(GAME_WIDTH - 250, 9);
    container.addChild(progressText);

    const recordText = new Text({
      text: `BATCH W:0 L:0 | ${this.gameSpeedMultiplier > 1 ? this.gameSpeedMultiplier + 'x SPEED' : 'NORMAL SPEED'}`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: TEXT_COLORS.phosphorGreen }),
    });
    recordText.position.set(GAME_WIDTH - 250, 27);
    container.addChild(recordText);

    this.layers.uiLayer.addChild(container);
    this.batchHud = container;
    this.batchHudTexts = { progress: progressText, record: recordText };
  }

  private updateBatchHud(): void {
    if (!this.batchHudTexts || this.batchTotal === 0) return;
    const currentRun = Math.min(this.batchTotal, Math.max(1, this.batchTotal - this.batchRemaining + 1));
    this.batchHudTexts.progress.text = `BATCH: ${currentRun}/${this.batchTotal}`;
    const speedLabel = this.gameSpeedMultiplier > 1 ? ` | ${this.gameSpeedMultiplier}x` : '';
    this.batchHudTexts.record.text = `BATCH W:${this.batchWins} L:${this.batchLosses}${speedLabel}`;
  }

  private removeBatchHud(): void {
    if (this.batchHud) {
      this.batchHud.parent?.removeChild(this.batchHud);
      this.batchHud.destroy({ children: true });
      this.batchHud = null;
      this.batchHudTexts = null;
    }
  }
}
