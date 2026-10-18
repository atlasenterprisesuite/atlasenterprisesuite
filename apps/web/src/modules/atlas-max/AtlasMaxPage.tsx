import React from 'react';
import type { EntitlementDecision } from '../../services/atlas-max/contracts';
import { OperatorPanel } from './OperatorPanel';
import { PlanComparison } from './PlanComparison';
import { UsagePanel } from './UsagePanel';

export function AtlasMaxPage({
  entitlement,
  usage,
}: {
  entitlement: EntitlementDecision;
  usage: { used: number; limit: number };
}) {
  const statusLabel =
    entitlement.status === 'allowed'
      ? 'MAX entitlement verified'
      : entitlement.status === 'degraded'
        ? 'ATLAS MAX degraded'
        : entitlement.status === 'denied'
          ? 'ATLAS MAX unavailable'
          : 'ATLAS MAX status unavailable';

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Intelligence</p>
        <h1>ATLAS MAX</h1>
        <p>Maximum governed capacity, priority execution, persistent Operators and evidence-backed usage controls.</p>
      </header>
      <div role="status" className="notice">{statusLabel}</div>
      <PlanComparison />
      <UsagePanel used={usage.used} limit={usage.limit} />
      <OperatorPanel />
    </section>
  );
}
