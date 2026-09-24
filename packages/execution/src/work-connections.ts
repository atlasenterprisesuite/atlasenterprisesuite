export type WorkConnectionMechanism = 'oauth' | 'session' | 'vault';
export type WorkConnectionStatus = 'active' | 'revoked' | 'expired' | 'error';

export type WorkConnectionRef = {
  id: string;
  provider: string;
  mechanism: WorkConnectionMechanism;
  status: WorkConnectionStatus;
  capabilities: string[];
};

export type ConnectionRequirement = {
  provider: string;
  capability: string;
};

export function connectionCanSatisfy(ref: WorkConnectionRef, requirement: ConnectionRequirement) {
  if (ref.status !== 'active') return false;
  if (ref.provider.trim().toLowerCase() !== requirement.provider.trim().toLowerCase()) return false;
  return ref.capabilities.includes(requirement.capability);
}
