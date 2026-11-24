# ATLAS 777 REVIEW — Cloudflare R2 regional degradation response

Status: **operational proposal / non-production**  
Scenario observed: November 17, 2026, elevated R2 errors and read timeouts for requests originating from South America (GRU, GIG, EZE, SCL).  
Authoritative provider reference: <https://www.cloudflarestatus.com/>  
Cloudflare R2 troubleshooting: <https://developers.cloudflare.com/r2/platform/troubleshooting/>  
Cloudflare R2 metrics: <https://developers.cloudflare.com/r2/platform/metrics-analytics/>  
Companion tests: `tests/unit/cloudflare-r2-regional-incident.test.ts`.

## 1. First establish scope; never invent a dependency

At the November 17 repository inspection, canonical `wrangler.jsonc` contained
static assets and two Durable Object bindings, but **no `r2_buckets` entry**.
That observation does not prove that other services, credentials, or external
clients never use R2. Inventory actual runtime configuration and approved
provider connections before declaring the entire ATLAS platform affected.

1. Inspect the canonical Worker configuration, approved environment binding
   inventory, object storage adapters, and authorized runtime telemetry.
2. Map each verified use of R2 to a module, tenant, operation, region, and
   criticality. Do not expose bucket secrets, object keys, personal paths, or
   tenant-specific identifiers in public issue/PR evidence.
3. Correlate provider incidents with ATLAS **measured** failures. Provider status
   alone does not establish a site outage or a data-integrity violation.
4. Reuse `evaluateProviderIncident` in `packages/core/src/evidence.ts`,
   existing ATLAS observability incidents, and the canonical production verifier.
   Do **not** introduce a second incident classifier or deployment pipeline.
5. Note the distinction between the Cloudflare status-page lifecycle
   (`investigating`, `identified`, `monitoring`, `resolved`) and ATLAS
   application verification. `resolved` is not proof of successful ATLAS reads.

## 2. Classify and contain

| Evidence | Scope | ATLAS response |
| --- | --- | --- |
| Provider reports R2 incident; no verified ATLAS R2 dependency | Uncorrelated | Provider watch; no application P0 and no global maintenance page |
| Verified optional R2 feature fails | Affected P1 module | Explain degraded feature; retain unrelated modules |
| Required tenant-authorized R2 read fails | Correlated P0 route | Fail closed for that route/action; preserve other healthy routes |
| Integrity mismatch, unauthorized cross-tenant result, or stale financial/legal record | Security/integrity P0 | Reject the result, prevent promotion, preserve non-sensitive audit evidence |
| Provider reports resolved, but ATLAS probes still fail | Ongoing ATLAS issue | Keep the application gate blocked until independently verified |

Never turn a Cloudflare incident into a global P0 solely from a provider headline.

## 3. Bounded retry and circuit breaker — design for any future R2 adapter

- Only retry transient network timeouts, 429 responses, and selected 5xx failures
  when the operation is idempotent, or when a write has a documented idempotency
  mechanism and server-confirmed outcome.
- Apply a strict request deadline, finite attempts (initial design target:
  at most three), exponential backoff with jitter, and `Retry-After` when
  present. Bound total retry traffic; do not create a retry storm.
- Do not retry authentication/authorization failures or missing objects as
  if they were provider outages. Do not silently swallow failure responses.
- Circuit breakers must be scoped to the **actual failing dependency and
  operation**. A South America read problem is not proof that all writes or
  all regions are down.
- While open, return an explicit degraded/unavailable state. Use half-open
  checks with limited concurrency and close only after successful authorized
  probes. Avoid cascading retries at multiple layers.
- No automatic origin, DNS, Cloudflare Access, or storage-provider mutation.

These values are **engineering proposals**, not evidence that the live system
already has these settings.

## 4. Continuity and data integrity

- Cache only content whose confidentiality, tenancy, permission checks, and
  maximum staleness allow it. Revalidate access control before serving cached
  content. Never use another tenant's cached response.
- Financial ledgers, tax data, identity and legal documents, and immutable
  audit records require an authoritative current read or an explicitly marked
  unavailable state; do not make up or silently substitute values.
- Durable queues must use idempotency keys, bounded retries, a dead-letter
  path, tenant ownership, and audit trails. A queued mutation is **pending**,
  not successfully completed.
- For large or critical objects, verify SHA-256 against a trusted manifest
  after the read, and verify expected object version/size where available.
  Do not treat an arbitrary R2 ETag as a universal SHA-256 checksum.
- If object replication/failover is ever introduced, require controlled
  consistency semantics, verified provider permissions, encryption, key
  management, cost authorization, and testing before enabling it.

## 5. Regional telemetry and incident correlation

Use Cloudflare's R2 bucket metrics (including regional request distribution and
HTTP error breakdowns) plus authorized ATLAS probes to determine:

- affected request interface (Workers binding, S3-compatible API, public URL);
- region/colo and time window in UTC;
- GET/HEAD read success, 429/5xx rate, p95 latency and timeout counts;
- authorization and tenant-scope correctness;
- whether other ATLAS modules are operational and whether a specific route
  actually requires the failing dependency.

Record aggregate, non-sensitive evidence. Preserve source timestamps and
labels `provider-reported`, `observed-by-atlas`, and `not-verified`.
External health results cannot substitute for exact-SHA production verification.

## 6. Safe recovery playbook

1. **DETECT:** Check official provider status and authorized regional telemetry.
2. **SCOPE:** Confirm actual binding/dependency and classify P0/P1 by impact.
3. **CONTAIN:** Degrade only affected operations; preserve security boundaries.
4. **RECOVER:** Retry bounded idempotent reads, drain authorized pending queues,
   and refuse any integrity mismatch.
5. **VERIFY:** Probe real protected and public routes, permissions, object hashes,
   and unrelated ATLAS health after provider recovery.
6. **RELEASE:** Use existing `verify:all`, PR exact-head CI,
   `.github/workflows/cloudflare-deploy.yml`, and existing global P0
   verifier. No green status without matching commit SHA and E2E evidence.
7. **REVIEW:** Log incident timeline, affected tenants in restricted audit
   storage, measured duration, RCA if provided, and corrective actions.

## 7. Acceptance criteria and open boundaries

- [ ] Demonstrate the actual R2 dependency or document explicitly that none
      was found in authorized runtime sources.
- [ ] Demonstrate an unrelated P0 workload stays unblocked when only R2 fails.
- [ ] Demonstrate a required affected R2 read fails closed.
- [ ] Demonstrate optional R2 features degrade without global outage.
- [ ] Execute and pass targeted regression tests and full CI on exact PR SHA.
- [ ] Obtain approval before new providers, replication, paid services, or
      production network/security changes.
- [ ] Independently verify the deployed production SHA and E2E operations.

**Current evidence at authoring:** repository-config inspection and new
scenario-based unit tests only; no claim of live R2 integration, successful
production rollout, incident recovery, or end-to-end runtime validation.
