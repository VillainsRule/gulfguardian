import { Container, Graphics, Text } from 'pixi.js';
import { IScene, SceneManager } from '@/core/scene-manager';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '@/app/constants';
import { getRun, endRun, WORLD_WIDTH } from '@/core/run-state';
import { drawMap } from './game/map-renderer';
import { getGameMode, resetGameMode } from '@/social/game-mode';
import { isDailySeed, getDailyNumberFromSeed, markDailyPlayed, saveDailyScore } from '@/social/daily-challenge';
import {
  type SharePanelState,
  createSharePanel,
  dismissSharePanel,
  handleSharePanelAction,
  shareChallenge,
} from './debrief-share';
import { type ChyronState, createChyron, updateChyron } from './debrief-chyron';
import { submitScore, type SubmitResult } from '@/social/leaderboard-api';
import { countryToFlag, hasClaimedCallsign, getCallsign } from '@/social/player-identity';
import { CallsignPicker } from '@/ui/overlays/CallsignPicker';
import { LeaderboardOverlay } from '@/ui/overlays/LeaderboardOverlay';
import { getQuality, isMobileDetected } from '@/app/quality';
import { trackDebriefAction } from '@/analytics/analytics';
import { getAudioManager } from '@/audio/audio-manager';
import { TEXT_COLORS } from '@/app/constants';
import {
  type CelebrationParticle,
  type DustParticle,
  type ShockwaveRing,
  createCelebrationBurst,
  createDustParticles,
  createScanlines,
  updateParticles,
  updateShockwaves,
  drawGrid,
  updateDust,
} from './debrief-effects';
import {
  type DebriefButtonsState,
  type LeaderboardButtonsState,
  createDebriefButtons,
  createLeaderboardButtons,
  updateButtonPulse,
  updateLeaderboardButtonPulse,
  detectHoveredButton,
} from './debrief-buttons';
import {
  type DebriefStatsState,
  createStatsPanel,
  updateOutcomeSlam,
  updateScoreCounting,
  updateStaggeredStats,
  updateOilPriceCounting,
  updateRankSlam,
} from './debrief-stats';

const INPUT_PROTECTION_TIME = 1.5;

export class DebriefScene implements IScene {
  private sceneManager: SceneManager;
  private stage: Container | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private protectionTimer: number = INPUT_PROTECTION_TIME;

  private elapsed: number = 0;
  private panelContainer!: Container;

  // Score/oil price counting
  private scoreDisplay: number = 0;
  private scoreTarget: number = 0;
  private oilPriceDisplay: number = 72;
  private oilPriceTarget: number = 72;

  // Stats panel state
  private stats!: DebriefStatsState;
  private rankSlamStarted: boolean = false;
  private rankSlamTimer: number = 0;

  // Victory/defeat effects
  private flashGraphics!: Graphics;
  private flashTimer: number = 0;
  private flashDuration: number = 0;
  private flashColor: number = 0;
  private shakeTimer: number = 0;
  private shakeIntensity: number = 6;
  private particles: CelebrationParticle[] = [];
  private particleGraphics!: Graphics;
  private isVictory: boolean = false;
  private shockwaves: ShockwaveRing[] = [];
  private secondaryBurstTimers: number[] = [];

  // Buttons
  private buttons!: DebriefButtonsState;
  private leaderboardButtons: LeaderboardButtonsState | null = null;

  // Challenge button confirm
  private challengeConfirmTimer: number = 0;

  // Share panel
  private sharePanelState: SharePanelState | null = null;

  // Mode state
  private isDaily: boolean = false;
  private dailyNumber: number | null = null;
  private challengeScoreToBeat: number | null = null;

  // Map backdrop progress marker
  private markerContainer: Container | null = null;

  // Grid + dust
  private gridGraphics!: Graphics;
  private gridOffset: number = 0;
  private dustGraphics!: Graphics;
  private dustParticles: DustParticle[] = [];

  // CRT effects
  private glitchTimer: number = 0;
  private glitchOffset: number = 0;
  private glitchDuration: number = 0;

  // Button hover
  private hoveredBtnIndex: number = -1;
  private pointerX: number = 0;
  private pointerY: number = 0;

  // Leaderboard
  private submitState: 'idle' | 'submitting' | 'done' | 'error' = 'idle';
  private leaderboardOverlay: LeaderboardOverlay | null = null;

  // Callsign picker
  private callsignPicker: CallsignPicker | null = null;

  // Breaking news chyron
  private chyronState: ChyronState | null = null;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
  }

  enter(stage: Container): void {
    this.protectionTimer = INPUT_PROTECTION_TIME;
    this.elapsed = 0;
    this.scoreDisplay = 0;
    this.oilPriceDisplay = 72;
    this.particles = [];
    this.shakeTimer = 0;
    this.flashTimer = 0;
    this.challengeConfirmTimer = 0;
    this.submitState = 'idle';
    this.leaderboardOverlay = null;
    this.rankSlamStarted = false;
    this.rankSlamTimer = 0;
    this.shockwaves = [];
    this.secondaryBurstTimers = [];
    this.glitchTimer = 0;
    this.glitchOffset = 0;
    this.glitchDuration = 0;
    this.hoveredBtnIndex = -1;
    this.gridOffset = 0;
    this.chyronState = null;

    const run = getRun();
    this.scoreTarget = run.score;
    this.oilPriceTarget = run.oilPrice;
    this.isVictory = run.missionOutcome === 'victory';

    // Determine mode
    const gm = getGameMode();
    this.isDaily = gm.mode === 'daily' || isDailySeed(run.seed);
    this.dailyNumber = getDailyNumberFromSeed(run.seed);
    this.challengeScoreToBeat = gm.mode === 'challenge' ? (gm.challengeScore ?? null) : null;

    // Persist daily challenge completion
    if (this.isDaily) {
      markDailyPlayed();
      saveDailyScore(run.score);
    }

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: COLORS.bgBlack });
    stage.addChild(bg);

    // Map backdrop
    const mapContainer = new Container();
    drawMap(mapContainer);
    const mapScale = GAME_WIDTH / WORLD_WIDTH;
    mapContainer.scale.set(mapScale);
    mapContainer.y = (GAME_HEIGHT - GAME_HEIGHT * mapScale) / 2;
    stage.addChild(mapContainer);

    // Dim overlay
    const dimOverlay = new Graphics();
    dimOverlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.55 });
    stage.addChild(dimOverlay);

    // Scrolling grid
    this.gridGraphics = new Graphics();
    stage.addChild(this.gridGraphics);

    // Dust particles
    this.dustGraphics = new Graphics();
    this.dustParticles = createDustParticles(25);
    stage.addChild(this.dustGraphics);

    // Static scanlines
    stage.addChild(createScanlines());

    // Progress marker
    const markerWorldX = run.cameraX + GAME_WIDTH / 2;
    const markerScreenX = markerWorldX * mapScale;
    this.markerContainer = new Container();

    const markerLine = new Graphics();
    markerLine.moveTo(markerScreenX, 0).lineTo(markerScreenX, GAME_HEIGHT)
      .stroke({ width: 2, color: this.isVictory ? COLORS.phosphorGreen : COLORS.red, alpha: 0.8 });
    this.markerContainer.addChild(markerLine);

    const markerLabel = new Text({
      text: this.isVictory ? 'DELIVERED' : 'MISSION END',
      style: {
        fontFamily: 'Share Tech Mono, monospace', fontSize: 10, fontWeight: 'bold',
        fill: this.isVictory ? TEXT_COLORS.phosphorGreen : TEXT_COLORS.red,
      },
    });
    markerLabel.anchor.set(0.5, 1);
    markerLabel.position.set(markerScreenX, mapContainer.y + 8);
    this.markerContainer.addChild(markerLabel);
    stage.addChild(this.markerContainer);

    // Flash overlay
    this.flashGraphics = new Graphics();
    stage.addChild(this.flashGraphics);

    // Panel container (for shake effect)
    this.panelContainer = new Container();
    stage.addChild(this.panelContainer);

    // Stats panel (title, outcome, score, stats, rank, budget, oil, callsign)
    this.stats = createStatsPanel(
      this.panelContainer, run, this.isVictory,
      this.isDaily, this.dailyNumber, this.challengeScoreToBeat,
    );

    // Leaderboard buttons
    this.leaderboardButtons = createLeaderboardButtons(this.panelContainer);

    // Action buttons (new mission, share, challenge, main menu, hint text)
    this.buttons = createDebriefButtons(this.panelContainer);

    // Breaking news chyron
    this.chyronState = createChyron(this.isVictory, run.oilPrice);
    this.chyronState.container.visible = false;
    stage.addChild(this.chyronState.container);

    // Particle layer
    this.particleGraphics = new Graphics();
    stage.addChild(this.particleGraphics);

    // Trigger victory/defeat effects
    if (this.isVictory) {
      this.flashColor = COLORS.phosphorGreen;
      this.flashDuration = 0.3;
      this.flashTimer = this.flashDuration;
      this.particles = createCelebrationBurst(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 60);
      this.shockwaves.push({
        x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 - 40,
        timer: 0, duration: 0.5, maxRadius: 180,
      });
      this.secondaryBurstTimers = [0.3, 0.6];
    } else {
      this.flashColor = COLORS.red;
      this.flashDuration = 0.2;
      this.flashTimer = this.flashDuration;
      this.shakeTimer = 0.4;
    }

    // Pointer move handler
    stage.on('pointermove', this.handlePointerMove);

    // Input handlers
    this.stage = stage;
    stage.eventMode = 'static';
    stage.cursor = 'pointer';
    stage.on('pointerdown', this.handleClick);

    this.keydownHandler = (e: KeyboardEvent) => {
      if (this.protectionTimer > 0) return;
      if (e.code === 'Space') this.sceneManager.switchTo('briefing');
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  exit(): void {
    if (this.callsignPicker) {
      this.closeCallsignPicker();
    }
    if (this.leaderboardOverlay) {
      this.closeLeaderboard();
    }
    if (this.sharePanelState) {
      dismissSharePanel(this.sharePanelState, this.stage!);
      this.sharePanelState = null;
    }
    this.chyronState = null;
    endRun();
    resetGameMode();
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.stage) {
      this.stage.off('pointerdown', this.handleClick);
      this.stage.off('pointermove', this.handlePointerMove);
      this.stage.eventMode = 'auto';
      this.stage.cursor = 'default';
      this.stage = null;
    }
  }

  update(dt: number): void {
    this.elapsed += dt;

    if (this.protectionTimer > 0) {
      this.protectionTimer -= dt;
    }

    // Hint text fade-in
    const hintText = this.buttons.hintText;
    hintText.alpha = this.protectionTimer <= 0 ? Math.min(1, hintText.alpha + dt * 2) : 0;

    // Stat animations
    updateOutcomeSlam(this.stats.outcomeText, this.elapsed, this.stats.outcomeSlamDuration);
    this.scoreDisplay = updateScoreCounting(this.elapsed, this.scoreDisplay, this.scoreTarget, this.stats.scoreText, dt);
    updateStaggeredStats(this.stats.statsElements, this.elapsed, dt);
    this.oilPriceDisplay = updateOilPriceCounting(this.elapsed, this.oilPriceDisplay, this.oilPriceTarget, this.stats.oilPriceText, dt);

    const rankResult = updateRankSlam(this.stats.rankText, this.elapsed, this.rankSlamStarted, this.rankSlamTimer, dt);
    this.rankSlamStarted = rankResult.started;
    this.rankSlamTimer = rankResult.timer;

    // CRT panel flicker
    this.panelContainer.alpha = 0.95 + 0.05 * Math.sin(this.elapsed * 7);

    // Screen flash
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const t = Math.max(0, this.flashTimer / this.flashDuration);
      this.flashGraphics.clear();
      this.flashGraphics.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: this.flashColor, alpha: 0.15 * t * t * t });
    } else {
      this.flashGraphics.clear();
    }

    // Screen shake (defeat)
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const t = Math.max(0, this.shakeTimer / 0.4);
      this.panelContainer.x = Math.sin(this.elapsed * 60) * this.shakeIntensity * t;
    } else {
      this.panelContainer.x = 0;
    }

    // Secondary particle bursts (victory)
    for (let i = this.secondaryBurstTimers.length - 1; i >= 0; i--) {
      this.secondaryBurstTimers[i] -= dt;
      if (this.secondaryBurstTimers[i] <= 0) {
        this.secondaryBurstTimers.splice(i, 1);
        const bx = GAME_WIDTH / 2 + (Math.random() - 0.5) * 200;
        const by = GAME_HEIGHT / 2 - 40 + (Math.random() - 0.5) * 100;
        this.particles.push(...createCelebrationBurst(bx, by, 20, true));
        this.shockwaves.push({ x: bx, y: by, timer: 0, duration: 0.4, maxRadius: 100 });
      }
    }

    // Particles and shockwaves
    updateShockwaves(this.shockwaves, dt);
    updateParticles(this.particles, this.shockwaves, this.particleGraphics, dt);

    // Challenge confirm timer
    if (this.challengeConfirmTimer > 0) {
      this.challengeConfirmTimer -= dt;
      if (this.challengeConfirmTimer <= 0) {
        this.buttons.challengeBtnText.text = '[ CHALLENGE ]';
      }
    }

    // Button hover and pulse
    this.hoveredBtnIndex = detectHoveredButton(this.buttons, this.pointerX, this.pointerY);
    updateButtonPulse(this.buttons, this.elapsed, this.hoveredBtnIndex);

    // Leaderboard buttons pulse
    if (this.leaderboardButtons) {
      updateLeaderboardButtonPulse(this.leaderboardButtons, this.elapsed, this.submitState);
    }

    // Leaderboard overlay update
    if (this.leaderboardOverlay) {
      this.leaderboardOverlay.update(dt);
    }

    // Callsign picker update
    if (this.callsignPicker) {
      this.callsignPicker.update(dt);
    }

    // Share panel button pulse and confirm timers
    if (this.sharePanelState) {
      this.updateSharePanel(dt);
    }

    // CRT glitch effect
    if (!isMobileDetected() && getQuality().particleMultiplier >= 0.6) {
      this.glitchTimer -= dt;
      if (this.glitchTimer <= 0) {
        this.glitchTimer = 4 + Math.random() * 3;
        this.glitchOffset = (Math.random() - 0.5) * 6;
        this.glitchDuration = 0.05 + Math.random() * 0.03;
      }
      if (this.glitchDuration > 0) {
        this.glitchDuration -= dt;
        this.panelContainer.x += this.glitchOffset;
      }
    }

    // Grid + dust
    this.gridOffset = (this.gridOffset + dt * 6) % 40;
    drawGrid(this.gridGraphics, this.gridOffset);
    updateDust(this.dustGraphics, this.dustParticles, this.elapsed, dt);

    // Progress marker pulse
    if (this.markerContainer) {
      this.markerContainer.alpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(this.elapsed * 2.5));
    }

    // Breaking news chyron
    if (this.chyronState) {
      if (!this.chyronState.isActive && this.elapsed > 2.5) {
        this.chyronState.isActive = true;
        this.chyronState.container.visible = true;
        this.buttons.hintText.visible = false;
      }
      if (this.chyronState.isActive) {
        updateChyron(this.chyronState, dt);
      }
    }
  }

  resize(_w: number, _h: number): void {}

  private handleClick = (e: any): void => {
    if (this.protectionTimer > 0) return;
    const local = this.stage!.toLocal(e.global);
    const x = local.x;
    const y = local.y;

    // Callsign picker — handle exclusively
    if (this.callsignPicker) {
      if (!this.callsignPicker.handleClick(x, y)) {
        this.closeCallsignPicker();
      }
      return;
    }

    // Leaderboard overlay — handle exclusively
    if (this.leaderboardOverlay) {
      if (!this.leaderboardOverlay.handleClick(x, y)) {
        this.closeLeaderboard();
      }
      return;
    }

    // Share panel — handle exclusively
    if (this.sharePanelState) {
      for (const btn of this.sharePanelState.btnRects) {
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          const closed = handleSharePanelAction(
            btn.action, this.sharePanelState, this.stage!,
            this.isDaily, this.dailyNumber, this.isVictory,
          );
          if (closed) this.sharePanelState = null;
          return;
        }
      }
      dismissSharePanel(this.sharePanelState, this.stage!);
      this.sharePanelState = null;
      return;
    }

    const audio = getAudioManager();
    const b = this.buttons;

    const outcome = this.isVictory ? 'victory' : 'defeat';
    if (this.hitTest(b.newMissionRect, x, y)) {
      audio.play('button_click');
      trackDebriefAction('play_again', outcome);
      this.sceneManager.switchTo('briefing');
    }
    if (this.hitTest(b.shareRect, x, y)) {
      audio.play('button_click');
      trackDebriefAction('share', outcome);
      this.openSharePanel();
    }
    if (this.hitTest(b.challengeRect, x, y)) {
      audio.play('button_click');
      trackDebriefAction('challenge', outcome);
      shareChallenge().then((result) => {
        b.challengeBtnText.text = result.label;
        this.challengeConfirmTimer = result.confirmTimer;
      });
    }
    if (this.hitTest(b.returnRect, x, y)) {
      audio.play('button_click');
      trackDebriefAction('main_menu', outcome);
      this.sceneManager.switchTo('title');
    }

    // Edit callsign
    if (this.hitTest(this.stats.editCallsignRect, x, y) && this.submitState !== 'submitting') {
      audio.play('button_click');
      this.openCallsignPicker();
      return;
    }

    // Submit score
    if (this.leaderboardButtons && this.submitState === 'idle' && this.hitTest(this.leaderboardButtons.submitRect, x, y)) {
      audio.play('button_click');
      this.handleSubmitScore();
    }

    // Leaderboard
    if (this.leaderboardButtons && this.hitTest(this.leaderboardButtons.lbRect, x, y)) {
      audio.play('button_click');
      trackDebriefAction('leaderboard', outcome);
      this.openLeaderboard();
    }
  };

  private hitTest(rect: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  private handleSubmitScore(): void {
    if (this.submitState !== 'idle' || !this.leaderboardButtons) return;

    if (!hasClaimedCallsign()) {
      this.openCallsignPicker(true);
      return;
    }

    this.doSubmitScore();
  }

  private doSubmitScore(): void {
    if (!this.leaderboardButtons) return;
    this.submitState = 'submitting';
    this.leaderboardButtons.submitBtnText.text = '[ SUBMITTING... ]';

    const run = getRun();
    submitScore(run).then((result: SubmitResult) => {
      if (!this.leaderboardButtons) return;
      if (result.ok) {
        this.submitState = 'done';
        const flag = result.country ? countryToFlag(result.country) + ' ' : '';
        this.leaderboardButtons.submitBtnText.text = `${flag}RANK #${result.rank ?? '?'}!`;
        this.leaderboardButtons.submitBtnText.style.fill = TEXT_COLORS.phosphorGreen;
        // Update the callsign display in the stats panel
        this.updateCallsignDisplay();
        if (this.leaderboardOverlay) {
          this.leaderboardOverlay.invalidateCache();
        }
      } else {
        this.submitState = 'error';
        this.leaderboardButtons.submitBtnText.text = `[ ${result.error?.toUpperCase().substring(0, 20) ?? 'ERROR'} ]`;
        this.leaderboardButtons.submitBtnText.style.fill = TEXT_COLORS.red;
        setTimeout(() => {
          if (this.submitState === 'error' && this.leaderboardButtons) {
            this.submitState = 'idle';
            this.leaderboardButtons.submitBtnText.text = '[ SUBMIT SCORE ]';
            this.leaderboardButtons.submitBtnText.style.fill = TEXT_COLORS.cyan;
          }
        }, 3000);
      }
    });
  }

  private openCallsignPicker(submitAfterClaim: boolean = false): void {
    if (this.callsignPicker) return;
    this.callsignPicker = new CallsignPicker();
    this.callsignPicker.onComplete(() => {
      this.closeCallsignPicker();
      this.updateCallsignDisplay();
      if (submitAfterClaim) {
        this.doSubmitScore();
      }
    });
    this.callsignPicker.onCancel(() => {
      this.closeCallsignPicker();
    });
    this.stage!.addChild(this.callsignPicker.container);
  }

  private closeCallsignPicker(): void {
    if (!this.callsignPicker) return;
    this.stage!.removeChild(this.callsignPicker.container);
    this.callsignPicker.destroy();
    this.callsignPicker = null;
  }

  private updateCallsignDisplay(): void {
    for (const stat of this.stats.statsElements) {
      if (stat.el.text.startsWith('PILOT:')) {
        stat.el.text = `PILOT: ${getCallsign()}`;
        break;
      }
    }
  }

  private openLeaderboard(): void {
    if (this.leaderboardOverlay) return;
    this.leaderboardOverlay = new LeaderboardOverlay();
    this.leaderboardOverlay.onClose(() => this.closeLeaderboard());
    this.stage!.addChild(this.leaderboardOverlay.container);
    this.leaderboardOverlay.show();
  }

  private closeLeaderboard(): void {
    if (!this.leaderboardOverlay) return;
    this.stage!.removeChild(this.leaderboardOverlay.container);
    this.leaderboardOverlay.destroy();
    this.leaderboardOverlay = null;
  }

  private openSharePanel(): void {
    if (this.sharePanelState) return;
    this.sharePanelState = createSharePanel();
    this.stage!.addChild(this.sharePanelState.container);
  }

  private handlePointerMove = (e: any): void => {
    if (!this.stage) return;
    const local = this.stage.toLocal(e.global);
    this.pointerX = local.x;
    this.pointerY = local.y;
    if (this.leaderboardOverlay) {
      this.leaderboardOverlay.handlePointerMove(local.x, local.y);
    }
  };

  private updateSharePanel(dt: number): void {
    const sp = this.sharePanelState!;
    const btnPulse = 0.6 + 0.4 * Math.sin(this.elapsed * 3);
    const btnColors = [COLORS.cyan, COLORS.phosphorGreen, COLORS.amber, COLORS.phosphorGreen];
    const btnLabels = ['[ TWITTER / X ]', '[ COPY TEXT ]', '[ SAVE IMAGE ]', '[ CLOSE ]'];
    for (let i = 0; i < sp.btnRects.length; i++) {
      const rect = sp.btnRects[i];
      const bg = sp.btnBgs[i];
      if (bg) {
        bg.clear();
        bg.rect(rect.x, rect.y, rect.w, rect.h).fill({ color: COLORS.panelBg, alpha: 0.8 });
        bg.rect(rect.x, rect.y, rect.w, rect.h).stroke({ width: 2, color: btnColors[i], alpha: btnPulse });
      }
      const action = rect.action;
      const timer = sp.confirmTimers.get(action);
      if (timer !== undefined && timer > 0) {
        const remaining = timer - dt;
        if (remaining <= 0) {
          sp.confirmTimers.delete(action);
          if (sp.btnTexts[i]) {
            sp.btnTexts[i].text = btnLabels[i];
          }
        } else {
          sp.confirmTimers.set(action, remaining);
        }
      }
    }
  }
}
