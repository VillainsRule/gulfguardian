import { Container } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';
import { MobileControls, isMobileDevice } from '@/ui/mobile/MobileControls';

export class InputManager {
  private keys: Set<string> = new Set();
  private justPressed: Set<string> = new Set();
  private mouseX: number = 0;
  private mouseY: number = 0;
  private mouseDown: boolean = false;
  private justClicked: boolean = false;
  private rightMouseDown: boolean = false;
  private justRightClicked: boolean = false;

  // Zoom state
  private _zoomDelta: number = 0;
  public zoomLevel: number = 1.0;

  // Mobile controls
  public mobileControls: MobileControls | null = null;
  public readonly isMobile: boolean;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;
  private onContextMenu: (e: Event) => void;
  private onWheel: (e: WheelEvent) => void;

  // Canvas reference for coordinate conversion
  private canvas: HTMLCanvasElement | null = null;

  private gameContainer: HTMLElement | null = null;

  /** Check if an event target is inside the game container */
  private isGameTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Node)) return false;
    if (!this.gameContainer) this.gameContainer = document.getElementById('game-container');
    return this.gameContainer?.contains(target) ?? false;
  }

  /** Check if the user is viewing the game (not scrolled to info section) */
  private isViewingGame(): boolean {
    return window.scrollY < window.innerHeight * 0.5;
  }

  constructor() {
    this.isMobile = isMobileDevice();
    this.onKeyDown = (e: KeyboardEvent) => {
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyR'].includes(e.code) && this.isViewingGame()) {
        e.preventDefault();
      }
    };
    this.onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    this.onPointerMove = (e: PointerEvent) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };
    this.onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // MobileControls handles touch
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (e.button === 0) {
        this.mouseDown = true;
        this.justClicked = true;
      } else if (e.button === 2) {
        this.rightMouseDown = true;
        this.justRightClicked = true;
      }
    };
    this.onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // MobileControls handles touch
      if (e.button === 0) {
        this.mouseDown = false;
      } else if (e.button === 2) {
        this.rightMouseDown = false;
      }
    };
    this.onContextMenu = (e: Event) => {
      if (this.isGameTarget(e.target)) {
        e.preventDefault();
      }
    };
    this.onWheel = (e: WheelEvent) => {
      if (this.isGameTarget(e.target)) {
        e.preventDefault();
        this._zoomDelta += e.deltaY;
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('wheel', this.onWheel, { passive: false });

    // Find the canvas element
    this.canvas = document.querySelector('canvas');
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  // --- WASD movement methods (with mobile joystick fallback) ---
  isMoveUp(): boolean { return this.keys.has('KeyW') || (this.mobileControls?.getMoveY() ?? 0) < -0.15; }
  isMoveDown(): boolean { return this.keys.has('KeyS') || (this.mobileControls?.getMoveY() ?? 0) > 0.15; }
  isMoveLeft(): boolean { return this.keys.has('KeyA') || (this.mobileControls?.getMoveX() ?? 0) < -0.15; }
  isMoveRight(): boolean { return this.keys.has('KeyD') || (this.mobileControls?.getMoveX() ?? 0) > 0.15; }

  // --- Arrow key firing methods (with mobile joystick fallback) ---
  isFireUp(): boolean { return this.keys.has('ArrowUp') || (this.mobileControls?.getFireY() ?? 0) < -0.15; }
  isFireDown(): boolean { return this.keys.has('ArrowDown') || (this.mobileControls?.getFireY() ?? 0) > 0.15; }
  isFireLeft(): boolean { return this.keys.has('ArrowLeft') || (this.mobileControls?.getFireX() ?? 0) < -0.15; }
  isFireRight(): boolean { return this.keys.has('ArrowRight') || (this.mobileControls?.getFireX() ?? 0) > 0.15; }
  isFireAny(): boolean {
    return this.keys.has('ArrowUp') || this.keys.has('ArrowDown') ||
           this.keys.has('ArrowLeft') || this.keys.has('ArrowRight') ||
           (this.mobileControls?.isFiring() ?? false);
  }

  // --- Analog input methods (smooth joystick values, binary for keyboard) ---
  getMoveAnalogX(): number {
    if (this.mobileControls) return this.mobileControls.getMoveX();
    let v = 0;
    if (this.keys.has('KeyA')) v -= 1;
    if (this.keys.has('KeyD')) v += 1;
    return v;
  }
  getMoveAnalogY(): number {
    if (this.mobileControls) return this.mobileControls.getMoveY();
    let v = 0;
    if (this.keys.has('KeyW')) v -= 1;
    if (this.keys.has('KeyS')) v += 1;
    return v;
  }
  getFireAnalogX(): number {
    if (this.mobileControls) return this.mobileControls.getFireX();
    let v = 0;
    if (this.keys.has('ArrowLeft')) v -= 1;
    if (this.keys.has('ArrowRight')) v += 1;
    return v;
  }
  getFireAnalogY(): number {
    if (this.mobileControls) return this.mobileControls.getFireY();
    let v = 0;
    if (this.keys.has('ArrowUp')) v -= 1;
    if (this.keys.has('ArrowDown')) v += 1;
    return v;
  }

  // Legacy combined methods (kept for any remaining callers)
  isUp(): boolean { return this.keys.has('ArrowUp') || this.keys.has('KeyW'); }
  isDownKey(): boolean { return this.keys.has('ArrowDown') || this.keys.has('KeyS'); }
  isLeft(): boolean { return this.keys.has('ArrowLeft') || this.keys.has('KeyA'); }
  isRight(): boolean { return this.keys.has('ArrowRight') || this.keys.has('KeyD'); }

  getMousePos(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  /** Get mouse position in game logical coordinates (0..GAME_WIDTH, 0..GAME_HEIGHT).
   *  Uses GAME_WIDTH/GAME_HEIGHT instead of canvas.width/canvas.height to avoid
   *  devicePixelRatio scaling — canvas.width includes DPR multiplier from PixiJS
   *  autoDensity, but the game coordinate system is always 1280x720 logical pixels.
   */
  getGameMousePos(): { x: number; y: number } {
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scale = Math.min(w / GAME_WIDTH, h / GAME_HEIGHT);
      const offsetX = (w - GAME_WIDTH * scale) / 2;
      const offsetY = (h - GAME_HEIGHT * scale) / 2;

      return {
        x: (this.mouseX - offsetX) / scale,
        y: (this.mouseY - offsetY) / scale,
      };
    }

    const scale = Math.min(rect.width / GAME_WIDTH, rect.height / GAME_HEIGHT);
    const offsetX = (rect.width - GAME_WIDTH * scale) / 2;
    const offsetY = (rect.height - GAME_HEIGHT * scale) / 2;
    return {
      x: (this.mouseX - rect.left - offsetX) / scale,
      y: (this.mouseY - rect.top - offsetY) / scale,
    };
  }

  /** Get mouse position in world coordinates (game coords + camera offset) */
  getWorldMousePos(cameraX: number): { x: number; y: number } {
    const game = this.getGameMousePos();
    return {
      x: game.x + cameraX,
      y: game.y,
    };
  }

  isMouseDown(): boolean {
    return this.mouseDown;
  }

  isRightMouseDown(): boolean {
    return this.rightMouseDown;
  }

  consumeClick(): boolean {
    if (this.justClicked) {
      this.justClicked = false;
      return true;
    }
    return false;
  }

  consumeRightClick(): boolean {
    if (this.justRightClicked) {
      this.justRightClicked = false;
      return true;
    }
    return false;
  }

  wasJustPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  wasAnyJustPressed(): boolean {
    return this.justPressed.size > 0;
  }

  isMissile(): boolean {
    return this.keys.has('Space') || (this.mobileControls?.isMissileDown() ?? false);
  }

  consumeMissileTrigger(): boolean {
    if (this.justPressed.has('Space')) {
      this.justPressed.delete('Space');
      return true;
    }
    return this.mobileControls?.consumeMissilePress() ?? false;
  }

  /** Consume accumulated scroll wheel delta (negative = zoom in, positive = zoom out) */
  consumeZoomDelta(): number {
    const delta = this._zoomDelta;
    this._zoomDelta = 0;
    return delta;
  }

  isPause(): boolean {
    return this.justPressed.has('Escape') || this.justPressed.has('KeyP');
  }

  clearFrame(): void {
    this.justClicked = false;
    this.justRightClicked = false;
    this.justPressed.clear();
    this.mobileControls?.clearFrame();
  }

  /** Initialize mobile controls and add to a stage container */
  initMobileControls(stage: Container): void {
    if (!this.isMobile || this.mobileControls) return;
    this.mobileControls = new MobileControls();
    stage.addChild(this.mobileControls);
  }

  /** Remove mobile controls from stage */
  removeMobileControls(): void {
    if (this.mobileControls) {
      this.mobileControls.destroy();
      this.mobileControls = null;
    }
  }

  destroy(): void {
    this.keys.clear();
    this.justPressed.clear();
    this.removeMobileControls();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('wheel', this.onWheel);
  }
}
