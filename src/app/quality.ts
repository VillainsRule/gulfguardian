/**
 * Quality Manager — auto-detects device capability and exposes
 * quality-scaled settings consumed by all rendering code.
 *
 * Override via URL param: ?quality=low|medium|high
 */

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualitySettings {
  level: QualityLevel;
  // Renderer
  resolution: number;
  antialias: boolean;
  roundPixels: boolean;
  // Particles & effects
  particleMultiplier: number;
  maxConcurrentEffects: number;
  wakeTrailLength: number;
  maxSmokeParticles: number;
  maxBulletTrailPoints: number;
  enableSecondaryExplosions: boolean;
  enableEmbers: boolean;
  enableSplashdowns: boolean;
  enableBowSpray: boolean;
  // Map
  enableBathymetricContours: boolean;
  enableFlowLines: boolean;
  gridAlpha: number;
  // Cool touches (high only)
  enableScanlines: boolean;
  enableVignette: boolean;
  enableGlow: boolean;
  enableWaterShimmer: boolean;
  // Radar
  sweepTrailSegments: number;
  // Combat
  maxActiveBullets: number; // 0 = unlimited
  enableMuzzleBlast: boolean;
  // Mobile rendering
  renderSkipCosmetic: number;  // skip cosmetic redraws every N frames (0 = no skip)
  enableEntityLabels: boolean; // show FAB/UAV/HELO/GUNBOAT labels
  enableRouteLines: boolean;   // show tanker route dashed lines
  enableMissileGlow: boolean;  // show missile outer glow halo
  maxMissileSmokeParticles: number; // per-missile smoke cap
  // Mobile perf flags
  simplifiedExplosions: boolean;  // fewer draw calls per explosion
  simplifiedDeaths: boolean;      // reduced death sequence presets
  skipKillShockwave: boolean;     // skip shockwave ring on enemy kill
  skipKillRipple: boolean;        // skip water ripple on enemy kill
  skipKillSplash: boolean;        // skip splashdown on enemy kill
  maxDeathSequences: number;      // max concurrent death sequences (0 = unlimited)
  batchEffectRendering: boolean;  // batch simple effects into one Graphics
}

const PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    level: 'low',
    resolution: 1,
    antialias: false,
    roundPixels: false,
    particleMultiplier: 0.4,
    maxConcurrentEffects: 15,
    wakeTrailLength: 20,
    maxSmokeParticles: 8,
    maxBulletTrailPoints: 4,
    enableSecondaryExplosions: false,
    enableEmbers: false,
    enableSplashdowns: false,
    enableBowSpray: false,
    enableBathymetricContours: false,
    enableFlowLines: false,
    gridAlpha: 0,
    enableScanlines: false,
    enableVignette: false,
    enableGlow: false,
    enableWaterShimmer: false,
    sweepTrailSegments: 8,
    maxActiveBullets: 15,
    enableMuzzleBlast: false,
    renderSkipCosmetic: 0,
    enableEntityLabels: true,
    enableRouteLines: true,
    enableMissileGlow: true,
    maxMissileSmokeParticles: 30,
    simplifiedExplosions: false,
    simplifiedDeaths: false,
    skipKillShockwave: false,
    skipKillRipple: false,
    skipKillSplash: false,
    maxDeathSequences: 0,
    batchEffectRendering: false,
  },
  medium: {
    level: 'medium',
    resolution: typeof window !== 'undefined'
      ? (navigator?.userAgent?.toLowerCase().includes('cros')
        ? 1
        : Math.min(window.devicePixelRatio || 1, 1.5))
      : 1,
    antialias: true,
    roundPixels: false,
    particleMultiplier: 0.7,
    maxConcurrentEffects: 40,
    wakeTrailLength: 40,
    maxSmokeParticles: 16,
    maxBulletTrailPoints: 8,
    enableSecondaryExplosions: true,
    enableEmbers: true,
    enableSplashdowns: false,
    enableBowSpray: true,
    enableBathymetricContours: true,
    enableFlowLines: false,
    gridAlpha: 0.06,
    enableScanlines: false,
    enableVignette: false,
    enableGlow: false,
    enableWaterShimmer: false,
    sweepTrailSegments: 14,
    maxActiveBullets: 40,
    enableMuzzleBlast: true,
    renderSkipCosmetic: 0,
    enableEntityLabels: true,
    enableRouteLines: true,
    enableMissileGlow: true,
    maxMissileSmokeParticles: 80,
    simplifiedExplosions: false,
    simplifiedDeaths: false,
    skipKillShockwave: false,
    skipKillRipple: false,
    skipKillSplash: false,
    maxDeathSequences: 0,
    batchEffectRendering: false,
  },
  high: {
    level: 'high',
    resolution: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    antialias: true,
    roundPixels: false,
    particleMultiplier: 1.0,
    maxConcurrentEffects: 80,
    wakeTrailLength: 60,
    maxSmokeParticles: 24,
    maxBulletTrailPoints: 12,
    enableSecondaryExplosions: true,
    enableEmbers: true,
    enableSplashdowns: true,
    enableBowSpray: true,
    enableBathymetricContours: true,
    enableFlowLines: true,
    gridAlpha: 0.12,
    enableScanlines: true,
    enableVignette: true,
    enableGlow: true,
    enableWaterShimmer: true,
    sweepTrailSegments: 20,
    maxActiveBullets: 0, // unlimited
    enableMuzzleBlast: true,
    renderSkipCosmetic: 0,
    enableEntityLabels: true,
    enableRouteLines: true,
    enableMissileGlow: true,
    maxMissileSmokeParticles: 80,
    simplifiedExplosions: false,
    simplifiedDeaths: false,
    skipKillShockwave: false,
    skipKillRipple: false,
    skipKillSplash: false,
    maxDeathSequences: 0,
    batchEffectRendering: false,
  },
};

let currentQuality: QualitySettings = PRESETS.high;
let detectedMobile = false;

/** Detect quality level based on device heuristics */
function detectQualityLevel(): QualityLevel {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'high';

  // Check URL param override
  const params = new URLSearchParams(window.location.search);
  const override = params.get('quality');
  if (override && (override === 'low' || override === 'medium' || override === 'high')) {
    return override;
  }

  // Heuristic-based detection
  const ua = navigator.userAgent.toLowerCase();
  const isChromeOS = ua.includes('cros');
  const isAndroid = ua.includes('android');
  const isMobile = /mobile|tablet|ipad|iphone/.test(ua);
  const isIOS = /iphone|ipad|ipod/.test(ua)
    || (ua.includes('macintosh') && navigator.maxTouchPoints > 0); // iPadOS
  const cores = navigator.hardwareConcurrency || 4;
  const dpr = window.devicePixelRatio || 1;
  const screenPixels = window.screen.width * window.screen.height * dpr * dpr;

  detectedMobile = isMobile || isIOS || isAndroid;

  // Low-end signals
  let lowScore = 0;
  if (isChromeOS) lowScore += 4;
  if (isAndroid) lowScore += 2;
  if (isMobile) lowScore += 2;
  if (cores <= 2) lowScore += 3;
  if (cores <= 4) lowScore += 1;
  if (screenPixels > 4_000_000) lowScore += 1; // high-res on weak GPU = bad
  if (dpr > 1.5 && (isChromeOS || isAndroid)) lowScore += 2;
  if (isIOS) lowScore += 2; // iOS devices thermal-throttle; cap at medium

  // Check for WebGL limitations
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
        // Known low-end GPUs
        if (/intel.*hd|intel.*uhd|mali|adreno [3-5]|powervr|sgx|vivante/.test(renderer)) {
          lowScore += 3;
        }
        // Known high-end GPUs — but don't let this override mobile constraints
        if (/nvidia.*rtx|nvidia.*gtx|radeon.*rx|apple.*m[1-9]/.test(renderer)) {
          lowScore -= isIOS ? 2 : 5; // Less reduction on iOS (thermal throttle)
        }
      }
    } else {
      lowScore += 5; // No WebGL at all
    }
  } catch {
    // Ignore WebGL detection errors
  }

  // iOS must be at least medium regardless of GPU power
  if (isIOS && lowScore < 3) lowScore = 3;

  if (lowScore >= 5) return 'low';
  if (lowScore >= 3) return 'medium';
  return 'high';
}

/** Initialize the quality manager. Call once at startup. */
export function initQuality(): QualitySettings {
  const level = detectQualityLevel();
  currentQuality = { ...PRESETS[level] };

  // Apply mobile-specific overrides to reduce rendering cost on phones/tablets
  if (detectedMobile && level !== 'low') {
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua)
      || (ua.includes('macintosh') && navigator.maxTouchPoints > 0);

    if (isIOS) {
      // iOS Safari: enable MSAA for smoother lines
      currentQuality.antialias = true;
      // Use 2x resolution for crisper rendering on high-DPR screens
      currentQuality.resolution = Math.min(window.devicePixelRatio || 1, 2);
      // Disable expensive map features
      currentQuality.enableBathymetricContours = false;
      // Aggressive effect limits for 60fps
      currentQuality.maxConcurrentEffects = 6;
      currentQuality.wakeTrailLength = Math.min(currentQuality.wakeTrailLength, 6);
      currentQuality.maxSmokeParticles = Math.min(currentQuality.maxSmokeParticles, 3);
      currentQuality.particleMultiplier = Math.min(currentQuality.particleMultiplier, 0.2);
      currentQuality.maxBulletTrailPoints = 0; // no bullet trails — just the body
      currentQuality.maxActiveBullets = 8;
      currentQuality.enableMuzzleBlast = false;
      currentQuality.enableEmbers = false;
      currentQuality.enableSecondaryExplosions = false;
      currentQuality.enableBowSpray = false;
      currentQuality.renderSkipCosmetic = 2;
      currentQuality.enableEntityLabels = false;
      currentQuality.enableRouteLines = false;
      currentQuality.enableMissileGlow = false;
      currentQuality.maxMissileSmokeParticles = 8;
      // Mobile perf: simplified rendering
      currentQuality.simplifiedExplosions = true;
      currentQuality.simplifiedDeaths = true;
      currentQuality.skipKillShockwave = true;
      currentQuality.skipKillRipple = true;
      currentQuality.skipKillSplash = true;
      currentQuality.maxDeathSequences = 2;
      currentQuality.batchEffectRendering = true;
    } else {
      currentQuality.antialias = false;
      currentQuality.resolution = Math.min(window.devicePixelRatio || 1, 2);
      currentQuality.enableBathymetricContours = false;
      currentQuality.maxConcurrentEffects = 8;
      currentQuality.wakeTrailLength = Math.min(currentQuality.wakeTrailLength, 8);
      currentQuality.maxSmokeParticles = Math.min(currentQuality.maxSmokeParticles, 4);
      currentQuality.particleMultiplier = Math.min(currentQuality.particleMultiplier, 0.3);
      currentQuality.maxActiveBullets = 8;
      currentQuality.enableMuzzleBlast = false;
      currentQuality.enableEmbers = false;
      currentQuality.enableSecondaryExplosions = false;
      currentQuality.maxBulletTrailPoints = 0;
      currentQuality.renderSkipCosmetic = 2;
      currentQuality.enableEntityLabels = false;
      currentQuality.enableRouteLines = false;
      currentQuality.enableMissileGlow = false;
      currentQuality.maxMissileSmokeParticles = 10;
      currentQuality.simplifiedExplosions = true;
      currentQuality.simplifiedDeaths = true;
      currentQuality.skipKillShockwave = true;
      currentQuality.skipKillRipple = true;
      currentQuality.skipKillSplash = true;
      currentQuality.maxDeathSequences = 3;
      currentQuality.batchEffectRendering = true;
    }
  }

  return currentQuality;
}

/** Get current quality settings */
export function getQuality(): QualitySettings {
  return currentQuality;
}

/** Manually set quality level (re-applies mobile overrides) */
export function setQualityLevel(level: QualityLevel): void {
  currentQuality = { ...PRESETS[level] };
  // Re-apply mobile overrides when auto-downgrading
  if (detectedMobile && level !== 'low') {
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua)
      || (ua.includes('macintosh') && navigator.maxTouchPoints > 0);
    if (isIOS) {
      currentQuality.antialias = true;
      currentQuality.resolution = Math.min(window.devicePixelRatio || 1, 2);
      currentQuality.enableBathymetricContours = false;
      currentQuality.maxConcurrentEffects = 6;
      currentQuality.wakeTrailLength = Math.min(currentQuality.wakeTrailLength, 6);
      currentQuality.maxSmokeParticles = Math.min(currentQuality.maxSmokeParticles, 3);
      currentQuality.particleMultiplier = Math.min(currentQuality.particleMultiplier, 0.2);
      currentQuality.maxBulletTrailPoints = 0;
      currentQuality.maxActiveBullets = 8;
      currentQuality.enableMuzzleBlast = false;
      currentQuality.enableEmbers = false;
      currentQuality.enableSecondaryExplosions = false;
      currentQuality.enableBowSpray = false;
      currentQuality.renderSkipCosmetic = 2;
      currentQuality.enableEntityLabels = false;
      currentQuality.enableRouteLines = false;
      currentQuality.enableMissileGlow = false;
      currentQuality.maxMissileSmokeParticles = 8;
      currentQuality.simplifiedExplosions = true;
      currentQuality.simplifiedDeaths = true;
      currentQuality.skipKillShockwave = true;
      currentQuality.skipKillRipple = true;
      currentQuality.skipKillSplash = true;
      currentQuality.maxDeathSequences = 2;
      currentQuality.batchEffectRendering = true;
    } else {
      currentQuality.antialias = true;
      currentQuality.resolution = Math.min(window.devicePixelRatio || 1, 2);
      currentQuality.enableBathymetricContours = false;
      currentQuality.maxConcurrentEffects = 8;
      currentQuality.wakeTrailLength = Math.min(currentQuality.wakeTrailLength, 8);
      currentQuality.maxSmokeParticles = Math.min(currentQuality.maxSmokeParticles, 4);
      currentQuality.particleMultiplier = Math.min(currentQuality.particleMultiplier, 0.3);
      currentQuality.maxActiveBullets = 8;
      currentQuality.enableMuzzleBlast = false;
      currentQuality.enableEmbers = false;
      currentQuality.enableSecondaryExplosions = false;
      currentQuality.maxBulletTrailPoints = 0;
      currentQuality.renderSkipCosmetic = 2;
      currentQuality.enableEntityLabels = false;
      currentQuality.enableRouteLines = false;
      currentQuality.enableMissileGlow = false;
      currentQuality.maxMissileSmokeParticles = 10;
      currentQuality.simplifiedExplosions = true;
      currentQuality.simplifiedDeaths = true;
      currentQuality.skipKillShockwave = true;
      currentQuality.skipKillRipple = true;
      currentQuality.skipKillSplash = true;
      currentQuality.maxDeathSequences = 3;
      currentQuality.batchEffectRendering = true;
    }
  }
}

/** Whether the device was detected as mobile */
export function isMobileDetected(): boolean {
  return detectedMobile;
}

// ─── FPS Monitor & Auto-Downgrade (ring buffer for O(1) average) ───

// Mobile: use smaller window and shorter duration for faster adaptation
const FPS_HISTORY_SIZE = detectedMobile ? 30 : 60;
const fpsRing = new Float64Array(FPS_HISTORY_SIZE);
let fpsRingIdx = 0;
let fpsRingCount = 0;
let fpsRunningSum = 0;
let lowFpsStartTime = 0;
const LOW_FPS_THRESHOLD = 40;
const LOW_FPS_DURATION = detectedMobile ? 1.5 : 3; // seconds

/** Call every frame with dt. Returns true if quality was downgraded. */
export function updateFPSMonitor(dt: number): boolean {
  if (dt <= 0) return false;
  const fps = 1 / dt;

  // Ring buffer: subtract old value, add new, advance index
  fpsRunningSum -= fpsRing[fpsRingIdx];
  fpsRing[fpsRingIdx] = fps;
  fpsRunningSum += fps;
  fpsRingIdx = (fpsRingIdx + 1) % FPS_HISTORY_SIZE;
  if (fpsRingCount < FPS_HISTORY_SIZE) fpsRingCount++;

  if (fpsRingCount < FPS_HISTORY_SIZE) return false;

  const avgFps = fpsRunningSum / FPS_HISTORY_SIZE;

  if (avgFps < LOW_FPS_THRESHOLD) {
    if (lowFpsStartTime === 0) {
      lowFpsStartTime = performance.now();
    } else if ((performance.now() - lowFpsStartTime) / 1000 >= LOW_FPS_DURATION) {
      // Downgrade one tier
      lowFpsStartTime = 0;
      fpsRingCount = 0;
      fpsRunningSum = 0;
      fpsRing.fill(0);
      if (currentQuality.level === 'high') {
        setQualityLevel('medium');
        return true;
      } else if (currentQuality.level === 'medium') {
        setQualityLevel('low');
        return true;
      }
    }
  } else {
    lowFpsStartTime = 0;
  }

  return false;
}
