import { registerVar } from '@/debug/tuning-registry';

export interface ProjectileData {
  speed: number;
  damage: number;
  lifetime: number;
  radius: number;
  /** Explosion blast radius on impact — damages all enemies within range (0 = no splash) */
  blastRadius: number;
}

export const PLAYER_MISSILE: ProjectileData = {
  speed: 110,          // Snappy missile launch — homes in on targets
  damage: 6,           // Heavy warhead — punishes what it hits
  lifetime: 9.9,       // Long range homing
  radius: 5,
  blastRadius: 55,     // Wider explosion splash damages nearby enemies
};

export const CMB_MISSILE: ProjectileData = {
  speed: 70,
  damage: 2,
  lifetime: 10.0,
  radius: 5,
  blastRadius: 0,
};

export const GUNBOAT_MISSILE: ProjectileData = {
  speed: 60,
  damage: 1,
  lifetime: 9.0,
  radius: 4,
  blastRadius: 0,
};

export const MIRV_SUBMISSILE: ProjectileData = {
  speed: 90,
  damage: 1,
  lifetime: 3.0,
  radius: 3,
  blastRadius: 30,    // Smaller splash for submissiles
};

export const HELICOPTER_MISSILE: ProjectileData = {
  speed: 80,
  damage: 2,
  lifetime: 8.0,
  radius: 5,
  blastRadius: 0,
};

export const PLAYER_GUN: ProjectileData = {
  speed: 720,          // Faster bullets feel punchier
  damage: 1,
  lifetime: 0.45,      // Extended range (~325px)
  radius: 4,
  blastRadius: 0,
};

// Register projectile tuning vars
function regProjectile(name: string, label: string, data: ProjectileData, defaults: ProjectileData) {
  registerVar({ key: `projectile.${name}.speed`, label: `${label} Speed`, category: 'Weapons', min: 10, max: 1500, step: 10, get: () => data.speed, set: v => { data.speed = v; }, default: defaults.speed });
  registerVar({ key: `projectile.${name}.damage`, label: `${label} Damage`, category: 'Weapons', min: 0, max: 20, step: 1, get: () => data.damage, set: v => { data.damage = v; }, default: defaults.damage });
  registerVar({ key: `projectile.${name}.lifetime`, label: `${label} Lifetime`, category: 'Weapons', min: 0.1, max: 20, step: 0.1, get: () => data.lifetime, set: v => { data.lifetime = v; }, default: defaults.lifetime });
  if (data.blastRadius > 0 || name === 'playerMissile') {
    registerVar({ key: `projectile.${name}.blastRadius`, label: `${label} Blast Radius`, category: 'Weapons', min: 0, max: 200, step: 5, get: () => data.blastRadius, set: v => { data.blastRadius = v; }, default: defaults.blastRadius });
  }
}

regProjectile('playerGun', 'Gun', PLAYER_GUN, { ...PLAYER_GUN });
regProjectile('playerMissile', 'Missile', PLAYER_MISSILE, { ...PLAYER_MISSILE });
regProjectile('cmbMissile', 'CMB Missile', CMB_MISSILE, { ...CMB_MISSILE });
regProjectile('gunboatMissile', 'Gunboat Missile', GUNBOAT_MISSILE, { ...GUNBOAT_MISSILE });
regProjectile('helicopterMissile', 'Helo Missile', HELICOPTER_MISSILE, { ...HELICOPTER_MISSILE });
