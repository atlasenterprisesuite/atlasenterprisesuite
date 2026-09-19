import { existsSync, readFileSync } from 'node:fs';

const required = [
  'supabase/functions/_shared/github-oidc-scope.ts',
  'supabase/functions/atlas-cloudflare-production-http-verify/index.ts',
  'supabase/functions/atlas-creator-e2e-verifier/index.ts',
  'supabase/functions/atlas-infra-evidence/index.ts',
  'supabase/functions/atlas-local-ai-bootstrap/index.ts',
  'supabase/functions/atlas-local-control/index.ts',
  'supabase/functions/atlas-infra-status/index.ts',
  'hubspot/atlas-crm-hubspot/repair-local-project.ps1',
  'supabase/config.toml',
  'docs/security/GITHUB_ORG_MIGRATION_RUNBOOK.md'
];

for (const path of required) {
  if (!existsSync(path)) {
    console.error(`::error::GitHub Organization migration preflight missing required file: ${path}`);
    process.exit(1);
  }
}

const read = (path) => readFileSync(path, 'utf8');
const helper = read('supabase/functions/_shared/github-oidc-scope.ts');

for (const token of [
  'ATLAS_GITHUB_REPOSITORIES',
  'ATLAS_CANONICAL_REPO',
  'allowsRepository',
  'workflowRefs'
]) {
  if (!helper.includes(token)) {
    console.error(`::error::GitHub OIDC scope helper missing required contract: ${token}`);
    process.exit(1);
  }
}

const oidcFunctions = [
  'supabase/functions/atlas-cloudflare-production-http-verify/index.ts',
  'supabase/functions/atlas-creator-e2e-verifier/index.ts',
  'supabase/functions/atlas-infra-evidence/index.ts',
  'supabase/functions/atlas-local-ai-bootstrap/index.ts',
  'supabase/functions/atlas-local-control/index.ts'
];

for (const path of oidcFunctions) {
  const source = read(path);
  if (!source.includes("createGitHubOidcScope")) {
    console.error(`::error::${path} bypasses the migration-safe GitHub OIDC scope helper`);
    process.exit(1);
  }
  if (source.includes("const OWNER = 'atlasenterprisesuite'") ||
      source.includes("const GITHUB_OWNER = 'atlasenterprisesuite'")) {
    console.error(`::error::${path} hardcodes the legacy GitHub owner`);
    process.exit(1);
  }
  if (!source.includes('allowsRepository(payload.repository, payload.repository_owner)')) {
    console.error(`::error::${path} does not validate repository and owner through the shared scope`);
    process.exit(1);
  }
}

const infraStatus = read('supabase/functions/atlas-infra-status/index.ts');
if (!infraStatus.includes('ATLAS_GITHUB_REPOSITORIES')) {
  console.error('::error::atlas-infra-status is not migration-aware');
  process.exit(1);
}

const hubspotRepair = read('hubspot/atlas-crm-hubspot/repair-local-project.ps1');
if (!hubspotRepair.includes('ATLAS_CANONICAL_REPO')) {
  console.error('::error::HubSpot repair path is not canonical-repository configurable');
  process.exit(1);
}
if (hubspotRepair.includes('raw.githubusercontent.com/atlasenterprisesuite/atlasenterprisesuite')) {
  console.error('::error::HubSpot repair path still hardcodes the legacy raw GitHub repository URL');
  process.exit(1);
}

const supabaseConfig = read('supabase/config.toml');
const jwtContracts = [
  ['atlas-cloudflare-production-http-verify', 'false'],
  ['atlas-creator-e2e-verifier', 'false'],
  ['atlas-infra-evidence', 'false'],
  ['atlas-local-ai-bootstrap', 'false'],
  ['atlas-local-control', 'false'],
  ['atlas-infra-status', 'true']
];

for (const [slug, expected] of jwtContracts) {
  const contract = '[functions.' + slug + ']\nverify_jwt = ' + expected;
  if (!supabaseConfig.includes(contract)) {
    console.error('::error::supabase/config.toml JWT policy mismatch for ' + slug + '; expected verify_jwt=' + expected);
    process.exit(1);
  }
}

console.log('ATLAS_GITHUB_ORG_MIGRATION_PREFLIGHT_OK');
