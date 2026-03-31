import { Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { IScene, SceneManager } from '@/core/scene-manager';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY, TEXT_COLORS } from '@/app/constants';
import { MonitorFrame } from '@/ui/overlays/MonitorFrame';
import { Vignette } from '@/ui/overlays/Vignette';
import { TimeManager } from '@/core/time';
import { updateTitleAction } from '@/scenes/title/title-action';
import {
  createDestroyerModel, projectVertex,
  type AegisIntercept, type DistantFlash, type DustParticle,
  type Explosion, type FlakBurst, type OceanSparkle,
  type TitleBullet, type TitleDebris, type TitleDrone,
  type TitleFAB, type TitleMissile, type WaterSplash, type WireModel,
} from '@/scenes/title/title-models';
import { drawTitleEnvironment, drawTitleTanker } from '@/scenes/title/title-render';

export class MobileUnsupportedScene implements IScene {
  private sceneManager: SceneManager;
  private timeManager: TimeManager;
  private gridGraphics: Graphics;
  private scanlineGraphics: Graphics;
  private environmentGraphics: Graphics;
  private tankerGraphics: Graphics;
  private dustGraphics: Graphics;
  private actionGraphics: Graphics;
  private logoFlashGraphics: Graphics;

  private logoSprite: Sprite | null = null;
  private logoBaseScaleX: number = 1;
  private logoBaseScaleY: number = 1;
  private logoAge: number = 0;
  private logoLoaded: boolean = false;

  private tankerRotation: number = 0;
  private tankerModel: ReturnType<typeof createDestroyerModel>;
  private dustParticles: DustParticle[] = [];
  private oceanSparkles: OceanSparkle[] = [];

  // Action state
  private titleDrones: TitleDrone[] = [];
  private titleMissiles: TitleMissile[] = [];
  private titleFABs: TitleFAB[] = [];
  private aegisIntercepts: AegisIntercept[] = [];
  private explosions: Explosion[] = [];
  private distantFlashes: DistantFlash[] = [];
  private titleBullets: TitleBullet[] = [];
  private titleDebris: TitleDebris[] = [];
  private waterSplashes: WaterSplash[] = [];
  private flakBursts: FlakBurst[] = [];
  private missileTimer: number = 1.0;
  private droneTimer: number = 2.0;
  private fabTimer: number = 3.0;
  private flashTimer: number = 1.5;
  private gunBurstTimer: number = 0.5;
  private gunBurstCount: number = 0;
  private gunTargetWx: number = 0;
  private gunTargetWy: number = -30;
  private gunTargetWz: number = 50;
  private gunMuzzleFlash: number = 0;
  private gunMuzzleFlashTurret: 'fwd' | 'ciws' = 'fwd';
  private activeTurretId: 'fwd' | 'ciws' = 'fwd';
  private fwdTurretAngle: number = 0;
  private ciwsTurretAngle: number = 0;
  private fwdTurretTargetAngle: number = 0;
  private ciwsTurretTargetAngle: number = 0;
  private cameraBobX: number = 0;
  private cameraBobY: number = 0;

  // Projection
  private projCenterX: number = 0;
  private projCenterY: number = 0;
  private projScale: number = 2.9;
  private projBobRotX: number = 0;

  private stage: Container | null = null;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.timeManager = new TimeManager();
    this.gridGraphics = new Graphics();
    this.scanlineGraphics = new Graphics();
    this.environmentGraphics = new Graphics();
    this.tankerGraphics = new Graphics();
    this.dustGraphics = new Graphics();
    this.actionGraphics = new Graphics();
    this.logoFlashGraphics = new Graphics();
    this.tankerModel = createDestroyerModel();

    for (let i = 0; i < 35; i++) {
      this.dustParticles.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 8,
        phase: Math.random() * Math.PI * 2,
      });
    }

    for (let i = 0; i < 35; i++) {
      this.oceanSparkles.push({
        wx: (Math.random() - 0.5) * 200,
        wz: (Math.random() - 0.5) * 200,
        phase: Math.random() * Math.PI * 2,
        speed: 1.5 + Math.random() * 2.5,
        driftX: (Math.random() - 0.5) * 0.4,
        driftZ: (Math.random() - 0.5) * 0.3,
        size: 0.5 + Math.random() * 1.0,
      });
    }
  }

  enter(stage: Container): void {
    this.stage = stage;

    stage.addChild(this.gridGraphics);
    this.drawGrid();

    stage.addChild(this.dustGraphics);
    stage.addChild(this.environmentGraphics);
    stage.addChild(this.actionGraphics);
    stage.addChild(this.tankerGraphics);
    stage.addChild(this.logoFlashGraphics);

    // Load logo
    Assets.load<Texture>('/gulf_logo.png').then((tex: Texture) => {
      if (this.stage !== stage) return;
      this.logoSprite = new Sprite(tex);
      this.logoSprite.anchor.set(0.5);
      const logoW = 680;
      const aspect = tex.height / tex.width;
      this.logoSprite.width = logoW;
      this.logoSprite.height = logoW * aspect;
      this.logoBaseScaleX = this.logoSprite.scale.x;
      this.logoBaseScaleY = this.logoSprite.scale.y;
      this.logoSprite.position.set(GAME_WIDTH / 2, 165);
      this.logoSprite.alpha = 0;
      this.logoSprite.scale.set(0, 0);
      this.logoLoaded = true;
      this.logoAge = 0;
      stage.addChild(this.logoSprite);
    });

    const monitorFrame = new MonitorFrame();
    stage.addChild(monitorFrame);

    const vignette = new Vignette();
    stage.addChild(vignette);

    stage.addChild(this.scanlineGraphics);
    this.drawScanlines();

    // Warning text line 1
    const warningLine1 = new Text({
      text: 'NOT SUITABLE FOR\nMOBILE PLAY!',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 62,
        fontWeight: 'bold',
        fill: TEXT_COLORS.amber,
        letterSpacing: 5,
        align: 'center',
        lineHeight: 74,
      }),
    });
    warningLine1.anchor.set(0.5);
    warningLine1.position.set(GAME_WIDTH / 2, GAME_HEIGHT - 150);
    stage.addChild(warningLine1);

    // Warning text line 2
    const warningLine2 = new Text({
      text: 'PLAY ON YOUR DESKTOP OR LAPTOP!',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 36,
        fontWeight: 'bold',
        fill: TEXT_COLORS.phosphorGreen,
        letterSpacing: 4,
      }),
    });
    warningLine2.anchor.set(0.5);
    warningLine2.position.set(GAME_WIDTH / 2, GAME_HEIGHT - 58);
    stage.addChild(warningLine2);

    // Reset animation state
    this.timeManager.reset();
    this.titleDrones = [];
    this.titleMissiles = [];
    this.titleFABs = [];
    this.titleBullets = [];
    this.aegisIntercepts = [];
    this.explosions = [];
    this.distantFlashes = [];
    this.titleDebris = [];
    this.waterSplashes = [];
    this.flakBursts = [];
    this.droneTimer = 2.0;
    this.fabTimer = 3.0;
    this.flashTimer = 1.5;
    this.missileTimer = 2.0;
    this.gunBurstTimer = 0.5;
    this.gunBurstCount = 0;
    this.gunMuzzleFlash = 0;
    this.logoAge = 0;
    this.logoLoaded = false;
  }

  exit(): void {
    this.timeManager.reset();
    if (this.logoSprite) {
      this.logoSprite.destroy();
      this.logoSprite = null;
    }
    this.logoFlashGraphics.clear();
    this.logoLoaded = false;
    this.stage = null;
    this.titleDebris.length = 0;
    this.waterSplashes.length = 0;
    this.flakBursts.length = 0;
  }

  update(dt: number): void {
    this.timeManager.update(dt);
    const elapsed = this.timeManager.getElapsed();

    // Logo pop-in FX (same as TitleScene)
    this.logoFlashGraphics.clear();
    if (this.logoSprite && this.logoLoaded) {
      this.logoAge += dt;
      const logoX = GAME_WIDTH / 2;
      const logoY = 165;
      const popDuration = 0.4;
      const settleDuration = 0.3;

      if (this.logoAge < popDuration) {
        const t = this.logoAge / popDuration;
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        const scaleMultiplier = eased * 1.15;
        this.logoSprite.scale.set(
          this.logoBaseScaleX * scaleMultiplier,
          this.logoBaseScaleY * scaleMultiplier
        );
        this.logoSprite.alpha = Math.min(1.0, t * 3);

        const flashAlpha = (1 - t) * 0.6;
        const flashR = 200 + t * 80;
        const fg = this.logoFlashGraphics;
        fg.circle(logoX, logoY, flashR).fill({ color: 0xffffff, alpha: flashAlpha * 0.3 });
        fg.circle(logoX, logoY, flashR * 0.5).fill({ color: 0xffffff, alpha: flashAlpha * 0.5 });
        const ringR = 80 + t * 160;
        fg.circle(logoX, logoY, ringR)
          .stroke({ width: 3 - t * 2, color: COLORS.phosphorGreen, alpha: (1 - t) * 0.5 });
        fg.circle(logoX, logoY, ringR * 0.85)
          .stroke({ width: 2 - t * 1.5, color: COLORS.phosphorGreen, alpha: (1 - t) * 0.25 });
      } else if (this.logoAge < popDuration + settleDuration) {
        const t = (this.logoAge - popDuration) / settleDuration;
        const eased = t * t * (3 - 2 * t);
        const scaleMultiplier = 1.15 - 0.15 * eased;
        this.logoSprite.scale.set(
          this.logoBaseScaleX * scaleMultiplier,
          this.logoBaseScaleY * scaleMultiplier
        );
        this.logoSprite.alpha = 0.9;
      } else {
        const pulse1 = Math.sin(elapsed * 2.0);
        const pulse2 = Math.sin(elapsed * 3.3) * 0.5;
        const combined = 0.75 + 0.15 * pulse1 + 0.1 * pulse2;
        this.logoSprite.alpha = combined;
        const glowScale = 1.0 + 0.012 * pulse1 + 0.008 * Math.sin(elapsed * 1.4);
        this.logoSprite.scale.set(this.logoBaseScaleX * glowScale, this.logoBaseScaleY * glowScale);
      }
    }

    // Ship animation
    this.tankerRotation += dt * 0.1;
    if (this.tankerRotation > Math.PI * 2) this.tankerRotation -= Math.PI * 2;
    this.cameraBobX *= 0.92;
    this.cameraBobY *= 0.92;
    if (Math.abs(this.cameraBobX) < 0.01) this.cameraBobX = 0;
    if (Math.abs(this.cameraBobY) < 0.01) this.cameraBobY = 0;

    this.projCenterX = GAME_WIDTH / 2 + Math.sin(elapsed * 0.22) * 28 + this.cameraBobX;
    const bobY = Math.sin(elapsed * 1.2) * 3;
    this.projBobRotX = Math.sin(elapsed * 0.8) * 0.04 + 0.02;
    this.projCenterY = GAME_HEIGHT * 0.55 + 30 + bobY + this.cameraBobY;
    this.projScale = 3.6;

    this.drawEnvironment();
    this.drawTanker();
    this.updateAction(dt, elapsed);
    this.updateDust(dt, elapsed);
  }

  resize(_w: number, _h: number): void {}

  private drawGrid(): void {
    const g = this.gridGraphics;
    g.clear();
    const gridSpacing = 40;
    for (let x = 0; x < GAME_WIDTH; x += gridSpacing) {
      g.moveTo(x, 0).lineTo(x, GAME_HEIGHT).stroke({ width: 0.5, color: COLORS.gridLine, alpha: 0.15 });
    }
    for (let y = 0; y < GAME_HEIGHT; y += gridSpacing) {
      g.moveTo(0, y).lineTo(GAME_WIDTH, y).stroke({ width: 0.5, color: COLORS.gridLine, alpha: 0.15 });
    }
  }

  private drawScanlines(): void {
    const g = this.scanlineGraphics;
    g.clear();
    for (let y = 0; y < GAME_HEIGHT; y += 3) {
      g.rect(0, y, GAME_WIDTH, 1).fill({ color: COLORS.bgBlack, alpha: 0.06 });
    }
  }

  private drawEnvironment(): void {
    drawTitleEnvironment({
      environmentGraphics: this.environmentGraphics,
      oceanSparkles: this.oceanSparkles,
      projectWorld: this.projectWorld.bind(this),
      tankerRotation: this.tankerRotation,
      elapsed: this.timeManager.getElapsed(),
    });
  }

  private drawTanker(): void {
    drawTitleTanker({
      tankerGraphics: this.tankerGraphics,
      projCenterX: this.projCenterX,
      projCenterY: this.projCenterY,
      projScale: this.projScale,
      projBobRotX: this.projBobRotX,
      tankerRotation: this.tankerRotation,
      tankerModel: this.tankerModel,
      projectWorld: this.projectWorld.bind(this),
      elapsed: this.timeManager.getElapsed(),
      fwdTurretAngle: this.fwdTurretAngle,
      ciwsTurretAngle: this.ciwsTurretAngle,
      gunMuzzleFlash: this.gunMuzzleFlash,
      gunMuzzleFlashTurret: this.gunMuzzleFlashTurret,
    });
  }

  private drawWireModel(
    g: Graphics, model: WireModel,
    wx: number, wy: number, wz: number,
    localRotY: number, localRotX: number,
    color: number, alpha: number, scale: number = 1.0,
    glowColor?: number
  ): void {
    const cosLY = Math.cos(localRotY);
    const sinLY = Math.sin(localRotY);
    const cosLX = Math.cos(localRotX);
    const sinLX = Math.sin(localRotX);
    const projected: { x: number; y: number; depth: number }[] = [];

    for (const v of model.vertices) {
      let rx = v.x * cosLY - v.z * sinLY;
      const rz = v.x * sinLY + v.z * cosLY;
      const ry = v.y;
      const ry2 = ry * cosLX - rz * sinLX;
      const rz2 = ry * sinLX + rz * cosLX;
      const worldX = wx + rx * scale;
      const worldY = wy + ry2 * scale;
      const worldZ = wz + rz2 * scale;
      projected.push(this.projectWorld(worldX, worldY, worldZ));
    }

    for (const [a, b] of model.edges) {
      const pa = projected[a];
      const pb = projected[b];
      g.moveTo(pa.x, pa.y).lineTo(pb.x, pb.y)
        .stroke({ width: 1.2, color, alpha: alpha * 0.9 });
    }

    const dotColor = glowColor ?? color;
    for (const p of projected) {
      g.circle(p.x, p.y, 1.2).fill({ color: dotColor, alpha: alpha * 0.6 });
      g.circle(p.x, p.y, 3).fill({ color: dotColor, alpha: alpha * 0.06 });
    }
  }

  private projectWorld(wx: number, wy: number, wz: number): { x: number; y: number; depth: number } {
    return projectVertex(
      { x: wx, y: wy, z: wz },
      this.tankerRotation,
      this.projCenterX,
      this.projCenterY,
      this.projScale,
      this.projBobRotX
    );
  }

  private updateAction(dt: number, elapsed: number): void {
    const ctx = {
      actionGraphics: this.actionGraphics,
      droneTimer: this.droneTimer,
      missileTimer: this.missileTimer,
      fabTimer: this.fabTimer,
      flashTimer: this.flashTimer,
      titleDrones: this.titleDrones,
      titleMissiles: this.titleMissiles,
      titleFABs: this.titleFABs,
      aegisIntercepts: this.aegisIntercepts,
      explosions: this.explosions,
      distantFlashes: this.distantFlashes,
      titleBullets: this.titleBullets,
      titleDebris: this.titleDebris,
      waterSplashes: this.waterSplashes,
      flakBursts: this.flakBursts,
      gunBurstTimer: this.gunBurstTimer,
      gunBurstCount: this.gunBurstCount,
      gunMuzzleFlash: this.gunMuzzleFlash,
      gunMuzzleFlashTurret: this.gunMuzzleFlashTurret,
      gunTargetWx: this.gunTargetWx,
      gunTargetWy: this.gunTargetWy,
      gunTargetWz: this.gunTargetWz,
      activeTurretId: this.activeTurretId,
      fwdTurretAngle: this.fwdTurretAngle,
      fwdTurretTargetAngle: this.fwdTurretTargetAngle,
      ciwsTurretAngle: this.ciwsTurretAngle,
      ciwsTurretTargetAngle: this.ciwsTurretTargetAngle,
      tankerRotation: this.tankerRotation,
      cameraBobX: this.cameraBobX,
      cameraBobY: this.cameraBobY,
      projectWorld: this.projectWorld.bind(this),
      drawWireModel: this.drawWireModel.bind(this),
    };

    updateTitleAction(ctx, dt, elapsed);

    this.droneTimer = ctx.droneTimer;
    this.missileTimer = ctx.missileTimer;
    this.fabTimer = ctx.fabTimer;
    this.flashTimer = ctx.flashTimer;
    this.gunBurstTimer = ctx.gunBurstTimer;
    this.gunBurstCount = ctx.gunBurstCount;
    this.gunMuzzleFlash = ctx.gunMuzzleFlash;
    this.gunMuzzleFlashTurret = ctx.gunMuzzleFlashTurret;
    this.gunTargetWx = ctx.gunTargetWx;
    this.gunTargetWy = ctx.gunTargetWy;
    this.gunTargetWz = ctx.gunTargetWz;
    this.activeTurretId = ctx.activeTurretId;
    this.fwdTurretAngle = ctx.fwdTurretAngle;
    this.fwdTurretTargetAngle = ctx.fwdTurretTargetAngle;
    this.ciwsTurretAngle = ctx.ciwsTurretAngle;
    this.ciwsTurretTargetAngle = ctx.ciwsTurretTargetAngle;
    this.cameraBobX = ctx.cameraBobX;
    this.cameraBobY = ctx.cameraBobY;
  }

  private updateDust(dt: number, elapsed: number): void {
    const g = this.dustGraphics;
    g.clear();

    for (let i = 0; i < this.dustParticles.length; i++) {
      const p = this.dustParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < 0) p.x += GAME_WIDTH;
      if (p.x > GAME_WIDTH) p.x -= GAME_WIDTH;
      if (p.y < 0) p.y += GAME_HEIGHT;
      if (p.y > GAME_HEIGHT) p.y -= GAME_HEIGHT;

      const alpha = 0.06 + 0.06 * Math.sin(elapsed * 2 + p.phase);
      g.circle(p.x, p.y, 1.2).fill({ color: COLORS.phosphorGreen, alpha });
    }
  }
}
