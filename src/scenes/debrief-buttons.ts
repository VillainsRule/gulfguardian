import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { isMobileDetected } from '@/app/quality';
import { isLeaderboardEnabled } from '@/social/leaderboard-config';

// ─── Types ───

export interface ButtonRect {
  x: number; y: number; w: number; h: number;
}

export interface DebriefButtonsState {
  newMissionRect: ButtonRect;
  shareRect: ButtonRect;
  challengeRect: ButtonRect;
  returnRect: ButtonRect;
  newBtnBg: Graphics;
  shareBtnBg: Graphics;
  challengeBtnBg: Graphics;
  retBtnBg: Graphics;
  shareBtnText: Text;
  challengeBtnText: Text;
  hintText: Text;
}

export interface LeaderboardButtonsState {
  submitRect: ButtonRect;
  submitBtnBg: Graphics;
  submitBtnText: Text;
  lbRect: ButtonRect;
  lbBtnBg: Graphics;
}

// ─── Button creation ───

/** Create the four action buttons (New Mission, Share, Challenge, Main Menu) and hint text. */
export function createDebriefButtons(panelContainer: Container): DebriefButtonsState {
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const btnW = isMobile ? 200 : 150;
  const btnH = 40;
  const gap = 15;

  let newBtnX: number, newBtnY: number;
  let shareBtnX: number, shareBtnY: number;
  let challengeBtnX: number, challengeBtnY: number;
  let retBtnX: number, retBtnY: number;

  if (isMobile) {
    const colGap = 20;
    const rowGap = 14;
    const gridW = btnW * 2 + colGap;
    const gridStartX = (GAME_WIDTH - gridW) / 2;
    const row1Y = GAME_HEIGHT - 130;
    const row2Y = row1Y + btnH + rowGap;

    newBtnX = gridStartX;               newBtnY = row1Y;
    shareBtnX = gridStartX + btnW + colGap; shareBtnY = row1Y;
    challengeBtnX = gridStartX;          challengeBtnY = row2Y;
    retBtnX = gridStartX + btnW + colGap;   retBtnY = row2Y;
  } else {
    const totalW = btnW * 4 + gap * 3;
    const startX = (GAME_WIDTH - totalW) / 2;
    const btnY = GAME_HEIGHT - 100;

    newBtnX = startX;                     newBtnY = btnY;
    shareBtnX = startX + btnW + gap;      shareBtnY = btnY;
    challengeBtnX = startX + (btnW + gap) * 2; challengeBtnY = btnY;
    retBtnX = startX + (btnW + gap) * 3;       retBtnY = btnY;
  }

  const newBtnBg = new Graphics();
  panelContainer.addChild(newBtnBg);
  const newBtnText = new Text({
    text: '[ NEW MISSION ]',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
  });
  newBtnText.anchor.set(0.5);
  newBtnText.position.set(newBtnX + btnW / 2, newBtnY + btnH / 2);
  panelContainer.addChild(newBtnText);

  const shareBtnBg = new Graphics();
  panelContainer.addChild(shareBtnBg);
  const shareBtnText = new Text({
    text: '[ SHARE ]',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 'bold', fill: TEXT_COLORS.cyan }),
  });
  shareBtnText.anchor.set(0.5);
  shareBtnText.position.set(shareBtnX + btnW / 2, shareBtnY + btnH / 2);
  panelContainer.addChild(shareBtnText);

  const challengeBtnBg = new Graphics();
  panelContainer.addChild(challengeBtnBg);
  const challengeBtnText = new Text({
    text: '[ CHALLENGE ]',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
  });
  challengeBtnText.anchor.set(0.5);
  challengeBtnText.position.set(challengeBtnX + btnW / 2, challengeBtnY + btnH / 2);
  panelContainer.addChild(challengeBtnText);

  const retBtnBg = new Graphics();
  panelContainer.addChild(retBtnBg);
  const retBtnText = new Text({
    text: '[ MAIN MENU ]',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
  });
  retBtnText.anchor.set(0.5);
  retBtnText.position.set(retBtnX + btnW / 2, retBtnY + btnH / 2);
  panelContainer.addChild(retBtnText);

  const hintText = new Text({
    text: isMobile ? 'TAP TO CONTINUE' : 'PRESS SPACE TO CONTINUE',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: TEXT_COLORS.phosphorGreen }),
  });
  hintText.anchor.set(0.5);
  hintText.position.set(GAME_WIDTH / 2, GAME_HEIGHT - 40);
  hintText.alpha = 0;
  panelContainer.addChild(hintText);

  return {
    newMissionRect: { x: newBtnX, y: newBtnY, w: btnW, h: btnH },
    shareRect: { x: shareBtnX, y: shareBtnY, w: btnW, h: btnH },
    challengeRect: { x: challengeBtnX, y: challengeBtnY, w: btnW, h: btnH },
    returnRect: { x: retBtnX, y: retBtnY, w: btnW, h: btnH },
    newBtnBg,
    shareBtnBg,
    challengeBtnBg,
    retBtnBg,
    shareBtnText,
    challengeBtnText,
    hintText,
  };
}

/** Create the Submit Score and View Leaderboard buttons if leaderboard is enabled. */
export function createLeaderboardButtons(panelContainer: Container): LeaderboardButtonsState | null {
  if (!isLeaderboardEnabled()) return null;

  const lbBtnW = 180;
  const lbBtnH = 32;
  const lbGap = 20;
  const lbTotalW = lbBtnW * 2 + lbGap;
  const lbStartX = (GAME_WIDTH - lbTotalW) / 2;
  const lbY = 420;

  const submitRect: ButtonRect = { x: lbStartX, y: lbY, w: lbBtnW, h: lbBtnH };
  const submitBtnBg = new Graphics();
  panelContainer.addChild(submitBtnBg);

  const submitBtnText = new Text({
    text: '[ SUBMIT SCORE ]',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 'bold', fill: TEXT_COLORS.cyan }),
  });
  submitBtnText.anchor.set(0.5);
  submitBtnText.position.set(lbStartX + lbBtnW / 2, lbY + lbBtnH / 2);
  panelContainer.addChild(submitBtnText);

  const lbBtnX = lbStartX + lbBtnW + lbGap;
  const lbRect: ButtonRect = { x: lbBtnX, y: lbY, w: lbBtnW, h: lbBtnH };
  const lbBtnBg = new Graphics();
  panelContainer.addChild(lbBtnBg);

  const lbBtnText = new Text({
    text: '[ LEADERBOARD ]',
    style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
  });
  lbBtnText.anchor.set(0.5);
  lbBtnText.position.set(lbBtnX + lbBtnW / 2, lbY + lbBtnH / 2);
  panelContainer.addChild(lbBtnText);

  return { submitRect, submitBtnBg, submitBtnText, lbRect, lbBtnBg };
}

// ─── Update functions ───

/** Render button backgrounds with pulse and hover effects. */
export function updateButtonPulse(
  buttons: DebriefButtonsState, elapsed: number, hoveredBtnIndex: number,
): void {
  const btnPulse = 0.6 + 0.4 * Math.sin(elapsed * 3);
  const btnDefs: Array<{ rect: ButtonRect; bg: Graphics; color: number; idx: number }> = [
    { rect: buttons.newMissionRect, bg: buttons.newBtnBg, color: COLORS.phosphorGreen, idx: 0 },
    { rect: buttons.shareRect, bg: buttons.shareBtnBg, color: COLORS.cyan, idx: 1 },
    { rect: buttons.challengeRect, bg: buttons.challengeBtnBg, color: COLORS.amber, idx: 2 },
    { rect: buttons.returnRect, bg: buttons.retBtnBg, color: COLORS.amber, idx: 3 },
  ];
  for (const bd of btnDefs) {
    const r = bd.rect;
    const hovered = hoveredBtnIndex === bd.idx;
    const alpha = hovered ? 1.0 : btnPulse;
    const strokeW = hovered ? 3 : 2;
    bd.bg.clear();
    bd.bg.rect(r.x, r.y, r.w, r.h).fill({ color: COLORS.panelBg, alpha: 0.8 });
    bd.bg.rect(r.x, r.y, r.w, r.h).stroke({ width: strokeW, color: bd.color, alpha });
    if (hovered) {
      bd.bg.rect(r.x, r.y, r.w, r.h).fill({ color: bd.color, alpha: 0.06 });
    }
  }
}

/** Render leaderboard button backgrounds with pulse. */
export function updateLeaderboardButtonPulse(
  lb: LeaderboardButtonsState, elapsed: number, submitState: string,
): void {
  const btnPulse = 0.6 + 0.4 * Math.sin(elapsed * 3);
  const r = lb.submitRect;
  const submitColor = submitState === 'done' ? COLORS.phosphorGreen : submitState === 'error' ? COLORS.red : COLORS.cyan;
  lb.submitBtnBg.clear();
  lb.submitBtnBg.rect(r.x, r.y, r.w, r.h).fill({ color: COLORS.panelBg, alpha: 0.8 });
  lb.submitBtnBg.rect(r.x, r.y, r.w, r.h).stroke({ width: 2, color: submitColor, alpha: btnPulse });

  const lr = lb.lbRect;
  lb.lbBtnBg.clear();
  lb.lbBtnBg.rect(lr.x, lr.y, lr.w, lr.h).fill({ color: COLORS.panelBg, alpha: 0.8 });
  lb.lbBtnBg.rect(lr.x, lr.y, lr.w, lr.h).stroke({ width: 2, color: COLORS.phosphorGreen, alpha: btnPulse });
}

/** Detect which button (0-3) the pointer is hovering over, or -1 for none. */
export function detectHoveredButton(
  buttons: DebriefButtonsState, pointerX: number, pointerY: number,
): number {
  if (isMobileDetected()) return -1;
  const allRects = [buttons.newMissionRect, buttons.shareRect, buttons.challengeRect, buttons.returnRect];
  for (let i = 0; i < allRects.length; i++) {
    const r = allRects[i];
    if (pointerX >= r.x && pointerX <= r.x + r.w && pointerY >= r.y && pointerY <= r.y + r.h) {
      return i;
    }
  }
  return -1;
}
