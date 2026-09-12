import type { ComplianceSubmission } from '../../../../packages/compliance/types.ts';
import type { RideComplianceContext } from './context.ts';
import { getSubmission } from './repository.ts';

export async function getLatestSubmissionForRequirement(
  ctx: RideComplianceContext,
  requirementId: string
): Promise<ComplianceSubmission | null> {
  const { data, error } = await ctx.storageAdmin
    .from('compliance_submissions')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .eq('tenant_id', ctx.tenantId)
    .eq('requirement_id', requirementId)
    .order('submitted_at', { ascending: false })
    .limit(1);
  if (error) throw new Error('internal_error');
  return data?.[0]?.id ? getSubmission(ctx, String(data[0].id)) : null;
}
