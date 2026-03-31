import { Application, Container } from 'pixi.js';
import { createGameConfig } from '@/app/game-config';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '@/app/constants';
import { SceneManager } from '@/core/scene-manager';
import { BootScene } from '@/scenes/BootScene';
import { TitleScene } from '@/scenes/TitleScene';
import { BriefingScene } from '@/scenes/BriefingScene';
import { GameScene } from '@/scenes/GameScene';
import { DebriefScene } from '@/scenes/DebriefScene';
import { MobileUnsupportedScene } from '@/scenes/MobileUnsupportedScene';
import { initQuality } from '@/app/quality';
import { initChallengeFromUrl } from '@/social/challenge-url';
import { getAudioManager } from '@/audio/audio-manager';
import { initMobileFullscreen, cleanupMobileFullscreen } from '@/ui/mobile/fullscreen';
import { isMobileDetected } from '@/app/quality';
import { initAnalytics } from '@/analytics/analytics';

let sceneManager: SceneManager;

export function shouldInitMobileFullscreen(isMobile: boolean): boolean {
  return isMobile;
}

export async function bootstrap(): Promise<void> {
  const config = createGameConfig();
  const quality = initQuality();
  initAnalytics();

  // Parse challenge URL params (e.g. ?c=... "beat my score" links)
  initChallengeFromUrl();

  const mobile = isMobileDetected();

  // Request fullscreen on first mobile touch (hides browser bars).
  if (shouldInitMobileFullscreen(mobile)) {
    initMobileFullscreen();
  }

  const app = new Application();
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: COLORS.bgBlack,
    antialias: quality.antialias,
    resolution: quality.resolution,
    autoDensity: true,
    roundPixels: quality.roundPixels,
    powerPreference: 'high-performance',
    preferWebGLVersion: 2,
  });

  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Game container not found');
  }

  const canvas = app.canvas as HTMLCanvasElement;
  container.appendChild(canvas);

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const stageContainer = new Container();
  app.stage.addChild(stageContainer);

  sceneManager = new SceneManager(stageContainer);

  sceneManager.registerScene('boot', new BootScene(sceneManager));
  sceneManager.registerScene('title', new TitleScene(sceneManager));
  sceneManager.registerScene('briefing', new BriefingScene(sceneManager));
  sceneManager.registerScene('game', new GameScene(sceneManager));
  sceneManager.registerScene('debrief', new DebriefScene(sceneManager));
  sceneManager.registerScene('mobile-unsupported', new MobileUnsupportedScene(sceneManager));

  sceneManager.switchTo('boot');

  function resizeApp(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    app.renderer.resize(w, h);

    const scale = Math.min(w / GAME_WIDTH, h / GAME_HEIGHT);
    stageContainer.scale.set(scale, scale);
    stageContainer.x = (w - GAME_WIDTH * scale) / 2;
    stageContainer.y = (h - GAME_HEIGHT * scale) / 2;

    sceneManager.resize(w, h);
  }

  resizeApp();

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    sceneManager.update(dt);
  });

  // ─── Debounced resize (avoid rapid GPU reallocations on Safari toolbar) ───
  let resizeRAF = 0;
  function scheduleResize(): void {
    if (resizeRAF) return;
    resizeRAF = requestAnimationFrame(() => {
      resizeRAF = 0;
      resizeApp();
    });
  }

  window.addEventListener('resize', scheduleResize);
  // iOS Safari: handle dynamic toolbar resize
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleResize);
  }

  // ─── Visibility change: pause rendering when tab/app is hidden ───
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      app.ticker.stop();
      getAudioManager().suspend();
    } else {
      app.ticker.start();
      getAudioManager().resume();
    }
  });

  // ─── WebGL context loss recovery (iOS Safari kills context on background) ───
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // Allow context restoration
    app.ticker.stop();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    app.ticker.start();
  });

  window.addEventListener('beforeunload', () => {
    cleanupMobileFullscreen();
  });
}
