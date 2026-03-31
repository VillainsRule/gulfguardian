import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { TEXT_RESOLUTION } from '@/ui/typography/text-styles';
import { registerVar } from '@/debug/tuning-registry';

export type PickupType = 'missiles' | 'health' | 'rapidfire' | 'score' | 'bomb' | 'shield' | 'tanker_repair' | 'bonus_tanker' | 'multifire' | 'mirv' | 'fae';

const PICKUP_COLORS: Record<PickupType, number> = {
  missiles: COLORS.amber,
  health: COLORS.phosphorGreen,
  rapidfire: COLORS.cyan,
  score: 0xffff00,
  bomb: COLORS.red,
  shield: 0x8888ff,
  tanker_repair: COLORS.phosphorGreen,
  bonus_tanker: 0xffff00,
  multifire: 0xff44ff,
  mirv: 0x44ffff,
  fae: 0xff6600,
};

const PICKUP_LABELS: Record<PickupType, string> = {
  missiles: 'MSL+1',
  health: 'HP+1',
  rapidfire: 'RAPID',
  score: '+500',
  bomb: 'BOMB!',
  shield: 'SHIELD',
  tanker_repair: 'REPAIR',
  bonus_tanker: '+TANKER',
  multifire: 'MULTI',
  mirv: 'MIRV',
  fae: 'FAE',
};

export class Pickup extends Container {
  public pickupType: PickupType;
  public alive: boolean = true;
  public lifetime: number = 12.0;
  public collectRadius: number = 45;

  private graphics: Graphics;
  private labelText: Text;
  private timer: number = 0;

  constructor(x: number, y: number, type: PickupType) {
    super();
    this.pickupType = type;
    this.position.set(x, y);

    this.graphics = new Graphics();
    this.drawPickup();
    this.addChild(this.graphics);

    const color = PICKUP_COLORS[type];
    this.labelText = new Text({
      text: PICKUP_LABELS[type],
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 8,
        fontWeight: 'bold',
        fill: color === COLORS.amber ? TEXT_COLORS.amber
            : color === COLORS.phosphorGreen ? TEXT_COLORS.phosphorGreen
            : color === COLORS.cyan ? TEXT_COLORS.cyan
            : color === COLORS.red ? TEXT_COLORS.red
            : color === 0x8888ff ? '#8888ff'
            : color === 0xff44ff ? '#ff44ff'
            : color === 0x44ffff ? '#44ffff'
            : color === 0xff6600 ? '#ff6600'
            : '#ffff00',
      }),
      resolution: TEXT_RESOLUTION,
    });
    this.labelText.anchor.set(0.5, 0);
    this.labelText.position.set(0, 14);
    this.addChild(this.labelText);
  }

  private drawPickup(pulse: number = 1): void {
    const g = this.graphics;
    g.clear();
    const color = PICKUP_COLORS[this.pickupType];

    // Pulsing attract glow
    const glowRadius = 14 + pulse * 4;
    const glowAlpha = 0.06 + pulse * 0.04;
    g.circle(0, 0, glowRadius).fill({ color, alpha: glowAlpha });

    // Rotating box shape
    g.rect(-8, -8, 16, 16)
      .fill({ color, alpha: 0.3 })
      .stroke({ width: 1.5, color });
    g.moveTo(-4, 0).lineTo(4, 0).stroke({ width: 1, color, alpha: 0.8 });
    g.moveTo(0, -4).lineTo(0, 4).stroke({ width: 1, color, alpha: 0.8 });
  }

  /** Call each frame with player position to enable magnet drift toward player */
  update(dt: number, playerX?: number, playerY?: number): void {
    if (!this.alive) return;
    this.timer += dt;
    this.lifetime -= dt;

    // Magnet effect: drift toward player when within 120px
    if (playerX !== undefined && playerY !== undefined) {
      const dx = playerX - this.x;
      const dy = playerY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120 && dist > 1) {
        const magnetSpeed = 80 + (120 - dist) * 2; // faster as it gets closer
        this.x += (dx / dist) * magnetSpeed * dt;
        this.y += (dy / dist) * magnetSpeed * dt;
      }
    }

    // Bobbing animation + glow pulse
    this.graphics.y = Math.sin(this.timer * 4) * 3;
    const pulse = Math.sin(this.timer * 3) * 0.5 + 0.5;
    this.drawPickup(pulse);
    this.graphics.rotation = Math.sin(this.timer * 2) * 0.15;

    // Blink when about to expire
    if (this.lifetime < 2.0) {
      this.visible = Math.sin(this.timer * 12) > 0;
    }

    if (this.lifetime <= 0) {
      this.alive = false;
    }
  }
}

let PICKUP_DROP_CHANCE = 0.45;
let W_MISSILES = 24;
let W_HEALTH = 16;
let W_RAPIDFIRE = 10;
let W_SCORE = 17;
let W_BOMB = 6;
let W_SHIELD = 11;
let W_TANKER_REPAIR = 10;
let W_BONUS_TANKER = 6;
let W_MULTIFIRE = 10;
let W_MIRV = 8;
let W_FAE = 6;

registerVar({ key: 'powerups.dropChance', label: 'Drop Chance', category: 'Powerups', min: 0, max: 1, step: 0.05, get: () => PICKUP_DROP_CHANCE, set: v => { PICKUP_DROP_CHANCE = v; }, default: 0.45 });
registerVar({ key: 'powerups.w.missiles', label: 'Weight: Missiles', category: 'Powerups', min: 0, max: 60, step: 1, get: () => W_MISSILES, set: v => { W_MISSILES = v; }, default: 24 });
registerVar({ key: 'powerups.w.health', label: 'Weight: Health', category: 'Powerups', min: 0, max: 60, step: 1, get: () => W_HEALTH, set: v => { W_HEALTH = v; }, default: 16 });
registerVar({ key: 'powerups.w.rapidfire', label: 'Weight: Rapidfire', category: 'Powerups', min: 0, max: 60, step: 1, get: () => W_RAPIDFIRE, set: v => { W_RAPIDFIRE = v; }, default: 10 });
registerVar({ key: 'powerups.w.score', label: 'Weight: Score', category: 'Powerups', min: 0, max: 60, step: 1, get: () => W_SCORE, set: v => { W_SCORE = v; }, default: 17 });
registerVar({ key: 'powerups.w.bomb', label: 'Weight: Bomb', category: 'Powerups', min: 0, max: 60, step: 1, get: () => W_BOMB, set: v => { W_BOMB = v; }, default: 6 });
registerVar({ key: 'powerups.w.shield', label: 'Weight: Shield', category: 'Powerups', min: 0, max: 60, step: 1, get: () => W_SHIELD, set: v => { W_SHIELD = v; }, default: 11 });
registerVar({ key: 'powerups.w.tankerRepair', label: 'Weight: Repair', category: 'Powerups', min: 0, max: 60, step: 1, get: () => W_TANKER_REPAIR, set: v => { W_TANKER_REPAIR = v; }, default: 10 });
registerVar({ key: 'powerups.w.bonusTanker', label: 'Weight: +Tanker', category: 'Powerups', min: 0, max: 60, step: 1, get: () => W_BONUS_TANKER, set: v => { W_BONUS_TANKER = v; }, default: 6 });
registerVar({ key: 'powerups.w.multifire', label: 'Weight: Multifire', category: 'Powerups', min: 0, max: 60, step: 1, get: () => W_MULTIFIRE, set: v => { W_MULTIFIRE = v; }, default: 10 });
registerVar({ key: 'powerups.w.mirv', label: 'Weight: MIRV', category: 'Powerups', min: 0, max: 60, step: 1, get: () => W_MIRV, set: v => { W_MIRV = v; }, default: 8 });
registerVar({ key: 'powerups.w.fae', label: 'Weight: FAE', category: 'Powerups', min: 0, max: 60, step: 1, get: () => W_FAE, set: v => { W_FAE = v; }, default: 6 });

function getDropTable(): { type: PickupType; weight: number }[] {
  const table: { type: PickupType; weight: number }[] = [
    { type: 'missiles', weight: W_MISSILES },
    { type: 'health', weight: W_HEALTH },
    { type: 'rapidfire', weight: W_RAPIDFIRE },
    { type: 'score', weight: W_SCORE },
    { type: 'bomb', weight: W_BOMB },
    { type: 'shield', weight: W_SHIELD },
    { type: 'tanker_repair', weight: W_TANKER_REPAIR },
    { type: 'bonus_tanker', weight: W_BONUS_TANKER },
    { type: 'multifire', weight: W_MULTIFIRE },
    { type: 'mirv', weight: W_MIRV },
    { type: 'fae', weight: W_FAE },
  ];
  return table.filter(e => e.weight > 0);
}

/** Context for smart drop filtering — avoids spawning unneeded powerups */
export interface DropContext {
  missileCount: number;
  maxMissiles: number;
  playerHP: number;
  playerMaxHP: number;
  rapidFireActive: boolean;
  shieldActive: boolean;
  multifireActive: boolean;
  mirvActive: boolean;
  faeActive: boolean;
}

export function rollPickupDrop(rng: () => number, ctx?: DropContext): PickupType | null {
  if (rng() > PICKUP_DROP_CHANCE) return null;

  // Filter out powerups that aren't useful right now
  let table = getDropTable();
  if (ctx) {
    table = table.filter(entry => {
      if (entry.type === 'health' && ctx.playerHP >= ctx.playerMaxHP) return false;
      if (entry.type === 'missiles' && ctx.missileCount >= ctx.maxMissiles) return false;

      if (entry.type === 'shield' && ctx.shieldActive) return false;
      if (entry.type === 'multifire' && ctx.multifireActive) return false;
      if (entry.type === 'mirv' && ctx.mirvActive) return false;
      if (entry.type === 'fae' && ctx.faeActive) return false;
      if (entry.type === 'rapidfire' && ctx.rapidFireActive) return false;
      return true;
    });
    // If everything was filtered, fall back to full table
    if (table.length === 0) table = getDropTable();
  }

  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return table[table.length - 1].type;
}
