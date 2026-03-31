import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { IScene, SceneManager } from '@/core/scene-manager';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { isMobileDetected } from '@/app/quality';

const BOOT_LINES = [
  { text: 'AEGIS COMBAT SYSTEM v4.2.1', delay: 0.0 },
  { text: 'INITIALIZING RADAR......... OK', delay: 0.12 },
  { text: 'WEAPONS CHECK.............. ARMED', delay: 0.24 },
  { text: 'COMMS LINK................. ESTABLISHED', delay: 0.36 },
  { text: 'NAV SYSTEM................. ONLINE', delay: 0.48 },
  { text: 'THREAT ASSESSMENT.......... READY', delay: 0.60 },
  { text: '', delay: 0.75 },
  { text: '> SYSTEM READY', delay: 0.80 },
];

const TRANSITION_DELAY = 1.2;

export class BootScene implements IScene {
  private sceneManager: SceneManager;
  private elapsed: number = 0;
  private bootTexts: Text[] = [];
  private flashGraphics!: Graphics;
  private flashTriggered: boolean = false;
  private transitioned: boolean = false;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
  }

  enter(stage: Container): void {
    this.elapsed = 0;
    this.flashTriggered = false;
    this.transitioned = false;
    this.bootTexts = [];

    // Black background
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: COLORS.bgBlack });
    stage.addChild(bg);

    // Create boot text lines
    const mobile = isMobileDetected();
    const bootFontSize = mobile ? 28 : 14;
    const bootLineHeight = mobile ? 42 : 22;
    const bootOffsetX = mobile ? GAME_WIDTH / 2 - 400 : GAME_WIDTH / 2 - 200;
    const startY = GAME_HEIGHT / 2 - (BOOT_LINES.length * bootLineHeight) / 2;
    const style = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: bootFontSize,
      fill: TEXT_COLORS.phosphorGreen,
    });

    for (let i = 0; i < BOOT_LINES.length; i++) {
      const t = new Text({
        text: BOOT_LINES[i].text,
        style: i === 0
          ? new TextStyle({ fontFamily: FONT_FAMILY, fontSize: bootFontSize, fontWeight: 'bold', fill: TEXT_COLORS.phosphorGreen })
          : i === BOOT_LINES.length - 1
            ? new TextStyle({ fontFamily: FONT_FAMILY, fontSize: bootFontSize, fontWeight: 'bold', fill: TEXT_COLORS.cyan })
            : style,
      });
      t.position.set(bootOffsetX, startY + i * bootLineHeight);
      t.alpha = 0;
      stage.addChild(t);
      this.bootTexts.push(t);
    }

    // Flash overlay
    this.flashGraphics = new Graphics();
    stage.addChild(this.flashGraphics);

    // Scanline overlay
    const scanlines = new Graphics();
    for (let y = 0; y < GAME_HEIGHT; y += 3) {
      scanlines.rect(0, y, GAME_WIDTH, 1).fill({ color: 0x000000, alpha: 0.06 });
    }
    stage.addChild(scanlines);
  }

  exit(): void {
    this.bootTexts = [];
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Reveal lines with stagger
    for (let i = 0; i < BOOT_LINES.length; i++) {
      const line = BOOT_LINES[i];
      if (this.elapsed >= line.delay) {
        const t = Math.min(1, (this.elapsed - line.delay) * 10); // fast fade in
        this.bootTexts[i].alpha = t;
      }
    }

    // Flash when "SYSTEM READY" appears
    const readyDelay = BOOT_LINES[BOOT_LINES.length - 1].delay;
    if (this.elapsed >= readyDelay && !this.flashTriggered) {
      this.flashTriggered = true;
    }

    // Green flash effect
    if (this.flashTriggered) {
      const flashElapsed = this.elapsed - readyDelay;
      const flashDuration = 0.3;
      if (flashElapsed < flashDuration) {
        const ft = 1 - flashElapsed / flashDuration;
        const fade = ft * ft * ft; // cubic falloff
        this.flashGraphics.clear();
        this.flashGraphics.rect(0, 0, GAME_WIDTH, GAME_HEIGHT)
          .fill({ color: COLORS.phosphorGreen, alpha: 0.15 * fade });
      } else {
        this.flashGraphics.clear();
      }
    }

    // Transition to title
    if (this.elapsed >= TRANSITION_DELAY && !this.transitioned) {
      this.transitioned = true;
      this.sceneManager.switchTo(isMobileDetected() ? 'mobile-unsupported' : 'title');
    }
  }

  resize(_w: number, _h: number): void {}
}
