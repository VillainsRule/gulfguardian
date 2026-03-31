import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, TEXT_COLORS, COLORS } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';
import { getRun } from '@/core/run-state';
import { GameLayers } from './game-types';

// ── Alert (typewriter encounter warnings) ──

export interface AlertState {
  text: Text | null;
  timer: number;
  fullText: string;
  charIndex: number;
  charTimer: number;
}

export function createAlertState(): AlertState {
  return { text: null, timer: 0, fullText: '', charIndex: 0, charTimer: 0 };
}

export function showAlert(state: AlertState, label: string, layers: GameLayers): void {
  if (state.text) layers.uiLayer.removeChild(state.text);
  state.fullText = `>> ${label} <<`;
  state.charIndex = 0;
  state.charTimer = 0;
  state.text = new Text({
    text: '',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
    resolution: TEXT_RESOLUTION,
  });
  state.text.anchor.set(0.5);
  state.text.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80);
  layers.uiLayer.addChild(state.text);
  state.timer = 3.0;
}

export function updateAlert(state: AlertState, dt: number, layers: GameLayers): void {
  if (state.timer <= 0) return;
  state.timer -= dt;
  if (state.text) {
    if (state.charIndex < state.fullText.length) {
      state.charTimer += dt;
      const charsPerSec = 30;
      while (state.charTimer > 1 / charsPerSec && state.charIndex < state.fullText.length) {
        state.charTimer -= 1 / charsPerSec;
        state.charIndex++;
        state.text.text = state.fullText.substring(0, state.charIndex);
      }
    }
    state.text.alpha = Math.min(1, state.timer / 0.5);
    if (state.timer <= 0) {
      layers.uiLayer.removeChild(state.text);
      state.text = null;
    }
  }
}

// ── Streak announcements ──

export interface StreakState {
  text: Text | null;
  timer: number;
}

export function createStreakState(): StreakState {
  return { text: null, timer: 0 };
}

export function showStreakAnnouncement(state: StreakState, label: string, layers: GameLayers): void {
  if (state.text) layers.uiLayer.removeChild(state.text);
  state.text = new Text({
    text: label,
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 32, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
    resolution: TEXT_RESOLUTION,
  });
  state.text.anchor.set(1, 0.5);
  state.text.position.set(GAME_WIDTH / 2 - 140, 28);
  layers.uiLayer.addChild(state.text);
  state.timer = 2.0;
}

export function updateStreakText(state: StreakState, dt: number, layers: GameLayers): void {
  if (state.timer <= 0 || !state.text) return;
  state.timer -= dt;
  const elapsed = 2.0 - state.timer;
  const scale = elapsed < 0.15 ? 0.5 + (elapsed / 0.15) * 1.0 : 1.5 - Math.min(0.5, (elapsed - 0.15) * 0.5);
  state.text.scale.set(scale);
  state.text.alpha = Math.min(1, state.timer / 0.4);
  if (state.timer <= 0) {
    layers.uiLayer.removeChild(state.text);
    state.text = null;
  }
}

// ── MSL AWAY flash ──

export interface MslAwayState {
  text: Text | null;
  timer: number;
}

export function createMslAwayState(): MslAwayState {
  return { text: null, timer: 0 };
}

export function showMslAway(state: MslAwayState, layers: GameLayers): void {
  if (state.text) layers.uiLayer.removeChild(state.text);
  state.text = new Text({
    text: 'MSL AWAY',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
    resolution: TEXT_RESOLUTION,
  });
  state.text.position.set(130, 44);
  layers.uiLayer.addChild(state.text);
  state.timer = 1.0;
}

export function updateMslAway(state: MslAwayState, dt: number, layers: GameLayers): void {
  if (state.timer <= 0) return;
  state.timer -= dt;
  if (state.text) {
    state.text.alpha = Math.min(1, state.timer / 0.3);
    if (state.timer <= 0) {
      layers.uiLayer.removeChild(state.text);
      state.text = null;
    }
  }
}

// ── Game Over overlay ──

export function createGameOverOverlay(run: ReturnType<typeof getRun>, title: string = 'GAME OVER'): Container {
  const container = new Container();

  const gameOverStyle = new TextStyle({
    fontFamily: FONT_FAMILY, fontSize: 72, fontWeight: 'bold', fill: TEXT_COLORS.red,
    dropShadow: { color: '#000000', distance: 4 },
  });

  // Child 0: dark overlay background
  const overlay = new Graphics();
  overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.6 });
  container.addChild(overlay);

  // Child 1: glow graphics (drawn behind text)
  const glowGraphics = new Graphics();
  container.addChild(glowGraphics);

  // Child 2: GAME OVER text
  const gameOverText = new Text({
    text: title,
    style: gameOverStyle,
    resolution: TEXT_RESOLUTION,
  });
  gameOverText.anchor.set(0.5);
  gameOverText.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);
  gameOverText.scale.set(0);
  gameOverText.alpha = 0;
  container.addChild(gameOverText);

  // Child 3: cost text
  const budget = run.budget;
  let budgetStr: string;
  if (budget >= 1_000_000_000) budgetStr = `$${(budget / 1_000_000_000).toFixed(1)}B`;
  else if (budget >= 1_000_000) budgetStr = `$${(budget / 1_000_000).toFixed(1)}M`;
  else budgetStr = `$${budget.toLocaleString()}`;

  const costText = new Text({
    text: `TOTAL COST: ${budgetStr}`,
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
    resolution: TEXT_RESOLUTION,
  });
  costText.anchor.set(0.5);
  costText.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
  costText.alpha = 0;
  container.addChild(costText);

  // Child 4: white flash overlay
  const flashOverlay = new Graphics();
  flashOverlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0xffffff, alpha: 1 });
  flashOverlay.alpha = 0;
  container.addChild(flashOverlay);

  // Child 5: scanline graphics
  const scanlineGraphics = new Graphics();
  container.addChild(scanlineGraphics);

  // Child 6: red chromatic aberration text
  const redText = new Text({
    text: title,
    style: new TextStyle({ ...gameOverStyle, fill: '#ff0000', dropShadow: undefined }),
    resolution: TEXT_RESOLUTION,
  });
  redText.anchor.set(0.5);
  redText.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);
  redText.scale.set(0);
  redText.alpha = 0;
  container.addChild(redText);

  // Child 7: cyan chromatic aberration text
  const cyanText = new Text({
    text: title,
    style: new TextStyle({ ...gameOverStyle, fill: '#00ffff', dropShadow: undefined }),
    resolution: TEXT_RESOLUTION,
  });
  cyanText.anchor.set(0.5);
  cyanText.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);
  cyanText.scale.set(0);
  cyanText.alpha = 0;
  container.addChild(cyanText);

  // Store start time for animation
  (container as any)._gameOverStart = Date.now();

  return container;
}

export function updateGameOverOverlay(container: Container): void {
  const elapsed = (Date.now() - (container as any)._gameOverStart) / 1000;

  const overlay = container.getChildAt(0) as Graphics;
  const glowGraphics = container.getChildAt(1) as Graphics;
  const gameOverText = container.getChildAt(2) as Text;
  const costText = container.getChildAt(3) as Text;
  const flashOverlay = container.getChildAt(4) as Graphics;
  const scanlineGraphics = container.getChildAt(5) as Graphics;
  const redText = container.getChildAt(6) as Text;
  const cyanText = container.getChildAt(7) as Text;

  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2 - 30;

  // Phase 1: Slam In (0 - 0.8s)
  const slamEnd = 0.8;
  // Phase 2: Hold & Pulse (0.8 - 3.0s)
  const holdEnd = 3.0;
  // Phase 3: Expand Into Face (3.0s+)
  const expandDuration = 3.0;

  if (elapsed < slamEnd) {
    // Slam in with easeOutBack
    const t = elapsed / slamEnd;
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);

    // Scale: overshoot to 1.4 then settle
    const scale = eased * 1.4;
    gameOverText.scale.set(scale);
    gameOverText.alpha = Math.min(1, t * 4);

    // Screen shake jitter on text position
    const shakeIntensity = 8 * (1 - t);
    const shakeX = (Math.random() - 0.5) * shakeIntensity;
    const shakeY = (Math.random() - 0.5) * shakeIntensity;
    gameOverText.position.set(cx + shakeX, cy + shakeY);

    // Chromatic aberration — spread out then converge
    const aberrationSpread = 6 * (1 - t);
    redText.scale.set(scale);
    redText.alpha = Math.min(0.4, t * 2) * (1 - t * 0.5);
    redText.position.set(cx + shakeX - aberrationSpread, cy + shakeY);
    cyanText.scale.set(scale);
    cyanText.alpha = Math.min(0.4, t * 2) * (1 - t * 0.5);
    cyanText.position.set(cx + shakeX + aberrationSpread, cy + shakeY);

    // White screen flash: bright at start, fading
    flashOverlay.alpha = Math.max(0, (1 - t * 1.5) * 0.9);

    // Scanline bars sweeping during slam
    scanlineGraphics.clear();
    const numScanlines = 6;
    for (let i = 0; i < numScanlines; i++) {
      const sy = ((elapsed * 800 + i * 120) % GAME_HEIGHT);
      const scanAlpha = 0.15 * (1 - t);
      scanlineGraphics.rect(0, sy, GAME_WIDTH, 2).fill({ color: 0xff0000, alpha: scanAlpha });
    }

    // Multi-layered glow behind text
    glowGraphics.clear();
    const glowR = 120 * eased;
    glowGraphics.circle(cx, cy, glowR * 1.2).fill({ color: 0xff4400, alpha: 0.08 * (1 - t) });
    glowGraphics.circle(cx, cy, glowR).fill({ color: 0xff0000, alpha: 0.15 * (1 - t) });
    glowGraphics.circle(cx, cy, glowR * 0.6).fill({ color: 0xff3333, alpha: 0.2 * (1 - t) });
    glowGraphics.circle(cx, cy, glowR * 0.3).fill({ color: 0xff6600, alpha: 0.12 * (1 - t) });

    // Darken overlay
    overlay.clear();
    overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.3 + 0.3 * t });

    costText.alpha = 0;
  } else if (elapsed < holdEnd) {
    // Hold & pulse phase
    const t = (elapsed - slamEnd) / (holdEnd - slamEnd);

    // Settle scale from 1.4 to 1.0 in first 0.3s of this phase, then pulse
    const settleT = Math.min(1, t * 3);
    const eased = settleT * settleT * (3 - 2 * settleT); // smoothstep
    const baseScale = 1.4 - 0.4 * eased;
    // Hold steady for first 1.5s of this phase, then gentle pulse
    const holdT = (elapsed - slamEnd);
    const pulse = holdT < 1.5 ? 0 : Math.sin(elapsed * 4) * 0.05;
    gameOverText.scale.set(baseScale + pulse);
    gameOverText.alpha = holdT < 1.5 ? 1.0 : 0.85 + Math.sin(elapsed * 5) * 0.15;
    gameOverText.position.set(cx, cy);

    // Subtle chromatic jitter during hold
    const jitter = Math.sin(elapsed * 12) * 1.5;
    redText.scale.set(baseScale + pulse);
    redText.alpha = 0.12 + Math.sin(elapsed * 6) * 0.06;
    redText.position.set(cx - 2 + jitter * 0.3, cy);
    cyanText.scale.set(baseScale + pulse);
    cyanText.alpha = 0.12 + Math.sin(elapsed * 6 + 1) * 0.06;
    cyanText.position.set(cx + 2 - jitter * 0.3, cy);

    flashOverlay.alpha = 0;

    // Scanlines fade out
    scanlineGraphics.clear();
    if (t < 0.3) {
      const scanFade = 1 - t / 0.3;
      for (let i = 0; i < 4; i++) {
        const sy = ((elapsed * 400 + i * 180) % GAME_HEIGHT);
        scanlineGraphics.rect(0, sy, GAME_WIDTH, 1).fill({ color: 0xff0000, alpha: 0.06 * scanFade });
      }
    }

    // Multi-layered pulsing glow
    glowGraphics.clear();
    const glowPulse = 0.5 + 0.5 * Math.sin(elapsed * 3);
    const glowR = 150 + 30 * glowPulse;
    glowGraphics.circle(cx, cy, glowR * 1.3).fill({ color: 0xff2200, alpha: 0.04 + 0.03 * glowPulse });
    glowGraphics.circle(cx, cy, glowR).fill({ color: 0xff0000, alpha: 0.08 + 0.06 * glowPulse });
    glowGraphics.circle(cx, cy, glowR * 0.5).fill({ color: 0xff3333, alpha: 0.1 + 0.05 * glowPulse });
    glowGraphics.circle(cx, cy, glowR * 0.25).fill({ color: 0xff6600, alpha: 0.06 + 0.04 * glowPulse });

    // Gradually darken overlay
    overlay.clear();
    overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.6 + 0.15 * t });

    // Cost text fades in after 0.5s into this phase
    const costT = Math.max(0, (t - 0.2) / 0.3);
    costText.alpha = Math.min(1, costT);
    costText.scale.set(1);
  } else {
    // Phase 3: Expand into face with rotation
    const t = Math.min(1, (elapsed - holdEnd) / expandDuration);
    // Ease in cubic for smoother accelerating growth
    const eased = t * t * t;

    const scale = 1.0 + eased * 5.0;
    const rotation = eased * 0.15;
    gameOverText.scale.set(scale);
    gameOverText.alpha = Math.max(0, 1.0 - eased * 0.6);
    gameOverText.rotation = rotation;
    gameOverText.position.set(cx, cy);

    // Chromatic copies expand with main text
    redText.scale.set(scale);
    redText.alpha = Math.max(0, 0.15 * (1 - eased));
    redText.position.set(cx - 3 * scale, cy);
    redText.rotation = rotation;
    cyanText.scale.set(scale);
    cyanText.alpha = Math.max(0, 0.15 * (1 - eased));
    cyanText.position.set(cx + 3 * scale, cy);
    cyanText.rotation = rotation;

    // Cost text scales with main text but fades faster
    costText.scale.set(1.0 + eased * 3.0);
    costText.alpha = Math.max(0, 1.0 - eased * 1.5);
    costText.rotation = rotation * 0.5;

    flashOverlay.alpha = 0;
    scanlineGraphics.clear();

    // Glow expands
    glowGraphics.clear();
    const glowR = 180 + eased * 400;
    glowGraphics.circle(cx, cy, glowR).fill({ color: 0xff0000, alpha: 0.1 * (1 - eased) });
    glowGraphics.circle(cx, cy, glowR * 0.6).fill({ color: 0xff4400, alpha: 0.06 * (1 - eased) });

    // Overlay goes to full black
    overlay.clear();
    overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.75 + 0.25 * eased });
  }
}

// ── News Ticker ──

const TICKER_MESSAGES = [
  'CENTCOM REPORTS ALL CLEAR IN SECTOR 7-ALPHA',
  'USS MASON COMPLETES REPLENISHMENT AT SEA',
  'FIFTH FLEET OPS NORMAL - READINESS LEVEL BRAVO',
  'NAVCENT ADVISORY: INCREASED FAST BOAT ACTIVITY IN AO',
  'SIGINT INTERCEPT: HOSTILE COMMS ON ENCRYPTED CHANNEL',
  'COMDESRON 50 CONFIRMS FREEDOM OF NAVIGATION OPS UNDERWAY',
  'CTF-152 PATROL REPORTS NEGATIVE HOSTILE CONTACTS',
  'MARITIME SECURITY OPS: ZONE 4 SECURE',
  'NCIS BRIEF: THREAT POSTURE ELEVATED IN STRAIT',
  'MH-60R SEAHAWK ON STATION - ASW SWEEP COMPLETE',
  'LOGCOM: FUEL RESERVES AT 87% - ALL STATIONS GREEN',
  'JOINT TASK FORCE ISSUES OPORD 2247',
  'EW SECTION: ELECTRONIC COUNTERMEASURES ACTIVE',
  'INTEL UPDATE: MINING THREAT ASSESSED MODERATE',
  'USS STOUT REPORTS WEAPONS SYSTEMS NOMINAL',
  'COAST GUARD SECTOR BAHRAIN: SMALL CRAFT ADVISORY',
  'CJTF-OIR CONFIRMS AIR SUPPORT ON STANDBY',
  'DESRON REPORTS MATERIAL CONDITION ZEBRA SET',
  'SATCOM LINK ESTABLISHED - BANDWIDTH NOMINAL',
  'UNREP SCHEDULED 0600Z WITH USNS SUPPLY',
  'METOC FORECAST: SEA STATE 2 - WINDS NW 12KT - VISIBILITY GOOD',
  'P-8A POSEIDON COMPLETING MARITIME PATROL SECTOR 3-BRAVO',
  'SONAR: SUBSURFACE CONTACT CLASSIFIED BIOLOGIC',
  'USS NITZE ASSUMES PLANE GUARD STATION',
  'VBSS TEAM STANDING BY FOR BOARDING OPS',
  'CTG-56.1: MINE COUNTERMEASURES OPS IN PROGRESS',
  'NAVCENT WEATHER: SANDSTORM WARNING EASTERN AO',
  'COMFIFTHFLT: FORCE PROTECTION LEVEL CHARLIE',
  'DAMAGE CONTROL TRAINING EXERCISE COMPLETE - ALL HANDS',
  'ELINT DETECTION: SURFACE SEARCH RADAR BEARING 045',
  'USS COLE DDG-67 INBOUND TO RELIEVE ON STATION',
  'HARBOR PILOT EMBARKED - CHANNEL TRANSIT COMMENCING',
  'COMMS CHECK: ALL GUARD FREQUENCIES CLEAR',
  'AIRBOSS REPORTS FLIGHT OPS SECURED FOR EVENING',
  'SUPPLY DEPT: FRESH WATER RESERVES AT 94%',
  'CTF-150: COUNTER-NARCOTICS INTERDICTION UNDERWAY',
  'MERCHANT VESSEL TRACKING: 47 CONTACTS IN STRAIT',
  'NSWC: SPECIAL OPERATIONS TEAM INSERTION COMPLETE',
  'FIRE CONTROLMAN REPORTS ALL SYSTEMS CALIBRATED',
  'BAHRAIN PORT AUTH: ANCHORAGE ALPHA RESTRICTED',
];

export interface TickerState {
  container: Container;
  text: Text;
  scrollX: number;
}

export function createNewsTicker(): TickerState {
  const messages = [...TICKER_MESSAGES].sort(() => Math.random() - 0.5);
  const container = new Container();

  const tickerBg = new Graphics();
  tickerBg.rect(0, GAME_HEIGHT - 22, GAME_WIDTH, 20).fill({ color: COLORS.bgBlack, alpha: 0.7 });
  tickerBg.moveTo(0, GAME_HEIGHT - 22).lineTo(GAME_WIDTH, GAME_HEIGHT - 22)
    .stroke({ width: 0.5, color: COLORS.phosphorGreen, alpha: 0.3 });
  container.addChild(tickerBg);

  const fullStr = messages.map(m => `  ///  ${m}`).join('');
  const text = new Text({
    text: fullStr,
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: TEXT_COLORS.dimGreen }),
    resolution: TEXT_RESOLUTION,
  });
  text.position.set(GAME_WIDTH, GAME_HEIGHT - 20);
  container.addChild(text);

  const tickerMask = new Graphics();
  tickerMask.rect(0, GAME_HEIGHT - 23, GAME_WIDTH, 22).fill({ color: 0xffffff });
  container.addChild(tickerMask);
  container.mask = tickerMask;

  return { container, text, scrollX: GAME_WIDTH };
}

export function updateNewsTicker(state: TickerState, dt: number): void {
  state.scrollX -= 80 * dt;
  state.text.position.x = state.scrollX;
  if (state.scrollX < -state.text.width) {
    state.scrollX = GAME_WIDTH;
  }
}

// ── Hints overlay ──

export function createHintsOverlay(): Container {
  const container = new Container();
  const hintW = 340, hintH = 260;
  const hintX = GAME_WIDTH / 2 - hintW / 2;
  const hintY = GAME_HEIGHT / 2 - hintH / 2;


  const titleStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 18, fontWeight: 'bold', fill: TEXT_COLORS.cyan });
  const hintTitle = new Text({ text: 'CONTROLS', style: titleStyle, resolution: TEXT_RESOLUTION });
  hintTitle.anchor.set(0.5, 0);
  hintTitle.position.set(GAME_WIDTH / 2, hintY + 16);
  container.addChild(hintTitle);

  const lineStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: TEXT_COLORS.phosphorGreen });
  const keyStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 'bold', fill: TEXT_COLORS.cyan });
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hints = isMobile
    ? [
        ['LEFT STICK', 'Move ship'],
        ['RIGHT STICK', 'Fire guns'],
        ['MSL BUTTON', 'Launch missile'],
      ]
    : [
        ['W A S D', 'Move ship'],
        ['ARROWS / LMB', 'Fire guns'],
        ['SPACE / RMB', 'Launch missile'],
      ];
  for (let i = 0; i < hints.length; i++) {
    const keyText = new Text({ text: hints[i][0], style: keyStyle, resolution: TEXT_RESOLUTION });
    keyText.position.set(hintX + 30, hintY + 50 + i * 32);
    container.addChild(keyText);
    const descText = new Text({ text: hints[i][1], style: lineStyle, resolution: TEXT_RESOLUTION });
    descText.position.set(hintX + 160, hintY + 50 + i * 32);
    container.addChild(descText);
  }

  return container;
}

// ── Flag overlay ──

export function createFlagOverlay(run: ReturnType<typeof getRun>): Container {
  const container = new Container();
  container.scale.set(0.65);
  const flagW = 300, flagH = 200;
  const flagX = GAME_WIDTH / 2 - flagW / 2;
  const flagY = 80;
  container.position.set(0, 0);

  const flagBg = new Graphics();
  flagBg.roundRect(flagX - 10, flagY - 10, flagW + 20, flagH + 20, 4)
    .fill({ color: COLORS.bgBlack, alpha: 0.85 });
  flagBg.roundRect(flagX - 10, flagY - 10, flagW + 20, flagH + 20, 4)
    .stroke({ width: 1, color: COLORS.cyan, alpha: 0.4 });
  container.addChild(flagBg);

  const flagGfx = new Graphics();
  const stripeH = 80 / 13;
  for (let i = 0; i < 13; i++) {
    const isRed = i % 2 === 0;
    flagGfx.rect(flagX + 20, flagY + 10 + i * stripeH, 200, stripeH)
      .fill({ color: isRed ? COLORS.red : 0xffffff, alpha: isRed ? 0.7 : 0.5 });
  }
  const cantonW = 80, cantonH = 80 * (7 / 13);
  flagGfx.rect(flagX + 20, flagY + 10, cantonW, cantonH)
    .fill({ color: 0x3344aa, alpha: 0.8 });
  for (let row = 0; row < 5; row++) {
    const cols = row % 2 === 0 ? 6 : 5;
    const offsetX = row % 2 === 0 ? 0 : 6;
    for (let col = 0; col < cols; col++) {
      const sx = flagX + 26 + offsetX + col * 13;
      const sy = flagY + 16 + row * (cantonH / 5);
      flagGfx.circle(sx, sy, 1.5).fill({ color: 0xffffff, alpha: 0.9 });
    }
  }
  for (let sl = 0; sl < 80; sl += 2) {
    flagGfx.moveTo(flagX + 20, flagY + 10 + sl)
      .lineTo(flagX + 220, flagY + 10 + sl)
      .stroke({ width: 0.5, color: 0x000000, alpha: 0.15 });
  }
  container.addChild(flagGfx);

  const shipNameText = new Text({
    text: 'USS GUARDIAN  DDG-117',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: 'bold', fill: TEXT_COLORS.cyan }),
    resolution: TEXT_RESOLUTION,
  });
  shipNameText.anchor.set(0.5, 0);
  shipNameText.position.set(GAME_WIDTH / 2, flagY + 100);
  container.addChild(shipNameText);

  const shipClassText = new Text({
    text: 'ARLEIGH BURKE-CLASS DESTROYER',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: TEXT_COLORS.phosphorGreen }),
    resolution: TEXT_RESOLUTION,
  });
  shipClassText.anchor.set(0.5, 0);
  shipClassText.position.set(GAME_WIDTH / 2, flagY + 122);
  container.addChild(shipClassText);

  const shipStatsText = new Text({
    text: `HULL: ${run.playerHP}/${run.playerMaxHP}  |  MISSILES: ${run.missileCount}  |  SPEED: 35 KTS`,
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: TEXT_COLORS.amber }),
    resolution: TEXT_RESOLUTION,
  });
  shipStatsText.anchor.set(0.5, 0);
  shipStatsText.position.set(GAME_WIDTH / 2, flagY + 142);
  container.addChild(shipStatsText);

  const armamentText = new Text({
    text: 'MK-45 5"/54 GUN  |  RGM-84 HARPOON  |  PHALANX CIWS',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: TEXT_COLORS.phosphorGreen }),
    resolution: TEXT_RESOLUTION,
  });
  armamentText.anchor.set(0.5, 0);
  armamentText.position.set(GAME_WIDTH / 2, flagY + 160);
  container.addChild(armamentText);

  return container;
}
