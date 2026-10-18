export type AtlasPlanId = 'core' | 'pro' | 'max';

export type SpeedClass = 'standard' | 'fast' | 'max';

export type AtlasCapability =
  | 'advanced-models'
  | 'priority-execution'
  | 'persistent-operators'
  | 'expanded-memory'
  | 'expanded-storage';

export type EntitlementStatus = 'allowed' | 'denied' | 'degraded' | 'unknown';

export interface EntitlementDecision {
  status: EntitlementStatus;
  planId?: AtlasPlanId;
  reason?: string;
  evidenceRef?: string;
}

export interface PlanDefinition {
  id: AtlasPlanId;
  displayName: string;
  speedClasses: readonly SpeedClass[];
  capabilities: readonly AtlasCapability[];
}
