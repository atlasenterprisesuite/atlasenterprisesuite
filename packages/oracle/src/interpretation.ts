import type { OracleCard, OracleInterpretationItem, OracleSpreadPosition } from './types';

export function buildOracleInterpretation(
  positions: readonly OracleSpreadPosition[],
  cards: readonly OracleCard[]
): OracleInterpretationItem[] {
  if (positions.length !== cards.length) throw new Error('oracle_spread_mismatch');
  return positions.map((position, index) => ({
    position,
    card: cards[index],
    reflection: `${position.label}: ${cards[index].longMessage}`
  }));
}
