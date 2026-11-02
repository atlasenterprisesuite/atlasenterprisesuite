// ATLAS WEB-777: offline, read-only exact-SHA evidence validator.
// Input is an explicitly supplied snapshot; this script never calls GitHub or changes state.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export const REQUIRED = Object.freeze({
  974: ['ATLAS 777 Isolated PostgreSQL 17 Runtime'],
  968: ['ATLAS Advisory 777 Revocation Evidence (isolated)', 'Advisory Office CI'],
  970: ['Robotics PostgreSQL 17 isolated revocation proof'],
  976: ['ATLAS Build + Production Readiness Gate', 'ATLAS GitHub Security Baseline'],
  948: ['ATLAS Secure Data Room PostgreSQL 777'],
  977: ['ATLAS AI Council Security Gates'],
});
const shaPattern = /^[a-f0-9]{40}$/;
export function validate(snapshot) {
  const blockers = [];
  if (!snapshot || !Array.isArray(snapshot.prs)) return { ok:false, blockers:['P0_INVALID_SNAPSHOT'] };
  const seen = new Set();
  for (const [number, required] of Object.entries(REQUIRED)) {
    const matches = snapshot.prs.filter(pr => String(pr.number) === number);
    if (matches.length !== 1) { blockers.push(`P0_PR_MISSING_OR_DUPLICATE:${number}`); continue; }
    const pr = matches[0]; seen.add(Number(number));
    if (!shaPattern.test(pr.expectedSha ?? '') || !shaPattern.test(pr.actualSha ?? '') ||
        pr.expectedSha !== pr.actualSha) blockers.push(`P0_SHA_DRIFT:${number}`);
    if (!Array.isArray(pr.checks)) { blockers.push(`P0_CHECKS_MISSING:${number}`); continue; }
    for (const name of required) {
      const checks = pr.checks.filter(check => check.name === name && check.sha === pr.actualSha);
      if (checks.length !== 1 || checks[0].status !== 'completed' || checks[0].conclusion !== 'success')
        blockers.push(`P0_REQUIRED_CHECK_NOT_SUCCESS:${number}:${name}`);
    }
  }
  if (snapshot.prs.some(pr => !seen.has(pr.number))) blockers.push('P0_UNEXPECTED_PR');
  if (snapshot.foundationBootstrapCertified !== true) blockers.push('P0_FOUNDATION_NOT_CERTIFIED');
  if (snapshot.rulesetEnforcementCertified !== true) blockers.push('P0_RULESET_ENFORCEMENT_UNPROVEN');
  if (snapshot.revocationCertified !== true) blockers.push('P0_CROSS_MODULE_REVOCATION_UNPROVEN');
  return { ok:blockers.length===0, blockers };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw Error('P0_SNAPSHOT_PATH_REQUIRED');
    const result = validate(JSON.parse(readFileSync(process.argv[2], 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error('P0_VALIDATOR_INPUT_ERROR:', error.message);
    process.exitCode = 1;
  }
}
