import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS, GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';
import { RunState, WORLD_WIDTH } from '@/core/run-state';
import { isMobileDevice } from '@/ui/mobile/MobileControls';
import { isMobileDetected } from '@/app/quality';

export class Hud extends Container {
  private scoreText: Text;
  private oilText: Text;
  private sectorText: Text;
  private timeText: Text;
  private comboText: Text;
  private progressGraphics: Graphics;
  private rapidFireText: Text;
  private shieldText: Text;
  private controlsText: Text;
  private speedText: Text;

  // Top-center weapon HUD
  private heatLabel: Text;
  private heatBarGraphics: Graphics;
  private missileLabel: Text;
  private missileIconGraphics: Graphics;
  private missileFiredAt: number = 0;
  private hullLabel: Text;
  private hullBarGraphics: Graphics;
  private oilPriceText: Text;
  private budgetText: Text;

  // Budget flash
  private prevBudget: number = 0;
  private budgetFlashTimer: number = 0;

  // Warning system
  private warningText: Text;
  private warningTimer: number = 0;

  // Oil price flash
  private prevOilPrice: number = 72;
  private oilFlashTimer: number = 0;
  private oilDeltaText: Text;

  // Accumulated animation timer (replaces per-frame Date.now() calls)
  private animTimer: number = 0;
  private animTimerMs: number = 0;

  // Dirty flags for graphics bar redraws
  private prevHeat: number = -1;
  private prevOverheated: boolean = false;
  private prevHpRatio: number = -1;
  private prevMissileCount: number = -1;
  private prevMaxMissiles: number = -1;
  private prevProgress: number = -1;

  constructor() {
    super();

    // Scale up fonts on mobile for readability (game canvas is 1280x720 but rendered small on phone screens)
    const m = isMobileDetected() ? 1.35 : 1.15;

    const style = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: Math.round(12 * m),
      fill: TEXT_COLORS.phosphorGreen,
    });

    // ─── TOP LEFT: Tertiary info ───
    this.scoreText = new Text({ text: 'SCORE: 00000000', style, resolution: TEXT_RESOLUTION });
    this.scoreText.position.set(20, 10);
    this.addChild(this.scoreText);

    this.sectorText = new Text({ text: 'SECTOR 1', style, resolution: TEXT_RESOLUTION });
    this.sectorText.position.set(20, 28);
    this.addChild(this.sectorText);

    this.timeText = new Text({ text: 'T+000s', style, resolution: TEXT_RESOLUTION });
    this.timeText.position.set(20, 46);
    this.addChild(this.timeText);

    this.speedText = new Text({ text: 'SPD: 0', style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: Math.round(10 * m), fill: TEXT_COLORS.cyan }), resolution: TEXT_RESOLUTION });
    this.speedText.position.set(20, 64);
    this.addChild(this.speedText);

    // ─── TOP CENTER: Big weapon HUD ───

    // HEAT label
    this.heatLabel = new Text({
      text: 'HEAT',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: Math.round(22 * m), fontWeight: 'bold', fill: TEXT_COLORS.red }),
      resolution: TEXT_RESOLUTION,
    });
    this.heatLabel.anchor.set(1, 0);
    this.heatLabel.position.set(GAME_WIDTH / 2 - 8, 8);
    this.addChild(this.heatLabel);

    // Heat bar (drawn as graphics)
    this.heatBarGraphics = new Graphics();
    this.heatBarGraphics.position.set(GAME_WIDTH / 2, 10);
    this.addChild(this.heatBarGraphics);

    // MSL label (hidden — icons are self-explanatory at larger size)
    this.missileLabel = new Text({
      text: 'MSL',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: Math.round(22 * m), fontWeight: 'bold', fill: TEXT_COLORS.red }),
      resolution: TEXT_RESOLUTION,
    });
    this.missileLabel.anchor.set(0.5, 0);
    this.missileLabel.position.set(GAME_WIDTH / 2 + 60, 34);
    this.missileLabel.visible = false;
    this.addChild(this.missileLabel);

    // Missile icons (below heat and hull bars)
    this.missileIconGraphics = new Graphics();
    this.missileIconGraphics.position.set(GAME_WIDTH / 2 - 8, 58);
    this.addChild(this.missileIconGraphics);

    // HULL label
    this.hullLabel = new Text({
      text: 'HULL',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: Math.round(22 * m), fontWeight: 'bold', fill: TEXT_COLORS.cyan }),
      resolution: TEXT_RESOLUTION,
    });
    this.hullLabel.anchor.set(1, 0);
    this.hullLabel.position.set(GAME_WIDTH / 2 - 8, 34);
    this.addChild(this.hullLabel);

    // Hull bar (drawn as graphics, same style as heat bar)
    this.hullBarGraphics = new Graphics();
    this.hullBarGraphics.position.set(GAME_WIDTH / 2, 36);
    this.addChild(this.hullBarGraphics);

    // ─── TOP RIGHT: Oil price & convoy ───
    this.oilPriceText = new Text({
      text: 'OIL: $72/bbl',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: Math.round(14 * m), fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
      resolution: TEXT_RESOLUTION,
    });
    this.oilPriceText.position.set(GAME_WIDTH - 340, 10);
    this.addChild(this.oilPriceText);

    this.oilText = new Text({ text: 'CONVOY: 3/3', style, resolution: TEXT_RESOLUTION });
    this.oilText.position.set(GAME_WIDTH - 340, 28);
    this.addChild(this.oilText);

    // Budget display
    this.budgetText = new Text({
      text: 'COST: $0',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: Math.round(12 * m), fill: TEXT_COLORS.phosphorGreen }),
      resolution: TEXT_RESOLUTION,
    });
    this.budgetText.position.set(GAME_WIDTH - 340, 46);
    this.addChild(this.budgetText);

    // Combo display
    this.comboText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: Math.round(16 * m), fontWeight: 'bold', fill: TEXT_COLORS.amber }),
      resolution: TEXT_RESOLUTION,
    });
    this.comboText.anchor.set(0.5, 0);
    this.comboText.position.set(GAME_WIDTH / 2, GAME_HEIGHT - 80);
    this.addChild(this.comboText);

    // Rapid fire indicator
    this.rapidFireText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: Math.round(14 * m), fontWeight: 'bold', fill: TEXT_COLORS.cyan }),
      resolution: TEXT_RESOLUTION,
    });
    this.rapidFireText.anchor.set(0.5, 0);
    this.rapidFireText.position.set(GAME_WIDTH / 2, GAME_HEIGHT - 60);
    this.addChild(this.rapidFireText);

    // Shield indicator
    this.shieldText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: Math.round(14 * m), fontWeight: 'bold', fill: '#8888ff' }),
      resolution: TEXT_RESOLUTION,
    });
    this.shieldText.anchor.set(0.5, 0);
    this.shieldText.position.set(GAME_WIDTH / 2, GAME_HEIGHT - 42);
    this.addChild(this.shieldText);

    // Warning text (upper-left, below existing HUD)
    this.warningText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: Math.round(14 * m), fontWeight: 'bold', fill: TEXT_COLORS.red }),
      resolution: TEXT_RESOLUTION,
    });
    this.warningText.position.set(20, 90);
    this.addChild(this.warningText);

    // Oil price delta indicator
    this.oilDeltaText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: Math.round(12 * m), fontWeight: 'bold', fill: TEXT_COLORS.red }),
      resolution: TEXT_RESOLUTION,
    });
    this.oilDeltaText.position.set(GAME_WIDTH - 230, 10);
    this.addChild(this.oilDeltaText);

    // Controls hint (bottom-left) — hidden on mobile (joysticks are self-explanatory)
    this.controlsText = new Text({
      text: 'WASD:MOVE  ARROWS/LMB:FIRE  SPACE/RMB:MISSILE  SHIFT/X:BOOST  R:RAM',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 9, fill: TEXT_COLORS.darkGreen }),
      resolution: TEXT_RESOLUTION,
    });
    this.controlsText.position.set(20, GAME_HEIGHT - 30);
    if (isMobileDevice()) this.controlsText.visible = false;
    this.addChild(this.controlsText);

    // Progress bar background
    this.progressGraphics = new Graphics();
    this.progressGraphics.position.set(GAME_WIDTH / 2 - 150, GAME_HEIGHT - 18);
    this.addChild(this.progressGraphics);
  }

  updateFromRun(run: RunState): void {
    // Advance animation timer (replaces all Date.now() calls)
    this.animTimer += 1 / 60;
    this.animTimerMs = this.animTimer * 1000;

    this.scoreText.text = `SCORE: ${String(run.score).padStart(8, '0')}`;

    const aliveTankers = run.totalConvoyTankers - run.tankersLost;
    this.oilText.text = `CONVOY: ${aliveTankers}/${run.totalConvoyTankers}  OIL: ${Math.round(run.oilFlow)}%`;

    // ─── TOP CENTER: Heat bar (dirty-flag: only redraw on change or during overheat flash) ───
    const heat = run.gunHeat;
    const heatQuantized = Math.round(heat * 100);
    if (heatQuantized !== this.prevHeat || run.gunOverheated !== this.prevOverheated || run.gunOverheated) {
      this.prevHeat = heatQuantized;
      this.prevOverheated = run.gunOverheated;

      const heatBarW = 120;
      const heatBarH = 18;
      const hg = this.heatBarGraphics;
      hg.clear();
      hg.rect(0, 0, heatBarW, heatBarH).stroke({ width: 1.5, color: COLORS.red, alpha: 0.7 });
      if (heat > 0) {
        hg.rect(2, 2, (heatBarW - 4) * heat, heatBarH - 4).fill({ color: COLORS.red, alpha: 0.85 });
      }
      if (run.gunOverheated) {
        const flashPhase = Math.sin(this.animTimerMs / 80);
        const isWhite = flashPhase > 0;
        const flashColor = isWhite ? COLORS.white : COLORS.red;
        const flashTextColor = isWhite ? TEXT_COLORS.white : TEXT_COLORS.red;
        this.heatLabel.text = 'OVERHEAT';
        this.heatLabel.style.fill = flashTextColor;
        this.heatLabel.alpha = 1;
        hg.rect(0, 0, heatBarW, heatBarH).stroke({ width: 1.5, color: flashColor, alpha: 0.9 });
        hg.rect(0, 0, heatBarW, heatBarH).fill({ color: flashColor, alpha: 0.35 });
      } else {
        this.heatLabel.alpha = 1;
        this.heatLabel.text = 'HEAT';
        this.heatLabel.style.fill = TEXT_COLORS.red;
      }
    }

    // ─── Missile icons (dirty-flag: only redraw on count change or low-ammo pulse) ───
    const mslFlashElapsed = (this.animTimerMs - this.missileFiredAt) / 1000;
    const needsMslRedraw = run.missileCount !== this.prevMissileCount
      || run.maxMissiles !== this.prevMaxMissiles
      || (run.missileCount <= 3 && run.missileCount > 0)
      || mslFlashElapsed < 0.5;

    if (needsMslRedraw) {
      this.prevMissileCount = run.missileCount;
      this.prevMaxMissiles = run.maxMissiles;

      let iconAlphaBoost = 0;
      if (mslFlashElapsed < 0.5) {
        iconAlphaBoost = (0.5 - mslFlashElapsed) * 0.4;
      }
      const ig = this.missileIconGraphics;
      ig.clear();
      const iconSpacing = 22;
      const maxIcons = Math.min(run.maxMissiles, 20);
      let iconPulseAlpha = 1;
      if (run.missileCount <= 3 && run.missileCount > 0) {
        iconPulseAlpha = 0.6 + Math.sin(this.animTimerMs / 150) * 0.4;
      } else if (run.missileCount === 0) {
        iconPulseAlpha = 0.4;
      }
      for (let i = 0; i < maxIcons; i++) {
        const ix = (i % 10) * iconSpacing;
        const iy = Math.floor(i / 10) * 18;
        if (i < run.missileCount) {
          const alpha = Math.min(1, 0.9 * iconPulseAlpha + iconAlphaBoost);
          ig.moveTo(ix, iy + 3).lineTo(ix + 14, iy + 7).lineTo(ix, iy + 11).closePath()
            .fill({ color: COLORS.red, alpha });
          ig.moveTo(ix, iy + 5).lineTo(ix - 5, iy + 2).lineTo(ix - 5, iy + 12).lineTo(ix, iy + 9)
            .fill({ color: COLORS.red, alpha: alpha * 0.55 });
        } else {
          ig.moveTo(ix, iy + 3).lineTo(ix + 14, iy + 7).lineTo(ix, iy + 11).closePath()
            .stroke({ width: 0.7, color: COLORS.red, alpha: 0.2 });
        }
      }
    }

    // ─── HULL bar (dirty-flag: only redraw on HP change or low-HP pulse) ───
    const hpRatio = run.playerHP / run.playerMaxHP;
    const hpQuantized = Math.round(hpRatio * 100);
    if (hpQuantized !== this.prevHpRatio || hpRatio <= 0.25) {
      this.prevHpRatio = hpQuantized;

      const hullBarW = 120;
      const hullBarH = 18;
      const hullG = this.hullBarGraphics;
      hullG.clear();

      let hullColor: number;
      if (hpRatio <= 0.25) hullColor = COLORS.red;
      else if (hpRatio <= 0.5) hullColor = COLORS.amber;
      else hullColor = COLORS.cyan;

      hullG.rect(0, 0, hullBarW, hullBarH).stroke({ width: 1.5, color: hullColor, alpha: 0.7 });
      if (hpRatio > 0) {
        hullG.rect(2, 2, (hullBarW - 4) * hpRatio, hullBarH - 4).fill({ color: hullColor, alpha: 0.85 });
      }

      if (hpRatio <= 0.25) {
        this.hullLabel.style.fill = TEXT_COLORS.red;
        this.hullLabel.alpha = 0.7 + Math.sin(this.animTimerMs / 120) * 0.3;
        const pulse = 0.5 + Math.sin(this.animTimerMs / 120) * 0.5;
        hullG.rect(0, 0, hullBarW, hullBarH).fill({ color: COLORS.red, alpha: pulse * 0.25 });
      } else if (hpRatio <= 0.5) {
        this.hullLabel.style.fill = TEXT_COLORS.amber;
        this.hullLabel.alpha = 1;
      } else {
        this.hullLabel.style.fill = TEXT_COLORS.cyan;
        this.hullLabel.alpha = 1;
      }
    }

    // Oil price display
    const price = Math.round(run.oilPrice);
    this.oilPriceText.text = `OIL: $${price}/bbl`;
    if (price <= 72) {
      this.oilPriceText.style.fill = TEXT_COLORS.phosphorGreen;
    } else if (price <= 90) {
      this.oilPriceText.style.fill = TEXT_COLORS.amber;
    } else {
      this.oilPriceText.style.fill = TEXT_COLORS.red;
    }

    // Budget display
    const budget = run.budget;
    let budgetStr: string;
    if (budget >= 1_000_000_000) {
      budgetStr = `$${(budget / 1_000_000_000).toFixed(1)}B`;
    } else if (budget >= 1_000_000) {
      budgetStr = `$${(budget / 1_000_000).toFixed(1)}M`;
    } else if (budget >= 1_000) {
      budgetStr = `$${(budget / 1_000).toFixed(0)}K`;
    } else {
      budgetStr = `$${budget}`;
    }
    this.budgetText.text = `COST: ${budgetStr}`;

    // Budget flash on increase
    if (budget > this.prevBudget) {
      this.budgetFlashTimer = 1.0;
    }
    this.prevBudget = budget;

    if (this.budgetFlashTimer > 0) {
      this.budgetFlashTimer -= 1 / 60;
      const flashPhase = Math.sin(this.animTimerMs / 80);
      this.budgetText.style.fill = flashPhase > 0 ? TEXT_COLORS.white : TEXT_COLORS.red;
      if (this.budgetFlashTimer <= 0) {
        this.budgetText.style.fill = budget >= 100_000_000 ? TEXT_COLORS.red : budget >= 10_000_000 ? TEXT_COLORS.amber : TEXT_COLORS.phosphorGreen;
      }
    } else {
      this.budgetText.style.fill = budget >= 100_000_000 ? TEXT_COLORS.red : budget >= 10_000_000 ? TEXT_COLORS.amber : TEXT_COLORS.phosphorGreen;
    }

    // Speed indicator
    const speedPct = Math.round(run.scrollSpeedMultiplier * 100);
    this.speedText.text = `SPD: ${speedPct}%`;

    const sector = Math.min(5, Math.floor(run.cameraX / (WORLD_WIDTH / 5)) + 1);
    this.sectorText.text = `SECTOR ${sector}`;
    this.timeText.text = `T+${String(Math.floor(run.missionTime)).padStart(3, '0')}s`;

    // Combo display with pulse effect
    if (run.comboMultiplier > 1) {
      this.comboText.text = `${run.comboCount}x COMBO! (${run.comboMultiplier}x SCORE)`;
      const comboPulse = 1 + Math.sin(this.animTimerMs / 150) * 0.03 * Math.min(run.comboMultiplier, 3);
      this.comboText.scale.set(comboPulse);
      this.comboText.alpha = 0.85 + Math.sin(this.animTimerMs / 200) * 0.1;
    } else {
      this.comboText.text = '';
      this.comboText.scale.set(1);
    }

    // Rapid fire indicator
    if (run.rapidFireActive) {
      this.rapidFireText.text = `RAPID FIRE ${Math.ceil(run.rapidFireTimer)}s`;
      this.rapidFireText.alpha = 1;
    } else {
      this.rapidFireText.text = '';
    }

    // Shield indicator
    if (run.shieldActive) {
      this.shieldText.text = `SHIELD ${Math.ceil(run.shieldTimer)}s`;
      this.shieldText.alpha = 0.7 + Math.sin(this.animTimerMs / 100) * 0.3;
    } else {
      this.shieldText.text = '';
    }

    // Warning text fade
    if (this.warningTimer > 0) {
      this.warningTimer -= 1 / 60;
      this.warningText.alpha = Math.min(1, this.warningTimer / 0.5) * (0.6 + Math.sin(this.animTimerMs / 100) * 0.4);
      if (this.warningTimer <= 0) {
        this.warningText.text = '';
      }
    }

    // Oil price flash detection
    const currentPrice = Math.round(run.oilPrice);
    if (currentPrice > this.prevOilPrice) {
      const delta = currentPrice - this.prevOilPrice;
      this.oilFlashTimer = 1.5;
      this.oilDeltaText.text = `+$${delta}`;
    }
    this.prevOilPrice = currentPrice;

    // Oil price flash effect
    if (this.oilFlashTimer > 0) {
      this.oilFlashTimer -= 1 / 60;
      const flashPhase = Math.sin(this.animTimerMs / 80);
      this.oilPriceText.style.fill = flashPhase > 0 ? TEXT_COLORS.white : TEXT_COLORS.red;
      const scale = 1 + Math.max(0, this.oilFlashTimer - 1.0) * 0.4;
      this.oilPriceText.scale.set(scale);
      this.oilDeltaText.alpha = Math.min(1, this.oilFlashTimer / 0.5);
      if (this.oilFlashTimer <= 0) {
        this.oilPriceText.scale.set(1);
        this.oilDeltaText.text = '';
      }
    }

    // Progress bar (dirty-flag: only redraw on visible change)
    const progress = run.cameraX / (WORLD_WIDTH - GAME_WIDTH);
    const progressQuantized = Math.round(progress * 1000);
    if (progressQuantized !== this.prevProgress) {
      this.prevProgress = progressQuantized;
      const g = this.progressGraphics;
      g.clear();
      const barW = 300;
      const barH = 6;
      g.rect(0, 0, barW, barH).stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.4 });
      g.rect(0, 0, barW * Math.min(1, progress), barH).fill({ color: COLORS.phosphorGreen, alpha: 0.6 });
      const dotX = barW * Math.min(1, progress);
      g.circle(dotX, barH / 2, 3).fill({ color: COLORS.cyan, alpha: 0.9 });
    }
  }

  flashMissileCount(): void {
    this.missileFiredAt = this.animTimerMs;
  }

  showWarning(text: string): void {
    this.warningText.text = `!! ${text} !!`;
    this.warningTimer = 3.0;
    this.warningText.alpha = 1;
  }
}
