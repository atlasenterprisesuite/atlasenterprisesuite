import type { AtlasPermission } from '../../core/src/index';
import type { AtlasRiskClass } from './approvals';
import type { AtlasEvidence } from './evidence';
import type { AtlasExecutionClass } from './types';

export type AtlasToolExecutionContext = {
  organizationId: string;
  actorId: string;
  taskId: string;
  stepId: string;
  traceId: string;
  idempotencyKey: string | null;
};

export type AtlasToolResult = {
  ok: boolean;
  resultRefs: string[];
  evidence: AtlasEvidence[];
  errorCode?: string;
  ambiguous?: boolean;
};

export type AtlasToolDefinition = {
  id: string;
  capabilityId: string;
  executionClass: AtlasExecutionClass;
  permission: AtlasPermission;
  risk: AtlasRiskClass;
  providerId: string | null;
  providerCapability: string | null;
  idempotency: 'none' | 'supported' | 'required';
  evidenceTypes: string[];
  execute(input: unknown, context: AtlasToolExecutionContext): Promise<AtlasToolResult>;
};

export class ToolRegistry {
  private readonly byCapability = new Map<string, AtlasToolDefinition>();
  private readonly byId = new Map<string, AtlasToolDefinition>();

  constructor(initial: readonly AtlasToolDefinition[] = []) {
    for (const tool of initial) this.register(tool);
  }

  register(tool: AtlasToolDefinition): void {
    if (!tool.id || !tool.capabilityId) throw new Error('invalid_tool');
    if (this.byCapability.has(tool.capabilityId) || this.byId.has(tool.id)) {
      throw new Error('duplicate_tool');
    }
    this.byCapability.set(tool.capabilityId, tool);
    this.byId.set(tool.id, tool);
  }

  getByCapability(capabilityId: string): AtlasToolDefinition | null {
    return this.byCapability.get(capabilityId) ?? null;
  }

  getById(id: string): AtlasToolDefinition | null {
    return this.byId.get(id) ?? null;
  }

  list(): AtlasToolDefinition[] {
    return [...this.byCapability.values()];
  }
}
