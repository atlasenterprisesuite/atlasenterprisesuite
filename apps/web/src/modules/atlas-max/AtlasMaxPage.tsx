import React from 'react';
import type { EntitlementDecision } from '../../services/atlas-max/contracts';
import { OperatorPanel } from './OperatorPanel';
import { PlanComparison } from './PlanComparison';
import { AtlasMaxJourneys } from './AtlasMaxJourneys';
import { GatewayPanel, type AtlasMaxGatewayPanelState } from './GatewayPanel';
import { UsagePanel } from './UsagePanel';
import './atlasMax.css';

const CAPABILITY_DOMAINS = [
  {
    number: '01',
    title: 'Intelligence orchestration',
    description: 'Route work through verified models and reasoning profiles, with provider and privacy policies enforced at the server boundary.',
    detail: 'Intelligence Gateway · Model Registry'
  },
  {
    number: '02',
    title: 'Governed operators',
    description: 'Coordinate long-running goals with explicit tool permissions, durable checkpoints and a reviewable execution trail.',
    detail: 'ATLAS Work · Orchestrator'
  },
  {
    number: '03',
    title: 'Connected context',
    description: 'Bring enterprise knowledge, conversations and files into an organization-scoped context with traceable sources.',
    detail: 'Knowledge Atlas · ATLAS Memory'
  },
  {
    number: '04',
    title: 'Cost-aware execution',
    description: 'Validate entitlement, quota and estimated cost before choosing eligible execution capacity or a policy-compliant fallback.',
    detail: 'Cost Guard · Evidence Ledger'
  }
] as const;

function entitlementLabel(entitlement: EntitlementDecision) {
  if (entitlement.status === 'allowed') {
    return entitlement.planId === 'max' && entitlement.evidenceRef?.trim() ? 'MAX entitlement verified' : 'ATLAS MAX entitlement evidence required';
  }
  if (entitlement.status === 'degraded') return 'ATLAS MAX degraded';
  if (entitlement.status === 'denied') return 'ATLAS MAX unavailable';
  return 'ATLAS MAX status unavailable';
}

export function AtlasMaxPage({
  entitlement,
  usage,
  gateway,
  onGatewayRefresh,
}: {
  entitlement: EntitlementDecision;
  usage: { used: number; limit: number; evidenceRef?: string };
  gateway?: AtlasMaxGatewayPanelState;
  onGatewayRefresh?: () => void;
}) {
  const statusLabel = entitlementLabel(entitlement);
  const hasEntitlementEvidence = entitlement.status === 'allowed' && entitlement.planId === 'max' && Boolean(entitlement.evidenceRef?.trim());

  return (
    <div className="atlas-max-experience">
      <header className="atlas-max-hero">
        <div className="atlas-max-hero-copy">
          <p className="atlas-max-kicker">ATLAS Enterprise Suite / Intelligence Platform</p>
          <h1>ATLAS MAX</h1>
          <p className="atlas-max-lead">One intelligent operating environment for decisions, coordinated work and enterprise knowledge.</p>
          <p className="atlas-max-hero-description">
            Move from an idea to governed execution with model routing, specialized operators,
            workspace context and auditable evidence — built on the ATLAS platform.
          </p>
          <div className="atlas-max-hero-links">
            <a className="atlas-max-link-primary" href="/studio">
              Explore ATLAS Studio <span aria-hidden="true">↗</span>
            </a>
            <a className="atlas-max-link-secondary" href="/finance">Explore Business Finance</a>
          </div>
        </div>
        <div className="atlas-max-visual" aria-hidden="true">
          <div className="atlas-max-visual-grid" />
          <div className="atlas-max-orbit atlas-max-orbit-outer" />
          <div className="atlas-max-orbit atlas-max-orbit-middle" />
          <div className="atlas-max-orbit atlas-max-orbit-inner" />
          <div className="atlas-max-core">
            <span>ATLAS</span>
            <strong>MAX</strong>
            <small>INTELLIGENCE</small>
          </div>
          <div className="atlas-max-orbit-label atlas-max-orbit-label-top">MODEL ROUTING</div>
          <div className="atlas-max-orbit-label atlas-max-orbit-label-bottom">POLICY · EVIDENCE</div>
        </div>
        <div className="atlas-max-hero-foot">
          <span>PROVIDER NEUTRAL</span>
          <span>ENTERPRISE GOVERNED</span>
          <span>ZERO TRUST</span>
        </div>
      </header>

      <section className="atlas-max-assurance" aria-labelledby="atlas-max-assurance-title">
        <div className="atlas-max-assurance-copy">
          <p className="atlas-max-kicker">System assurance</p>
          <h2 id="atlas-max-assurance-title">Clarity before capability.</h2>
          <p>Feature catalog entries describe intended offerings. Execution and subscription access depend on authenticated service evidence.</p>
        </div>
        <div className="atlas-max-assurance-state">
          <span className="atlas-max-field-label">Current entitlement</span>
          <p role="status" className={hasEntitlementEvidence ? 'atlas-max-state verified' : 'atlas-max-state'}>
            <span className="atlas-max-state-symbol" aria-hidden="true" />
            {statusLabel}
          </p>
          <p className="atlas-max-meta-note">{hasEntitlementEvidence ? 'Evidence reference supplied by the entitlement boundary.' : 'No active entitlement is claimed without a verified server response.'}</p>
        </div>
      </section>

      <section className="atlas-max-capabilities" aria-labelledby="atlas-max-capabilities-title">
        <div className="atlas-max-section-heading">
          <div>
            <p className="atlas-max-kicker">01 / Platform architecture</p>
            <h2 id="atlas-max-capabilities-title">One platform. Connected intelligence.</h2>
          </div>
          <p>Four coordinated systems designed to work with existing ATLAS services, never a parallel identity or data silo.</p>
        </div>
        <div className="atlas-max-capability-grid">
          {CAPABILITY_DOMAINS.map((item) => (
            <article className="atlas-max-capability" key={item.number}>
              <div className="atlas-max-capability-top">
                <span className="atlas-max-capability-number" aria-hidden="true">{item.number}</span>
                <span className="atlas-max-capability-dot" aria-hidden="true" />
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="atlas-max-capability-owner">{item.detail}</div>
            </article>
          ))}
        </div>
      </section>

      <AtlasMaxJourneys />
      <PlanComparison />

      <section className="atlas-max-operations" aria-labelledby="atlas-max-operations-title">
        <div className="atlas-max-section-heading">
          <div>
            <p className="atlas-max-kicker">04 / Operational controls</p>
            <h2 id="atlas-max-operations-title">Every action should have evidence.</h2>
          </div>
          <p>Entitlements, capacity and delegated work remain visible without manufacturing readiness or utilization.</p>
        </div>
        <div className="atlas-max-operations-grid">
          <UsagePanel used={usage.used} limit={usage.limit} evidenceRef={hasEntitlementEvidence ? usage.evidenceRef : undefined} />
          <OperatorPanel />
        </div>
      </section>
      {gateway && <GatewayPanel gateway={gateway} onRefresh={onGatewayRefresh} />}
      <footer className="atlas-max-footer">
        <span>ATLAS / INTELLIGENCE SYSTEMS</span>
        <span>Identity · Tenant isolation · Approval · Audit</span>
      </footer>
    </div>
  );
}
