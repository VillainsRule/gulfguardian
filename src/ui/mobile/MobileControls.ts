import { Container, Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '@/app/constants';

/**
 * Mobile touch controls with dual joysticks + ability buttons.
 * Left joystick = movement (WASD equivalent)
 * Right joystick = firing direction (arrow keys equivalent)
 * Buttons: missile, boost
 *
 * Designed for landscape orientation.
 */

interface JoystickState {
  active: boolean;
  pointerId: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  dx: number; // normalized -1..1
  dy: number; // normalized -1..1
}

interface ButtonState {
  pressed: boolean;
  justPressed: boolean;
  pointerId: number;
  x: number;
  y: number;
  radius: number;
  touchPadding: number;
  color: number;
  label: string;
}

const JOYSTICK_RADIUS = 50;
const JOYSTICK_DEAD_ZONE = 0.15;
const BUTTON_RADIUS = 28;
const BUTTON_PADDING = 12;

export class MobileControls extends Container {
  private leftStick: JoystickState;
  private rightStick: JoystickState;
  private gfx: Graphics;

  // Ability buttons
  private missileBtn: ButtonState;
  private allButtons: ButtonState[];

  // Screen regions: left half = move stick, right half = fire stick
  private readonly leftZoneMaxX = GAME_WIDTH * 0.45;
  private readonly rightZoneMinX = GAME_WIDTH * 0.45;

  // Dirty tracking for draw optimization
  private dirty = true;
  private prevLeftActive = false;
  private prevRightActive = false;
  private prevLeftCX = 0;
  private prevLeftCY = 0;
  private prevRightCX = 0;
  private prevRightCY = 0;

  // Bound handlers for cleanup
  private onPointerDownBound: (e: PointerEvent) => void;
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerUpBound: (e: PointerEvent) => void;

  constructor() {
    super();

    this.leftStick = this.createStickState();
    this.rightStick = this.createStickState();
    this.gfx = new Graphics();
    this.addChild(this.gfx);

    // Button layout: bottom-right, large and visible
    const btnX = GAME_WIDTH - 50;
    const btnY = GAME_HEIGHT - 140;

    this.missileBtn = this.createButton(btnX, btnY, 44, 22, COLORS.amber, 'MSL');
    this.allButtons = [this.missileBtn];

    this.onPointerDownBound = this.handlePointerDown.bind(this);
    this.onPointerMoveBound = this.handlePointerMove.bind(this);
    this.onPointerUpBound = this.handlePointerUp.bind(this);

    window.addEventListener('pointerdown', this.onPointerDownBound);
    window.addEventListener('pointermove', this.onPointerMoveBound);
    window.addEventListener('pointerup', this.onPointerUpBound);
    window.addEventListener('pointercancel', this.onPointerUpBound);
  }

  private createStickState(): JoystickState {
    return {
      active: false,
      pointerId: -1,
      originX: 0, originY: 0,
      currentX: 0, currentY: 0,
      dx: 0, dy: 0,
    };
  }

  private createButton(x: number, y: number, radius: number, touchPad: number, color: number, label: string): ButtonState {
    return { pressed: false, justPressed: false, pointerId: -1, x, y, radius, touchPadding: touchPad, color, label };
  }

  /** Convert window coords to game coords */
  private toGameCoords(clientX: number, clientY: number): { x: number; y: number } {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.min(w / GAME_WIDTH, h / GAME_HEIGHT);
    const offsetX = (w - GAME_WIDTH * scale) / 2;
    const offsetY = (h - GAME_HEIGHT * scale) / 2;
    return {
      x: (clientX - offsetX) / scale,
      y: (clientY - offsetY) / scale,
    };
  }

  private hitTestButton(btn: ButtonState, px: number, py: number): boolean {
    const dx = px - btn.x;
    const dy = py - btn.y;
    const hitR = btn.radius + btn.touchPadding;
    return dx * dx + dy * dy <= hitR * hitR;
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return;

    const pos = this.toGameCoords(e.clientX, e.clientY);

    // Check buttons first (they're in the right zone)
    for (const btn of this.allButtons) {
      if (this.hitTestButton(btn, pos.x, pos.y)) {
        btn.pressed = true;
        btn.justPressed = true;
        btn.pointerId = e.pointerId;
        this.dirty = true;
        return;
      }
    }

    // Left zone = movement joystick
    if (pos.x < this.leftZoneMaxX && !this.leftStick.active) {
      this.leftStick.active = true;
      this.leftStick.pointerId = e.pointerId;
      this.leftStick.originX = pos.x;
      this.leftStick.originY = pos.y;
      this.leftStick.currentX = pos.x;
      this.leftStick.currentY = pos.y;
      this.leftStick.dx = 0;
      this.leftStick.dy = 0;
      this.dirty = true;
      return;
    }

    // Right zone = fire joystick
    if (pos.x >= this.rightZoneMinX && !this.rightStick.active) {
      this.rightStick.active = true;
      this.rightStick.pointerId = e.pointerId;
      this.rightStick.originX = pos.x;
      this.rightStick.originY = pos.y;
      this.rightStick.currentX = pos.x;
      this.rightStick.currentY = pos.y;
      this.rightStick.dx = 0;
      this.rightStick.dy = 0;
      this.dirty = true;
      return;
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return;

    const pos = this.toGameCoords(e.clientX, e.clientY);

    if (this.leftStick.active && e.pointerId === this.leftStick.pointerId) {
      this.updateStick(this.leftStick, pos.x, pos.y);
      this.dirty = true;
    }
    if (this.rightStick.active && e.pointerId === this.rightStick.pointerId) {
      this.updateStick(this.rightStick, pos.x, pos.y);
      this.dirty = true;
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return;

    if (this.leftStick.active && e.pointerId === this.leftStick.pointerId) {
      this.leftStick.active = false;
      this.leftStick.pointerId = -1;
      this.leftStick.dx = 0;
      this.leftStick.dy = 0;
      this.dirty = true;
    }
    if (this.rightStick.active && e.pointerId === this.rightStick.pointerId) {
      this.rightStick.active = false;
      this.rightStick.pointerId = -1;
      this.rightStick.dx = 0;
      this.rightStick.dy = 0;
      this.dirty = true;
    }
    for (const btn of this.allButtons) {
      if (e.pointerId === btn.pointerId) {
        btn.pressed = false;
        btn.pointerId = -1;
        this.dirty = true;
      }
    }
  }

  private updateStick(stick: JoystickState, x: number, y: number): void {
    stick.currentX = x;
    stick.currentY = y;
    let dx = x - stick.originX;
    let dy = y - stick.originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = JOYSTICK_RADIUS;

    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
      stick.currentX = stick.originX + dx;
      stick.currentY = stick.originY + dy;
    }

    stick.dx = dx / maxDist;
    stick.dy = dy / maxDist;

    // Apply dead zone
    if (Math.abs(stick.dx) < JOYSTICK_DEAD_ZONE) stick.dx = 0;
    if (Math.abs(stick.dy) < JOYSTICK_DEAD_ZONE) stick.dy = 0;
  }

  // ── Public API for InputManager ──

  getMoveX(): number { return this.leftStick.dx; }
  getMoveY(): number { return this.leftStick.dy; }
  getFireX(): number { return this.rightStick.dx; }
  getFireY(): number { return this.rightStick.dy; }
  isFiring(): boolean { return this.rightStick.active && (this.rightStick.dx !== 0 || this.rightStick.dy !== 0); }

  isMissileDown(): boolean { return this.missileBtn.pressed; }
  consumeMissilePress(): boolean {
    if (this.missileBtn.justPressed) {
      this.missileBtn.justPressed = false;
      return true;
    }
    return false;
  }

  isAnyTouchActive(): boolean {
    return this.leftStick.active || this.rightStick.active || this.allButtons.some(b => b.pressed);
  }

  clearFrame(): void {
    for (const btn of this.allButtons) {
      btn.justPressed = false;
    }
  }

  /** Render joystick + button overlays */
  draw(): void {
    // Skip redraw if nothing changed
    if (!this.dirty
      && this.prevLeftActive === this.leftStick.active
      && this.prevRightActive === this.rightStick.active
      && this.prevLeftCX === this.leftStick.currentX
      && this.prevLeftCY === this.leftStick.currentY
      && this.prevRightCX === this.rightStick.currentX
      && this.prevRightCY === this.rightStick.currentY
    ) {
      return;
    }

    this.prevLeftActive = this.leftStick.active;
    this.prevRightActive = this.rightStick.active;
    this.prevLeftCX = this.leftStick.currentX;
    this.prevLeftCY = this.leftStick.currentY;
    this.prevRightCX = this.rightStick.currentX;
    this.prevRightCY = this.rightStick.currentY;
    this.dirty = false;

    const g = this.gfx;
    g.clear();

    const color = COLORS.phosphorGreen;

    // Left joystick
    if (this.leftStick.active) {
      g.circle(this.leftStick.originX, this.leftStick.originY, JOYSTICK_RADIUS)
        .stroke({ width: 1.5, color, alpha: 0.25 });
      g.circle(this.leftStick.currentX, this.leftStick.currentY, 18)
        .fill({ color, alpha: 0.15 });
      g.circle(this.leftStick.currentX, this.leftStick.currentY, 18)
        .stroke({ width: 2, color, alpha: 0.5 });
      g.moveTo(this.leftStick.originX - 8, this.leftStick.originY)
        .lineTo(this.leftStick.originX + 8, this.leftStick.originY)
        .stroke({ width: 1, color, alpha: 0.2 });
      g.moveTo(this.leftStick.originX, this.leftStick.originY - 8)
        .lineTo(this.leftStick.originX, this.leftStick.originY + 8)
        .stroke({ width: 1, color, alpha: 0.2 });
    } else {
      const hintX = 120;
      const hintY = GAME_HEIGHT - 140;
      g.circle(hintX, hintY, JOYSTICK_RADIUS)
        .stroke({ width: 1, color, alpha: 0.1 });
      g.circle(hintX, hintY, 16)
        .stroke({ width: 1, color, alpha: 0.08 });
      g.moveTo(hintX - 8, hintY).lineTo(hintX + 8, hintY)
        .stroke({ width: 0.8, color, alpha: 0.08 });
      g.moveTo(hintX, hintY - 8).lineTo(hintX, hintY + 8)
        .stroke({ width: 0.8, color, alpha: 0.08 });
    }

    // Right joystick
    if (this.rightStick.active) {
      g.circle(this.rightStick.originX, this.rightStick.originY, JOYSTICK_RADIUS)
        .stroke({ width: 1.5, color, alpha: 0.25 });
      g.circle(this.rightStick.currentX, this.rightStick.currentY, 18)
        .fill({ color: COLORS.red, alpha: 0.12 });
      g.circle(this.rightStick.currentX, this.rightStick.currentY, 18)
        .stroke({ width: 2, color: COLORS.red, alpha: 0.45 });
      g.moveTo(this.rightStick.originX - 8, this.rightStick.originY)
        .lineTo(this.rightStick.originX + 8, this.rightStick.originY)
        .stroke({ width: 1, color: COLORS.red, alpha: 0.2 });
      g.moveTo(this.rightStick.originX, this.rightStick.originY - 8)
        .lineTo(this.rightStick.originX, this.rightStick.originY + 8)
        .stroke({ width: 1, color: COLORS.red, alpha: 0.2 });
    } else {
      const hintX = GAME_WIDTH - 120;
      const hintY = GAME_HEIGHT - 140;
      g.circle(hintX, hintY, JOYSTICK_RADIUS)
        .stroke({ width: 1, color: COLORS.red, alpha: 0.08 });
      g.circle(hintX, hintY, 16)
        .stroke({ width: 1, color: COLORS.red, alpha: 0.06 });
      g.moveTo(hintX - 8, hintY).lineTo(hintX + 8, hintY)
        .stroke({ width: 0.8, color: COLORS.red, alpha: 0.06 });
      g.moveTo(hintX, hintY - 8).lineTo(hintX, hintY + 8)
        .stroke({ width: 0.8, color: COLORS.red, alpha: 0.06 });
    }

    // Ability buttons — large, high-visibility for mobile
    for (const btn of this.allButtons) {
      const alpha = btn.pressed ? 0.8 : 0.45;
      const fillAlpha = btn.pressed ? 0.35 : 0.15;

      g.circle(btn.x, btn.y, btn.radius)
        .fill({ color: btn.color, alpha: fillAlpha });
      g.circle(btn.x, btn.y, btn.radius)
        .stroke({ width: 3, color: btn.color, alpha: alpha });

      // Outer glow ring for visibility
      g.circle(btn.x, btn.y, btn.radius + 6)
        .stroke({ width: 1, color: btn.color, alpha: alpha * 0.3 });

      if (btn.pressed) {
        g.circle(btn.x, btn.y, btn.radius - 5)
          .stroke({ width: 1.5, color: btn.color, alpha: 0.5 });
      }
    }

    // Missile icon on MSL button
    this.drawMissileIcon(this.missileBtn);
  }

  private drawMissileIcon(btn: ButtonState): void {
    const g = this.gfx;
    const alpha = btn.pressed ? 0.8 : 0.45;
    const s = 1.0;
    // Missile body — upward-pointing chevron
    g.moveTo(btn.x - 10 * s, btn.y + 8 * s)
      .lineTo(btn.x, btn.y - 12 * s)
      .lineTo(btn.x + 10 * s, btn.y + 8 * s)
      .stroke({ width: 2.5, color: btn.color, alpha });
    // Tail fins
    g.moveTo(btn.x - 7 * s, btn.y + 14 * s)
      .lineTo(btn.x, btn.y + 7 * s)
      .lineTo(btn.x + 7 * s, btn.y + 14 * s)
      .stroke({ width: 2, color: btn.color, alpha: alpha * 0.8 });
  }

  destroy(): void {
    window.removeEventListener('pointerdown', this.onPointerDownBound);
    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('pointercancel', this.onPointerUpBound);
    super.destroy();
  }
}

/** Detect if we're on a mobile/touch device */
export function isMobileDevice(): boolean {
  return 'ontouchstart' in window
    || navigator.maxTouchPoints > 0
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
