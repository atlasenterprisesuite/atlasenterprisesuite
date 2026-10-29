import { sanitizeConnectedAppMetadata } from './access.ts';

type TableClient = {
  from(table: string): {
    insert(value: Record<string, unknown>): Promise<{ error?: unknown }>;
  };
};

export async function recordConnectedAppAccessEvent(
  admin: TableClient,
  input: Record<string, unknown>
): Promise<void> {
  const safe = sanitizeConnectedAppMetadata(input);
  const { error } = await admin.from('atlas_connected_app_access_events').insert(safe);
  if (error) throw new Error('connected_app_audit_write_failed');
}

export async function recordConnectedAppDataLedger(
  admin: TableClient,
  input: Record<string, unknown>
): Promise<void> {
  const safe = sanitizeConnectedAppMetadata(input);
  const { error } = await admin.from('atlas_connected_app_data_ledger').insert(safe);
  if (error) throw new Error('connected_app_data_ledger_write_failed');
}
