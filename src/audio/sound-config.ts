export interface SoundConfig {
  oscillatorType: 'sine' | 'square' | 'sawtooth' | 'triangle';
  frequency: number;
  duration: number;
  volume: number;
  useNoise: boolean;
  envelopeAttack: number;
  envelopeDecay: number;
  envelopeRelease: number;
  frequencySweep?: {
    startFreq: number;
    endFreq: number;
    duration: number;
  };
}

export const SOUND_CONFIGS: Record<string, SoundConfig> = {
  missile_fire: {
    oscillatorType: 'square',
    frequency: 250,
    duration: 0.15,
    volume: 0.4,
    useNoise: false,
    envelopeAttack: 0.01,
    envelopeDecay: 0.1,
    envelopeRelease: 0.04,
    frequencySweep: { startFreq: 250, endFreq: 150, duration: 0.15 },
  },
  missile_hit: {
    oscillatorType: 'sine',
    frequency: 800,
    duration: 0.25,
    volume: 0.5,
    useNoise: true,
    envelopeAttack: 0.02,
    envelopeDecay: 0.2,
    envelopeRelease: 0.03,
    frequencySweep: { startFreq: 800, endFreq: 300, duration: 0.25 },
  },
  explosion: {
    oscillatorType: 'sine',
    frequency: 150,
    duration: 0.5,
    volume: 0.6,
    useNoise: true,
    envelopeAttack: 0.03,
    envelopeDecay: 0.4,
    envelopeRelease: 0.07,
    frequencySweep: { startFreq: 150, endFreq: 50, duration: 0.5 },
  },
  tanker_destroyed: {
    oscillatorType: 'sine',
    frequency: 200,
    duration: 0.8,
    volume: 0.55,
    useNoise: true,
    envelopeAttack: 0.05,
    envelopeDecay: 0.6,
    envelopeRelease: 0.15,
    frequencySweep: { startFreq: 200, endFreq: 40, duration: 0.8 },
  },
  wave_start: {
    oscillatorType: 'square',
    frequency: 500,
    duration: 0.4,
    volume: 0.45,
    useNoise: false,
    envelopeAttack: 0.03,
    envelopeDecay: 0.3,
    envelopeRelease: 0.07,
  },
  game_over: {
    oscillatorType: 'sine',
    frequency: 350,
    duration: 0.6,
    volume: 0.5,
    useNoise: true,
    envelopeAttack: 0.04,
    envelopeDecay: 0.45,
    envelopeRelease: 0.11,
    frequencySweep: { startFreq: 350, endFreq: 100, duration: 0.6 },
  },
  button_click: {
    oscillatorType: 'triangle',
    frequency: 1000,
    duration: 0.05,
    volume: 0.2,
    useNoise: false,
    envelopeAttack: 0.002,
    envelopeDecay: 0.045,
    envelopeRelease: 0.003,
  },
};
