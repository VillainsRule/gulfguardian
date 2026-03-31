import { COLORS } from '@/app/constants';
import { getRun } from '@/core/run-state';
import { InputManager } from '@/core/input';
import { SeededRNG } from '@/core/rng';
import { CombatSystem } from '@/systems/combat/combat-system';
import { BUDGET_COSTS } from '@/data/scoring';
import { playSfx } from '@/audio/sfx';
import { GameEntities, GameLayers } from './game-types';
import { firePlayerMissile } from './game-combat';
import { spawnFlash } from './game-effects';
import { MslAwayState, showMslAway } from './game-ui';
import { Hud } from '@/ui/hud/Hud';
import { fireGunShot } from './game-autoplay';
import { liveTracking } from '@/debug/StatsRecorder';

export function handleCombatInput(
  dt: number,
  input: InputManager,
  cooldowns: { missileCooldownTimer: number; gunCooldownTimer: number },
  entities: GameEntities,
  layers: GameLayers,
  rng: SeededRNG,
  mslAwayState: MslAwayState,
  hud: Hud,
  gunFireRate: number,
  getWorldMousePos: () => { x: number; y: number },
): void {
  cooldowns.missileCooldownTimer -= dt;
  cooldowns.gunCooldownTimer -= dt;

  const player = entities.playerShip;

  // Arrow keys / right joystick = directional gun fire
  const fireX = input.getFireAnalogX();
  const fireY = input.getFireAnalogY();

  const wantsGunFire = (fireX !== 0 || fireY !== 0) || input.isMouseDown();

  if (wantsGunFire) {
    if (cooldowns.gunCooldownTimer <= 0 && CombatSystem.tryFireGun()) {
      const run = getRun();
      cooldowns.gunCooldownTimer = run.rapidFireActive ? gunFireRate * 0.5 : gunFireRate;

      let toX: number, toY: number;
      if (fireX !== 0 || fireY !== 0) {
        const len = Math.sqrt(fireX * fireX + fireY * fireY);
        toX = player.x + (fireX / len) * 400;
        toY = player.y + (fireY / len) * 400;
      } else {
        const target = getWorldMousePos();
        toX = target.x;
        toY = target.y;
      }

      const fired = fireGunShot(player.x, player.y, toX, toY, entities, layers, rng);
      if (run.multifireActive) {
        const baseAngle = Math.atan2(toY - player.y, toX - player.x);
        for (const offset of [-0.15, 0.15]) {
          const a = baseAngle + offset;
          fireGunShot(player.x, player.y, player.x + Math.cos(a) * 400, player.y + Math.sin(a) * 400, entities, layers, rng);
        }
      }
      if (fired) playSfx('gunFire');
    }
  }

  // Space/RMB = fire missile
  const manualAimLaunch = input.isRightMouseDown();
  const wantsMissile = input.consumeMissileTrigger() || manualAimLaunch;
  if (wantsMissile && cooldowns.missileCooldownTimer <= 0 && CombatSystem.tryFireMissile()) {
    const run = getRun();
    const missileTarget = manualAimLaunch
      ? getWorldMousePos()
      : { x: player.x + 500, y: player.y };
    firePlayerMissile(entities, layers, missileTarget, !manualAimLaunch);
    run.budget += BUDGET_COSTS.MISSILE_FIRED;
    liveTracking.missilesFired++;

    cooldowns.missileCooldownTimer = CombatSystem.getMissileFireCooldown();
    CombatSystem.triggerScreenShake(4, 0.15);
    spawnFlash(entities.playerShip.x - 15, entities.playerShip.y, entities, layers, COLORS.amber);
    showMslAway(mslAwayState, layers);
    hud.flashMissileCount();
  }
}
