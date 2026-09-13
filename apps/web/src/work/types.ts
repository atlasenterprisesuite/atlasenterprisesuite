import type {
  AtlasWorkContext,
  WorkAutonomyLevel,
  WorkExecutionMode,
  WorkRuntimePreference
} from '../../../../packages/execution/src/work-types';
import type { ExecutionStatus } from '../../../../packages/execution/src/types';

export type WorkWorkflow = {
  id: string;
  ownerModule: string;
  status: ExecutionStatus;
  currentTaskId: string | null;
  currentModule: string;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  work: AtlasWorkContext;
};

export type CreateWorkWorkflowInput = {
  intent: string;
  ownerModule: string;
  executionMode: WorkExecutionMode;
  autonomyLevel: WorkAutonomyLevel;
  runtimePreference: WorkRuntimePreference;
  budgetLimit: number | null;
  connectionRefs: string[];
};

export type WorkView = 'active' | 'history' | 'approvals' | 'all';
