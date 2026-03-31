/**
 * Game mode state — tracks whether the current session is a daily challenge,
 * a challenge link, or a normal game. Read by BriefingScene/DebriefScene.
 */

export type GameMode = 'normal' | 'daily' | 'challenge';

interface GameModeState {
  mode: GameMode;
  seed: string | undefined;
  challengeScore: number | undefined;
}

let current: GameModeState = { mode: 'normal', seed: undefined, challengeScore: undefined };

export function setGameMode(mode: GameMode, seed?: string, challengeScore?: number): void {
  current = { mode, seed, challengeScore };
}

export function getGameMode(): GameModeState {
  return current;
}

export function resetGameMode(): void {
  current = { mode: 'normal', seed: undefined, challengeScore: undefined };
}
