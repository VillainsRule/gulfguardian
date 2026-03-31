import { Container, Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';

export class Vignette extends Container {
  constructor() {
    super();
    const g = new Graphics();

    const edgeSize = 80;
    g.rect(0, 0, GAME_WIDTH, edgeSize).fill({ color: 0x000000, alpha: 0.3 });
    g.rect(0, GAME_HEIGHT - edgeSize, GAME_WIDTH, edgeSize).fill({ color: 0x000000, alpha: 0.3 });
    g.rect(0, 0, edgeSize, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.2 });
    g.rect(GAME_WIDTH - edgeSize, 0, edgeSize, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.2 });

    this.addChild(g);
  }
}
