# ATLAS Business Workspace Governance — reference adaptation

Date: 2026-11-23
Status: **Reference policy and non-executing review interface; no billing, migration, provider or production activation**
Owner: ATLAS Identity / Work / Security
Source: User-provided excerpt, *Managing members, seat types, and roles in ChatGPT Business* (2026-11-23).

## Purpose and boundaries

Adapt the **functional organization** of the user's ChatGPT Business management guide into ATLAS Enterprise Suite, without copying provider code, branded UI, proprietary implementation or user data. This is **not** an attempt to alter a ChatGPT Business subscription or claim the separate ChatGPT Business Hub company profile. The source describes ChatGPT workspace administration; Business Hub company claims, domain TXT verification, API credits and Ads Manager are separate systems.

Reuse instead of duplicating:
- `/work/team`: display organization context and execution permissions; this change adds only a truthful reference policy summary.
- ATLAS Identity + `organization_members`, invitations, roles and existing privileged RPC paths: authoritative membership operations. Do not create a second identity database or permission system.
- `/work/policies`, Work approvals, ATLAS audit and Supabase RLS: canonical governance boundaries.
- `/knowledge`: approved organization knowledge, not automatic ChatGPT personal-history ingestion.
- Finance / ATLAS billing: sovereign system of record. Provider subscription seats must not be presented as native ATLAS charges without provider evidence.

## Reference feature map

| User-provided capability | ATLAS target | Actual state |
| --- | --- | --- |
| Distinct personal and business workspaces | ATLAS organization/session scope | Existing organization scope; **no ChatGPT personal-workspace import** |
| Owner, Admin, Member, Analytics Viewer | Existing ATLAS Identity role and permission backend | Policy reference only, **not a grant or new live role** |
| Standard and Premium seats | Future approved billing entitlement adapter | **Not connected**; no live seat counts or price claims |
| Invitation with role and seat type | Existing Identity invitation RPC and `/work/team` | Authoritative RPC reconciliation required before new UI controls |
| Join requests and invitation status | Existing Identity membership processes | No fabricated pending requests |
| Role and seat reassignment | Existing roles + future billing adapter | Owner-sensitive, MFA/AAL2 and audit required; seat adapter gated |
| Discovery and automatic join | Identity settings with verified domain | Opt-in; default **disabled** in ATLAS until verified and spend-safe |
| SSO and external member exemptions | Existing governed Identity / SSO capabilities | Provider-specific exemptions require runtime evidence |
| Analytics and spend controls | Analytics + budget approval boundary | No invented amounts or connected state |
| ChatGPT Apps management | ATLAS work connections/integration registry | Per-provider verified connection and scoped permissions |
| Merge personal into business | **No automatic action** | Irreversible or hard-to-reverse migration requires separate explicit manual procedure |
| Business Hub company profile claim | External provider workflow | Independent of subscriptions, workspace seats and provider APIs |

## Safety policy implemented in `@atlas/core`

`assessWorkspaceGovernanceChange` is a pure non-executing policy check for prospective changes. Even an eligible result is **not** provider authorization. Every actual write must validate: authenticated current user, tenant/organization from server session, existing Identity RBAC, MFA/AAL2 when privileged, RLS, audited change, approval boundaries, and provider/billing evidence. Never infer authority from a client-supplied role. No auto-purchase without explicit spend authorization. Do not automatically merge personal content.

The read-only `/work/team` reference must not claim members, paid seats, connections, invoices or app permissions that were not fetched from an authoritative backend.

## Acceptance gates — work remaining

1. Reconcile canonical source with existing production Identity RPC definitions before exposing invitations, role changes or revocation writes.
2. Validate privileged AAL2/MFA and final-owner protection on the actual backend.
3. Implement entitlement inventory and reversible seat management only after verified billing/provider contract and explicit spending consent.
4. Provide real, organization-scoped and accessible UX for invitations, membership, roles, seat allocation, discovery, analytics and error states.
5. Test authorization/tenant isolation, pending invitation and seat accounting, auto-join charge prevention, disabled accounts and SSO exemptions.
6. Run TypeScript, unit/integration, build, relevant security checks; obtain exact-HEAD CI, review, merge and Cloudflare production exact-SHA/E2E verification.
7. Keep P0 fail-closed and document P1 warnings. No production-complete claim before all gates pass.

References: https://help.openai.com/en/articles/20001635-setting-up-your-business-on-chatgpt
