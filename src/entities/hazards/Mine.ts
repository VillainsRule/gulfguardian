import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';
import { registerVar } from '@/debug/tuning-registry';

export let MINE_DAMAGE = 2;
export let MINE_TRIGGER_RADIUS = 40;

registerVar({ key: 'hazard.mineDamage', label: 'Mine Damage', category: 'Hazards', min: 1, max: 10, step: 1, get: () => MINE_DAMAGE, set: v => { MINE_DAMAGE = v; }, default: 2 });
registerVar({ key: 'hazard.mineTriggerRadius', label: 'Mine Trigger Radius', category: 'Hazards', min: 10, max: 100, step: 5, get: () => MINE_TRIGGER_RADIUS, set: v => { MINE_TRIGGER_RADIUS = v; }, default: 40 });

let nextMineId = 1;

export class Mine extends Container {
  public id: number;
  public damage: number = MINE_DAMAGE;
  public triggerRadius: number = MINE_TRIGGER_RADIUS;
  public alive: boolean = true;
  public scoreValue: number = 150;

  private mineGraphics: Graphics;
  private labelText: Text;
  private pulseTimer: number = 0;
  private lastDrawTime: number = -1;

  constructor(x: number, y: number) {
    super();
    this.id = nextMineId++;
    this.position.set(x, y);

    this.mineGraphics = new Graphics();
    this.addChild(this.mineGraphics);

    this.labelText = new Text({
      text: 'MINE',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 7, fill: TEXT_COLORS.red }),
      resolution: TEXT_RESOLUTION,
    });
    this.labelText.anchor.set(0.5, 0);
    this.labelText.position.set(0, 14);
    this.addChild(this.labelText);
  }

  private drawMine(): void {
    const g = this.mineGraphics;
    g.clear();
    const pulse = 0.85 + 0.15 * Math.sin(this.pulseTimer * 3);

    // Danger proximity ring (faint pulsing)
    const ringAlpha = 0.05 + 0.05 * Math.sin(this.pulseTimer * 2);
    g.circle(0, 0, this.triggerRadius).stroke({ width: 0.5, color: COLORS.red, alpha: ringAlpha });

    // Outer spikes (contact detonators)
    const spikeLen = 4;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + this.pulseTimer * 0.3;
      const innerR = 7 * pulse;
      const outerR = (7 + spikeLen) * pulse;
      g.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR)
        .lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR)
        .stroke({ width: 1, color: COLORS.red, alpha: 0.6 });
    }

    // Main body diamond
    const s = 7 * pulse;
    g.moveTo(0, -s)
      .lineTo(s, 0)
      .lineTo(0, s)
      .lineTo(-s, 0)
      .lineTo(0, -s)
      .fill({ color: COLORS.red, alpha: 0.3 })
      .stroke({ width: 1.5, color: COLORS.red });

    // Blinking warning light
    const blinkRate = 4;
    const blink = Math.sin(this.pulseTimer * blinkRate * Math.PI) > 0.3;
    if (blink) {
      g.circle(0, 0, 2).fill({ color: 0xffffff, alpha: 0.9 });
      g.circle(0, 0, 5).fill({ color: COLORS.red, alpha: 0.25 });
    } else {
      g.circle(0, 0, 1.5).fill({ color: COLORS.red, alpha: 0.5 });
    }
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.pulseTimer += dt;
    // Throttle mine redraw to ~30fps — pulse animation is slow enough
    if (this.pulseTimer - this.lastDrawTime > 0.033) {
      this.lastDrawTime = this.pulseTimer;
      this.drawMine();
    }
  }

  detonate(): void {
    this.alive = false;
    this.visible = false;
  }
}

export function resetMineIdCounter(): void {
  nextMineId = 1;
}
