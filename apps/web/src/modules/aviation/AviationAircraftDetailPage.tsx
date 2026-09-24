import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AVIATION_CONCEPTS } from './aviation-concepts';
import { classifyEvidenceState } from './aviation-evidence';
import { classifyInvestmentFreshness, getOfficialInvestmentAction } from './aviation-investment';
import type { AviationConcept } from './aviation-model';

const TABS = [
  'Overview',
  'Specifications',
  'Certification',
  'Company',
  'Investment',
  'Documents',
  'News'
] as const;

type AircraftTab = (typeof TABS)[number];

function NotFound() {
  return (
    <section className="page-stack aviation-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Aviation</p>
        <h1>Aircraft not found</h1>
        <p>The requested aircraft does not exist in the governed ATLAS concept catalog.</p>
      </header>
      <Link className="text-link" to="/mobility/aviation/aircraft">Return to Aircraft Catalog</Link>
    </section>
  );
}

function SpecificationPanel({ aircraft }: { aircraft: AviationConcept }) {
  return (
    <div className="aviation-detail-panel">
      <div className="notice strong">No engineering specification is promoted as verified until evidence and engineering validation exist.</div>
      <dl className="aviation-detail-metrics">
        <div><dt>Speed</dt><dd>{aircraft.metrics.speedKph ?? 'Not validated'}</dd></div>
        <div><dt>Range</dt><dd>{aircraft.metrics.rangeKm ?? 'Not validated'}</dd></div>
        <div><dt>Payload</dt><dd>{aircraft.metrics.payloadKg ?? 'Not validated'}</dd></div>
        <div><dt>Price</dt><dd>{aircraft.metrics.priceUsd ?? 'Not validated'}</dd></div>
        <div><dt>Valuation</dt><dd>{aircraft.metrics.valuationUsd ?? 'Not validated'}</dd></div>
      </dl>
    </div>
  );
}

function DetailPanel({ aircraft, tab }: { aircraft: AviationConcept; tab: AircraftTab }) {
  const evidenceState = classifyEvidenceState([]);

  if (tab === 'Specifications') return <SpecificationPanel aircraft={aircraft} />;

  if (tab === 'Certification') {
    return (
      <div className="aviation-detail-panel">
        <h2>Certification intelligence</h2>
        <p><strong>Evidence not configured</strong></p>
        <p>No regulator-backed certification record has been attached to this internal concept.</p>
      </div>
    );
  }

  if (tab === 'Investment') {
    const freshness = classifyInvestmentFreshness(aircraft.investment);
    const officialAction = getOfficialInvestmentAction(aircraft.investment);

    return (
      <div className="aviation-detail-panel">
        <h2>Investment intelligence</h2>
        <p>{freshness === 'not_configured' ? 'Investment data is not configured for this internal concept.' : `Investment evidence state: ${freshness}.`}</p>
        <div className="notice strong">
          Early-stage investments may be illiquid and may result in total loss. ATLAS does not execute securities transactions from this workspace.
        </div>
        {officialAction ? (
          <a
            className="aviation-open-aircraft"
            href={officialAction}
            target="_blank"
            rel="noreferrer"
            aria-label="Open official offering source"
          >
            Open official offering source
          </a>
        ) : null}
      </div>
    );
  }

  if (tab === 'Company') {
    return (
      <div className="aviation-detail-panel">
        <h2>Company context</h2>
        <p>This is an ATLAS internal concept. No external manufacturer or issuer is represented.</p>
      </div>
    );
  }

  if (tab === 'Documents') {
    return (
      <div className="aviation-detail-panel">
        <h2>Documents</h2>
        <p>No evidence documents are configured for this concept.</p>
      </div>
    );
  }

  if (tab === 'News') {
    return (
      <div className="aviation-detail-panel">
        <h2>News</h2>
        <p>No verified news sources are attached to this concept.</p>
      </div>
    );
  }

  return (
    <div className="aviation-detail-panel">
      <h2>Concept overview</h2>
      <p>{aircraft.summary}</p>
      <dl className="aviation-detail-metrics">
        <div><dt>Intended use</dt><dd>{aircraft.intendedUse}</dd></div>
        <div><dt>Design state</dt><dd>Concept record</dd></div>
        <div><dt>Evidence</dt><dd>{evidenceState === 'not_configured' ? 'Not configured' : evidenceState}</dd></div>
      </dl>
    </div>
  );
}

export function AviationAircraftDetailPage() {
  const { aircraftId = '' } = useParams();
  const aircraft = AVIATION_CONCEPTS.find((item) => item.id === aircraftId || item.slug === aircraftId);
  const [activeTab, setActiveTab] = useState<AircraftTab>('Overview');

  if (!aircraft) return <NotFound />;

  const activeIndex = TABS.indexOf(activeTab);

  return (
    <section className="page-stack aviation-page">
      <Link className="text-link" to="/mobility/aviation/aircraft">← Aircraft Catalog</Link>

      <header className="aviation-detail-hero">
        <div className="aviation-detail-visual" aria-hidden="true">
          <span>{aircraft.modelName.replace('ATLAS ', '')}</span>
        </div>
        <div className="aviation-detail-hero-copy">
          <p className="eyebrow">{aircraft.categoryLabel}</p>
          <h1>{aircraft.modelName}</h1>
          <p>{aircraft.summary}</p>
          <div className="aviation-evidence-strip">
            <span>Internal concept</span>
            <span>Certification: Unverified</span>
            <span>Evidence: Not configured</span>
          </div>
        </div>
      </header>

      <div className="aviation-tabs" role="tablist" aria-label="Aircraft intelligence sections">
        {TABS.map((tab, index) => (
          <button
            id={`aviation-tab-${index}`}
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls="aviation-detail-tabpanel"
            tabIndex={activeTab === tab ? 0 : -1}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        id="aviation-detail-tabpanel"
        role="tabpanel"
        aria-labelledby={`aviation-tab-${activeIndex}`}
      >
        <DetailPanel aircraft={aircraft} tab={activeTab} />
      </div>
    </section>
  );
}
