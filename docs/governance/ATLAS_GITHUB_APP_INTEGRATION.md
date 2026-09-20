# ATLAS GitHub App Integration Contract

## Purpose

ATLAS GitHub App is the least-privilege identity and event ingress for GitHub. It does not replace GitHub Actions, the ATLAS Director, ATLAS MCP, tenant/RBAC governance, or the production release gate.

A valid GitHub webhook proves only that GitHub delivered an authentic event. It never grants production authority.

## Runtime boundary

The orchestrator exposes:

`POST /webhooks/github`

The endpoint:

1. requires `ATLAS_GITHUB_WEBHOOK_SECRET`;
2. validates the raw request body against `X-Hub-Signature-256` using HMAC-SHA256;
3. requires `X-GitHub-Delivery`;
4. requires `X-GitHub-Event`;
5. accepts only the explicit event allowlist in `apps/atlas-orchestrator/src/webhooks/github.ts`;
6. parses JSON only after signature validation;
7. returns normalized metadata and `executionAuthorized: false`.

Webhook receipt must not directly merge, deploy, approve a release, or bypass ATLAS task state.

## Initial GitHub App permissions

Request only permissions needed by the control plane.

Repository permissions:

- Metadata: read (implicit/required by GitHub)
- Contents: read/write for governed branch and code proposal operations
- Issues: read/write
- Pull requests: read/write
- Checks: read
- Actions: read
- Commit statuses: read
- Deployments: read

Do not grant Administration permission for the initial integration.
Do not grant Secrets, Environments, or organization-wide administration access.
Production deployment remains owned by the authorized GitHub Actions workflow and ATLAS human release gate.

## Webhook subscriptions

Subscribe only to events ATLAS consumes:

- `installation`
- `installation_repositories`
- `issues`
- `issue_comment`
- `pull_request`
- `pull_request_review`
- `pull_request_review_comment`
- `push`
- `check_run`
- `check_suite`
- `workflow_run`
- `deployment`
- `deployment_status`

GitHub also sends `ping` when testing the webhook.

## Authentication model

Do not use a long-lived personal access token as the normal ATLAS GitHub identity.

The GitHub App authentication helper in
`apps/atlas-orchestrator/src/github/appAuth.ts`:

1. signs a short-lived RS256 GitHub App JWT from the App private key;
2. accepts the installation id resolved from a trusted webhook payload or GitHub API;
3. mints an installation access token scoped to selected repository ids and requested permissions;
4. returns token expiry and repository metadata to the caller;
5. never writes the JWT, private key, installation token, authorization header, or webhook secret to ATLAS persistence.

Callers must cache installation tokens only until shortly before expiry and request the
minimum repository and permission scope needed for each operation.

Installation access tokens expire after one hour.

## Required secrets

Runtime-only secrets:

- `ATLAS_GITHUB_APP_ID`
- `ATLAS_GITHUB_PRIVATE_KEY`
- `ATLAS_GITHUB_WEBHOOK_SECRET`

These values must be supplied through the authorized secret store/runtime and must never be committed to the repository.

## Replay protection

`X-GitHub-Delivery` is mandatory at ingress. ATLAS persists each delivery claim in
`public.atlas_github_webhook_deliveries` using
`(tenant_id, organization_id, delivery_id)` as the primary key. Duplicate or
redelivered events therefore return a duplicate acknowledgement and are not claimed twice.

The managed-host path uses the token-gated
`atlas_orchestrator_claim_github_delivery` SECURITY DEFINER RPC. Raw table access
remains revoked from `anon` and `authenticated`.

Webhook receipt and successful delivery claiming still do not authorize execution.
Event-to-task dispatch remains subject to ATLAS Director, tenant/RBAC policy, task state,
CI, and release governance.

## Governed execution path

```text
GitHub App webhook
  -> signature + delivery validation
  -> durable delivery deduplication
  -> tenant/org/repository resolution
  -> ATLAS Director task/event mapping
  -> ATLAS MCP least-privilege tools
  -> branch / draft PR
  -> CI and review
  -> authorized human release approval when required
  -> production workflow
  -> global fail-closed production verification
```

A deployment is not verified unless the final production verifier confirms the deployed SHA, the public ATLAS shell, and all configured critical ATLAS Network routes.
