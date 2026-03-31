import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { IScene, SceneManager } from '@/core/scene-manager';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { startRun } from '@/core/run-state';
import { DEFAULT_PLAYER_STATS } from '@/entities/player/player-types';
import { getGameMode } from '@/social/game-mode';
import { getDailyNumber } from '@/social/daily-challenge';
import { getQuality, isMobileDetected } from '@/app/quality';
import { trackMissionStart } from '@/analytics/analytics';
import { getDailyNumberFromSeed } from '@/social/daily-challenge';

interface TypewriterEntry {
  text: Text;
  fullContent: string;
  delay: number;
  speed: number;
}

interface StaggeredElement {
  el: Container;
  targetX: number;
  delay: number;
}

interface DustParticle {
  x: number; y: number;
  vx: number;
  vy: number;
  phase: number;
}

interface RadarBlip {
  angle: number;
  dist: number;
  phase: number;
}

interface BtnSpark {
  angle: number;
  speed: number;
  dist: number;
}

export class BriefingScene implements IScene {
  private sceneManager: SceneManager;
  private stage: Container | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  private elapsed: number = 0;
  private panelContainer!: Container;
  private panelSlideDuration: number = 0.5;
  private typewriterTexts: TypewriterEntry[] = [];
  private staggeredElements: StaggeredElement[] = [];
  private btnBg!: Graphics;
  private btnText!: Text;
  private gridGraphics!: Graphics;
  private gridOffset: number = 0;
  private dustGraphics!: Graphics;
  private dustParticles: DustParticle[] = [];
  private btnX: number = 0;
  private btnY: number = 0;
  private btnW: number = 200;
  private btnH: number = 40;

  // Mode banner
  private modeBanner: Text | null = null;

  // Juice effects
  private titleText!: Text;
  private titleSlamDuration: number = 0.5;
  private flashGraphics!: Graphics;
  private flashTimer: number = 0.3;
  private sepGraphics!: Graphics;
  private sepTargetWidth: number = 0;
  private sepY: number = 0;
  private sepDelay: number = 1.35;
  private flagGfx!: Graphics;
  private flagScanOffset: number = 0;

  // CRT effects
  private glitchTimer: number = 0;
  private glitchOffset: number = 0;
  private glitchDuration: number = 0;

  // Radar sweep
  private radarGraphics!: Graphics;
  private radarBlips: RadarBlip[] = [];

  // Threat indicator
  private threatGraphics!: Graphics;
  private threatText!: Text;
  private threatSettleTime: number = 1.8;

  // Button hover
  private hoveredBtn: boolean = false;
  private pointerX: number = 0;
  private pointerY: number = 0;
  private btnPressFeedback: number = 0;

  // Button sparks
  private btnSparks: BtnSpark[] = [];

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
  }

  enter(stage: Container): void {
    this.elapsed = 0;
    this.typewriterTexts = [];
    this.staggeredElements = [];
    this.flashTimer = 0.3;
    this.glitchTimer = 0;
    this.glitchOffset = 0;
    this.glitchDuration = 0;
    this.hoveredBtn = false;
    this.btnPressFeedback = 0;
    this.btnSparks = [
      { angle: 0, speed: 1.2, dist: 0 },
      { angle: Math.PI * 0.7, speed: 0.9, dist: 0 },
      { angle: Math.PI * 1.4, speed: 1.05, dist: 0 },
    ];

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: COLORS.bgBlack });
    stage.addChild(bg);

    // Scrolling grid (drawn each frame)
    this.gridGraphics = new Graphics();
    stage.addChild(this.gridGraphics);

    // Screen flash overlay (behind panel)
    this.flashGraphics = new Graphics();
    stage.addChild(this.flashGraphics);

    // Dust particles layer — more particles with horizontal drift
    this.dustGraphics = new Graphics();
    this.dustParticles = [];
    for (let i = 0; i < 35; i++) {
      this.dustParticles.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        vx: (Math.random() - 0.5) * 6,
        vy: -(3 + Math.random() * 6),
        phase: Math.random() * Math.PI * 2,
      });
    }
    stage.addChild(this.dustGraphics);

    // Static scanline overlay
    const scanlines = new Graphics();
    for (let y = 0; y < GAME_HEIGHT; y += 3) {
      scanlines.rect(0, y, GAME_WIDTH, 1).fill({ color: 0x000000, alpha: 0.06 });
    }
    scanlines.eventMode = 'none';
    stage.addChild(scanlines);

    // Panel container (for slide-in animation)
    this.panelContainer = new Container();
    this.panelContainer.y = 40;
    this.panelContainer.alpha = 0;
    stage.addChild(this.panelContainer);

    // Panel background
    const panelBg = new Graphics();
    panelBg.rect(60, 80, GAME_WIDTH - 120, GAME_HEIGHT - 160).fill({ color: COLORS.panelBg, alpha: 0.6 });
    panelBg.rect(60, 80, GAME_WIDTH - 120, GAME_HEIGHT - 160).stroke({ width: 2, color: COLORS.phosphorGreen, alpha: 0.7 });
    this.panelContainer.addChild(panelBg);

    // Mode banner (daily / challenge)
    const gm = getGameMode();
    if (gm.mode === 'daily') {
      this.modeBanner = new Text({
        text: `◆ DAILY CHALLENGE #${getDailyNumber()} ◆`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
      });
      this.modeBanner.anchor.set(0.5, 0);
      this.modeBanner.position.set(GAME_WIDTH / 2, 88);
      this.panelContainer.addChild(this.modeBanner);
    } else if (gm.mode === 'challenge' && gm.challengeScore !== undefined) {
      this.modeBanner = new Text({
        text: `◆ CHALLENGE: BEAT ${String(gm.challengeScore).padStart(8, '0')} ◆`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 'bold', fill: TEXT_COLORS.cyan }),
      });
      this.modeBanner.anchor.set(0.5, 0);
      this.modeBanner.position.set(GAME_WIDTH / 2, 88);
      this.panelContainer.addChild(this.modeBanner);
    } else {
      this.modeBanner = null;
    }

    // Title — slam-in effect (starts large, slams to 1.0)
    this.titleText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
    });
    this.titleText.position.set(GAME_WIDTH / 2, gm.mode !== 'normal' ? 108 : 100);
    this.titleText.anchor.set(0.5, 0);
    this.titleText.scale.set(2.0);
    this.titleText.alpha = 0;
    this.panelContainer.addChild(this.titleText);
    this.typewriterTexts.push({ text: this.titleText, fullContent: 'MISSION BRIEFING', delay: 0.3, speed: 30 });

    // Objective — staggered slide-in
    const objText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: TEXT_COLORS.phosphorGreen }),
    });
    objText.position.set(100 - 20, 145);
    objText.alpha = 0;
    this.panelContainer.addChild(objText);
    this.typewriterTexts.push({
      text: objText,
      fullContent: 'Escort oil tankers through the Strait of Hormuz.\nDestroy enemies. Keep tankers alive. Chain kills for combos!',
      delay: 0.6,
      speed: 40,
    });
    this.staggeredElements.push({ el: objText, targetX: 100, delay: 0.5 });

    // ── Ship info section with flag ──
    const shipSectionY = 205;
    const flagX = 100;

    // Small US flag graphic (redrawn each frame for animated scanlines)
    this.flagGfx = new Graphics();
    this.panelContainer.addChild(this.flagGfx);
    // Stagger the flag
    this.flagGfx.alpha = 0;
    this.flagGfx.position.set(-20, 0);
    this.staggeredElements.push({ el: this.flagGfx, targetX: 0, delay: 0.8 });

    // Ship name (right of flag)
    const shipInfoX = flagX + 80 + 20;
    const shipNameText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 'bold', fill: TEXT_COLORS.cyan }),
    });
    shipNameText.position.set(shipInfoX - 20, shipSectionY + 2);
    shipNameText.alpha = 0;
    this.panelContainer.addChild(shipNameText);
    this.typewriterTexts.push({ text: shipNameText, fullContent: 'USS GUARDIAN  DDG-117', delay: 0.9, speed: 35 });
    this.staggeredElements.push({ el: shipNameText, targetX: shipInfoX, delay: 0.85 });

    const shipClassText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: TEXT_COLORS.phosphorGreen }),
    });
    shipClassText.position.set(shipInfoX - 20, shipSectionY + 20);
    shipClassText.alpha = 0;
    this.panelContainer.addChild(shipClassText);
    this.typewriterTexts.push({ text: shipClassText, fullContent: 'ARLEIGH BURKE-CLASS DESTROYER', delay: 1.1, speed: 40 });
    this.staggeredElements.push({ el: shipClassText, targetX: shipInfoX, delay: 1.0 });

    const hp = DEFAULT_PLAYER_STATS.maxHP;
    const shipStatsText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: TEXT_COLORS.amber }),
    });
    shipStatsText.position.set(shipInfoX - 20, shipSectionY + 35);
    shipStatsText.alpha = 0;
    this.panelContainer.addChild(shipStatsText);
    this.typewriterTexts.push({ text: shipStatsText, fullContent: `HULL: ${hp}/${hp}  |  MISSILES: 12  |  SPEED: 35 KTS`, delay: 1.25, speed: 45 });
    this.staggeredElements.push({ el: shipStatsText, targetX: shipInfoX, delay: 1.15 });

    const armamentText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 9, fill: TEXT_COLORS.phosphorGreen }),
    });
    armamentText.position.set(shipInfoX - 20, shipSectionY + 50);
    armamentText.alpha = 0;
    this.panelContainer.addChild(armamentText);
    this.typewriterTexts.push({ text: armamentText, fullContent: 'MK-45 5"/54 GUN  |  RGM-84 HARPOON  |  PHALANX CIWS', delay: 1.4, speed: 50 });
    this.staggeredElements.push({ el: armamentText, targetX: shipInfoX, delay: 1.3 });

    // Separator line — animated draw-in
    this.sepY = shipSectionY + 70;
    this.sepTargetWidth = GAME_WIDTH - 200;
    this.sepGraphics = new Graphics();
    this.panelContainer.addChild(this.sepGraphics);

    // Controls label
    const controlsLabel = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
    });
    controlsLabel.position.set(100 - 20, shipSectionY + 82);
    controlsLabel.alpha = 0;
    this.panelContainer.addChild(controlsLabel);
    this.typewriterTexts.push({ text: controlsLabel, fullContent: 'CONTROLS:', delay: 1.5, speed: 30 });
    this.staggeredElements.push({ el: controlsLabel, targetX: 100, delay: 1.45 });

    // Controls text — adapt for mobile vs desktop
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const controlsText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: TEXT_COLORS.phosphorGreen }),
    });
    controlsText.position.set(100 - 20, shipSectionY + 102);
    controlsText.alpha = 0;
    this.panelContainer.addChild(controlsText);
    this.typewriterTexts.push({
      text: controlsText,
      fullContent: isMobile
        ? '[LEFT STICK] Move Ship\n[RIGHT STICK] Fire Guns\n[MSL BUTTON] Launch Missile'
        : '[WASD] Move Ship\n[Arrow Keys / LMB] Fire Guns\n[Space / RMB] Launch Missile\n[ESC] Pause',
      delay: 1.7,
      speed: 50,
    });
    this.staggeredElements.push({ el: controlsText, targetX: 100, delay: 1.6 });

    // Tips
    const tipsText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: TEXT_COLORS.dimGreen }),
    });
    tipsText.position.set(100 - 20, shipSectionY + 175);
    tipsText.alpha = 0;
    this.panelContainer.addChild(tipsText);
    this.typewriterTexts.push({
      text: tipsText,
      fullContent: 'Destroyed enemies drop power-ups. Missiles do NOT auto-reload!',
      delay: 2.2,
      speed: 40,
    });
    this.staggeredElements.push({ el: tipsText, targetX: 100, delay: 2.1 });

    // Threat indicator (below tips)
    this.threatGraphics = new Graphics();
    this.threatGraphics.alpha = 0;
    this.threatGraphics.position.set(-20, 0);
    this.panelContainer.addChild(this.threatGraphics);
    this.staggeredElements.push({ el: this.threatGraphics, targetX: 0, delay: 2.3 });

    this.threatText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: 'bold', fill: TEXT_COLORS.red }),
    });
    this.threatText.position.set(100 - 20, shipSectionY + 198);
    this.threatText.alpha = 0;
    this.panelContainer.addChild(this.threatText);
    this.staggeredElements.push({ el: this.threatText, targetX: 100, delay: 2.3 });

    // Radar sweep (bottom-right of panel)
    this.radarGraphics = new Graphics();
    this.panelContainer.addChild(this.radarGraphics);
    this.radarBlips = [
      { angle: 0.4, dist: 0.6, phase: 0 },
      { angle: 1.8, dist: 0.4, phase: 0 },
      { angle: 3.5, dist: 0.75, phase: 0 },
      { angle: 5.1, dist: 0.3, phase: 0 },
    ];

    // Button — enhanced size with corner brackets
    this.btnW = 240;
    this.btnH = 48;
    this.btnX = GAME_WIDTH / 2 - this.btnW / 2;
    this.btnY = GAME_HEIGHT - 120;

    this.btnBg = new Graphics();
    this.panelContainer.addChild(this.btnBg);

    this.btnText = new Text({
      text: '[ LAUNCH MISSION ]',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 18, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
    });
    this.btnText.anchor.set(0.5);
    this.btnText.position.set(GAME_WIDTH / 2, this.btnY + this.btnH / 2);
    this.panelContainer.addChild(this.btnText);

    this.stage = stage;
    stage.eventMode = 'static';
    stage.cursor = 'pointer';
    stage.on('pointerdown', this.handleBegin);
    stage.on('pointermove', this.handlePointerMove);

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault();
      this.handleBegin();
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  exit(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.stage) {
      this.stage.off('pointerdown', this.handleBegin);
      this.stage.off('pointermove', this.handlePointerMove);
      this.stage.eventMode = 'auto';
      this.stage.cursor = 'default';
      this.stage = null;
    }
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Panel slide-in
    const slideT = Math.min(1, this.elapsed / this.panelSlideDuration);
    const eased = 1 - (1 - slideT) * (1 - slideT); // quadratic ease-out
    this.panelContainer.y = 40 * (1 - eased);
    const panelBaseAlpha = eased;

    // CRT panel flicker — subtle alpha oscillation
    const crtFlicker = 0.95 + 0.05 * Math.sin(this.elapsed * 7);
    this.panelContainer.alpha = panelBaseAlpha * crtFlicker;

    // Title slam-in effect
    if (this.elapsed > 0.3) {
      const slamT = Math.min(1, (this.elapsed - 0.3) / this.titleSlamDuration);
      let scale: number;
      if (slamT < 0.5) {
        // Slam down from 2.0 to 0.95
        const st = slamT / 0.5;
        scale = 2.0 - 1.05 * st * (2 - st);
      } else {
        // Bounce back from 0.95 to 1.0
        const bt = (slamT - 0.5) / 0.5;
        scale = 0.95 + 0.05 * bt * (2 - bt);
      }
      this.titleText.scale.set(scale);
      this.titleText.alpha = Math.min(1, (this.elapsed - 0.3) * 5);
    }

    // Staggered section slide-ins (from left)
    for (const s of this.staggeredElements) {
      if (this.elapsed > s.delay) {
        const t = Math.min(1, (this.elapsed - s.delay) / 0.3);
        const e = t * (2 - t); // quadratic ease-out
        s.el.alpha = e;
        s.el.x = s.targetX - 20 * (1 - e);
      }
    }

    // Typewriter reveals
    for (const tw of this.typewriterTexts) {
      const charsToShow = Math.floor(Math.max(0, this.elapsed - tw.delay) * tw.speed);
      tw.text.text = tw.fullContent.substring(0, Math.min(charsToShow, tw.fullContent.length));
    }

    // Separator line draw-in animation
    if (this.elapsed > this.sepDelay) {
      const sepT = Math.min(1, (this.elapsed - this.sepDelay) / 0.4);
      const sepEased = sepT * (2 - sepT);
      const currentWidth = this.sepTargetWidth * sepEased;
      this.sepGraphics.clear();
      this.sepGraphics.moveTo(100, this.sepY)
        .lineTo(100 + currentWidth, this.sepY)
        .stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.3 * sepEased });
    }

    // Animated flag scanlines
    this.drawFlag();

    // Screen flash (green, on enter)
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const ft = Math.max(0, this.flashTimer / 0.3);
      const fade = ft * ft * ft; // cubic falloff
      this.flashGraphics.clear();
      this.flashGraphics.rect(0, 0, GAME_WIDTH, GAME_HEIGHT)
        .fill({ color: COLORS.phosphorGreen, alpha: 0.12 * fade });
    } else {
      this.flashGraphics.clear();
    }

    // Button hover detection
    this.hoveredBtn = (
      this.pointerX >= this.btnX && this.pointerX <= this.btnX + this.btnW &&
      this.pointerY >= this.btnY && this.pointerY <= this.btnY + this.btnH
    );

    // Button press feedback decay
    if (this.btnPressFeedback > 0) {
      this.btnPressFeedback = Math.max(0, this.btnPressFeedback - dt * 8);
    }

    // Button pulse with scale — enhanced
    const btnGlow = this.hoveredBtn ? 1.0 : (0.7 + 0.3 * Math.sin(this.elapsed * 4));
    const btnStroke = this.hoveredBtn ? 3 : 2;
    const pressScale = this.btnPressFeedback > 0 ? 0.95 : 1.0;
    const hoverScale = this.hoveredBtn ? 1.05 : 1.0;
    const pulseScale = 1.0 + 0.04 * Math.sin(this.elapsed * 3);
    this.btnBg.clear();
    this.btnBg.rect(this.btnX, this.btnY, this.btnW, this.btnH).fill({ color: COLORS.panelBg, alpha: 0.8 });
    this.btnBg.rect(this.btnX, this.btnY, this.btnW, this.btnH).stroke({ width: btnStroke, color: COLORS.phosphorGreen, alpha: btnGlow });
    // Corner brackets
    const bx = this.btnX, by = this.btnY, bw = this.btnW, bh = this.btnH;
    const cLen = 10;
    this.btnBg.moveTo(bx - 4, by + cLen).lineTo(bx - 4, by - 4).lineTo(bx + cLen, by - 4).stroke({ width: 2, color: COLORS.phosphorGreen, alpha: btnGlow * 0.8 });
    this.btnBg.moveTo(bx + bw - cLen, by - 4).lineTo(bx + bw + 4, by - 4).lineTo(bx + bw + 4, by + cLen).stroke({ width: 2, color: COLORS.phosphorGreen, alpha: btnGlow * 0.8 });
    this.btnBg.moveTo(bx - 4, by + bh - cLen).lineTo(bx - 4, by + bh + 4).lineTo(bx + cLen, by + bh + 4).stroke({ width: 2, color: COLORS.phosphorGreen, alpha: btnGlow * 0.8 });
    this.btnBg.moveTo(bx + bw - cLen, by + bh + 4).lineTo(bx + bw + 4, by + bh + 4).lineTo(bx + bw + 4, by + bh - cLen).stroke({ width: 2, color: COLORS.phosphorGreen, alpha: btnGlow * 0.8 });

    // Button press white flash
    if (this.btnPressFeedback > 0) {
      this.btnBg.rect(this.btnX, this.btnY, this.btnW, this.btnH).fill({ color: 0xffffff, alpha: this.btnPressFeedback * 0.2 });
    }

    // Button sparks orbiting around perimeter
    for (const spark of this.btnSparks) {
      spark.angle += spark.speed * dt;
      // Map angle to perimeter position
      const perim = 2 * (this.btnW + this.btnH);
      const pos = ((spark.angle * 40) % perim + perim) % perim;
      let sx: number, sy: number;
      if (pos < this.btnW) {
        sx = this.btnX + pos; sy = this.btnY;
      } else if (pos < this.btnW + this.btnH) {
        sx = this.btnX + this.btnW; sy = this.btnY + (pos - this.btnW);
      } else if (pos < 2 * this.btnW + this.btnH) {
        sx = this.btnX + this.btnW - (pos - this.btnW - this.btnH); sy = this.btnY + this.btnH;
      } else {
        sx = this.btnX; sy = this.btnY + this.btnH - (pos - 2 * this.btnW - this.btnH);
      }
      const sparkAlpha = 0.4 + 0.3 * Math.sin(this.elapsed * 5 + spark.angle);
      this.btnBg.circle(sx, sy, 1.5).fill({ color: COLORS.phosphorGreen, alpha: sparkAlpha });
    }

    this.btnText.alpha = 0.7 + 0.3 * Math.sin(this.elapsed * 4);
    this.btnText.scale.set(pulseScale * hoverScale * pressScale);

    // Threat indicator
    this.drawThreatIndicator();

    // Radar sweep
    this.drawRadar();

    // CRT glitch effect (medium+ quality, not on mobile)
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

    // Scrolling grid
    this.gridOffset = (this.gridOffset + dt * 8) % 40;
    this.drawGrid();

    // Dust particles
    this.updateDust(dt);
  }

  resize(_w: number, _h: number): void {}

  private handleBegin = (): void => {
    this.btnPressFeedback = 1.0;
    const gm = getGameMode();
    startRun(gm.seed);
    trackMissionStart(gm.mode, getDailyNumberFromSeed(gm.seed ?? ''), gm.seed);
    this.sceneManager.switchTo('game');
  };

  private handlePointerMove = (e: any): void => {
    if (!this.stage) return;
    const local = this.stage.toLocal(e.global);
    this.pointerX = local.x;
    this.pointerY = local.y;
  };

  private drawFlag(): void {
    const g = this.flagGfx;
    g.clear();

    const shipSectionY = 205;
    const flagX = 100;
    const flagW = 80, flagH = 42;
    const stripeH = flagH / 13;

    for (let i = 0; i < 13; i++) {
      const isRed = i % 2 === 0;
      g.rect(flagX, shipSectionY + i * stripeH, flagW, stripeH)
        .fill({ color: isRed ? COLORS.red : 0xffffff, alpha: isRed ? 0.7 : 0.5 });
    }
    const cantonW = 32, cantonH = flagH * (7 / 13);
    g.rect(flagX, shipSectionY, cantonW, cantonH)
      .fill({ color: 0x3344aa, alpha: 0.8 });
    for (let row = 0; row < 4; row++) {
      const cols = row % 2 === 0 ? 4 : 3;
      const oX = row % 2 === 0 ? 0 : 3;
      for (let col = 0; col < cols; col++) {
        g.circle(flagX + 4 + oX + col * 7, shipSectionY + 4 + row * (cantonH / 4), 1)
          .fill({ color: 0xffffff, alpha: 0.9 });
      }
    }

    // Animated scanline overlay — scrolls downward
    this.flagScanOffset = (this.flagScanOffset + 0.5) % 4;
    for (let sl = this.flagScanOffset; sl < flagH; sl += 2) {
      g.moveTo(flagX, shipSectionY + sl)
        .lineTo(flagX + flagW, shipSectionY + sl)
        .stroke({ width: 0.5, color: 0x000000, alpha: 0.15 });
    }

    // Bright scan line sweep
    const scanY = (this.elapsed * 15) % flagH;
    g.moveTo(flagX, shipSectionY + scanY)
      .lineTo(flagX + flagW, shipSectionY + scanY)
      .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.15 });
  }

  private drawGrid(): void {
    const g = this.gridGraphics;
    g.clear();
    const gridSpacing = 40;
    for (let x = 0; x < GAME_WIDTH; x += gridSpacing) {
      g.moveTo(x, 0).lineTo(x, GAME_HEIGHT).stroke({ width: 0.5, color: COLORS.gridLine, alpha: 0.1 });
    }
    for (let y = -gridSpacing + this.gridOffset; y < GAME_HEIGHT + gridSpacing; y += gridSpacing) {
      g.moveTo(0, y).lineTo(GAME_WIDTH, y).stroke({ width: 0.5, color: COLORS.gridLine, alpha: 0.1 });
    }
  }

  private updateDust(dt: number): void {
    const g = this.dustGraphics;
    g.clear();
    for (const p of this.dustParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < 0) p.y += GAME_HEIGHT;
      if (p.x < 0) p.x += GAME_WIDTH;
      if (p.x > GAME_WIDTH) p.x -= GAME_WIDTH;
      const alpha = 0.05 + 0.05 * Math.sin(this.elapsed * 2 + p.phase);
      g.circle(p.x, p.y, 1).fill({ color: COLORS.phosphorGreen, alpha });
    }
  }

  private drawRadar(): void {
    if (isMobileDetected() || getQuality().particleMultiplier < 0.6) return;

    const g = this.radarGraphics;
    g.clear();

    const cx = GAME_WIDTH - 140;
    const cy = GAME_HEIGHT - 185;
    const r = 55;

    // Radar background circle
    g.circle(cx, cy, r).fill({ color: 0x001100, alpha: 0.5 });
    g.circle(cx, cy, r).stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.3 });
    // Range rings
    g.circle(cx, cy, r * 0.5).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.15 });
    // Crosshairs
    g.moveTo(cx - r, cy).lineTo(cx + r, cy).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.1 });
    g.moveTo(cx, cy - r).lineTo(cx, cy + r).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.1 });

    // Sweep line
    const sweepAngle = this.elapsed * Math.PI; // one revolution per 2s
    const sweepX = cx + Math.cos(sweepAngle) * r;
    const sweepY = cy + Math.sin(sweepAngle) * r;
    g.moveTo(cx, cy).lineTo(sweepX, sweepY).stroke({ width: 1.5, color: COLORS.phosphorGreen, alpha: 0.8 });

    // Sweep trail (fading arc)
    for (let i = 1; i <= 8; i++) {
      const trailAngle = sweepAngle - i * 0.08;
      const tx = cx + Math.cos(trailAngle) * r;
      const ty = cy + Math.sin(trailAngle) * r;
      g.moveTo(cx, cy).lineTo(tx, ty).stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.4 * (1 - i / 8) });
    }

    // Blips
    for (const blip of this.radarBlips) {
      const bx = cx + Math.cos(blip.angle) * blip.dist * r;
      const by = cy + Math.sin(blip.angle) * blip.dist * r;
      // Blip brightens when sweep passes near it
      const angleDiff = Math.abs(((sweepAngle % (Math.PI * 2)) - blip.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const brightness = angleDiff < 0.5 ? (1 - angleDiff / 0.5) : 0;
      const blipAlpha = 0.2 + 0.6 * brightness;
      g.circle(bx, by, 2).fill({ color: COLORS.phosphorGreen, alpha: blipAlpha });
      if (brightness > 0.5) {
        g.circle(bx, by, 4).fill({ color: COLORS.phosphorGreen, alpha: brightness * 0.15 });
      }
    }

    // Label
    g.moveTo(cx - r, cy - r - 6).lineTo(cx + r, cy - r - 6).stroke({ width: 0, color: 0x000000, alpha: 0 });
  }

  private drawThreatIndicator(): void {
    const g = this.threatGraphics;
    g.clear();

    const tx = 100;
    const ty = 205 + 198;
    const barW = 120;
    const barH = 8;

    // Calculate fill — flicker during calculation, then settle
    let fillRatio: number;
    const targetFill = 0.8; // HIGH threat
    if (this.elapsed < this.threatSettleTime) {
      // Flickering random values
      fillRatio = 0.1 + Math.random() * 0.9;
    } else {
      // Ease to target
      const settleT = Math.min(1, (this.elapsed - this.threatSettleTime) * 4);
      fillRatio = targetFill + (Math.random() - 0.5) * 0.02 * (1 - settleT);
    }

    // Bar background
    g.rect(tx, ty, barW, barH).fill({ color: 0x001100, alpha: 0.6 });
    g.rect(tx, ty, barW, barH).stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.3 });

    // Fill — color based on level
    const fillW = barW * fillRatio;
    const fillColor = fillRatio > 0.7 ? COLORS.red : fillRatio > 0.4 ? COLORS.amber : COLORS.phosphorGreen;
    g.rect(tx, ty, fillW, barH).fill({ color: fillColor, alpha: 0.7 });

    // Threat label
    if (this.elapsed >= this.threatSettleTime) {
      const label = fillRatio > 0.7 ? 'HIGH' : fillRatio > 0.4 ? 'MODERATE' : 'LOW';
      this.threatText.text = `THREAT LEVEL: ${'█'.repeat(Math.floor(fillRatio * 10))}${'░'.repeat(10 - Math.floor(fillRatio * 10))} ${label}`;
    } else {
      this.threatText.text = `THREAT LEVEL: ${'█'.repeat(Math.floor(fillRatio * 10))}${'░'.repeat(10 - Math.floor(fillRatio * 10))} CALCULATING...`;
    }
  }
}
