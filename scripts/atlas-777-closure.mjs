/** ATLAS 777 closure gate: evaluates existing canonical evidence; never manufactures it. */
export function evaluateClosure({ledger, evidence, approval, production} = {}) {
  const blockers = [];
  const failed = [];
  if (!ledger || !Array.isArray(ledger.phases) || ledger.phases.length !== 14) blockers.push('ledger:missing-or-invalid');
  if (!ledger?.sha || !/^[a-f0-9]{40}$/.test(ledger.sha)) blockers.push('ledger:exact-sha-missing');
  if (ledger?.phases) {
    for (const [index, phase] of ledger.phases.entries()) {
      if (phase.status === 'failed') failed.push(`phase:${index + 1}:${phase.name}`);
      else if (phase.status !== 'verified' || !Array.isArray(phase.evidence) || !phase.evidence.length) blockers.push(`phase:${index + 1}:unverified`);
    }
  }
  if (evidence?.outcome === 'FAIL') failed.push('canonical-evidence:fail');
  else if (evidence?.outcome !== 'PASS') blockers.push('canonical-evidence:not-pass');
  if (evidence?.sha !== ledger?.sha) blockers.push('canonical-evidence:sha-mismatch');
  if (approval?.status !== 'approved' || approval?.sha !== ledger?.sha) blockers.push('approval:missing-or-stale');
  if (production?.verified !== true) blockers.push('production:not-verified');
  if (production?.sha !== ledger?.sha) blockers.push('production:sha-mismatch');
  if (production?.environment !== 'production') blockers.push('production:wrong-environment');
  const outcome = failed.length ? 'FAIL' : blockers.length ? 'BLOCKED' : 'PASS';
  return {outcome, close_allowed:outcome === 'PASS', sha:ledger?.sha ?? null, failed, blockers};
}
