#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { evaluateCommercialRelease } from './lib/commercial-release.mjs';

const POLICY_PATH = new URL('../data/ops/commercial-release-verification.json', import.meta.url);
const policy = JSON.parse(readFileSync(POLICY_PATH, 'utf8'));

function fail(message, code = 2) {
  console.error(`ATLAS Commercial Release: ${message}`);
  process.exitCode = code;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function requireArg(args, key) {
  const value = String(args[key] ?? '').trim();
  if (!value) throw new Error(`Missing required --${key}`);
  return value;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  const offerId = requireArg(args, 'offer');
  const expectedSha = requireArg(args, 'expected-sha').toLowerCase();
  const globalResultPath = requireArg(args, 'global-result');
  const evidencePath = requireArg(args, 'evidence');
  const outputPath = requireArg(args, 'json-output');
  const mode = String(args.mode ?? policy.default_mode ?? 'fail-closed');

  if (!policy.allowed_offer_ids.includes(offerId)) {
    throw new Error(`Unknown commercial offer: ${offerId}`);
  }
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
    throw new Error('--expected-sha must be a 40-character Git commit SHA');
  }
  if (!['fail-closed', 'warning-only'].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const globalProduction = readJson(globalResultPath, 'global production result');
  const evidence = readJson(evidencePath, 'commercial evidence');

  const result = evaluateCommercialRelease({
    ...evidence,
    expected_sha: expectedSha,
    offer_id: offerId,
    global_production: globalProduction
  }, { mode });

  const output = {
    ...result,
    gate_version: policy.gate_version,
    evidence_freshness_hours: policy.evidence_freshness_hours
  };

  const absoluteOutput = resolve(outputPath);
  mkdirSync(dirname(absoluteOutput), { recursive: true });
  writeFileSync(absoluteOutput, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    outcome: output.outcome,
    ok: output.ok,
    mode: output.mode,
    offer_id: output.offer_id,
    evaluated_sha: output.evaluated_sha,
    blocker_count: output.blockers.length,
    warning_count: output.warnings.length,
    json_output: absoluteOutput
  }));

  process.exitCode = output.outcome === 'BLOCKED' && mode === 'fail-closed' ? 1 : 0;
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
