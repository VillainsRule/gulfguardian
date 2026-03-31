import { registerVar } from '@/debug/tuning-registry';

export interface EnemyStats {
  hp: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  scoreValue: number;
}

export const FAB_STATS: EnemyStats = {
  hp: 3,
  speed: 90,
  damage: 1,
  attackRange: 60,
  attackCooldown: 1.5,
  scoreValue: 300,
};

export const CMB_STATS: EnemyStats = {
  hp: 6,
  speed: 0,
  damage: 2,
  attackRange: 800,
  attackCooldown: 4.0,
  scoreValue: 750,
};

export const GUNBOAT_STATS: EnemyStats = {
  hp: 10,
  speed: 15,
  damage: 1,
  attackRange: 650,
  attackCooldown: 3.0,
  scoreValue: 2500,
};

export const DRONE_STATS: EnemyStats = {
  hp: 2,
  speed: 130,
  damage: 2,
  attackRange: 25,
  attackCooldown: 0.8,
  scoreValue: 500,
};

export const HELICOPTER_STATS: EnemyStats = {
  hp: 5,
  speed: 90,
  damage: 2,
  attackRange: 450,
  attackCooldown: 3.5,
  scoreValue: 1200,
};

// Register all enemy stats with tuning registry
function regEnemy(name: string, category: string, stats: EnemyStats, defaults: EnemyStats) {
  registerVar({ key: `enemy.${name}.hp`, label: 'HP', category, min: 1, max: 50, step: 1, get: () => stats.hp, set: v => { stats.hp = v; }, default: defaults.hp });
  registerVar({ key: `enemy.${name}.speed`, label: 'Speed', category, min: 0, max: 300, step: 5, get: () => stats.speed, set: v => { stats.speed = v; }, default: defaults.speed });
  registerVar({ key: `enemy.${name}.damage`, label: 'Damage', category, min: 0, max: 10, step: 1, get: () => stats.damage, set: v => { stats.damage = v; }, default: defaults.damage });
  registerVar({ key: `enemy.${name}.attackRange`, label: 'Attack Range', category, min: 10, max: 1200, step: 10, get: () => stats.attackRange, set: v => { stats.attackRange = v; }, default: defaults.attackRange });
  registerVar({ key: `enemy.${name}.attackCooldown`, label: 'Attack Cooldown', category, min: 0.1, max: 10, step: 0.1, get: () => stats.attackCooldown, set: v => { stats.attackCooldown = v; }, default: defaults.attackCooldown });
}

regEnemy('fab', 'Enemies: FAB', FAB_STATS, { ...FAB_STATS });
regEnemy('cmb', 'Enemies: CMB', CMB_STATS, { ...CMB_STATS });
regEnemy('gunboat', 'Enemies: Gunboat', GUNBOAT_STATS, { ...GUNBOAT_STATS });
regEnemy('drone', 'Enemies: Drone', DRONE_STATS, { ...DRONE_STATS });
regEnemy('helicopter', 'Enemies: Helicopter', HELICOPTER_STATS, { ...HELICOPTER_STATS });
