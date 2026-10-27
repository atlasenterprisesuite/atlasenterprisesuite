import { describe, it, expect } from 'vitest';
import { analyzeSignal } from '../../packages/telecom/signal-intelligence';
const context = { organizationId:'tenant-a', actorId:'user-a', authorizedOrganizations:['tenant-a'], permissions:['signal.analyze'] };
const base = { number:'+1 (250) 524-0575', message:"I'm Fiona Williams. I'm wondering if our paths have ever crossed?", organizationId:'tenant-a', declaredName:'Fiona Williams' };
describe('Signal Intelligence fail-closed', () => {
  it('normalizes and never confirms claimed identity', () => { const r=analyzeSignal(base,context); expect(r.normalized).toBe('+12505240575'); expect(r.identity).toBe('unverified'); expect(r.providerStatus).toBe('not_connected'); expect(r.suspiciousPatterns).toContain('ambiguous_introduction'); });
  it('denies tenant crossing', () => expect(()=>analyzeSignal({...base,organizationId:'tenant-b'},context)).toThrow('signal_tenant_denied'));
  it('denies revoked membership', () => expect(()=>analyzeSignal(base,{...context,authorizedOrganizations:[]})).toThrow('signal_access_denied'));
  it('denies missing permission', () => expect(()=>analyzeSignal(base,{...context,permissions:[]})).toThrow('signal_access_denied'));
  it('rejects invalid numbers', () => expect(()=>analyzeSignal({...base,number:'123'},context)).toThrow('invalid_nanp_number'));
  it('rejects unverified provider claims', () => { const r=analyzeSignal({...base,providerEvidence:{source:'demo',reference:'fake',observedAt:new Date().toISOString(),authenticated:false,authoritative:false,carrier:'Fake'}},context); expect(r.providerEvidence).toBeNull(); expect(r.providerStatus).toBe('not_connected'); });
  it('does not leak SMS into audit', () => expect(JSON.stringify(analyzeSignal(base,context).audit)).not.toContain('Fiona'));
});
