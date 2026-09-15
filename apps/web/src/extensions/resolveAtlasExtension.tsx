import { Link } from 'react-router-dom';
import { RequireAtlasIdentity } from '../identity/RequireAtlasIdentity';
import { CrmRoutes } from '../modules/business/crm/CrmRoutes';
import { ContentIntelligencePage } from '../modules/creator/content/ContentIntelligencePage';
import {
  AccountingExperiencePage,
  EnterpriseExperiencePage,
  FinanceExperiencePage
} from '../modules/experience/AtlasModuleExperiences';
import { HealthExperiencePage } from '../modules/experience/HealthExperiencePage';
import { NeuroplasticityProgramPage } from '../modules/learning/NeuroplasticityProgramPage';

export function resolveAtlasExtension(pathname: string) {
  if (pathname === '/') {
    return <EnterpriseExperiencePage />;
  }

  if (pathname === '/finance') {
    return <FinanceExperiencePage />;
  }

  if (pathname === '/finance/accounting') {
    return <AccountingExperiencePage />;
  }

  if (pathname === '/crm' || pathname.startsWith('/crm/')) {
    return (
      <RequireAtlasIdentity>
        <CrmRoutes />
      </RequireAtlasIdentity>
    );
  }

  if (pathname === '/studio/content') {
    return <RequireAtlasIdentity><ContentIntelligencePage /></RequireAtlasIdentity>;
  }

  if (pathname === '/health') {
    return <HealthExperiencePage />;
  }

  if (pathname === '/health/wellbeing/neuroplasticity') {
    return <NeuroplasticityProgramPage entry="health" />;
  }

  if (pathname === '/learning/neuroplasticity') {
    return <NeuroplasticityProgramPage entry="learning" />;
  }

  if (pathname === '/learning') {
    return (
      <section className="page-stack">
        <header className="page-header">
          <p className="eyebrow">ATLAS Learning</p>
          <h1>Learning</h1>
          <p>Turn goals into deliberate practice, active recall, spaced review and measurable activity progress.</p>
        </header>
        <Link className="feature-card link-card accent" to="/learning/neuroplasticity">
          <p className="eyebrow">Practice Lab</p>
          <h2>Neuroplasticity Program</h2>
          <p>A cross-module program coordinated with ATLAS Health for readiness, recovery and safety.</p>
          <span className="action-link">Build a daily plan</span>
        </Link>
      </section>
    );
  }

  return null;
}
