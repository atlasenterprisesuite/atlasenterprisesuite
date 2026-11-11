import { useState } from 'react';

type Gate = 'BLOCKED' | 'CI_PASSED' | 'NOT_VERIFIED';
type WorkItem = { name: string; pr: number; sha: string; workflows: string; gate: Gate };
export const missionSnapshot = {
  observedAt: '2026-11-06T15:07:00Z',
  provenance: 'GitHub PR HEAD and associated workflow-run queries; not a live feed',
  items: [
    { name: 'Academy', pr: 992, sha: '60a424d11b436869e2b5acb66d073b79552f063c', workflows: '8/8', gate: 'CI_PASSED' },
    { name: 'Sovereign Browser', pr: 976, sha: 'b7f51275ba929575a5ca344d790227311e2c43db', workflows: '8/8', gate: 'CI_PASSED' },
    { name: 'Voice Transfer', pr: 985, sha: '57d46c963b71808ba9323e83ec4caaf786baa133', workflows: '7/7', gate: 'CI_PASSED' },
    { name: 'Canonical inventory', pr: 994, sha: '61d213138e224f1c92b57075143e64e7782df284', workflows: '7/7', gate: 'CI_PASSED' },
    { name: 'AI Stack', pr: 621, sha: 'c7e3ceb3ad1e741d4ac8c2ac45f1f63876371015', workflows: 'No runs found', gate: 'NOT_VERIFIED' }
  ] satisfies WorkItem[]
} as const;

const stages = [
  ['Checkpoint', 'Verify branch HEAD, ownership, durable ledger and exclusive lease'],
  ['TDD RED', 'Reproduce a specific failure in an isolated environment'],
  ['Repair', 'Apply a minimal change on the existing authorized branch'],
  ['CI exact-SHA', 'Check the current commit and all required security gates'],
  ['Review / staging', 'Require independent review and explicit authorization'],
  ['Production', 'Require separate authorization, E2E evidence and rollback readiness']
] as const;

export function MissionControlPage() {
  const [selected, setSelected] = useState(0);
  return <main className="page-stack" aria-labelledby="mission-control-title">
    <header className="page-header">
      <p className="eyebrow">ATLAS 777 REVIEW / Mission Control</p>
      <h1 id="mission-control-title">Master Orchestrator</h1>
      <p>One execution line, evidence-backed gates, no simulated deployment.</p>
    </header>
    <div className="notice strong" role="status">
      <strong>P0 NO-GO</strong> — Snapshot recorded {new Date(missionSnapshot.observedAt).toLocaleString()}.
      This page does not poll GitHub, run CI, merge, deploy, or authorize production.
    </div>
    <section className="module-card" aria-labelledby="pipeline-heading">
      <h2 id="pipeline-heading">Execution pipeline</h2>
      <p>Choose a stage to inspect its acceptance gate. Selection does not execute a stage.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {stages.map(([name], index) => <button key={name} type="button" aria-pressed={selected === index}
          onClick={() => setSelected(index)}>{index + 1}. {name}</button>)}
      </div>
      <h3>{stages[selected][0]}</h3>
      <p>{stages[selected][1]}</p>
    </section>
    <section aria-labelledby="lines-heading">
      <h2 id="lines-heading">Canonical execution lines</h2>
      <p>CI success alone never authorizes merge, staging, or production.</p>
      <div className="module-grid">
        {missionSnapshot.items.map(item => <article className="module-card" key={item.pr}>
          <h3>{item.name}</h3>
          <p>PR #{item.pr} · Workflows: {item.workflows}</p>
          <p>HEAD: <code style={{ overflowWrap: 'anywhere' }}>{item.sha}</code></p>
          <p>Gate: {item.gate === 'CI_PASSED' ? 'Workflow runs successful; P0 remains open' : 'Not verified; P0 remains open'}</p>
          <a href={`https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/${item.pr}`}
            target="_blank" rel="noopener noreferrer">Inspect evidence in GitHub</a>
        </article>)}
      </div>
    </section>
    <section className="module-card" aria-labelledby="alerts-heading">
      <h2 id="alerts-heading">Notifications and authorization</h2>
      <p>Merge Ready → Deploy Ready → Production Verified are separate future gates, not achieved statuses.</p>
      <p>Only the authorized operator can approve irreversible actions. No actions are enabled here.</p>
    </section>
  </main>;
}
