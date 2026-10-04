# ATLAS AI Dev Stack Transfer — Normative Test & Policy Contracts

This file is a normative companion to `docs/superpowers/plans/2026-10-04-atlas-ai-dev-stack-transfer.md`. If an implementation choice is ambiguous, these contracts control. They tighten the plan without expanding the approved product scope.

## Policy clarifications

### Model allowlist

Model selection remains inside the existing provider boundary. Add a server-side optional allowlist `ATLAS_AI_ALLOWED_MODELS` using comma-separated fully qualified entries in the form `provider/model`, for example `openai/gpt-6.1-sol,openai/gpt-6-astra,gemini/gemini-4-argon`.

- Empty allowlist preserves current behavior: a model may execute only when it is configured, provider-verified, and the provider/cost policy allows it.
- Non-empty allowlist adds an extra fail-closed restriction: a configured/verified model outside the allowlist is `model_not_allowed`.
- No frontend value may expand the server allowlist.

### Managed runtime memory/session retention

Provider sessions are non-canonical references. The managed-runtime contract must expose cleanup metadata:

```ts
cleanup({ provider_session_id }): Promise<{
  attempted: boolean;
  deleted: boolean;
  reason: string | null;
}>
```

ATLAS records `provider_session_id`, `runtime_backend`, creation/terminal timestamps, and cleanup outcome. Where the provider exposes session deletion, ATLAS attempts cleanup after terminal completion when policy requires it. Where deletion is unsupported/unavailable, ATLAS records that fact and still retains its own canonical conversation/audit state.

### Copilot review effort

The ATLAS Copilot review workflow requests `balanced` effort for this cross-service/security-sensitive change and records both requested and observed effort in evidence. If GitHub cannot honor or report the requested effort, evidence must say `effort_unconfirmed`; it must never invent a confirmed effort value.

Copilot review remains advisory unless a separate repository policy explicitly promotes a finding class to blocking.

## Task 1 test contract — model-aware routing

Add exact assertions equivalent to:

```ts
it('keeps model identity inside the selected provider boundary', () => {
  const result = router.route({
    mode: 'openai',
    intent: 'balanced',
    model: 'gpt-6.1-sol',
    capabilities_requested: ['generation'],
  });
  expect(result.provider).toBe('openai');
  expect(result.model).toBe('gpt-6.1-sol');
  expect(result.providers).toEqual(['openai']);
});

it('fails closed when an explicitly pinned model is not verified', () => {
  expect(() => router.route({
    mode: 'openai',
    intent: 'balanced',
    model: 'unverified-model',
    capabilities_requested: ['generation'],
  })).toThrowError(/model_unavailable/);
});

it('enforces a non-empty server model allowlist', () => {
  expect(() => selectVerifiedModel({
    provider: verifiedOpenAI,
    profile: 'balanced',
    explicitModel: 'gpt-6-astra',
    allowedModels: ['openai/gpt-6.1-sol'],
  })).toThrowError(/model_not_allowed/);
});
```

Regression: all existing provider-only requests without `model` must preserve current routing semantics.

## Task 2 test contract — model-specific provider readiness

Add exact assertions equivalent to:

```ts
it('does not mark an announced Gemini model verified when the provider probe rejects it', async () => {
  const result = await adapter.probe({ profile: 'deep', model: 'gemini-4-argon' });
  expect(result.verified).toBe(false);
  expect(result.model).toBe('gemini-4-argon');
  expect(result.error).not.toBeNull();
});

it('uses provider-reported OpenAI usage without fabricating cache savings', async () => {
  const result = await adapter.execute(request);
  expect(result.usage).toEqual(providerUsage);
  expect(result.usage).not.toHaveProperty('estimated_cache_savings_usd');
});
```

A model becomes executable only after the configured provider account successfully authenticates and verifies it.

## Task 3 test contract — managed runtime

Add exact assertions equivalent to:

```ts
it('keeps the managed runtime disabled by default', async () => {
  const runtime = createOpenAIAgentsRuntime({ apiKey: 'test', enabled: false, fetchFn });
  await expect(runtime.execute(request)).rejects.toMatchObject({ code: 'runtime_not_enabled' });
  expect(fetchFn).not.toHaveBeenCalled();
});

it('returns tool requests as proposals instead of executing them', async () => {
  const result = await runtime.execute(request);
  expect(result.tool_calls).toEqual(expect.any(Array));
  expect(result.tools_executed ?? []).toHaveLength(0);
});

it('does not turn a partial managed run into completed', async () => {
  const result = await runtime.execute(partialProviderResponse);
  expect(result.execution_state).not.toBe('completed');
});

it('retains ATLAS state when provider-session cleanup is unavailable', async () => {
  const cleanup = await runtime.cleanup({ provider_session_id: 'session-1' });
  expect(cleanup).toMatchObject({ attempted: true, deleted: false });
  expect(atlasConversationStillExists()).toBe(true);
});
```

## Task 4 test contract — computer use and tool governance

Add exact assertions equivalent to:

```ts
it('denies computer use outside the ATLAS domain allowlist', () => {
  const result = gateway.evaluate({ context, proposals: [externalNavigation] });
  expect(result.denied[0].decision_reason).toBe('domain_not_allowed');
});

it('requires approval for a mutating computer-use action', () => {
  const result = gateway.evaluate({ context, proposals: [browserMutation] });
  expect(result.approval_required).toHaveLength(1);
});

it('never trusts runtime-supplied tenant identity over authenticated context', () => {
  expect(() => dispatcher.execute({
    context: orgAContext,
    tool_name: 'records.update',
    arguments: { organization_id: 'org-b' },
  })).rejects.toMatchObject({ code: 'tenant_mismatch' });
});
```

## Task 5 test contract — Copilot exact-SHA evidence

Add exact assertions equivalent to:

```ts
it('rejects Copilot evidence from a stale PR head', () => {
  const evidence = normalizeCopilotReview({ currentHeadSha: 'new', reviewHeadSha: 'old' });
  expect(evidence.stale).toBe(true);
  expect(evidence.blocking_decision).not.toBe('passed');
});

it('keeps Copilot approval non-authoritative', () => {
  const evidence = normalizeCopilotReview({ reviewState: 'APPROVED', deterministicChecks: false });
  expect(evidence.blocking_decision).not.toBe('release_authorized');
});

it('records unavailable review service truthfully', () => {
  const evidence = normalizeCopilotReview({ serviceUnavailable: true });
  expect(evidence.completed).toBe(false);
  expect(evidence.status).toBe('unavailable');
});
```

Workflow source-contract assertions must reject `permissions: write-all` and `pull_request_target` and require reviewer `copilot-pull-request-reviewer[bot]`.

## Task 6 test contract — agentic security evidence

Add exact assertions equivalent to:

```ts
it('keeps model-only security output as a hypothesis', () => {
  const finding = normalizeSecurityFinding({ severity: 'critical', evidence: [] });
  expect(finding.state).toBe('hypothesis');
});

it('requires an allowlisted deterministic evidence kind for verified state', () => {
  const verified = verifySecurityFinding({
    finding: hypothesis,
    evidence: [{ kind: 'failing_test', reference: 'tests/unit/example.test.ts' }],
  });
  expect(verified.state).toBe('verified');
});

it('does not accept narrative text as reproduction evidence', () => {
  const result = verifySecurityFinding({
    finding: hypothesis,
    evidence: [{ kind: 'model_narrative', reference: 'looks exploitable' }],
  });
  expect(result.state).toBe('hypothesis');
});
```

## Task 7 test contract — truthful readiness and canonical telemetry

Add exact assertions equivalent to:

```ts
it('never exposes configured-unverified runtime or model as verified', async () => {
  const readiness = await getReadiness();
  expect(readiness.providers.find((p) => p.model === 'gemini-4-argon')?.verified).not.toBe(true);
});

it('persists runtime/provider/model identity without storing provider memory as canonical', async () => {
  const result = await gateway.execute(request);
  const stored = await loadAtlasRequest(result.trace_id);
  expect(stored.runtime_backend).toBeDefined();
  expect(stored.provider).toBeDefined();
  expect(stored.model).toBeDefined();
  expect(stored.canonical_state_owner).toBe('atlas');
});
```

## Task 8 verification contract

Before PR creation, run all focused tests plus `npm run verify:all` and require zero failures. Before merge, require the exact PR head SHA to have current required checks. After merge, require fresh evidence on the merged SHA from:

- `ATLAS 3-of-3 Consensus`
- `CodeQL Advanced`
- `verify-build-readiness`
- canonical Cloudflare production deployment
- `ATLAS Global Production Verification` in `fail-closed` mode

A passing PR or build is not deployment verification. A production challenge, unavailable verifier, stale SHA, failed P0 route, or unverified runtime/model remains a failure/incomplete state until evidence proves otherwise.
