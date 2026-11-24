import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCapabilities } from '../packages/execution/src/capability-registry.ts';

const GENERATED_FROM = 'packages/execution/src/capability-registry.ts' as const;
const ARTIFACT_PATH = resolve(
  fileURLToPath(new URL('../docs/generated/atlas-agent-capabilities.json', import.meta.url))
);

export function buildCapabilityManifest() {
  const capabilities = [...listCapabilities()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((capability) => ({
      id: capability.id,
      version: capability.version,
      domain: capability.domain,
      title: capability.title,
      description: capability.description,
      operation: capability.operation,
      risk_tier: capability.riskTier,
      mutates_external_state: capability.mutatesExternalState,
      may_incur_cost: capability.mayIncurCost,
      requires_approval: capability.requiresApproval,
      requires_evidence: capability.requiresEvidence,
      permissions: [...capability.permissions],
      allowed_environments: [...capability.allowedEnvironments],
      input_schema_ref: capability.inputSchemaRef,
      output_schema_ref: capability.outputSchemaRef,
      verification_policy: capability.verificationPolicy,
      ...(capability.skillRef ? { skill_ref: capability.skillRef } : {}),
      ...(capability.guideRef ? { guide_ref: capability.guideRef } : {}),
      providers: capability.providerBindings.map((binding) => ({
        provider: binding.provider,
        adapter: binding.adapter,
        environments: [...binding.environments],
        ...(binding.regions ? { regions: [...binding.regions] } : {}),
        priority: binding.priority,
        health_check: binding.healthCheck,
        ...(binding.writePolicy ? { write_policy: binding.writePolicy } : {})
      }))
    }));

  return {
    schema_version: 1 as const,
    generated_from: GENERATED_FROM,
    capabilities
  };
}

export function serializeCapabilityManifest(): string {
  return `${JSON.stringify(buildCapabilityManifest(), null, 2)}\n`;
}

function main() {
  const output = serializeCapabilityManifest();
  if (process.argv.includes('--check')) {
    let committed = '';
    try {
      committed = readFileSync(ARTIFACT_PATH, 'utf8');
    } catch {
      console.error('capability_manifest_missing');
      process.exitCode = 1;
      return;
    }

    if (committed !== output) {
      console.error('capability_manifest_drift');
      process.exitCode = 1;
      return;
    }

    console.log('capability_manifest_verified');
    return;
  }

  writeFileSync(ARTIFACT_PATH, output, 'utf8');
  console.log(`capability_manifest_written:${ARTIFACT_PATH}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === resolve(fileURLToPath(import.meta.url))) main();
