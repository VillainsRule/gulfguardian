import { Container, Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';

export class KillFlash extends Container {
  private graphics: Graphics;
  private timer: number = 0;
  private duration: number;
  private intensity: number;
  public finished: boolean = false;

  constructor(duration: number = 0.10, intensity: number = 0.18) {
    super();
    this.duration = duration;
    this.intensity = intensity;
    this.graphics = new Graphics();
    this.graphics.rect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      .fill({ color: 0xffffff, alpha: intensity });
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
    // Cubic falloff — fast snap then gone
    const fade = (1 - t) * (1 - t) * (1 - t);
    this.alpha = fade;
  }
}
