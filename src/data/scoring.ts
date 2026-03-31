export const SCORING = {
  TANKER_DELIVERED: 2000,
  FAB_DESTROYED: 300,
  CMB_DESTROYED: 750,
  GUNBOAT_DESTROYED: 2500,
  MINE_CLEARED: 150,
  TANKER_LOST_PENALTY: 8,
  PLAYER_HIT_PENALTY: 100,
  PROXIMITY_KILL_BONUS: 0.75,
  PROXIMITY_RANGE: 120,
  COMBO_WINDOW: 2.5,
  COMBO_MAX_MULTIPLIER: 8,
  PICKUP_SCORE_BONUS: 500,
} as const;

export const OIL_FLOW_PENALTIES = {
  TANKER_DESTROYED: 8,
  TANKER_REACHED_DESTINATION: 0,
  PLAYER_DEATH: 25,
} as const;

export const BUDGET_COSTS = {
  SHELL_FIRED: 5_000,
  MISSILE_FIRED: 1_500_000,
  TANKER_LOST: 50_000_000,
  PLAYER_DESTROYED: 500_000_000,
} as const;

export function calculateScore(
  event: 'tanker_delivered' | 'fab_destroyed' | 'cmb_destroyed' | 'mine_cleared' | 'gunboat_destroyed'
): number {
  const rewards: Record<string, number> = {
    tanker_delivered: SCORING.TANKER_DELIVERED,
    fab_destroyed: SCORING.FAB_DESTROYED,
    cmb_destroyed: SCORING.CMB_DESTROYED,
    gunboat_destroyed: SCORING.GUNBOAT_DESTROYED,
    mine_cleared: SCORING.MINE_CLEARED,
  };
  return rewards[event] || 0;
}
