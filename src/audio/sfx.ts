import { isMobileDetected } from '@/app/quality';

const SFX_DEFS = {
  gunFire:        { src: '/audio/deck_gun_fire.mp3',         vol: 0.25, pool: 4 },
  missileLaunch:  { src: '/audio/missile_launch.mp3',        vol: 0.35, pool: 3 },
  enemyExplode:   { src: '/audio/patrol_boat_explode.mp3',   vol: 0.4,  pool: 3 },
  mineExplode:    { src: '/audio/mine_explode.mp3',          vol: 0.45, pool: 2 },
  playerHit:      { src: '/audio/destroyer_hit_light.mp3',   vol: 0.5,  pool: 2 },
  bigExplode:     { src: '/audio/destroyer_explode.mp3',     vol: 0.5,  pool: 2 },
  enemyMissile:   { src: '/audio/enemy_missile_launch.mp3',  vol: 0.25, pool: 2 },
  heliMissile:    { src: '/audio/heli_missile.mp3',          vol: 0.3,  pool: 2 },
  heliDeath:      { src: '/audio/heli_death.mp3',            vol: 0.45, pool: 2 },
  heliRotor:      { src: '/audio/heli_rotor.mp3',            vol: 0.2,  pool: 1 },
  pickup:         { src: '/audio/powerup_collect.mp3',       vol: 0.4,  pool: 2 },
  combo:          { src: '/audio/score_multiplier.mp3',      vol: 0.35, pool: 2 },
  gameStart:      { src: '/audio/game_start.mp3',            vol: 0.4,  pool: 1 },
  lifeLost:       { src: '/audio/life_lost.mp3',             vol: 0.45, pool: 1 },
  tankerHorn:     { src: '/audio/tanker_horn.mp3',           vol: 0.3,  pool: 1 },
} as const;

export type SfxName = keyof typeof SFX_DEFS;

let audioCtx: AudioContext | null = null;
const buffers: Map<SfxName, AudioBuffer> = new Map();
const volumes: Map<SfxName, number> = new Map();
let ready = false;
let mobile = false;
let sfxMuted = false;

export function setSfxMuted(muted: boolean): void {
  sfxMuted = muted;
}

export function isSfxMuted(): boolean {
  return sfxMuted;
}

const throttleTimers: Map<SfxName, number> = new Map();
const MOBILE_THROTTLE_MS: Partial<Record<SfxName, number>> = {
  gunFire: 200,
  enemyExplode: 150,
  enemyMissile: 300,
};

export function initSfx(): void {
  if (ready) return;
  mobile = isMobileDetected();

  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return;
  }

  for (const [name, def] of Object.entries(SFX_DEFS)) {
    volumes.set(name as SfxName, def.vol);
    fetch(def.src)
      .then(r => r.arrayBuffer())
      .then(buf => audioCtx!.decodeAudioData(buf))
      .then(decoded => { buffers.set(name as SfxName, decoded); })
      .catch(() => {});
  }

  ready = true;
}

const activeLoops = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();

export function playLoopSfx(name: SfxName, loopId: string): void {
  if (!ready || !audioCtx || sfxMuted) return;
  if (activeLoops.has(loopId)) return;

  const buffer = buffers.get(name);
  if (!buffer) return;

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = audioCtx.createGain();
  gain.gain.value = volumes.get(name) ?? 0.2;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start(0);
  activeLoops.set(loopId, { source, gain });
}

export function stopLoopSfx(loopId: string): void {
  const loop = activeLoops.get(loopId);
  if (loop) {
    try { loop.source.stop(); } catch {}
    activeLoops.delete(loopId);
  }
}

export function stopAllLoops(): void {
  for (const [id, loop] of activeLoops) {
    try { loop.source.stop(); } catch {}
  }
  activeLoops.clear();
}

export function playSfx(name: SfxName): void {
  if (!ready || !audioCtx || sfxMuted) return;

  if (mobile) {
    const throttleMs = MOBILE_THROTTLE_MS[name] ?? 0;
    if (throttleMs > 0) {
      const now = performance.now();
      const last = throttleTimers.get(name) ?? 0;
      if (now - last < throttleMs) return;
      throttleTimers.set(name, now);
    }
  }

  const buffer = buffers.get(name);
  if (!buffer) return;

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.value = volumes.get(name) ?? 0.3;
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start(0);
}
