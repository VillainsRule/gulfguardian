import { SOUND_CONFIGS, type SoundConfig } from '@/audio/sound-config';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume: number = 0.7;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private unlockBound: (() => void) | null = null;

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  init(): void {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      if (this.audioContext) {
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = this.masterVolume;
        this.isInitialized = true;

        // iOS Safari: AudioContext starts suspended, resume on first user gesture
        if (this.audioContext.state === 'suspended') {
          this.unlockBound = this.unlockAudioContext.bind(this);
          for (const evt of ['touchstart', 'pointerdown', 'click'] as const) {
            document.addEventListener(evt, this.unlockBound, { once: false, capture: true });
          }
        }
      }
    } catch (error) {
      console.warn('AudioContext initialization failed:', error);
    }
  }

  private unlockAudioContext(): void {
    if (!this.audioContext || this.audioContext.state !== 'suspended') {
      this.removeUnlockListeners();
      return;
    }
    this.audioContext.resume().then(() => {
      this.removeUnlockListeners();
    }).catch(() => {});
  }

  private removeUnlockListeners(): void {
    if (!this.unlockBound) return;
    for (const evt of ['touchstart', 'pointerdown', 'click'] as const) {
      document.removeEventListener(evt, this.unlockBound, { capture: true });
    }
    this.unlockBound = null;
  }

  /** Suspend audio (e.g. when page hidden) */
  suspend(): void {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend().catch(() => {});
    }
  }

  /** Resume audio (e.g. when page visible) */
  resume(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null;
  }

  play(soundId: string): void {
    if (!this.isReady() || !this.audioContext || !this.masterGain) return;

    const config = SOUND_CONFIGS[soundId];
    if (!config) {
      console.warn(`Unknown sound ID: ${soundId}`);
      return;
    }

    try {
      this.synthesizeSound(config);
    } catch (error) {
      console.warn(`Error playing sound ${soundId}:`, error);
    }
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.audioContext.currentTime,
        0.01
      );
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : this.masterVolume,
        this.audioContext.currentTime,
        0.01
      );
    }
  }

  isMutedState(): boolean {
    return this.isMuted;
  }

  private synthesizeSound(config: SoundConfig): void {
    if (!this.audioContext || !this.masterGain) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const { duration, volume, envelopeAttack, envelopeDecay, envelopeRelease } = config;

    const oscillator = ctx.createOscillator();
    const oscillatorGain = ctx.createGain();
    oscillator.type = config.oscillatorType;
    oscillator.frequency.value = config.frequency;

    if (config.useNoise) {
      const bufferSize = ctx.sampleRate * duration;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      noiseSource.connect(noiseGain);
      noiseGain.connect(oscillatorGain);
      noiseGain.gain.value = 0.15;
      noiseSource.start(now);
      noiseSource.stop(now + duration + envelopeRelease);
    }

    if (config.frequencySweep) {
      const sweep = config.frequencySweep;
      oscillator.frequency.setValueAtTime(sweep.startFreq, now);
      oscillator.frequency.linearRampToValueAtTime(sweep.endFreq, now + sweep.duration);
    }

    oscillatorGain.gain.setValueAtTime(0, now);
    oscillatorGain.gain.linearRampToValueAtTime(volume, now + envelopeAttack);
    oscillatorGain.gain.linearRampToValueAtTime(volume * 0.7, now + envelopeAttack + envelopeDecay);
    oscillatorGain.gain.linearRampToValueAtTime(0, now + duration + envelopeRelease);

    oscillatorGain.connect(this.masterGain);

    oscillator.connect(oscillatorGain);
    oscillator.start(now);
    oscillator.stop(now + duration + envelopeRelease);
  }
}

export function getAudioManager(): AudioManager {
  return AudioManager.getInstance();
}
