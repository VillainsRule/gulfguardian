import { RunState } from '@/core/run-state';
import { exportSnapshot } from './tuning-registry';

export interface KillBreakdown {
  fabs: number;
  cmbs: number;
  gunboats: number;
  drones: number;
  helicopters: number;
  mines: number;
}

export interface RunStats {
  runNumber: number;
  timestamp: number;
  seed: string;
  smartness: number;
  distanceTraveled: number;
  survivalTime: number;
  score: number;
  enemiesDestroyed: number;
  killBreakdown: KillBreakdown;
  shotsFired: number;
  shotsHit: number;
  missilesFired: number;
  missilesHit: number;
  damageDealt: number;
  damageTaken: number;
  tankersSaved: number;
  tankersLost: number;
  playerHP: number;
  bestCombo: number;
  pickupsCollected: number;
  outcome: 'victory' | 'defeat';
  configSnapshot: Record<string, number>;
}

// Live tracking counters — updated in real-time during gameplay
export const liveTracking = {
  shotsFired: 0,
  shotsHit: 0,
  missilesFired: 0,
  missilesHit: 0,
  damageDealt: 0,
  damageTaken: 0,
  pickupsCollected: 0,
  killBreakdown: { fabs: 0, cmbs: 0, gunboats: 0, drones: 0, helicopters: 0, mines: 0 } as KillBreakdown,
};

export function resetLiveTracking(): void {
  liveTracking.shotsFired = 0;
  liveTracking.shotsHit = 0;
  liveTracking.missilesFired = 0;
  liveTracking.missilesHit = 0;
  liveTracking.damageDealt = 0;
  liveTracking.damageTaken = 0;
  liveTracking.pickupsCollected = 0;
  liveTracking.killBreakdown = { fabs: 0, cmbs: 0, gunboats: 0, drones: 0, helicopters: 0, mines: 0 };
}

const allStats: RunStats[] = [];

export function recordRun(run: RunState, smartness: number): void {
  const stats: RunStats = {
    runNumber: allStats.length + 1,
    timestamp: Date.now(),
    seed: run.seed,
    smartness,
    distanceTraveled: run.cameraX,
    survivalTime: run.missionTime,
    score: run.score,
    enemiesDestroyed: run.enemiesDestroyed,
    killBreakdown: { ...liveTracking.killBreakdown },
    shotsFired: liveTracking.shotsFired,
    shotsHit: liveTracking.shotsHit,
    missilesFired: liveTracking.missilesFired,
    missilesHit: liveTracking.missilesHit,
    damageDealt: liveTracking.damageDealt,
    damageTaken: liveTracking.damageTaken,
    tankersSaved: run.tankersSaved,
    tankersLost: run.tankersLost,
    playerHP: run.playerHP,
    bestCombo: run.bestCombo,
    pickupsCollected: liveTracking.pickupsCollected,
    outcome: run.missionOutcome === 'victory' ? 'victory' : 'defeat',
    configSnapshot: exportSnapshot(),
  };
  allStats.push(stats);

  const accuracy = liveTracking.shotsFired > 0
    ? ((liveTracking.shotsHit / liveTracking.shotsFired) * 100).toFixed(1) + '%'
    : 'N/A';

  console.log(`[AutoPlay] Run #${allStats.length} complete:`, {
    outcome: stats.outcome,
    score: stats.score,
    distance: Math.round(stats.distanceTraveled),
    time: stats.survivalTime.toFixed(1) + 's',
    kills: stats.enemiesDestroyed,
    accuracy,
    tankers: `${stats.tankersSaved}/${stats.tankersSaved + stats.tankersLost}`,
  });
}

export function getStats(): RunStats[] {
  return allStats;
}

export function clearStats(): void {
  allStats.length = 0;
}

export function downloadStatsJSON(): void {
  if (allStats.length === 0) return;

  const victories = allStats.filter(s => s.outcome === 'victory').length;
  const totalShots = allStats.reduce((s, r) => s + r.shotsFired, 0);
  const totalHits = allStats.reduce((s, r) => s + r.shotsHit, 0);
  const totalMissiles = allStats.reduce((s, r) => s + r.missilesFired, 0);
  const totalMissileHits = allStats.reduce((s, r) => s + r.missilesHit, 0);

  const data = {
    exportedAt: new Date().toISOString(),
    runCount: allStats.length,
    summary: {
      victories,
      defeats: allStats.length - victories,
      winRate: +(victories / allStats.length * 100).toFixed(1),
      avgScore: Math.round(allStats.reduce((s, r) => s + r.score, 0) / allStats.length),
      avgKills: +(allStats.reduce((s, r) => s + r.enemiesDestroyed, 0) / allStats.length).toFixed(1),
      avgTime: +(allStats.reduce((s, r) => s + r.survivalTime, 0) / allStats.length).toFixed(1),
      avgDistance: Math.round(allStats.reduce((s, r) => s + r.distanceTraveled, 0) / allStats.length),
      avgBestCombo: +(allStats.reduce((s, r) => s + r.bestCombo, 0) / allStats.length).toFixed(1),
      gunAccuracy: totalShots > 0 ? +((totalHits / totalShots) * 100).toFixed(1) : 0,
      missileAccuracy: totalMissiles > 0 ? +((totalMissileHits / totalMissiles) * 100).toFixed(1) : 0,
      totalKillBreakdown: {
        fabs: allStats.reduce((s, r) => s + r.killBreakdown.fabs, 0),
        cmbs: allStats.reduce((s, r) => s + r.killBreakdown.cmbs, 0),
        gunboats: allStats.reduce((s, r) => s + r.killBreakdown.gunboats, 0),
        drones: allStats.reduce((s, r) => s + r.killBreakdown.drones, 0),
        helicopters: allStats.reduce((s, r) => s + r.killBreakdown.helicopters, 0),
        mines: allStats.reduce((s, r) => s + r.killBreakdown.mines, 0),
      },
    },
    runs: allStats,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gulf-guardian-stats-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`[AutoPlay] Stats JSON downloaded (${allStats.length} runs)`);
}

export function getStatsSummary(): string {
  if (allStats.length === 0) return 'No stats recorded.';

  const victories = allStats.filter(s => s.outcome === 'victory').length;
  const avgScore = allStats.reduce((s, r) => s + r.score, 0) / allStats.length;
  const avgDist = allStats.reduce((s, r) => s + r.distanceTraveled, 0) / allStats.length;
  const avgTime = allStats.reduce((s, r) => s + r.survivalTime, 0) / allStats.length;
  const avgKills = allStats.reduce((s, r) => s + r.enemiesDestroyed, 0) / allStats.length;
  const totalShots = allStats.reduce((s, r) => s + r.shotsFired, 0);
  const totalHits = allStats.reduce((s, r) => s + r.shotsHit, 0);
  const accuracy = totalShots > 0 ? ((totalHits / totalShots) * 100).toFixed(1) : 'N/A';

  return [
    `Runs: ${allStats.length} | Wins: ${victories}/${allStats.length} (${(victories / allStats.length * 100).toFixed(0)}%)`,
    `Avg Score: ${Math.round(avgScore)} | Avg Kills: ${avgKills.toFixed(1)}`,
    `Avg Distance: ${Math.round(avgDist)} | Avg Time: ${avgTime.toFixed(1)}s`,
    `Gun Accuracy: ${accuracy}`,
  ].join('\n');
}

/** Get formatted stats lines for in-panel display */
export function getStatsForDisplay(): { summary: string[]; runs: string[] } {
  if (allStats.length === 0) {
    return { summary: ['No stats recorded yet.'], runs: [] };
  }

  const victories = allStats.filter(s => s.outcome === 'victory').length;
  const avgScore = Math.round(allStats.reduce((s, r) => s + r.score, 0) / allStats.length);
  const avgKills = +(allStats.reduce((s, r) => s + r.enemiesDestroyed, 0) / allStats.length).toFixed(1);
  const avgTime = +(allStats.reduce((s, r) => s + r.survivalTime, 0) / allStats.length).toFixed(1);
  const totalShots = allStats.reduce((s, r) => s + r.shotsFired, 0);
  const totalHits = allStats.reduce((s, r) => s + r.shotsHit, 0);
  const accuracy = totalShots > 0 ? ((totalHits / totalShots) * 100).toFixed(1) + '%' : 'N/A';
  const totalMissiles = allStats.reduce((s, r) => s + r.missilesFired, 0);
  const totalMissileHits = allStats.reduce((s, r) => s + r.missilesHit, 0);
  const mslAccuracy = totalMissiles > 0 ? ((totalMissileHits / totalMissiles) * 100).toFixed(1) + '%' : 'N/A';

  const summary = [
    `RUNS: ${allStats.length}  WIN RATE: ${victories}/${allStats.length} (${(victories / allStats.length * 100).toFixed(0)}%)`,
    `AVG SCORE: ${avgScore}  AVG KILLS: ${avgKills}  AVG TIME: ${avgTime}s`,
    `GUN ACCURACY: ${accuracy}  MSL ACCURACY: ${mslAccuracy}`,
    `KILL BREAKDOWN:  FAB ${allStats.reduce((s, r) => s + r.killBreakdown.fabs, 0)}  CMB ${allStats.reduce((s, r) => s + r.killBreakdown.cmbs, 0)}  GUNBOAT ${allStats.reduce((s, r) => s + r.killBreakdown.gunboats, 0)}  DRONE ${allStats.reduce((s, r) => s + r.killBreakdown.drones, 0)}  HELI ${allStats.reduce((s, r) => s + r.killBreakdown.helicopters, 0)}  MINE ${allStats.reduce((s, r) => s + r.killBreakdown.mines, 0)}`,
  ];

  const runs = allStats.slice(-20).map(s => {
    const acc = s.shotsFired > 0 ? ((s.shotsHit / s.shotsFired) * 100).toFixed(0) + '%' : '--';
    return `#${s.runNumber} ${s.outcome === 'victory' ? 'WIN' : 'LOSS'}  S:${s.score}  K:${s.enemiesDestroyed}  T:${s.survivalTime.toFixed(0)}s  Acc:${acc}  Tkr:${s.tankersSaved}/${s.tankersSaved + s.tankersLost}`;
  });

  return { summary, runs };
}
