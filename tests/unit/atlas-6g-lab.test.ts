import { describe, expect, it } from 'vitest';
import { selectBestSimulatedLink, simulateFreeSpaceLink } from '../../apps/web/src/lib/atlas6gLab';

const input = {
  frequencyGHz: 3.5, distanceMeters: 100, transmitPowerDbm: 20,
  txGainDbi: 0, rxGainDbi: 0, lossesDb: 0,
  noiseFloorDbm: -100, requiredSnrDb: 10
};
describe('ATLAS 6G Lab research-only link model', () => {
  it('computes Friis free-space path loss reproducibly', () => {
    expect(simulateFreeSpaceLink(input).freeSpacePathLossDb).toBeCloseTo(83.32, 1);
    expect(simulateFreeSpaceLink(input)).toEqual(simulateFreeSpaceLink(input));
  });
  it('rejects impossible parameters rather than inventing results', () => {
    expect(() => simulateFreeSpaceLink({ ...input, distanceMeters: 0 })).toThrow('invalid_rf_parameters');
    expect(() => simulateFreeSpaceLink({ ...input, frequencyGHz: Number.NaN })).toThrow('invalid_rf_parameters');
  });
  it('selects viable simulated links only', () => {
    expect(selectBestSimulatedLink([{ ...input, distanceMeters: 100000 }, input])?.index).toBe(1);
    expect(selectBestSimulatedLink([{ ...input, distanceMeters: 100000 }])).toBeNull();
  });
});
