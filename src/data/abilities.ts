import { registerVar } from '@/debug/tuning-registry';

export interface AbilityCooldown {
  ability: string;
  cooldown: number;
  duration: number;
  ammoConsume: number;
}

export const ABILITY_COOLDOWNS: Record<string, AbilityCooldown> = {
  MISSILE: {
    ability: 'missile',
    cooldown: 0.22,
    duration: 0,
    ammoConsume: 1,
  },
};

export let MISSILE_AMMO_MAX = 16;

export function getAbilityCooldown(ability: string): AbilityCooldown {
  return ABILITY_COOLDOWNS[ability.toUpperCase()] || ABILITY_COOLDOWNS.MISSILE;
}

registerVar({ key: 'ability.missileCooldown', label: 'Missile Cooldown', category: 'Missiles', min: 0.05, max: 2, step: 0.05, get: () => ABILITY_COOLDOWNS.MISSILE.cooldown, set: v => { ABILITY_COOLDOWNS.MISSILE.cooldown = v; }, default: 0.22 });
registerVar({ key: 'ability.missileAmmoMax', label: 'Max Missile Ammo', category: 'Missiles', min: 1, max: 50, step: 1, get: () => MISSILE_AMMO_MAX, set: v => { MISSILE_AMMO_MAX = v; }, default: 16 });
