// ATLAS Gravity F1: evidence-backed PR dependency gate; never infer runtime edges.
const SHA = /^[a-f0-9]{40}$/;
const FAIL = new Set(['failure','failed','cancelled','canceled','timed_out','action_required','pending','queued','in_progress','skipped','neutral','missing']);
export function validateGravityLedger(ledger, observed) {
  const findings = [];
  const nodes = ledger?.nodes;
  if (!Array.isArray(nodes) || !Array.isArray(ledger?.edges) || !observed || typeof observed !== 'object') return {go:false,findings:['invalid-ledger']};
  const ids = new Set();
  for (const n of nodes) {
    if (!n || typeof n.id !== 'string' || ids.has(n.id)) { findings.push('duplicate-or-invalid-node'); continue; }
    ids.add(n.id);
    if (!SHA.test(n.expectedHead || '')) findings.push('invalid-sha:'+n.id);
    const current = observed[n.id];
    if (!current || current.head !== n.expectedHead) { findings.push('stale-or-missing-head:'+n.id); continue; }
    if (current.rulesetCertified !== true) findings.push('ruleset-not-certified:'+n.id);
    if (!Array.isArray(n.requiredChecks) || !n.requiredChecks.length) findings.push('required-checks-absent:'+n.id);
    for (const name of n.requiredChecks || []) {
      const check = current.checks?.[name];
      if (!check || check.head !== n.expectedHead || check.conclusion !== 'success' || FAIL.has(check.status)) findings.push('check-not-green:'+n.id+':'+name);
    }
  }
  for (const e of ledger.edges) {
    if (!e || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to || !e.evidence?.reference || !e.evidence?.kind) findings.push('unproven-or-broken-edge');
  }
  const adj = new Map([...ids].map(id=>[id,[]]));
  for (const e of ledger.edges) if (adj.has(e?.from) && ids.has(e.to)) adj.get(e.from).push(e.to);
  const visiting = new Set(), visited = new Set();
  function walk(id) { if (visiting.has(id)) {findings.push('dependency-cycle:'+id);return;} if (visited.has(id)) return; visiting.add(id); for (const to of adj.get(id)) walk(to); visiting.delete(id); visited.add(id); }
  for (const id of ids) walk(id);
  return {go:findings.length===0,findings:[...new Set(findings)].sort()};
}
