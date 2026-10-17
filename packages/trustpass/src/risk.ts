import type { RiskBand, RiskReason, RiskResult } from './types';

function clampScore(value: number) {
  if (!Number.isFinite(value)) return value > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function riskBand(score: number): RiskBand {
  const normalized = clampScore(score);
  if (normalized <= 25) return 'low';
  if (normalized <= 55) return 'medium';
  if (normalized <= 80) return 'high';
  return 'critical';
}

export function calculateRisk(reasons: readonly RiskReason[]): RiskResult {
  const counted = new Set<string>();
  const reasonCodes: string[] = [];
  let score = 0;

  for (const reason of reasons) {
    const code = String(reason.code || '').trim();
    if (!code) continue;

    if (!counted.has(code)) reasonCodes.push(code);
    if (!reason.repeatable && counted.has(code)) continue;

    counted.add(code);
    score += Number.isFinite(reason.weight) ? reason.weight : 0;
  }

  const normalized = clampScore(score);
  return {
    score: normalized,
    band: riskBand(normalized),
    reasonCodes
  };
}
