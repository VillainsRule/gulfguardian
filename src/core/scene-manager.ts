import { Container, Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';

export interface IScene {
  enter(stage: Container): void;
  exit(): void;
  update?(dt: number): void;
  resize?(w: number, h: number): void;
}

export class SceneManager {
  private currentScene: IScene | null = null;
  private scenes: Map<string, IScene> = new Map();
  private stage: Container;
  private fadeGraphics: Graphics;
  private scanlineGraphics: Graphics;
  private fadeState: 'none' | 'fading-out' | 'fading-in' = 'none';
  private fadeTimer: number = 0;
  private fadeDuration: number = 0.3;
  private pendingScene: string | null = null;
  private scanlineY: number = 0;
  private scanlineSweepActive: boolean = false;
  private scanlineSweepTimer: number = 0;
  private scanlineSweepDuration: number = 0.1;

  constructor(stage: Container) {
    this.stage = stage;
    this.fadeGraphics = new Graphics();
    this.fadeGraphics.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000 });
    this.fadeGraphics.alpha = 0;
    this.fadeGraphics.eventMode = 'none';
    this.fadeGraphics.interactiveChildren = false;
    this.scanlineGraphics = new Graphics();
    this.scanlineGraphics.eventMode = 'none';
    this.scanlineGraphics.alpha = 0;
    this.stage.addChild(this.fadeGraphics);
    this.stage.addChild(this.scanlineGraphics);
  }

  registerScene(name: string, scene: IScene): void {
    this.scenes.set(name, scene);
  }

  switchTo(sceneName: string): void {
    // Prevent double-transitions
    if (this.fadeState !== 'none') return;

    const scene = this.scenes.get(sceneName);
    if (!scene) {
      throw new Error(`Scene not found: ${sceneName}`);
    }

    // First scene load — no fade, just go
    if (!this.currentScene) {
      this.currentScene = scene;
      scene.enter(this.stage);
      this.stage.addChild(this.fadeGraphics); // keep on top
      this.stage.addChild(this.scanlineGraphics);
      return;
    }

    // Start fade-out
    this.pendingScene = sceneName;
    this.fadeState = 'fading-out';
    this.fadeTimer = 0;
    this.scanlineSweepActive = false;
    this.stage.eventMode = 'none'; // block input during transition
  }

  /** Switch scenes immediately without fade transition (used for batch restarts). */
  switchToImmediate(sceneName: string): void {
    const scene = this.scenes.get(sceneName);
    if (!scene) throw new Error(`Scene not found: ${sceneName}`);

    // Cancel any in-progress fade
    this.fadeState = 'none';
    this.fadeTimer = 0;
    this.pendingScene = null;
    this.fadeGraphics.alpha = 0;
    this.scanlineGraphics.alpha = 0;
    this.scanlineSweepActive = false;

    if (this.currentScene) {
      this.currentScene.exit();
      this.stage.removeChildren();
    }

    this.currentScene = scene;
    scene.enter(this.stage);
    this.stage.addChild(this.fadeGraphics);
    this.stage.addChild(this.scanlineGraphics);
    this.stage.eventMode = 'static';
  }

  update(dt: number): void {
    if (this.currentScene && this.currentScene.update) {
      this.currentScene.update(dt);
    }

    if (this.fadeState === 'fading-out') {
      this.fadeTimer += dt;
      const t = Math.min(1, this.fadeTimer / this.fadeDuration);
      // Green-tinted fade
      this.fadeGraphics.clear();
      this.fadeGraphics.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000800 });
      this.fadeGraphics.alpha = t;

      if (t >= 1 && this.pendingScene) {
        // Start scanline sweep before switching
        if (!this.scanlineSweepActive) {
          this.scanlineSweepActive = true;
          this.scanlineSweepTimer = 0;
          this.scanlineY = 0;
        }

        this.scanlineSweepTimer += dt;
        const sweepT = Math.min(1, this.scanlineSweepTimer / this.scanlineSweepDuration);
        this.scanlineY = sweepT * GAME_HEIGHT;

        // Draw sweeping scanline
        this.scanlineGraphics.clear();
        this.scanlineGraphics.alpha = 1;
        this.scanlineGraphics.rect(0, this.scanlineY - 2, GAME_WIDTH, 4)
          .fill({ color: 0x00ff41, alpha: 0.6 * (1 - sweepT * 0.5) });
        this.scanlineGraphics.rect(0, this.scanlineY - 1, GAME_WIDTH, 2)
          .fill({ color: 0xffffff, alpha: 0.3 * (1 - sweepT * 0.5) });

        if (sweepT >= 1) {
          // Swap scenes
          this.scanlineGraphics.clear();
          this.scanlineGraphics.alpha = 0;

          if (this.currentScene) {
            this.currentScene.exit();
            this.stage.removeChildren();
          }

          const scene = this.scenes.get(this.pendingScene)!;
          this.currentScene = scene;
          scene.enter(this.stage);
          this.stage.addChild(this.fadeGraphics); // keep on top
          this.stage.addChild(this.scanlineGraphics);
          this.fadeGraphics.alpha = 1;

          this.pendingScene = null;
          this.fadeState = 'fading-in';
          this.fadeTimer = 0;
          this.scanlineSweepActive = false;
        }
      }
    } else if (this.fadeState === 'fading-in') {
      this.fadeTimer += dt;
      const t = Math.min(1, this.fadeTimer / this.fadeDuration);
      this.fadeGraphics.clear();
      this.fadeGraphics.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000800 });
      this.fadeGraphics.alpha = 1 - t;

      if (t >= 1) {
        this.fadeGraphics.alpha = 0;
        this.fadeState = 'none';
        this.stage.eventMode = 'static'; // re-enable input
      }
    }
  }

  resize(w: number, h: number): void {
    if (this.currentScene && this.currentScene.resize) {
      this.currentScene.resize(w, h);
    }
  }

  getCurrentScene(): IScene | null {
    return this.currentScene;
  }
}
