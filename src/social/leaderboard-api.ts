/**
 * Leaderboard API — score submission, retrieval, and callsign claiming.
 */

import type { RunState } from '@/core/run-state';
import { getCallsign, getClaimToken } from './player-identity';

export interface SubmitResult {
  ok: boolean;
  rank?: number;
  country?: string;
  error?: string;
}

export interface LeaderboardEntry {
  rank: number;
  callsign: string;
  score: number;
  country?: string;
  wave: number;
  tankersSaved: number;
}

const API_BASE = '/api/leaderboard';

export async function submitScore(run: RunState): Promise<SubmitResult> {
  try {
    const claimToken = getClaimToken();
    if (!claimToken) {
      return { ok: false, error: 'Missing claim token' };
    }
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callsign: getCallsign(),
        claimToken,
        score: run.score,
        wave: run.wave,
        tankersSaved: run.tankersSaved,
        tankersLost: run.tankersLost,
        enemiesDestroyed: run.enemiesDestroyed,
        missionTime: Math.floor(run.missionTime),
        missionOutcome: run.missionOutcome,
        seed: run.seed,
      }),
    });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const errorText = typeof errorBody.error === 'string' ? errorBody.error : `HTTP ${res.status}`;
      return { ok: false, error: errorText };
    }
    const data = await res.json();
    return {
      ok: true,
      rank: data.rank,
      country: data.country,
    };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Network error' };
  }
}

export async function fetchLeaderboard(limit: number = 20): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${API_BASE}?limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ─── Callsign claiming ───

export async function checkCallsign(callsign: string): Promise<{ available: boolean }> {
  try {
    const res = await fetch('/api/callsign/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callsign }),
    });
    if (!res.ok) return { available: false };
    return await res.json();
  } catch {
    return { available: false };
  }
}

export async function claimCallsign(
  callsign: string,
  claimToken: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/callsign/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callsign, claimToken }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: data.ok ?? true, error: data.error };
  } catch (e: any) {
    return { ok: false, error: e.message || 'Network error' };
  }
}
