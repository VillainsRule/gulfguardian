import { DamageFlash } from '@/effects/screen/DamageFlash';
import { KillFlash } from '@/effects/screen/KillFlash';
import { GameLayers } from './game-types';

export interface ScreenEffectsState {
  damageFlash: DamageFlash | null;
  killFlash: KillFlash | null;
}

export function createScreenEffectsState(): ScreenEffectsState {
  return { damageFlash: null, killFlash: null };
}

export function triggerKillFlash(state: ScreenEffectsState, layers: GameLayers): void {
  if (state.killFlash) layers.uiLayer.removeChild(state.killFlash);
  state.killFlash = new KillFlash(0.10, 0.18);
  layers.uiLayer.addChild(state.killFlash);
}

export function triggerDamageFlash(state: ScreenEffectsState, layers: GameLayers, damageAmount: number): void {
  if (state.damageFlash) layers.uiLayer.removeChild(state.damageFlash);
  const intensity = Math.min(0.55, 0.25 + damageAmount * 0.12);
  state.damageFlash = new DamageFlash(0.4, intensity);
  layers.uiLayer.addChild(state.damageFlash);
}

export function triggerTankerDamageFlash(state: ScreenEffectsState, layers: GameLayers, damageAmount: number): void {
  if (state.damageFlash) layers.uiLayer.removeChild(state.damageFlash);
  const intensity = Math.min(0.45, 0.15 + damageAmount * 0.1);
  state.damageFlash = new DamageFlash(0.5, intensity);
  layers.uiLayer.addChild(state.damageFlash);
}

export function updateScreenEffects(state: ScreenEffectsState, dt: number, layers: GameLayers): void {
  if (state.damageFlash) {
    state.damageFlash.update(dt);
    if (state.damageFlash.finished) {
      layers.uiLayer.removeChild(state.damageFlash);
      state.damageFlash = null;
    }
  }
  if (state.killFlash) {
    state.killFlash.update(dt);
    if (state.killFlash.finished) {
      layers.uiLayer.removeChild(state.killFlash);
      state.killFlash = null;
    }
  }
}
