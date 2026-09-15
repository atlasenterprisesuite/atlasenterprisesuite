import { RequireAtlasIdentity } from '../identity/RequireAtlasIdentity';
import { CrmRoutes } from '../modules/business/crm/CrmRoutes';
import { ContentIntelligencePage } from '../modules/creator/content/ContentIntelligencePage';
import {
  AccountingExperiencePage,
  BusinessExperiencePage,
  EnterpriseExperiencePage,
  FinanceExperiencePage
} from '../modules/experience/AtlasModuleExperiences';
import { HealthExperiencePage } from '../modules/experience/HealthExperiencePage';
import { LearningExperiencePage } from '../modules/experience/LearningExperiencePage';
import { NeuroplasticityProgramPage } from '../modules/learning/NeuroplasticityProgramPage';

export function resolveAtlasExtension(pathname: string) {
  if (pathname === '/') {
    return <EnterpriseExperiencePage />;
  }

  if (pathname === '/business') {
    return <BusinessExperiencePage />;
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
    return <LearningExperiencePage />;
  }

  return null;
}
