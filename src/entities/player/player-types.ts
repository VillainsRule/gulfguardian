import { registerVar } from '@/debug/tuning-registry';

export interface PlayerStats {
  maxHP: number;
  speed: number;
  turnSpeed: number;
}

export const DEFAULT_PLAYER_STATS: PlayerStats = {
  maxHP: 5,
  speed: 230,          // Faster lateral movement for snappy dodging
  turnSpeed: 3.0,
};

registerVar({ key: 'player.maxHP', label: 'Max HP', category: 'Player', min: 1, max: 30, step: 1, get: () => DEFAULT_PLAYER_STATS.maxHP, set: v => { DEFAULT_PLAYER_STATS.maxHP = v; }, default: 5 });
registerVar({ key: 'player.speed', label: 'Speed', category: 'Player', min: 50, max: 500, step: 10, get: () => DEFAULT_PLAYER_STATS.speed, set: v => { DEFAULT_PLAYER_STATS.speed = v; }, default: 230 });
