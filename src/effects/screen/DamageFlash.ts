import { Container, Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '@/app/constants';

export class DamageFlash extends Container {
  private graphics: Graphics;
  private timer: number = 0;
  private duration: number;
  public finished: boolean = false;

  constructor(duration: number = 0.3, intensity: number = 0.4) {
    super();

    this.duration = duration;
    this.graphics = new Graphics();
    this.graphics.rect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      .fill({ color: COLORS.red, alpha: intensity });
    // Edge vignette strips — intensified red at screen borders for peripheral threat cue
    const edgeH = 60;
    const edgeAlpha = Math.min(intensity * 2, 0.6);
    this.graphics.rect(0, 0, GAME_WIDTH, edgeH)
      .fill({ color: COLORS.red, alpha: edgeAlpha });
    this.graphics.rect(0, GAME_HEIGHT - edgeH, GAME_WIDTH, edgeH)
      .fill({ color: COLORS.red, alpha: edgeAlpha });
    this.addChild(this.graphics);
  }

  update(dt: number): void {
    if (this.finished) return;
    this.timer += dt;
    const t = this.timer / this.duration;
    if (t >= 1) {
      this.finished = true;
      this.visible = false;
      return;
    }
    // Quick flash that fades out
    this.alpha = (1 - t) * (1 - t);
  }
}
