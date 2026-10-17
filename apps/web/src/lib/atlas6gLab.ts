/** Research-only deterministic RF link model; NOT a 6G modem or live spectrum control. */
export type LinkInput = {
  frequencyGHz: number;
  distanceMeters: number;
  transmitPowerDbm: number;
  txGainDbi: number;
  rxGainDbi: number;
  lossesDb: number;
  noiseFloorDbm: number;
  requiredSnrDb: number;
};
export type LinkResult = {
  freeSpacePathLossDb: number;
  receivedPowerDbm: number;
  snrDb: number;
  marginDb: number;
  viable: boolean;
  model: 'free-space-ideal';
};
export function simulateFreeSpaceLink(input: LinkInput): LinkResult {
  const values = Object.values(input);
  if (values.some(value => !Number.isFinite(value)) ||
      input.frequencyGHz <= 0 || input.distanceMeters <= 0 ||
      input.distanceMeters > 1e8 || input.frequencyGHz > 1000 ||
      input.lossesDb < 0) {
    throw new RangeError('invalid_rf_parameters');
  }
  // Friis free-space loss: frequency in MHz and distance in km.
  const loss = 32.44 + 20 * Math.log10(input.frequencyGHz * 1000) +
    20 * Math.log10(input.distanceMeters / 1000);
  const received = input.transmitPowerDbm + input.txGainDbi +
    input.rxGainDbi - input.lossesDb - loss;
  const snr = received - input.noiseFloorDbm;
  const margin = snr - input.requiredSnrDb;
  return {
    freeSpacePathLossDb: loss,
    receivedPowerDbm: received,
    snrDb: snr,
    marginDb: margin,
    viable: margin >= 0,
    model: 'free-space-ideal'
  };
}
export function selectBestSimulatedLink(candidates: readonly LinkInput[]): { index: number; result: LinkResult } | null {
  let best: { index: number; result: LinkResult } | null = null;
  candidates.forEach((candidate, index) => {
    const result = simulateFreeSpaceLink(candidate);
    if (result.viable && (!best || result.marginDb > best.result.marginDb)) best = { index, result };
  });
  return best;
}
