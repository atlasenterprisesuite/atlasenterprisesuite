import { describe, expect, it, vi } from 'vitest';
import { executeOnce } from '../../packages/execution/src/idempotency';

const scope = {tenantId:'tenant-A', organizationId:'org-A', key:'job-1'};
describe('Sovereign browser idempotency fail closed', () => {
  it('does not execute on a duplicate claim', async () => {
    const run=vi.fn();
    await expect(executeOnce({claim:async()=> 'duplicate',complete:vi.fn(),fail:vi.fn()},scope,run)).rejects.toThrow('duplicate_execution');
    expect(run).not.toHaveBeenCalled();
  });
  it('marks an errored side effect indeterminate and does not silently retry', async () => {
    const fail=vi.fn();
    const store={claim:vi.fn().mockResolvedValueOnce('claimed').mockResolvedValueOnce('duplicate'),complete:vi.fn(),fail};
    const run=vi.fn().mockRejectedValue(new Error('remote_timeout'));
    await expect(executeOnce(store,scope,run)).rejects.toThrow('remote_timeout');
    expect(fail).toHaveBeenCalledWith(scope);
    await expect(executeOnce(store,scope,run)).rejects.toThrow('duplicate_execution');
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('fails closed if the failure record cannot be persisted', async () => {
    await expect(executeOnce({claim:async()=> 'claimed',complete:vi.fn(),fail:async()=>{throw new Error('db_down');}},scope,async()=>{throw new Error('timeout');})).rejects.toThrow('idempotency_state_indeterminate');
  });
  it('does not rerun an action when the completion commit fails', async () => {
    const run=vi.fn().mockResolvedValue('done');
    await expect(executeOnce({claim:async()=> 'claimed',complete:async()=>{throw new Error('db_down');},fail:vi.fn()},scope,run)).rejects.toThrow('idempotency_commit_indeterminate');
    expect(run).toHaveBeenCalledOnce();
  });
});
