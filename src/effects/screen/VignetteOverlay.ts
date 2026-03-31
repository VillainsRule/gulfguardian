import { Container, Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';

/**
 * Vignette overlay — radial darkening at screen edges.
 * Drawn once as concentric rectangles, zero per-frame cost.
 * Enhances the tactical monitor / CRT aesthetic.
 */
export class VignetteOverlay extends Container {
  constructor() {
    super();
    const g = new Graphics();

    // Draw concentric dark rectangles from edge inward with decreasing alpha
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const t = i / steps; // 0 = outermost, 1 = innermost
      const inset = t * 120; // Max 120px inset
      const alpha = (1 - t) * (1 - t) * 0.15; // Quadratic falloff, max 0.15

      // Top edge
      g.rect(inset, inset, GAME_WIDTH - inset * 2, 20).fill({ color: 0x000000, alpha });
      // Bottom edge
      g.rect(inset, GAME_HEIGHT - inset - 20, GAME_WIDTH - inset * 2, 20).fill({ color: 0x000000, alpha });
      // Left edge
      g.rect(inset, inset, 20, GAME_HEIGHT - inset * 2).fill({ color: 0x000000, alpha });
      // Right edge
      g.rect(GAME_WIDTH - inset - 20, inset, 20, GAME_HEIGHT - inset * 2).fill({ color: 0x000000, alpha });
    }

    // Corner darkening (extra dark corners)
    const cornerSize = 100;
    const cornerAlpha = 0.12;
    // Top-left
    g.moveTo(0, 0).lineTo(cornerSize, 0).lineTo(0, cornerSize).closePath()
      .fill({ color: 0x000000, alpha: cornerAlpha });
    // Top-right
    g.moveTo(GAME_WIDTH, 0).lineTo(GAME_WIDTH - cornerSize, 0).lineTo(GAME_WIDTH, cornerSize).closePath()
      .fill({ color: 0x000000, alpha: cornerAlpha });
    // Bottom-left
    g.moveTo(0, GAME_HEIGHT).lineTo(cornerSize, GAME_HEIGHT).lineTo(0, GAME_HEIGHT - cornerSize).closePath()
      .fill({ color: 0x000000, alpha: cornerAlpha });
    // Bottom-right
    g.moveTo(GAME_WIDTH, GAME_HEIGHT).lineTo(GAME_WIDTH - cornerSize, GAME_HEIGHT).lineTo(GAME_WIDTH, GAME_HEIGHT - cornerSize).closePath()
      .fill({ color: 0x000000, alpha: cornerAlpha });

    this.addChild(g);
    this.eventMode = 'none';
    this.interactiveChildren = false;
  }
}
