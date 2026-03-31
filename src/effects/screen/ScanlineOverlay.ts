import { Container, Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '@/app/constants';

/**
 * CRT scanline overlay — static horizontal lines drawn once, zero per-frame cost.
 * Gives the tactical monitor a retro phosphor-screen feel.
 */
export class ScanlineOverlay extends Container {
  constructor() {
    super();
    const g = new Graphics();
    const lineSpacing = 3;
    const lineAlpha = 0.04;

    for (let y = 0; y < GAME_HEIGHT; y += lineSpacing) {
      g.rect(0, y, GAME_WIDTH, 1).fill({ color: 0x000000, alpha: lineAlpha });
    }

    // Very subtle phosphor-green tint along even rows
    for (let y = 0; y < GAME_HEIGHT; y += lineSpacing * 2) {
      g.rect(0, y + 1, GAME_WIDTH, 1).fill({ color: COLORS.phosphorGreen, alpha: 0.008 });
    }

    this.addChild(g);
    // Non-interactive overlay
    this.eventMode = 'none';
    this.interactiveChildren = false;
  }
}
