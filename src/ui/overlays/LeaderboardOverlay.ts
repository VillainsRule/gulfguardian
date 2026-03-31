/**
 * LeaderboardOverlay — modal overlay showing top scores.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS, GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';
import { fetchLeaderboard, type LeaderboardEntry } from '@/social/leaderboard-api';
import { createFlagGraphic, FLAG_WIDTH, FLAG_HEIGHT, COUNTRY_NAMES } from '@/ui/country-flags';
import { getAudioManager } from '@/audio/audio-manager';

const PANEL_W = 600;
const PANEL_H = 500;
const PANEL_X = (GAME_WIDTH - PANEL_W) / 2;
const PANEL_Y = (GAME_HEIGHT - PANEL_H) / 2;

export class LeaderboardOverlay {
  public container: Container;
  private closeCallback: (() => void) | null = null;
  private closeRect = { x: PANEL_X + PANEL_W - 80, y: PANEL_Y + PANEL_H - 50, w: 60, h: 30 };
  private entriesContainer: Container;
  private loadingText: Text;
  private cache: LeaderboardEntry[] | null = null;
  private elapsed = 0;
  private flagHitAreas: { x: number; y: number; w: number; h: number; country: string }[] = [];
  private tooltip: Text;
  private tooltipBg: Graphics;

  constructor() {
    this.container = new Container();

    // Dim background
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.7 });
    this.container.addChild(bg);

    // Panel
    const panel = new Graphics();
    panel.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H)
      .fill({ color: COLORS.panelBg, alpha: 0.95 })
      .stroke({ width: 2, color: COLORS.phosphorGreen, alpha: 0.8 });
    this.container.addChild(panel);

    // Title
    const title = new Text({
      text: 'LEADERBOARD',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen }),
    });
    title.anchor.set(0.5, 0);
    title.position.set(GAME_WIDTH / 2, PANEL_Y + 15);
    this.container.addChild(title);

    // Header row
    const headerStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 'bold', fill: TEXT_COLORS.amber });
    const headerY = PANEL_Y + 55;
    const cols = [
      { text: '#', x: PANEL_X + 20 },
      { text: 'CALLSIGN', x: PANEL_X + 60 },
      { text: 'SCORE', x: PANEL_X + 320 },
      { text: 'WAVE', x: PANEL_X + 430 },
      { text: 'TANKERS', x: PANEL_X + 500 },
    ];
    for (const col of cols) {
      const t = new Text({ text: col.text, style: headerStyle });
      t.position.set(col.x, headerY);
      this.container.addChild(t);
    }

    // Separator line
    const sep = new Graphics();
    sep.moveTo(PANEL_X + 15, headerY + 20).lineTo(PANEL_X + PANEL_W - 15, headerY + 20)
      .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.4 });
    this.container.addChild(sep);

    // Entries container
    this.entriesContainer = new Container();
    this.container.addChild(this.entriesContainer);

    // Loading text
    this.loadingText = new Text({
      text: 'LOADING...',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fill: TEXT_COLORS.dimGreen }),
    });
    this.loadingText.anchor.set(0.5);
    this.loadingText.position.set(GAME_WIDTH / 2, PANEL_Y + PANEL_H / 2);
    this.container.addChild(this.loadingText);

    // Close button
    const closeBg = new Graphics();
    closeBg.rect(this.closeRect.x, this.closeRect.y, this.closeRect.w, this.closeRect.h)
      .fill({ color: COLORS.panelBg, alpha: 0.8 })
      .stroke({ width: 1, color: COLORS.amber, alpha: 0.8 });
    this.container.addChild(closeBg);

    const closeText = new Text({
      text: '[ X ]',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 'bold', fill: TEXT_COLORS.amber }),
    });
    closeText.anchor.set(0.5);
    closeText.position.set(this.closeRect.x + this.closeRect.w / 2, this.closeRect.y + this.closeRect.h / 2);
    this.container.addChild(closeText);

    // Tooltip for country names on hover
    this.tooltipBg = new Graphics();
    this.tooltipBg.visible = false;
    this.container.addChild(this.tooltipBg);

    this.tooltip = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: TEXT_COLORS.amber }),
    });
    this.tooltip.visible = false;
    this.container.addChild(this.tooltip);
  }

  onClose(cb: () => void): void {
    this.closeCallback = cb;
  }

  show(): void {
    this.container.visible = true;
    this.loadEntries();
  }

  handleClick(x: number, y: number): boolean {
    // Check if inside panel
    if (x >= PANEL_X && x <= PANEL_X + PANEL_W && y >= PANEL_Y && y <= PANEL_Y + PANEL_H) {
      // Close button
      if (
        x >= this.closeRect.x && x <= this.closeRect.x + this.closeRect.w &&
        y >= this.closeRect.y && y <= this.closeRect.y + this.closeRect.h
      ) {
        getAudioManager().play('button_click');
        this.closeCallback?.();
      }
      return true; // consumed
    }
    return false; // click outside
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (this.loadingText.visible) {
      this.loadingText.alpha = 0.5 + 0.5 * Math.sin(this.elapsed * 4);
    }
  }

  invalidateCache(): void {
    this.cache = null;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private async loadEntries(): Promise<void> {
    if (this.cache) {
      this.renderEntries(this.cache);
      return;
    }
    this.loadingText.visible = true;
    const entries = await fetchLeaderboard(20);
    this.cache = entries;
    this.loadingText.visible = false;
    this.renderEntries(entries);
  }

  handlePointerMove(x: number, y: number): void {
    for (const area of this.flagHitAreas) {
      if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
        const name = COUNTRY_NAMES[area.country.toUpperCase()] ?? area.country.toUpperCase();
        this.tooltip.text = name;
        const tx = area.x + area.w + 4;
        const ty = area.y - 2;
        this.tooltip.position.set(tx, ty);
        this.tooltip.visible = true;

        const pad = 4;
        this.tooltipBg.clear();
        this.tooltipBg.roundRect(tx - pad, ty - pad, this.tooltip.width + pad * 2, this.tooltip.height + pad * 2, 3)
          .fill({ color: COLORS.panelBg, alpha: 0.95 })
          .stroke({ width: 1, color: COLORS.phosphorGreen, alpha: 0.5 });
        this.tooltipBg.visible = true;
        return;
      }
    }
    this.tooltip.visible = false;
    this.tooltipBg.visible = false;
  }

  private renderEntries(entries: LeaderboardEntry[]): void {
    this.entriesContainer.removeChildren();
    this.flagHitAreas = [];
    const rowStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: TEXT_COLORS.phosphorGreen });
    const startY = PANEL_Y + 80;
    const rowH = 18;

    if (entries.length === 0) {
      const noData = new Text({
        text: 'NO SCORES YET',
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fill: TEXT_COLORS.dimGreen }),
      });
      noData.anchor.set(0.5);
      noData.position.set(GAME_WIDTH / 2, startY + 60);
      this.entriesContainer.addChild(noData);
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const y = startY + i * rowH;

      const rank = new Text({ text: `${e.rank}`, style: rowStyle });
      rank.position.set(PANEL_X + 20, y);
      this.entriesContainer.addChild(rank);

      let nameX = PANEL_X + 60;
      if (e.country) {
        const flag = createFlagGraphic(e.country);
        if (flag) {
          flag.position.set(nameX, y + 1);
          this.entriesContainer.addChild(flag);
          this.flagHitAreas.push({ x: nameX, y: y + 1, w: FLAG_WIDTH, h: FLAG_HEIGHT, country: e.country });
          nameX += FLAG_WIDTH + 4;
        }
      }

      const name = new Text({ text: e.callsign, style: rowStyle });
      name.position.set(nameX, y);
      this.entriesContainer.addChild(name);

      const score = new Text({ text: String(e.score).padStart(8, '0'), style: rowStyle });
      score.position.set(PANEL_X + 320, y);
      this.entriesContainer.addChild(score);

      const wave = new Text({ text: `${e.wave}/5`, style: rowStyle });
      wave.position.set(PANEL_X + 430, y);
      this.entriesContainer.addChild(wave);

      const tankers = new Text({ text: `${e.tankersSaved}`, style: rowStyle });
      tankers.position.set(PANEL_X + 500, y);
      this.entriesContainer.addChild(tankers);
    }
  }
}
