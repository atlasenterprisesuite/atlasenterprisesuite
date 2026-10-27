/** ATLAS sovereign Linux sandbox: configuration contract only; no process spawning. */
export type LinuxSandboxRequest = {
  step: 'gps5d-unit' | 'gps5d-typecheck' | 'gps5d-postgres';
  executableId: 'vitest-offline' | 'tsc-offline' | 'postgres-local';
  checkoutSha: string;
  readonlyCheckout: boolean;
  privateTmp: boolean;
  dropCapabilities: boolean;
  noNewPrivileges: boolean;
  denyIpv4: boolean;
  denyIpv6: boolean;
  denyDns: boolean;
  denyMetadata: boolean;
  noInheritedEnvironment: boolean;
  noHostSockets: boolean;
  noWritableHostMounts: boolean;
  pidNamespace: boolean;
  mountNamespace: boolean;
  networkNamespace: boolean;
  userNamespace: boolean;
  cgroupLimits: boolean;
  timeoutMs: number;
  memoryMb: number;
  outputBytes: number;
  cleanupRequired: boolean;
};
export type LinuxSandboxValidation = { allowed: boolean; reasons: string[] };
const STEP_EXECUTABLE = {
  'gps5d-unit': 'vitest-offline',
  'gps5d-typecheck': 'tsc-offline',
  'gps5d-postgres': 'postgres-local'
} as const;
const REQUIRED: readonly (keyof LinuxSandboxRequest)[] = [
  'readonlyCheckout','privateTmp','dropCapabilities','noNewPrivileges',
  'denyIpv4','denyIpv6','denyDns','denyMetadata','noInheritedEnvironment',
  'noHostSockets','noWritableHostMounts','pidNamespace','mountNamespace',
  'networkNamespace','userNamespace','cgroupLimits','cleanupRequired'
];

/** Never convert this result into a claim that host isolation was observed. */
export function validateLinuxSandboxRequest(input: unknown): LinuxSandboxValidation {
  const reasons: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { allowed:false,reasons:['invalid-request'] };
  const r = input as Partial<LinuxSandboxRequest>;
  if (!(r.step && Object.hasOwn(STEP_EXECUTABLE, r.step))) reasons.push('unsupported-step');
  else if (r.executableId !== STEP_EXECUTABLE[r.step]) reasons.push('executable-not-allowlisted');
  if (typeof r.checkoutSha !== 'string' || !/^[0-9a-f]{40}$/.test(r.checkoutSha)) reasons.push('invalid-sha');
  for (const field of REQUIRED) if (r[field] !== true) reasons.push('required-' + field);
  for (const [field,limit] of [['timeoutMs',1200000],['memoryMb',4096],['outputBytes',10485760]] as const) {
    const value = r[field];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > limit) reasons.push('invalid-' + field);
  }
  return { allowed:reasons.length === 0,reasons };
}
