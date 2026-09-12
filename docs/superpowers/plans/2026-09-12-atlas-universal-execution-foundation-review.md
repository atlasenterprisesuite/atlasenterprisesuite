# ATLAS Universal Execution Foundation — Binding Self-Review Notes

This file is a binding companion to `docs/superpowers/plans/2026-09-12-atlas-universal-execution-foundation.md` and resolves the two implementation ambiguities found during the required plan self-review.

## 1. Runtime-neutral UUID generation

`packages/execution` must remain usable from Node/Vitest, Supabase/Deno consumers, and browser-facing TypeScript imports. Therefore Task 5 must use the Web Crypto API and must not import `node:crypto` from the shared package.

Use:

```ts
const evidenceId = crypto.randomUUID();
```

Do not add a UUID dependency. `node:crypto` remains acceptable only inside Node-only tests if ever needed, not in `packages/execution/src/*`.

## 2. Execution-layer permissions are explicit

The foundation introduces only these execution-layer permissions:

```ts
export type ExecutionPermission =
  | 'execution.read'
  | 'execution.write'
  | 'execution.approve'
  | 'execution.audit'
  | 'execution.admin';
```

Role mapping at the shared execution boundary follows the repository's existing organization role pattern:

```ts
export function executionPermissionsForRole(role: string): ExecutionPermission[] {
  if (['owner', 'admin', 'platform_admin'].includes(role)) {
    return [
      'execution.read',
      'execution.write',
      'execution.approve',
      'execution.audit',
      'execution.admin'
    ];
  }
  return ['execution.read'];
}
```

The `atlas-execution` Edge Function may use this mapping only for execution-layer operations. It must not infer or fabricate module permissions such as `payroll.write`, `accounting.post`, `health.*`, or other domain permissions.

For Task 7:

- `get_state` requires `execution.read`.
- `create_task`, `transition_task`, `record_evidence`, and `request_approval` require `execution.write` or `execution.admin`.
- `decide_approval` requires `execution.approve` or `execution.admin` at the execution layer.
- If an approval row declares a domain-specific `required_permission` that is not an `execution.*` permission, the foundation must fail closed with `domain_permission_resolver_required` unless a real owning-module authorization adapter verifies it. It must never treat owner/admin execution permission as equivalent to every domain permission.

This preserves the spec rule that execution uses the strictest applicable combination of authenticated user permission, module authorization, workflow policy, approval policy, and provider capability.

## 3. Approval binding

`decide_approval` must load the pending approval row and compare the exact stored `payload_version` and `payload_digest` against the current task/action version before recording a decision. A mismatch returns `approval_binding_mismatch` and leaves the approval pending or marks it expired according to the implemented state policy; it must not execute the underlying action.

## 4. Self-review result

- Scope: foundation remains one independently testable subsystem; UI/Approval Center presentation, Assistant/Voice, and broad module adoption remain separate follow-on plans.
- Placeholder scan: no `TBD`, `TODO`, fake provider state, fake completion state, or secret material is allowed during execution.
- Type consistency: Task 1 canonical status/type names are authoritative for Tasks 2-9.
- Security consistency: RLS is tenant isolation; Edge Function authorization is the mutation boundary; module adapters remain the domain authorization boundary.
