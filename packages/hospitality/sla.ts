export type HospitalitySlaPolicy = {
  responseMinutes: number;
  resolutionMinutes: number;
  warningMinutesBeforeBreach: number;
};

export type HospitalitySlaDecision =
  | { status: 'unconfigured' }
  | {
      status: 'configured';
      firstResponseDueAt: string;
      resolutionDueAt: string;
      warningAt: string;
    };

function addMinutes(iso: string, minutes: number) {
  const value = Date.parse(iso);
  if (!Number.isFinite(value)) throw new Error('invalid_sla_start');
  return new Date(value + minutes * 60_000).toISOString();
}

export function resolveHospitalitySla(input: {
  createdAt: string;
  policy: HospitalitySlaPolicy | null;
}): HospitalitySlaDecision {
  if (!input.policy) return { status: 'unconfigured' };

  const { responseMinutes, resolutionMinutes, warningMinutesBeforeBreach } = input.policy;
  if (
    !Number.isFinite(responseMinutes) || responseMinutes < 0 ||
    !Number.isFinite(resolutionMinutes) || resolutionMinutes <= 0 ||
    responseMinutes > resolutionMinutes ||
    !Number.isFinite(warningMinutesBeforeBreach) || warningMinutesBeforeBreach < 0 ||
    warningMinutesBeforeBreach > resolutionMinutes
  ) {
    throw new Error('invalid_sla_policy');
  }

  return {
    status: 'configured',
    firstResponseDueAt: addMinutes(input.createdAt, responseMinutes),
    resolutionDueAt: addMinutes(input.createdAt, resolutionMinutes),
    warningAt: addMinutes(input.createdAt, resolutionMinutes - warningMinutesBeforeBreach)
  };
}
