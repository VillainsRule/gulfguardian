import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { getCallsign } from '@/social/player-identity';

// ─── Types ───

export interface StaggeredElement {
  el: Text;
  targetX: number;
  delay: number;
  flashTimer: number;
  originalFill: string;
}

export interface DebriefStatsState {
  outcomeText: Text;
  outcomeSlamDuration: number;
  scoreText: Text;
  rankText: Text;
  rankGrade: string;
  rankColor: string;
  oilPriceText: Text;
  oilPriceColor: string;
  statsElements: StaggeredElement[];
  editCallsignRect: { x: number; y: number; w: number; h: number };
  editCallsignText: Text;
}

/** Run data needed to build the stats panel. */
export interface DebriefRunData {
  score: number;
  oilPrice: number;
  tankersSaved: number;
  totalConvoyTankers: number;
  tankersLost: number;
  enemiesDestroyed: number;
  bestCombo: number;
  missionTime: number;
  wave: number;
  budget: number;
}

// ─── Stats panel creation ───

/** Create all stats panel UI elements (title, outcome, score, stat lines, rank, budget, oil price, callsign). */
export function createStatsPanel(
  panelContainer: Container,
  run: DebriefRunData,
  isVictory: boolean,
  isDaily: boolean,
  dailyNumber: number | null,
  challengeScoreToBeat: number | null,
): DebriefStatsState {
  // Panel background
  const panelBg = new Graphics();
  panelBg.rect(60, 60, GAME_WIDTH - 120, GAME_HEIGHT - 120).fill({ color: COLORS.panelBg, alpha: 0.7 });
  panelBg.rect(60, 60, GAME_WIDTH - 120, GAME_HEIGHT - 120).stroke({ width: 2, color: COLORS.phosphorGreen, alpha: 0.7 });
  panelContainer.addChild(panelBg);

  // Title
  let titleLabel = 'POST-MISSION ANALYSIS';
  if (isDaily && dailyNumber !== null) {
    titleLabel = `DAILY #${dailyNumber} — POST-MISSION ANALYSIS`;
  } else if (challengeScoreToBeat !== null) {
    const beat = run.score > challengeScoreToBeat;
    titleLabel = beat ? 'CHALLENGE BEATEN!' : 'CHALLENGE — POST-MISSION ANALYSIS';
  }
  const titleText = new Text({
    text: titleLabel,
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: isDaily || challengeScoreToBeat !== null ? 20 : 24, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
  });
  titleText.position.set(GAME_WIDTH / 2, 80);
  titleText.anchor.set(0.5, 0);
  panelContainer.addChild(titleText);

  // Outcome text — starts large for slam-in
  const outcomeColor = isVictory ? TEXT_COLORS.phosphorGreen : TEXT_COLORS.red;
  const outcomeLabel = isVictory ? 'CONVOY DELIVERED - MISSION SUCCESS' : 'MISSION FAILED';
  const outcomeText = new Text({
    text: outcomeLabel,
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 18, fontWeight: 'bold', fill: outcomeColor }),
  });
  outcomeText.anchor.set(0.5, 0.5);
  outcomeText.position.set(GAME_WIDTH / 2, 140);
  outcomeText.scale.set(2.5);
  outcomeText.alpha = 0;
  panelContainer.addChild(outcomeText);

  // Score (starts at 00000000)
  const scoreText = new Text({
    text: 'FINAL SCORE: 00000000',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 16, fill: TEXT_COLORS.cyan }),
  });
  scoreText.position.set(100, 170);
  scoreText.alpha = 0;
  panelContainer.addChild(scoreText);

  // Performance rank
  let rankGrade: string;
  let rankColor: string;
  if (run.score >= 50000) { rankGrade = 'S'; rankColor = TEXT_COLORS.cyan; }
  else if (run.score >= 30000) { rankGrade = 'A'; rankColor = TEXT_COLORS.phosphorGreen; }
  else if (run.score >= 15000) { rankGrade = 'B'; rankColor = TEXT_COLORS.phosphorGreen; }
  else if (run.score >= 5000) { rankGrade = 'C'; rankColor = TEXT_COLORS.amber; }
  else if (run.score >= 1000) { rankGrade = 'D'; rankColor = TEXT_COLORS.amber; }
  else { rankGrade = 'F'; rankColor = TEXT_COLORS.red; }

  const rankText = new Text({
    text: rankGrade,
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 48, fontWeight: 'bold', fill: rankColor }),
  });
  rankText.anchor.set(0.5);
  rankText.position.set(GAME_WIDTH - 160, 185);
  rankText.scale.set(3.0);
  rankText.alpha = 0;
  panelContainer.addChild(rankText);

  // Staggered stats
  const statsElements: StaggeredElement[] = [];
  const convoyResult = `${run.tankersSaved}/${run.totalConvoyTankers} tankers delivered`;
  const statLines: Array<{ content: string; delay: number; y: number; style: TextStyle }> = [
    { content: 'STATISTICS:', delay: 0.5, y: 220, style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 'bold', fill: TEXT_COLORS.amber }) },
    { content: `Convoy: ${convoyResult}  |  Tankers Lost: ${run.tankersLost}`, delay: 0.7, y: 250, style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: TEXT_COLORS.phosphorGreen }) },
    { content: `Enemies Destroyed: ${run.enemiesDestroyed}  |  Best Combo: ${run.bestCombo}x`, delay: 0.9, y: 275, style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: TEXT_COLORS.phosphorGreen }) },
    { content: `Mission Time: ${Math.floor(run.missionTime)}s  |  Sectors Cleared: ${run.wave}/5`, delay: 1.1, y: 300, style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: TEXT_COLORS.phosphorGreen }) },
  ];

  for (const stat of statLines) {
    const text = new Text({ text: stat.content, style: stat.style });
    text.position.set(100 - 20, stat.y);
    text.alpha = 0;
    panelContainer.addChild(text);
    statsElements.push({ el: text, targetX: 100, delay: stat.delay, flashTimer: 0, originalFill: stat.style.fill as string });
  }

  // Military Budget
  const budget = run.budget;
  let budgetStr: string;
  if (budget >= 1_000_000_000) budgetStr = `$${(budget / 1_000_000_000).toFixed(1)}B`;
  else if (budget >= 1_000_000) budgetStr = `$${(budget / 1_000_000).toFixed(1)}M`;
  else budgetStr = `$${budget.toLocaleString()}`;

  const budgetText = new Text({
    text: `MILITARY BUDGET: ${budgetStr}`,
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
  });
  budgetText.position.set(100 - 20, 330);
  budgetText.alpha = 0;
  panelContainer.addChild(budgetText);
  statsElements.push({ el: budgetText, targetX: 100, delay: 1.3, flashTimer: 0, originalFill: TEXT_COLORS.amber });

  // Oil price
  const oilPriceColor = run.oilPrice <= 72 ? TEXT_COLORS.phosphorGreen : run.oilPrice <= 90 ? TEXT_COLORS.amber : TEXT_COLORS.red;
  const oilPriceText = new Text({
    text: `OIL PRICE: $72/bbl`,
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: 'bold', fill: oilPriceColor }),
  });
  oilPriceText.position.set(100 - 20, 360);
  oilPriceText.alpha = 0;
  panelContainer.addChild(oilPriceText);
  statsElements.push({ el: oilPriceText, targetX: 100, delay: 1.5, flashTimer: 0, originalFill: oilPriceColor });

  // Callsign
  const callsign = getCallsign();
  const callsignText = new Text({
    text: `PILOT: ${callsign}`,
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: TEXT_COLORS.dimGreen }),
  });
  callsignText.position.set(100 - 20, 390);
  callsignText.alpha = 0;
  panelContainer.addChild(callsignText);
  statsElements.push({ el: callsignText, targetX: 100, delay: 1.7, flashTimer: 0, originalFill: TEXT_COLORS.dimGreen });

  // Edit callsign button
  const editCallsignText = new Text({
    text: '[ EDIT ]',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: TEXT_COLORS.cyan }),
  });
  editCallsignText.position.set(310, 392);
  editCallsignText.alpha = 0;
  panelContainer.addChild(editCallsignText);
  const editCallsignRect = { x: 305, y: 388, w: 55, h: 18 };

  // Fade in the edit button along with callsign
  statsElements.push({ el: editCallsignText, targetX: 310, delay: 1.7, flashTimer: 0, originalFill: TEXT_COLORS.cyan });

  return {
    outcomeText,
    outcomeSlamDuration: 0.4,
    scoreText,
    rankText,
    rankGrade,
    rankColor,
    oilPriceText,
    oilPriceColor,
    statsElements,
    editCallsignRect,
    editCallsignText,
  };
}

// ─── Animation update functions ───

/** Animate the outcome text slam-in (scale 2.5 → 1.0 with overshoot). */
export function updateOutcomeSlam(outcomeText: Text, elapsed: number, slamDuration: number): void {
  if (elapsed < slamDuration) {
    const t = elapsed / slamDuration;
    let scale: number;
    if (t < 0.6) {
      const st = t / 0.6;
      scale = 2.5 - 1.6 * st * (2 - st);
    } else {
      const bt = (t - 0.6) / 0.4;
      scale = 0.9 + 0.1 * bt * (2 - bt);
    }
    outcomeText.scale.set(scale);
    outcomeText.alpha = Math.min(1, t * 3);
  } else {
    outcomeText.scale.set(1);
    outcomeText.alpha = 1;
  }
}

/** Animate score counting up. Returns the new scoreDisplay value. */
export function updateScoreCounting(
  elapsed: number, scoreDisplay: number, scoreTarget: number,
  scoreText: Text, dt: number,
): number {
  if (elapsed > 0.2) {
    scoreText.alpha = Math.min(1, (elapsed - 0.2) * 4);
    if (scoreDisplay < scoreTarget) {
      const rate = scoreTarget / 1.5;
      scoreDisplay = Math.min(scoreTarget, scoreDisplay + rate * dt);
      scoreText.text = `FINAL SCORE: ${String(Math.floor(scoreDisplay)).padStart(8, '0')}`;
    }
  }
  return scoreDisplay;
}

/** Animate staggered stat reveals with flash effect. */
export function updateStaggeredStats(
  statsElements: StaggeredElement[], elapsed: number, dt: number,
): void {
  for (const stat of statsElements) {
    if (elapsed > stat.delay) {
      const t = Math.min(1, (elapsed - stat.delay) / 0.3);
      const eased = t * (2 - t);
      stat.el.alpha = eased;
      stat.el.x = stat.targetX - 20 * (1 - eased);

      if (stat.flashTimer === 0 && t > 0) {
        stat.flashTimer = 0.15;
      }
      if (stat.flashTimer > 0) {
        stat.flashTimer = Math.max(0, stat.flashTimer - dt);
        stat.el.style.fill = stat.flashTimer > 0 ? '#ffffff' : stat.originalFill;
      }
    }
  }
}

/** Animate oil price counting. Returns the new oilPriceDisplay value. */
export function updateOilPriceCounting(
  elapsed: number, oilPriceDisplay: number, oilPriceTarget: number,
  oilPriceText: Text, dt: number,
): number {
  const oilDelay = 1.8;
  if (elapsed > oilDelay && Math.round(oilPriceDisplay) !== Math.round(oilPriceTarget)) {
    const rate = Math.max(1, Math.abs(oilPriceTarget - 72)) / 1.0;
    if (oilPriceTarget > oilPriceDisplay) {
      oilPriceDisplay = Math.min(oilPriceTarget, oilPriceDisplay + rate * dt);
    } else {
      oilPriceDisplay = Math.max(oilPriceTarget, oilPriceDisplay - rate * dt);
    }
    oilPriceText.text = `OIL PRICE: $${Math.round(oilPriceDisplay)}/bbl`;
  }
  return oilPriceDisplay;
}

/** Animate rank text slam-in. Returns { started, timer }. */
export function updateRankSlam(
  rankText: Text, elapsed: number, rankSlamStarted: boolean, rankSlamTimer: number, dt: number,
): { started: boolean; timer: number } {
  if (elapsed > 1.7 && !rankSlamStarted) {
    rankSlamStarted = true;
    rankSlamTimer = 0;
  }
  if (rankSlamStarted) {
    rankSlamTimer += dt;
    const slamDuration = 0.4;
    if (rankSlamTimer < slamDuration) {
      const t = rankSlamTimer / slamDuration;
      let scale: number;
      if (t < 0.6) {
        const st = t / 0.6;
        scale = 3.0 - 2.1 * st * (2 - st);
      } else {
        const bt = (t - 0.6) / 0.4;
        scale = 0.9 + 0.1 * bt * (2 - bt);
      }
      rankText.scale.set(scale);
      rankText.alpha = Math.min(1, t * 3);
    } else {
      rankText.scale.set(1);
      rankText.alpha = 1;
    }
  }
  return { started: rankSlamStarted, timer: rankSlamTimer };
}
