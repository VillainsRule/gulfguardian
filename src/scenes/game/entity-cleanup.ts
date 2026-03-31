import { getRun, WORLD_WIDTH } from '@/core/run-state';
import { GAME_WIDTH } from '@/app/constants';
import { stopLoopSfx } from '@/audio/sfx';
import { GameEntities, GameLayers } from './game-types';

export function cleanupEntities(entities: GameEntities, layers: GameLayers): void {
  const run = getRun();
  const cullLeft = run.cameraX - 200;
  const cullRight = run.cameraX + GAME_WIDTH + 400;

  removeDeadOrOffscreen(entities.tankers, layers.entityLayer, t => !t.alive || t.completed);
  removeDeadOrOffscreen(entities.fabs, layers.entityLayer, f => !f.alive || f.x < cullLeft);
  removeDeadOrOffscreen(entities.cmbs, layers.entityLayer, c => !c.alive || c.x < cullLeft);
  removeDeadOrOffscreen(entities.gunboats, layers.entityLayer, g => !g.alive || g.x < cullLeft);
  removeDeadOrOffscreen(entities.drones, layers.entityLayer, d => !d.alive || d.x < cullLeft);
  for (let i = entities.helicopters.length - 1; i >= 0; i--) {
    const h = entities.helicopters[i];
    if (!h.alive || h.x < cullLeft) {
      stopLoopSfx(`heli_rotor_${h.id}`);
      layers.entityLayer.removeChild(h);
      h.destroy?.();
      entities.helicopters.splice(i, 1);
    }
  }
  removeDeadOrOffscreen(entities.mines, layers.entityLayer, m => !m.alive || m.x < cullLeft);
  removeDeadOrOffscreen(entities.missiles, layers.entityLayer, m => !m.alive || m.x < cullLeft - 100 || m.x > cullRight + 100);
  // Bullets are data-only (no Pixi Container) — just filter the array
  for (let i = entities.bullets.length - 1; i >= 0; i--) {
    const b = entities.bullets[i];
    if (!b.alive || b.x < cullLeft - 50 || b.x > cullRight + 50) {
      entities.bullets.splice(i, 1);
    }
  }
  removeDeadOrOffscreen(entities.pickups, layers.entityLayer, p => !p.alive || p.x < cullLeft);

  for (let i = entities.effects.length - 1; i >= 0; i--) {
    if (entities.effects[i].finished) {
      layers.effectLayer.removeChild(entities.effects[i]);
      entities.effects[i].destroy?.();
      entities.effects.splice(i, 1);
    }
  }
}

function removeDeadOrOffscreen<T extends { destroy?: () => void }>(
  list: T[], layer: { removeChild: (child: any) => void }, shouldRemove: (item: T) => boolean,
): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (shouldRemove(list[i])) {
      layer.removeChild(list[i]);
      list[i].destroy?.();
      list.splice(i, 1);
    }
  }
}
