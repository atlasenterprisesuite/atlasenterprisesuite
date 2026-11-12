#!/usr/bin/env node
/** ATLAS SOV-001: offline, fail-closed evidence verification. No provider access. */
import { createPublicKey, createHash, verify as verifySignature } from 'node:crypto';
import { readFileSync, realpathSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const P0_CHECKS = Object.freeze([
  'typecheck', 'unit_tests', 'integration_tests', 'production_build',
  'auth_and_tenancy', 'rls_and_rbac', 'backup_restore',
  'provider_independence', 'artifact_integrity', 'runtime_health',
  'dns_and_tls', 'authorized_release'
]);
const SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_AGE_MS = 86400000;
const CLOCK_SKEW_MS = 300000;

function smallFile(path, max) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > max) throw new Error('Not a regular file or exceeds size limit');
  return readFileSync(path);
}
function safeEvidence(root, name) {
  if (typeof name !== 'string' || !name || isAbsolute(name) ||
      name.includes('\\') || name.includes('\0') ||
      name.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('Invalid evidence path');
  }
  const base = realpathSync(root);
  const file = realpathSync(resolve(base, name));
  const rel = relative(base, file);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error('Evidence escapes root');
  }
  return file;
}
export function verifyRelease({ manifestPath, signaturePath, publicKeyPath, expectedSha, evidenceRoot, now = new Date() }) {
  const issues = [];
  let raw, manifest;
  if (!SHA.test(expectedSha || '')) issues.push('Expected SHA must be 40 lowercase hex characters');
  try {
    raw = smallFile(manifestPath, 1048576);
    manifest = JSON.parse(raw.toString('utf8'));
  } catch (e) { issues.push('Manifest unreadable or invalid: ' + e.message); }
  if (raw) {
    try {
      const key = createPublicKey(smallFile(publicKeyPath, 65536));
      if (key.asymmetricKeyType !== 'ed25519') throw new Error('Expected Ed25519 key');
      const encoded = smallFile(signaturePath, 4096).toString('utf8').trim();
      if (!/^[A-Za-z0-9+/]{86}==$/.test(encoded)) throw new Error('Malformed signature');
      if (!verifySignature(null, raw, key, Buffer.from(encoded, 'base64'))) {
        throw new Error('Invalid detached signature');
      }
    } catch (e) { issues.push('Signature not verified: ' + e.message); }
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { schema_version:'atlas.sovereignty.gate-result.v1', ok:false,
      eligible_for_deployment:false, checks_examined:0, issues };
  }
  if (manifest.schema_version !== 'atlas.sovereignty.v1') issues.push('Unsupported manifest schema');
  if (manifest.release?.environment !== 'production') issues.push('Expected production environment');
  if (!SHA.test(manifest.release?.sha || '')) issues.push('Invalid release SHA');
  if (manifest.release?.sha !== expectedSha) issues.push('Expected/release SHA mismatch');
  const issued = manifest.release?.issued_at;
  const stamp = typeof issued === 'string' ? Date.parse(issued) : NaN;
  const time = new Date(now).getTime();
  if (!Number.isFinite(stamp) || !Number.isFinite(time) ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(issued || '')) {
    issues.push('Invalid UTC issuance timestamp');
  } else if (stamp > time + CLOCK_SKEW_MS || time - stamp > MAX_AGE_MS) {
    issues.push('Attestation expired or in the future');
  }
  const checks = manifest.checks;
  if (!checks || typeof checks !== 'object' || Array.isArray(checks)) issues.push('Missing checks object');
  for (const name of P0_CHECKS) {
    const check = checks?.[name];
    if (!check || typeof check !== 'object' || Array.isArray(check)) {
      issues.push(name + ': missing check');
      continue;
    }
    if (check.status !== 'pass') issues.push(name + ': P0 not passed');
    if (check.sha !== expectedSha) issues.push(name + ': commit SHA mismatch');
    const evidence = check.evidence;
    if (!evidence || typeof evidence !== 'object' || !SHA256.test(evidence.sha256 || '')) {
      issues.push(name + ': missing SHA-256 evidence');
      continue;
    }
    try {
      const data = smallFile(safeEvidence(evidenceRoot, evidence.path), 10485760);
      if (createHash('sha256').update(data).digest('hex') !== evidence.sha256) {
        issues.push(name + ': content digest mismatch');
      }
    } catch (e) { issues.push(name + ': inaccessible or unsafe evidence: ' + e.message); }
  }
  return {
    schema_version:'atlas.sovereignty.gate-result.v1', ok:issues.length === 0,
    eligible_for_deployment:false,
    release_sha:SHA.test(manifest.release?.sha || '') ? manifest.release.sha : null,
    checks_examined:P0_CHECKS.length, issues
  };
}
function parseArgs(argv) {
  const args = {};
  if (argv.length % 2 !== 0) throw new Error('Expected --key value arguments');
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || !argv[i+1] || argv[i+1].startsWith('--')) {
      throw new Error('Expected --key value arguments');
    }
    args[argv[i].slice(2)] = argv[i+1];
  }
  for (const key of ['manifest','signature','public-key','expected-sha','evidence-root']) {
    if (!args[key]) throw new Error('Missing --' + key);
  }
  return args;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = verifyRelease({
      manifestPath:args.manifest, signaturePath:args.signature,
      publicKeyPath:args['public-key'], expectedSha:args['expected-sha'],
      evidenceRoot:args['evidence-root']
    });
    if (args.output) {
      mkdirSync(dirname(resolve(args.output)), {recursive:true});
      writeFileSync(args.output, JSON.stringify(result,null,2) + '\n', {flag:'w',mode:0o600});
    }
    process.stdout.write(JSON.stringify(result,null,2) + '\n');
    process.exitCode = result.ok ? 0 : 2;
  } catch(e) {
    process.stderr.write('ATLAS SOV-001 fail-closed: ' + e.message + '\n');
    process.exitCode = 2;
  }
}
