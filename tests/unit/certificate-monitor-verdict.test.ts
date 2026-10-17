import { describe, expect, it } from 'vitest';
import { certificateVerdict, type CertificateObservation, type CertificateTarget } from '../../apps/web/src/modules/security/certificateInventory';

const now = Date.parse('2026-10-09T18:00:00Z');
const target: CertificateTarget = {
  id:'00000000-0000-4000-8000-000000000001', org_id:'00000000-0000-4000-8000-000000000002',
  label:'ATLAS',hostname:'www.atlasenterprisesuite.com',port:443,
  provider:'cloudflare',environment:'production',purpose:'server_tls',monitoring_approved:true,
  created_at:'2026-10-09T16:00:00Z'
};
const evidence: CertificateObservation = {
  id:'00000000-0000-4000-8000-000000000003',org_id:target.org_id,target_id:target.id,
  observed_at:'2026-10-09T17:58:00Z',observation_status:'verified_tls',
  source:'github_actions_oidc',certificate_sha256:'a'.repeat(64),
  certificate_subject:'CN=example',certificate_issuer:'CA example',
  not_before:'2026-10-01T00:00:00Z',not_after:'2027-01-20T00:00:00Z',
  tls_protocol:'TLSv1.3',hostname_verified:true,chain_verified:true,mtls_verified:false,
  evidence_sha256:'b'.repeat(64),evidence_ref:'github-actions:example:1:1'
};
describe('certificate inventory fail-closed evidence verdicts', () => {
  it('requires an approved target and valid recent evidence', () => {
    expect(certificateVerdict(target,[evidence],now)).toBe('verified');
    expect(certificateVerdict(target,[{...evidence,not_after:'2026-10-20T00:00:00Z'}],now)).toBe('expiring_soon');
    expect(certificateVerdict(target,[{...evidence,not_after:'2027-01-20T00:00:00Z'}],now)).toBe('verified');
    expect(certificateVerdict({...target,monitoring_approved:false},[evidence],now)).toBe('no_evidence');
    expect(certificateVerdict(target,[],now)).toBe('no_evidence');
  });
  it('does not trust unrelated organization/target evidence', () => {
    expect(certificateVerdict(target,[{...evidence,target_id:'other'}],now)).toBe('no_evidence');
    expect(certificateVerdict(target,[{...evidence,org_id:'other'}],now)).toBe('no_evidence');
  });
  it('never treats expired, self-reported or broken certificates as healthy', () => {
    expect(certificateVerdict(target,[{...evidence,chain_verified:false}],now)).toBe('no_evidence');
    expect(certificateVerdict(target,[{...evidence,hostname_verified:false}],now)).toBe('no_evidence');
    expect(certificateVerdict({...target,purpose:'mtls_client'},[evidence],now)).toBe('no_evidence');
    expect(certificateVerdict({...target,purpose:'mtls_server'},[{...evidence,mtls_verified:true}],now)).toBe('verified');
    expect(certificateVerdict(target,[{...evidence,not_after:'2026-10-08T00:00:00Z'}],now)).toBe('no_evidence');
    expect(certificateVerdict(target,[{...evidence,certificate_sha256:'fake'}],now)).toBe('no_evidence');
    expect(certificateVerdict(target,[{...evidence,observation_status:'tls_failure'}],now)).toBe('failed');
  });
  it('rejects stale or future-dated observations', () => {
    expect(certificateVerdict(target,[{...evidence,observed_at:'2026-10-07T17:00:00Z'}],now)).toBe('stale');
    expect(certificateVerdict(target,[{...evidence,observed_at:'2026-10-10T17:00:00Z'}],now)).toBe('stale');
  });
});
