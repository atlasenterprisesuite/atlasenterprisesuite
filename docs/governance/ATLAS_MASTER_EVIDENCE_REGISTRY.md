# ATLAS Master Evidence Registry v1

Status: Approved implementation contract  
Owner: ATLAS Manager / Release Control  
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`

## Purpose

The Master Evidence Registry prevents screenshots, stale audits, design documents, old successful deployments, or provider assumptions from being presented as current production truth.

It reuses the existing ATLAS Manager, Release Control, runtime-verification and deployment-gate architecture. It is not a parallel control plane.

## Evidence precedence

Highest authority wins only when it is current for the same environment and release boundary:

1. machine-verifiable evidence for the exact deployed SHA;
2. ATLAS production-verification standard and mandatory release contract;
3. release-specific operational verification;
4. canonical module inventory and route evidence;
5. product specifications and technical blueprints;
6. operational runbooks;
7. historical audits/baselines;
8. non-technical or personal material is excluded from this registry entirely and never participates in production readiness.

A newer document does not silently erase an older one. Historical evidence remains immutable and a newer record points to the record it supersedes.

## Canonical statuses

- `VIGENTE`: still authoritative for the function it defines.
- `IMPLEMENTADA`: implementation is supported by repository/runtime evidence.
- `PENDIENTE`: the requirement exists but mandatory evidence is incomplete.
- `SUPERADA`: a newer, higher-authority record supersedes the operational conclusion.
- `REQUIERE_REVERIFICACION`: the claim was valid for a prior snapshot but must be measured again for the current SHA/environment.

These statuses describe evidence records. They do not replace release-gate states.

## Production badge mapping

The production UI may derive badges only from mandatory machine evidence:

- `FINAL PRODUCTION VERIFIED — FULL`: all mandatory gates pass for the exact deployed SHA and environment.
- `PRODUCTION VERIFIED — GATED`: ATLAS-owned runtime is verified, but an external provider is unavailable or unverified and provider-backed actions remain disabled.
- `VERIFICATION HOLD`: implementation exists but one or more mandatory acceptance gates lack current evidence.
- `NOT PRODUCTION VERIFIED`: a mandatory hard gate failed.

Documents, screenshots and prior green releases cannot independently produce a production badge.

## Storage contract

Canonical table: `public.atlas_master_evidence_registry`.

Core fields:

- tenant: `org_id`;
- optional release/deployment linkage;
- `module` and `claim`;
- `source_type` and `evidence_level`;
- canonical evidence `status`;
- `environment`;
- `expected_sha` / `deployed_sha`;
- `verified_at`;
- `source_ref`;
- `supersedes_id`;
- `production_impact`;
- safe metadata and actor/timestamp.

The table is append-only. Corrections and updated conclusions create a new record with `supersedes_id`; update/delete are rejected.

## Security and tenancy

- RLS is enabled.
- Authenticated reads require active organization membership and `releases.read`.
- Browser clients receive read-only access.
- Writes are performed only through a server-side ATLAS control-plane action after authorization.
- Raw secrets, credentials, bearer tokens, private keys, recovery codes and sensitive provider payloads are forbidden in `claim`, `source_ref` and metadata.

## Technical source classification baseline

Only technical ATLAS sources are eligible for this registry:

| Source class | Registry role | Production authority |
| --- | --- | --- |
| ATLAS OS Production Verification Standard | P0 production standard | Governs the meaning of the final production badge |
| ATLAS Assistant Production Health Verification | P0 operational snapshot | Valid only for its verified SHA/time; reverify for newer releases |
| ATLAS Module Checkmark Audit | P1 module inventory | Confirms coverage/inventory, not final production |
| ATLAS Chat integration research | P1 product blueprint | Architecture input; requires implementation/E2E evidence |
| ATLAS Voice/WebRTC research | P1 product blueprint | Architecture input; requires implementation/E2E evidence |
| OpenCode + Cloudflare manual | P1 runbook | Operational procedure; cannot certify production by itself |
| General ATLAS architecture/module audit | P2 historical baseline | Historical planning evidence; later machine evidence supersedes status claims |

Personal, employment-screening, health, legal, financial, symbolic, divination, or other non-technical user material must not be ingested into the production evidence registry unless a separate, explicitly approved product requirement and privacy model exists.

## Resolution algorithm

For a module or release claim:

1. scope to the active organization;
2. scope to the requested environment;
3. prefer exact `deployed_sha == expected_sha` machine evidence;
4. reject stale exact-SHA claims for a newer release;
5. follow `supersedes_id` relationships;
6. preserve external-gated truth rather than fabricating provider success;
7. fail closed when a mandatory production claim lacks current evidence.

## Integration boundary

The registry extends Release Control; it does not replace:

- `atlas_releases`;
- `atlas_deployments`;
- `atlas_deployment_gates`;
- `atlas_runtime_verification_runs`;
- `atlas-infra-evidence`;
- ATLAS Manager readiness and production history.

Deployment gates remain the execution authority. The Evidence Registry supplies durable provenance and precedence for the facts those gates consume or expose.
