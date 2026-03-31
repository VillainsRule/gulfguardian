/**
 * Game controls overlay: SFX toggle + music toggle + fullscreen toggle.
 * Positioned in the top-right corner of the 1280x720 game canvas.
 * Uses Pixi's native event system for reliable hit detection.
 */

import { Container, Graphics, Rectangle } from 'pixi.js';
import { COLORS, GAME_WIDTH } from '@/app/constants';
import { isMobileDetected } from '@/app/quality';
import { toggleFullscreen, isFullscreen } from '@/ui/mobile/fullscreen';
import { setMusicMuted, isMusicMuted } from '@/audio/music';
import { getAudioManager } from '@/audio/audio-manager';
import { setSfxMuted, isSfxMuted } from '@/audio/sfx';

const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2.0;
const ZOOM_DEFAULT_MOBILE = 1.8;
const ZOOM_DEFAULT_DESKTOP = 1.0;

const BTN_SIZE = 28;
const BTN_GAP = 4;
const MARGIN_X = 8;
const MARGIN_Y = 8;
const HIT_PAD = 8;

let currentZoom = isMobileDetected() ? ZOOM_DEFAULT_MOBILE : ZOOM_DEFAULT_DESKTOP;

export function getZoomLevel(): number {
  return currentZoom;
}

export function setZoomLevel(z: number): void {
  currentZoom = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) * 10) / 10;
}

export class GameControls extends Container {
  private gfx: Graphics;
  private fsGfx: Graphics;
  private musicGfx: Graphics;
  private sfxGfx: Graphics;
  private dirty = true;
  private lastFs = false;
  private lastMusicMuted = false;
  private lastSfxMuted = false;

  constructor() {
    super();

    const layout = GameControls.getButtonLayout();

    this.gfx = new Graphics();
    this.addChild(this.gfx);

    this.sfxGfx = new Graphics();
    this.sfxGfx.eventMode = 'static';
    this.sfxGfx.cursor = 'pointer';
    this.sfxGfx.hitArea = GameControls.paddedRect(layout.sfx);
    this.sfxGfx.on('pointerdown', (e: any) => {
      e.stopPropagation();
      setSfxMuted(!isSfxMuted());
      this.dirty = true;
    });
    this.addChild(this.sfxGfx);

    this.musicGfx = new Graphics();
    this.musicGfx.eventMode = 'static';
    this.musicGfx.cursor = 'pointer';
    this.musicGfx.hitArea = GameControls.paddedRect(layout.music);
    this.musicGfx.on('pointerdown', (e: any) => {
      e.stopPropagation();
      const muted = !isMusicMuted();
      setMusicMuted(muted);
      getAudioManager().setMuted(muted);
      this.dirty = true;
    });
    this.addChild(this.musicGfx);

    this.fsGfx = new Graphics();
    this.fsGfx.eventMode = 'static';
    this.fsGfx.cursor = 'pointer';
    this.fsGfx.hitArea = GameControls.paddedRect(layout.fs);
    this.fsGfx.on('pointerdown', (e: any) => {
      e.stopPropagation();
      toggleFullscreen();
      this.dirty = true;
    });
    this.addChild(this.fsGfx);

    this.redraw();
  }

  private static paddedRect(r: { x: number; y: number; w: number; h: number }): Rectangle {
    return new Rectangle(r.x - HIT_PAD, r.y - HIT_PAD, r.w + HIT_PAD * 2, r.h + HIT_PAD * 2);
  }

  private static getButtonLayout() {
    const y = MARGIN_Y;
    const fs = { x: GAME_WIDTH - MARGIN_X - BTN_SIZE, y, w: BTN_SIZE, h: BTN_SIZE };
    const music = { x: fs.x - BTN_GAP - BTN_SIZE, y, w: BTN_SIZE, h: BTN_SIZE };
    const sfx = { x: music.x - BTN_GAP - BTN_SIZE, y, w: BTN_SIZE, h: BTN_SIZE };
    return { sfx, music, fs };
  }

  update(): void {
    const fs = isFullscreen();
    const muted = isMusicMuted();
    const sfxMuted = isSfxMuted();
    if (fs !== this.lastFs || muted !== this.lastMusicMuted || sfxMuted !== this.lastSfxMuted) {
      this.dirty = true;
    }
    if (this.dirty) {
      this.redraw();
    }
  }

  private redraw(): void {
    this.dirty = false;
    this.lastFs = isFullscreen();
    this.lastMusicMuted = isMusicMuted();
    this.lastSfxMuted = isSfxMuted();

    const g = this.gfx;
    g.clear();

    const layout = GameControls.getButtonLayout();
    const color = COLORS.phosphorGreen;

    // Background panel spanning all three buttons
    const panelX = layout.sfx.x - 4;
    const panelW = (layout.fs.x + layout.fs.w) - layout.sfx.x + 8;
    g.roundRect(panelX, layout.sfx.y - 4, panelW, BTN_SIZE + 8, 4)
      .fill({ color: 0x000000, alpha: 0.4 })
      .stroke({ width: 1, color, alpha: 0.2 });

    // Draw buttons
    this.drawSfxIcon(this.sfxGfx, layout.sfx);
    this.drawMusicIcon(this.musicGfx, layout.music);
    this.drawFullscreenIcon(this.fsGfx, layout.fs);
  }

  private drawSfxIcon(gfx: Graphics, rect: { x: number; y: number; w: number; h: number }): void {
    gfx.clear();
    const color = COLORS.phosphorGreen;
    const muted = isSfxMuted();

    // Button background
    gfx.roundRect(rect.x, rect.y, rect.w, rect.h, 3)
      .fill({ color: 0x000000, alpha: 0.3 })
      .stroke({ width: 1.5, color, alpha: muted ? 0.4 : 0.5 });

    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;

    // Speaker body (small rectangle + triangle)
    gfx.moveTo(cx - 5, cy - 3).lineTo(cx - 2, cy - 3)
      .lineTo(cx + 2, cy - 6).lineTo(cx + 2, cy + 6)
      .lineTo(cx - 2, cy + 3).lineTo(cx - 5, cy + 3)
      .closePath()
      .stroke({ width: 1.5, color, alpha: 0.8 });

    if (!muted) {
      // Sound waves
      gfx.moveTo(cx + 4, cy - 3).lineTo(cx + 6, cy - 5)
        .stroke({ width: 1.5, color, alpha: 0.6 });
      gfx.moveTo(cx + 4, cy + 3).lineTo(cx + 6, cy + 5)
        .stroke({ width: 1.5, color, alpha: 0.6 });
    } else {
      // X mark for muted
      gfx.moveTo(cx + 4, cy - 4).lineTo(cx + 8, cy + 4)
        .stroke({ width: 2, color: 0xff3333, alpha: 0.8 });
      gfx.moveTo(cx + 8, cy - 4).lineTo(cx + 4, cy + 4)
        .stroke({ width: 2, color: 0xff3333, alpha: 0.8 });
    }
  }

  private drawMusicIcon(gfx: Graphics, rect: { x: number; y: number; w: number; h: number }): void {
    gfx.clear();
    const color = COLORS.phosphorGreen;
    const muted = isMusicMuted();

    // Button background
    gfx.roundRect(rect.x, rect.y, rect.w, rect.h, 3)
      .fill({ color: 0x000000, alpha: 0.3 })
      .stroke({ width: 1.5, color, alpha: muted ? 0.4 : 0.5 });

    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;

    // Musical note icon: filled oval at bottom + stem + flag
    gfx.ellipse(cx - 2, cy + 4, 4, 3)
      .fill({ color, alpha: 0.8 });
    // Stem
    gfx.moveTo(cx + 2, cy + 4).lineTo(cx + 2, cy - 7)
      .stroke({ width: 1.5, color, alpha: 0.8 });
    // Flag
    gfx.moveTo(cx + 2, cy - 7).lineTo(cx + 6, cy - 4)
      .stroke({ width: 2, color, alpha: 0.7 });

    if (muted) {
      // Red slash through note
      gfx.moveTo(cx - 6, cy - 6).lineTo(cx + 6, cy + 6)
        .stroke({ width: 2, color: 0xff3333, alpha: 0.8 });
    }
  }

  private drawFullscreenIcon(fsGfx: Graphics, rect: { x: number; y: number; w: number; h: number }): void {
    fsGfx.clear();
    const color = COLORS.phosphorGreen;
    const fs = isFullscreen();

    // Button background
    fsGfx.roundRect(rect.x, rect.y, rect.w, rect.h, 3)
      .fill({ color: 0x000000, alpha: 0.3 })
      .stroke({ width: 1.5, color, alpha: fs ? 0.7 : 0.5 });

    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const s = 6;

    if (!fs) {
      // Expand icon: 4 corner brackets
      fsGfx.moveTo(cx - s, cy - s + 3).lineTo(cx - s, cy - s).lineTo(cx - s + 3, cy - s)
        .stroke({ width: 1.5, color, alpha: 0.8 });
      fsGfx.moveTo(cx + s - 3, cy - s).lineTo(cx + s, cy - s).lineTo(cx + s, cy - s + 3)
        .stroke({ width: 1.5, color, alpha: 0.8 });
      fsGfx.moveTo(cx - s, cy + s - 3).lineTo(cx - s, cy + s).lineTo(cx - s + 3, cy + s)
        .stroke({ width: 1.5, color, alpha: 0.8 });
      fsGfx.moveTo(cx + s - 3, cy + s).lineTo(cx + s, cy + s).lineTo(cx + s, cy + s - 3)
        .stroke({ width: 1.5, color, alpha: 0.8 });
    } else {
      // Collapse icon: 4 inward brackets
      const i = 3;
      fsGfx.moveTo(cx - i, cy - i + 3).lineTo(cx - i, cy - i).lineTo(cx - i + 3, cy - i)
        .stroke({ width: 1.5, color, alpha: 0.8 });
      fsGfx.moveTo(cx + i - 3, cy - i).lineTo(cx + i, cy - i).lineTo(cx + i, cy - i + 3)
        .stroke({ width: 1.5, color, alpha: 0.8 });
      fsGfx.moveTo(cx - i, cy + i - 3).lineTo(cx - i, cy + i).lineTo(cx - i + 3, cy + i)
        .stroke({ width: 1.5, color, alpha: 0.8 });
      fsGfx.moveTo(cx + i - 3, cy + i).lineTo(cx + i, cy + i).lineTo(cx + i, cy + i - 3)
        .stroke({ width: 1.5, color, alpha: 0.8 });
      // Outer box
      fsGfx.rect(cx - s, cy - s, s * 2, s * 2)
        .stroke({ width: 1, color, alpha: 0.3 });
    }
  }

  destroy(): void {
    this.sfxGfx.removeAllListeners();
    this.musicGfx.removeAllListeners();
    this.fsGfx.removeAllListeners();
    super.destroy();
  }
}
