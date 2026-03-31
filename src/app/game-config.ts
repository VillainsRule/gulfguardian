import { GAME_WIDTH, GAME_HEIGHT } from '@/app/constants';

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  qualityPreset: 'low' | 'medium' | 'high';
  debug: boolean;
  defaultSeed: string;
  antiAlias: boolean;
  resolution: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  canvasWidth: GAME_WIDTH,
  canvasHeight: GAME_HEIGHT,
  qualityPreset: 'high',
  debug: false,
  defaultSeed: 'open-hormuz-stage-1',
  antiAlias: true,
  resolution: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
};

export function createGameConfig(overrides?: Partial<GameConfig>): GameConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
