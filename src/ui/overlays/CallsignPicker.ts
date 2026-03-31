/**
 * CallsignPicker — modal overlay for choosing a custom callsign.
 *
 * Two scrollable word columns (prefix + suffix) with a random number suffix.
 * Players pick one word from each column, preview the combined callsign,
 * and claim it (server-enforced uniqueness).
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS, GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';
import { PREFIXES, SUFFIXES, setCallsign, generateClaimToken } from '@/social/player-identity';
import { claimCallsign } from '@/social/leaderboard-api';
import { getAudioManager } from '@/audio/audio-manager';

const PANEL_W = 700;
const PANEL_H = 440;
const PANEL_X = (GAME_WIDTH - PANEL_W) / 2;
const PANEL_Y = (GAME_HEIGHT - PANEL_H) / 2;

const COL_W = 180;
const COL_H = 220;
const VISIBLE_ROWS = 10;
const ROW_H = 22;
const COL_A_X = PANEL_X + 40;
const COL_B_X = PANEL_X + 260;
const COL_TOP = PANEL_Y + 80;

const ARROW_H = 22;

type ClaimState = 'idle' | 'claiming' | 'taken' | 'success' | 'error';

export class CallsignPicker {
  public container: Container;
  private onCompleteCallback: ((callsign: string) => void) | null = null;
  private onCancelCallback: (() => void) | null = null;

  private selectedA: number = 0;
  private selectedB: number = 0;
  private currentNumber: number;
  private scrollA: number = 0;
  private scrollB: number = 0;

  private previewText!: Text;
  private statusText!: Text;
  private claimBtnText!: Text;
  private numberText!: Text;

  private claimState: ClaimState = 'idle';
  private statusTimer: number = 0;
  private elapsed: number = 0;

  // Column text items for rendering
  private colATexts: Text[] = [];
  private colBTexts: Text[] = [];

  // Hit rects
  private claimRect = { x: PANEL_X + 140, y: PANEL_Y + PANEL_H - 70, w: 200, h: 36 };
  private cancelRect = { x: PANEL_X + 380, y: PANEL_Y + PANEL_H - 70, w: 140, h: 36 };
  private rerollRect = { x: PANEL_X + 520, y: COL_TOP + 80, w: 100, h: 36 };
  private arrowUpA = { x: COL_A_X, y: COL_TOP - ARROW_H - 2, w: COL_W, h: ARROW_H };
  private arrowDownA = { x: COL_A_X, y: COL_TOP + COL_H + 2, w: COL_W, h: ARROW_H };
  private arrowUpB = { x: COL_B_X, y: COL_TOP - ARROW_H - 2, w: COL_W, h: ARROW_H };
  private arrowDownB = { x: COL_B_X, y: COL_TOP + COL_H + 2, w: COL_W, h: ARROW_H };

  // Graphics objects to redraw
  private claimBtnBg!: Graphics;
  private cancelBtnBg!: Graphics;

  constructor() {
    this.currentNumber = Math.floor(Math.random() * 100);
    // Randomize initial selection
    this.selectedA = Math.floor(Math.random() * PREFIXES.length);
    this.selectedB = Math.floor(Math.random() * SUFFIXES.length);
    // Center scroll on selection
    this.scrollA = Math.max(0, Math.min(this.selectedA - Math.floor(VISIBLE_ROWS / 2), PREFIXES.length - VISIBLE_ROWS));
    this.scrollB = Math.max(0, Math.min(this.selectedB - Math.floor(VISIBLE_ROWS / 2), SUFFIXES.length - VISIBLE_ROWS));

    this.container = new Container();
    this.buildUI();
    this.refreshColumns();
    this.updatePreview();
  }

  onComplete(cb: (callsign: string) => void): void {
    this.onCompleteCallback = cb;
  }

  onCancel(cb: () => void): void {
    this.onCancelCallback = cb;
  }

  private buildUI(): void {
    // Dim background
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.75 });
    this.container.addChild(bg);

    // Panel
    const panel = new Graphics();
    panel.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H)
      .fill({ color: COLORS.panelBg, alpha: 0.95 })
      .stroke({ width: 2, color: COLORS.phosphorGreen, alpha: 0.8 });
    this.container.addChild(panel);

    // Title
    const title = new Text({
      text: 'CHOOSE YOUR CALLSIGN',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
    });
    title.anchor.set(0.5, 0);
    title.position.set(GAME_WIDTH / 2, PANEL_Y + 15);
    this.container.addChild(title);

    // Column headers
    const headerStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: 'bold', fill: TEXT_COLORS.amber });
    const hdrA = new Text({ text: 'PREFIX', style: headerStyle });
    hdrA.position.set(COL_A_X + COL_W / 2, PANEL_Y + 48);
    hdrA.anchor.set(0.5, 0);
    this.container.addChild(hdrA);

    const hdrB = new Text({ text: 'SUFFIX', style: headerStyle });
    hdrB.position.set(COL_B_X + COL_W / 2, PANEL_Y + 48);
    hdrB.anchor.set(0.5, 0);
    this.container.addChild(hdrB);

    // Column backgrounds
    const colBgA = new Graphics();
    colBgA.rect(COL_A_X, COL_TOP, COL_W, COL_H)
      .fill({ color: 0x000800, alpha: 0.6 })
      .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.3 });
    this.container.addChild(colBgA);

    const colBgB = new Graphics();
    colBgB.rect(COL_B_X, COL_TOP, COL_W, COL_H)
      .fill({ color: 0x000800, alpha: 0.6 })
      .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.3 });
    this.container.addChild(colBgB);

    // Arrow buttons
    this.drawArrowButton(this.arrowUpA, true);
    this.drawArrowButton(this.arrowDownA, false);
    this.drawArrowButton(this.arrowUpB, true);
    this.drawArrowButton(this.arrowDownB, false);

    // Column A text items
    for (let i = 0; i < VISIBLE_ROWS; i++) {
      const t = new Text({
        text: '',
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: TEXT_COLORS.phosphorGreen }),
      });
      t.position.set(COL_A_X + COL_W / 2, COL_TOP + i * ROW_H + 2);
      t.anchor.set(0.5, 0);
      this.container.addChild(t);
      this.colATexts.push(t);
    }

    // Column B text items
    for (let i = 0; i < VISIBLE_ROWS; i++) {
      const t = new Text({
        text: '',
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: TEXT_COLORS.phosphorGreen }),
      });
      t.position.set(COL_B_X + COL_W / 2, COL_TOP + i * ROW_H + 2);
      t.anchor.set(0.5, 0);
      this.container.addChild(t);
      this.colBTexts.push(t);
    }

    // Number section
    const numLabel = new Text({
      text: 'NUMBER',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
    });
    numLabel.position.set(PANEL_X + 570, PANEL_Y + 48);
    numLabel.anchor.set(0.5, 0);
    this.container.addChild(numLabel);

    const numBg = new Graphics();
    numBg.rect(PANEL_X + 520, COL_TOP, 100, 36)
      .fill({ color: 0x000800, alpha: 0.6 })
      .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.3 });
    this.container.addChild(numBg);

    this.numberText = new Text({
      text: this.currentNumber.toString().padStart(2, '0'),
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 18, fontWeight: 'bold', fill: TEXT_COLORS.cyan }),
    });
    this.numberText.anchor.set(0.5);
    this.numberText.position.set(PANEL_X + 570, COL_TOP + 18);
    this.container.addChild(this.numberText);

    // Re-roll button
    const rerollBg = new Graphics();
    rerollBg.rect(this.rerollRect.x, this.rerollRect.y, this.rerollRect.w, this.rerollRect.h)
      .fill({ color: COLORS.panelBg, alpha: 0.8 })
      .stroke({ width: 1, color: COLORS.amber, alpha: 0.7 });
    this.container.addChild(rerollBg);

    const rerollText = new Text({
      text: '[ REROLL ]',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
    });
    rerollText.anchor.set(0.5);
    rerollText.position.set(this.rerollRect.x + this.rerollRect.w / 2, this.rerollRect.y + this.rerollRect.h / 2);
    this.container.addChild(rerollText);

    // Preview
    this.previewText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 'bold', fill: TEXT_COLORS.cyan }),
    });
    this.previewText.anchor.set(0.5, 0);
    this.previewText.position.set(GAME_WIDTH / 2, PANEL_Y + PANEL_H - 120);
    this.container.addChild(this.previewText);

    // Claim button
    this.claimBtnBg = new Graphics();
    this.container.addChild(this.claimBtnBg);

    this.claimBtnText = new Text({
      text: '[ CLAIM CALLSIGN ]',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
    });
    this.claimBtnText.anchor.set(0.5);
    this.claimBtnText.position.set(this.claimRect.x + this.claimRect.w / 2, this.claimRect.y + this.claimRect.h / 2);
    this.container.addChild(this.claimBtnText);

    // Cancel button
    this.cancelBtnBg = new Graphics();
    this.container.addChild(this.cancelBtnBg);

    const cancelText = new Text({
      text: '[ CANCEL ]',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
    });
    cancelText.anchor.set(0.5);
    cancelText.position.set(this.cancelRect.x + this.cancelRect.w / 2, this.cancelRect.y + this.cancelRect.h / 2);
    this.container.addChild(cancelText);

    // Status text (for errors/feedback)
    this.statusText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: TEXT_COLORS.red }),
    });
    this.statusText.anchor.set(0.5, 0);
    this.statusText.position.set(GAME_WIDTH / 2, PANEL_Y + PANEL_H - 30);
    this.container.addChild(this.statusText);
  }

  private drawArrowButton(rect: { x: number; y: number; w: number; h: number }, isUp: boolean): void {
    const g = new Graphics();
    g.rect(rect.x, rect.y, rect.w, rect.h)
      .fill({ color: COLORS.panelBg, alpha: 0.6 })
      .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.3 });
    this.container.addChild(g);

    const label = new Text({
      text: isUp ? '▲' : '▼',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: TEXT_COLORS.phosphorGreen }),
    });
    label.anchor.set(0.5);
    label.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
    this.container.addChild(label);
  }

  private refreshColumns(): void {
    for (let i = 0; i < VISIBLE_ROWS; i++) {
      const idxA = this.scrollA + i;
      const tA = this.colATexts[i];
      if (idxA < PREFIXES.length) {
        const selected = idxA === this.selectedA;
        tA.text = selected ? `> ${PREFIXES[idxA]} <` : `  ${PREFIXES[idxA]}  `;
        tA.style.fill = selected ? TEXT_COLORS.cyan : TEXT_COLORS.phosphorGreen;
        tA.style.fontWeight = selected ? 'bold' : 'normal';
      } else {
        tA.text = '';
      }

      const idxB = this.scrollB + i;
      const tB = this.colBTexts[i];
      if (idxB < SUFFIXES.length) {
        const selected = idxB === this.selectedB;
        tB.text = selected ? `> ${SUFFIXES[idxB]} <` : `  ${SUFFIXES[idxB]}  `;
        tB.style.fill = selected ? TEXT_COLORS.cyan : TEXT_COLORS.phosphorGreen;
        tB.style.fontWeight = selected ? 'bold' : 'normal';
      } else {
        tB.text = '';
      }
    }
  }

  private updatePreview(): void {
    const callsign = this.buildCallsign();
    this.previewText.text = `CALLSIGN:  ${callsign}`;
  }

  private buildCallsign(): string {
    return `${PREFIXES[this.selectedA]}-${SUFFIXES[this.selectedB]}-${this.currentNumber.toString().padStart(2, '0')}`;
  }

  handleClick(x: number, y: number): boolean {
    // Check inside panel
    if (x < PANEL_X || x > PANEL_X + PANEL_W || y < PANEL_Y || y > PANEL_Y + PANEL_H) {
      return false; // click outside
    }

    const audio = getAudioManager();

    // Arrow buttons
    if (this.hitTest(this.arrowUpA, x, y)) {
      audio.play('button_click');
      this.scrollA = Math.max(0, this.scrollA - 1);
      this.refreshColumns();
      return true;
    }
    if (this.hitTest(this.arrowDownA, x, y)) {
      audio.play('button_click');
      this.scrollA = Math.min(PREFIXES.length - VISIBLE_ROWS, this.scrollA + 1);
      this.refreshColumns();
      return true;
    }
    if (this.hitTest(this.arrowUpB, x, y)) {
      audio.play('button_click');
      this.scrollB = Math.max(0, this.scrollB - 1);
      this.refreshColumns();
      return true;
    }
    if (this.hitTest(this.arrowDownB, x, y)) {
      audio.play('button_click');
      this.scrollB = Math.min(SUFFIXES.length - VISIBLE_ROWS, this.scrollB + 1);
      this.refreshColumns();
      return true;
    }

    // Click on column A items
    if (x >= COL_A_X && x <= COL_A_X + COL_W && y >= COL_TOP && y <= COL_TOP + COL_H) {
      const row = Math.floor((y - COL_TOP) / ROW_H);
      const idx = this.scrollA + row;
      if (idx >= 0 && idx < PREFIXES.length) {
        audio.play('button_click');
        this.selectedA = idx;
        this.refreshColumns();
        this.updatePreview();
      }
      return true;
    }

    // Click on column B items
    if (x >= COL_B_X && x <= COL_B_X + COL_W && y >= COL_TOP && y <= COL_TOP + COL_H) {
      const row = Math.floor((y - COL_TOP) / ROW_H);
      const idx = this.scrollB + row;
      if (idx >= 0 && idx < SUFFIXES.length) {
        audio.play('button_click');
        this.selectedB = idx;
        this.refreshColumns();
        this.updatePreview();
      }
      return true;
    }

    // Re-roll number
    if (this.hitTest(this.rerollRect, x, y)) {
      audio.play('button_click');
      this.currentNumber = Math.floor(Math.random() * 100);
      this.numberText.text = this.currentNumber.toString().padStart(2, '0');
      this.updatePreview();
      return true;
    }

    // Claim button
    if (this.hitTest(this.claimRect, x, y) && this.claimState === 'idle') {
      audio.play('button_click');
      this.handleClaim();
      return true;
    }

    // Cancel button
    if (this.hitTest(this.cancelRect, x, y)) {
      audio.play('button_click');
      this.onCancelCallback?.();
      return true;
    }

    return true; // consumed (inside panel)
  }

  private async handleClaim(): Promise<void> {
    this.claimState = 'claiming';
    this.claimBtnText.text = '[ CLAIMING... ]';
    this.statusText.text = '';

    const callsign = this.buildCallsign();
    const token = generateClaimToken();

    const result = await claimCallsign(callsign, token);

    if (result.ok) {
      this.claimState = 'success';
      setCallsign(callsign, token);
      this.claimBtnText.text = '[ CLAIMED! ]';
      this.claimBtnText.style.fill = TEXT_COLORS.phosphorGreen;
      this.statusText.text = '';
      // Brief delay then complete
      setTimeout(() => {
        this.onCompleteCallback?.(callsign);
      }, 400);
    } else {
      const isTaken = result.error === 'CALLSIGN TAKEN';
      this.claimState = isTaken ? 'taken' : 'error';
      this.claimBtnText.text = '[ CLAIM CALLSIGN ]';
      this.statusText.text = isTaken ? 'CALLSIGN TAKEN — TRY ANOTHER COMBINATION' : (result.error?.toUpperCase() ?? 'ERROR');
      this.statusText.style.fill = TEXT_COLORS.red;
      this.statusTimer = 3;
    }
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Button pulse
    const pulse = 0.6 + 0.4 * Math.sin(this.elapsed * 3);
    const claimColor = this.claimState === 'success' ? COLORS.phosphorGreen : COLORS.cyan;
    this.claimBtnBg.clear();
    this.claimBtnBg.rect(this.claimRect.x, this.claimRect.y, this.claimRect.w, this.claimRect.h)
      .fill({ color: COLORS.panelBg, alpha: 0.8 })
      .stroke({ width: 2, color: claimColor, alpha: pulse });

    this.cancelBtnBg.clear();
    this.cancelBtnBg.rect(this.cancelRect.x, this.cancelRect.y, this.cancelRect.w, this.cancelRect.h)
      .fill({ color: COLORS.panelBg, alpha: 0.8 })
      .stroke({ width: 2, color: COLORS.amber, alpha: pulse });

    // Status timer — clear error and reset claim state
    if (this.statusTimer > 0) {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) {
        this.statusText.text = '';
        if (this.claimState === 'taken' || this.claimState === 'error') {
          this.claimState = 'idle';
        }
      }
    }
  }

  private hitTest(rect: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
