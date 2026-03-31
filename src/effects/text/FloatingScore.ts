import { Container, Text, TextStyle } from 'pixi.js';
import { FONT_FAMILY } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';

export class FloatingScore extends Container {
  private text: Text;
  private timer: number = 0;
  private duration: number = 1.0;
  public finished: boolean = false;
  public priority: number = 0;
  private startY: number;

  constructor(x: number, y: number, score: number, color: string = '#ffaa00', isCombo: boolean = false, customText?: string) {
    super();
    this.position.set(x, y);
    this.startY = y;

    const label = customText || (isCombo ? `+${score} COMBO!` : `+${score}`);
    const fontSize = customText ? 14 : (isCombo ? 20 : 13);

    this.text = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize,
        fontWeight: 'bold',
        fill: color,
      }),
      resolution: TEXT_RESOLUTION,
    });
    this.text.anchor.set(0.5);
    this.addChild(this.text);
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

    // Float upward with deceleration
    this.y = this.startY - 50 * t * (2 - t);
    // Fade out in last 40%
    this.alpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    // Slight scale pulse at start
    const scale = t < 0.15 ? 1 + (1 - t / 0.15) * 0.4 : 1;
    this.text.scale.set(scale);
  }
}
