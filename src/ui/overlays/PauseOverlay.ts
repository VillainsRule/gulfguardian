import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS, GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';

export class PauseOverlay extends Container {
  constructor() {
    super();
    this.visible = false;

    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: 0.6 });
    this.addChild(bg);

    const panel = new Graphics();
    const pw = 400;
    const ph = 200;
    const px = (GAME_WIDTH - pw) / 2;
    const py = (GAME_HEIGHT - ph) / 2;
    panel.rect(px, py, pw, ph)
      .fill({ color: COLORS.panelBg, alpha: 0.9 })
      .stroke({ width: 2, color: COLORS.phosphorGreen, alpha: 0.8 });
    this.addChild(panel);

    const title = new Text({
      text: 'PAUSED',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 32,
        fontWeight: 'bold',
        fill: TEXT_COLORS.phosphorGreen,
      }),
    });
    title.anchor.set(0.5);
    title.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
    this.addChild(title);

    const hint = new Text({
      text: '[ESC/P] Resume  |  [Q] Quit Mission',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        fill: TEXT_COLORS.amber,
      }),
    });
    hint.anchor.set(0.5);
    hint.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
    this.addChild(hint);
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}
