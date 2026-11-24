import { readFileSync } from 'node:fs';
import { describe,it,expect } from 'vitest';
import { join } from 'node:path';
describe('PostgreSQL fixture remains non-production and fail-closed',()=>{
 const sql=readFileSync(join(process.cwd(),'tests/fixtures/repair-atomic-isolated.sql'),'utf8');
 it('rolls back the fixture',()=>expect(sql.trimEnd().endsWith('ROLLBACK;')).toBe(true));
 it('does not create or replace a public RPC',()=>expect(sql).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+public\./i));
 it('requires unique tenant-scoped idempotency receipts',()=>expect(sql).toContain('UNIQUE(org_id,job_id,idempotency_key)'));
 it('documents transaction lock and fencing',()=>{expect(sql).toContain('FOR UPDATE');expect(sql).toContain('lease_epoch');});
});
