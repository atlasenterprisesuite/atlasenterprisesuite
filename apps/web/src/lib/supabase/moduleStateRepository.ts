import type { SupabaseClient } from '@supabase/supabase-js';

type OrganizationModuleRow = {
  module_code: string;
  enabled: boolean;
};

export async function loadEnabledAtlasModuleCodes(
  client: SupabaseClient,
  tenantId: string,
  organizationId: string,
): Promise<ReadonlySet<string>> {
  const { data, error } = await client
    .from('organization_modules')
    .select('module_code,enabled')
    .eq('tenant_id', tenantId)
    .eq('org_id', organizationId);

  if (error) throw new Error('module_state_unavailable');

  return new Set(
    ((data ?? []) as OrganizationModuleRow[])
      .filter((row) => row.enabled && row.module_code)
      .map((row) => row.module_code),
  );
}
