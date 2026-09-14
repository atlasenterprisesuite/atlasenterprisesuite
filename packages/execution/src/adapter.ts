import type { ExecutionActor, ExecutionEvidence, ExecutionStep } from './types';

export type AdapterValidation = { ok: boolean; errors: string[] };
export type AdapterAuthorization = { ok: boolean; reason: string | null };
export type AdapterExecution = { ok: boolean; result: Record<string, unknown>; errorCode?: string };
export type AdapterVerification = {
  ok: boolean;
  evidence: Array<Pick<ExecutionEvidence, 'kind' | 'reference' | 'verified'>>;
  reason?: string;
};

export interface ExecutionModuleAdapter {
  module: string;
  canHandle(actionType: string): boolean;
  validate(step: ExecutionStep): Promise<AdapterValidation>;
  authorize(actor: ExecutionActor, step: ExecutionStep): Promise<AdapterAuthorization>;
  execute(step: ExecutionStep): Promise<AdapterExecution>;
  verify(step: ExecutionStep, execution: AdapterExecution): Promise<AdapterVerification>;
  suggestNext(step: ExecutionStep, execution: AdapterExecution): Promise<string | null>;
}

export class ExecutionAdapterRegistry {
  constructor(private readonly adapters: ExecutionModuleAdapter[]) {}

  resolve(module: string, actionType: string) {
    const adapter = this.adapters.find((item) => item.module === module && item.canHandle(actionType));
    if (!adapter) throw new Error(`execution_adapter_not_found:${module}:${actionType}`);
    return adapter;
  }
}
