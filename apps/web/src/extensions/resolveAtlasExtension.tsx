import { Navigate } from 'react-router-dom';
import { RequireAtlasIdentity } from '../identity/RequireAtlasIdentity';
import { CrmRoutes } from '../modules/business/crm/CrmRoutes';
import { CommerceRoutes } from '../modules/commerce/CommerceRoutes';
import { ConnectRoutes } from '../modules/connect/ConnectRoutes';
import { ContentIntelligencePage } from '../modules/creator/content/ContentIntelligencePage';
import {
  AccountingExperiencePage,
  BusinessExperiencePage,
  EnterpriseExperiencePage,
  FinanceExperiencePage
} from '../modules/experience/AtlasModuleExperiences';
import { AtlasGalaxyPage } from '../modules/galaxy/AtlasGalaxyPage';
import { HealthExperiencePage } from '../modules/experience/HealthExperiencePage';
import { JaqueMateSentinelPage } from '../modules/health/JaqueMateSentinelPage';
import { LearningExperiencePage } from '../modules/experience/LearningExperiencePage';
import { NeuroplasticityProgramPage } from '../modules/learning/NeuroplasticityProgramPage';

const JAQUE_MATE_SENTINEL_CANONICAL = '/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel';
const JAQUE_MATE_SENTINEL_V2 = '/health/jaque-mate/sentinel/v2';
const JAQUE_MATE_SENTINEL_LEGACY = '/health/jaque-mate/sentinel';

export function resolveAtlasExtension(pathname: string) {
  if (pathname === '/') return <EnterpriseExperiencePage />;
  if (pathname === '/business') return <BusinessExperiencePage />;
  if (pathname === '/finance') return <FinanceExperiencePage />;
  if (pathname === '/finance/accounting') return <AccountingExperiencePage />;

  if (pathname === '/galaxy') {
    return <RequireAtlasIdentity><AtlasGalaxyPage /></RequireAtlasIdentity>;
  }

  if (pathname === '/crm' || pathname.startsWith('/crm/')) {
    return <RequireAtlasIdentity><CrmRoutes /></RequireAtlasIdentity>;
  }

  if (pathname === '/commerce' || pathname.startsWith('/commerce/')) {
    return (
      <RequireAtlasIdentity>
        <CommerceRoutes />
      </RequireAtlasIdentity>
    );
  }

  if (pathname === '/connect' || pathname.startsWith('/connect/')) {
    return <RequireAtlasIdentity><ConnectRoutes /></RequireAtlasIdentity>;
  }

  if (pathname === '/studio/content') {
    return <RequireAtlasIdentity><ContentIntelligencePage /></RequireAtlasIdentity>;
  }

  if (pathname === '/health') return <HealthExperiencePage />;

  if (pathname === JAQUE_MATE_SENTINEL_LEGACY) {
    return <Navigate to={JAQUE_MATE_SENTINEL_V2} replace />;
  }

  if (pathname === JAQUE_MATE_SENTINEL_V2 || pathname === JAQUE_MATE_SENTINEL_CANONICAL) {
    return <JaqueMateSentinelPage />;
  }

  if (pathname === '/health/wellbeing/neuroplasticity') {
    return <NeuroplasticityProgramPage entry="health" />;
  }

  if (pathname === '/learning/neuroplasticity') {
    return <NeuroplasticityProgramPage entry="learning" />;
  }

  if (pathname === '/learning') return <LearningExperiencePage />;
  return null;
}
