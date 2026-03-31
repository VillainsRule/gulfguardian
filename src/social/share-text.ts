import type { RunState } from '@/core/run-state';
import { generateDailyEmoji } from './daily-challenge';

/**
 * Build full share text with all stats.
 */
export function buildShareText(
  run: RunState, isDaily: boolean, dailyNumber: number | null, isVictory: boolean,
): string {
  const wave = Math.max(0, Math.min(5, Math.floor(run.wave)));
  const outcome = isVictory ? 'CONVOY DELIVERED' : 'MISSION FAILED';
  const marker = isVictory ? '✓' : '✗';
  const line = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  let header = 'GULF GUARDIAN — POST-MISSION ANALYSIS';
  if (isDaily && dailyNumber !== null) {
    header = `GULF GUARDIAN — DAILY #${dailyNumber}`;
  }

  const textLines = [
    header,
    line,
    `Result: ${outcome} ${marker}`,
    `Score:  ${String(run.score).padStart(8, '0')}`,
    `Convoy: ${run.tankersSaved}/${run.totalConvoyTankers} tankers delivered | Lost: ${run.tankersLost}`,
    `Enemies Destroyed: ${run.enemiesDestroyed} | Best Combo: ${run.bestCombo}x`,
    `Sectors Cleared: ${wave}/5 | Time: ${Math.floor(run.missionTime)}s`,
    `Hormuz Progress: ${'🟩'.repeat(wave)}${'⬜'.repeat(5 - wave)}`,
    `Oil Price: $${Math.round(run.oilPrice)}/bbl`,
  ];

  if (isDaily) {
    const emoji = generateDailyEmoji(
      run.tankersSaved, run.totalConvoyTankers, run.wave, run.bestCombo, isVictory,
    );
    textLines.push(emoji);
  }

  textLines.push(line, '#GulfGuardian  gulfguardian.io');
  return textLines.join('\n');
}

/**
 * Build short share text for Twitter/X (fits ~280 chars).
 */
export function buildShareTextShort(
  run: RunState, isDaily: boolean, dailyNumber: number | null, isVictory: boolean,
): string {
  const wave = Math.max(0, Math.min(5, Math.floor(run.wave)));
  const marker = isVictory ? '✓' : '✗';
  const outcome = isVictory ? 'CONVOY DELIVERED' : 'MISSION FAILED';

  let header = 'GULF GUARDIAN';
  if (isDaily && dailyNumber !== null) {
    header = `GULF GUARDIAN — DAILY #${dailyNumber}`;
  }

  const parts = [
    header,
    `${outcome} ${marker} | Score: ${String(run.score).padStart(8, '0')}`,
    `Convoy: ${run.tankersSaved}/${run.totalConvoyTankers} | Kills: ${run.enemiesDestroyed} | Combo: ${run.bestCombo}x`,
    `${'🟩'.repeat(wave)}${'⬜'.repeat(5 - wave)}`,
  ];

  if (isDaily) {
    const emoji = generateDailyEmoji(
      run.tankersSaved, run.totalConvoyTankers, run.wave, run.bestCombo, isVictory,
    );
    parts.push(emoji);
  }

  parts.push('#GulfGuardian gulfguardian.io');
  return parts.join('\n');
}
