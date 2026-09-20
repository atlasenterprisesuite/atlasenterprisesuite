import { Navigate } from 'react-router-dom';
import { RequireAtlasIdentity } from '../identity/RequireAtlasIdentity';
import { AdvisoryRoutes } from '../modules/advisory/AdvisoryRoutes';
import { AviationRoutes } from '../modules/aviation/AviationRoutes';
import { CrmRoutes } from '../modules/business/crm/CrmRoutes';
import { CommerceRoutes } from '../modules/commerce/CommerceRoutes';
import { ConnectRoutes } from '../modules/connect/ConnectRoutes';
import { DeviceOSPage } from '../modules/device-os/DeviceOSPage';
import { EventsHomePage } from '../modules/events/EventsHomePage';
import { FrontierRoutes } from '../modules/frontier/FrontierRoutes';
import { AtlasGestationPage } from '../modules/release/AtlasGestationPage';
import { ContentIntelligencePage } from '../modules/creator/content/ContentIntelligencePage';
import { SocialCommandCenterPage } from '../modules/creator/social/SocialCommandCenterPage';
import { ATLASWritingDeskPage } from '../modules/creator/writing/ATLASWritingDeskPage';
import { WebLaunchPage } from '../modules/creator/web/WebLaunchPage';
import {
  AccountingExperiencePage,
  BusinessExperiencePage,
  EnterpriseExperiencePage,
  FinanceExperiencePage
} from '../modules/experience/AtlasModuleExperiences';
import { AtlasGalaxyPage } from '../modules/galaxy/AtlasGalaxyPage';
import { AtlasPortalsPage } from '../modules/galaxy/AtlasPortalsPage';
import { HealthExperiencePage } from '../modules/experience/HealthExperiencePage';
import { JaqueMateSentinelPage } from '../modules/health/JaqueMateSentinelPage';
import { LearningExperiencePage } from '../modules/experience/LearningExperiencePage';
import { NeuroplasticityProgramPage } from '../modules/learning/NeuroplasticityProgramPage';
import { UnifiedAIChatPage } from '../modules/intelligence/UnifiedAIChatPage';
import { AtlasSuitePage } from '../modules/integration/AtlasSuitePage';
import {
  AnalyticsIntegrationHub,
  AutomationsIntegrationHub,
  PeopleIntegrationHub,
  ReleaseControlIntegrationHub,
  RevenueIntegrationHub,
  SiteReviewIntegrationHub,
  TelecomIntegrationHub
} from '../modules/integration/AtlasIntegrationHubs';
import { VoiceRoutes } from '../modules/voice/VoiceRoutes';
import { WorkRoutes } from '../work/WorkRoutes';

const JAQUE_MATE_SENTINEL_CANONICAL = '/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel';
const JAQUE_MATE_SENTINEL_V2 = '/health/jaque-mate/sentinel/v2';
const JAQUE_MATE_SENTINEL_LEGACY = '/health/jaque-mate/sentinel';

export function resolveAtlasExtension(pathname: string) {
  if (pathname === '/suite') return <AtlasSuitePage />;

  if (pathname === '/automations') {
    return <RequireAtlasIdentity><AutomationsIntegrationHub /></RequireAtlasIdentity>;
  }

  if (pathname === '/analytics') {
    return <RequireAtlasIdentity><AnalyticsIntegrationHub /></RequireAtlasIdentity>;
  }

  if (pathname === '/people') {
    return <RequireAtlasIdentity><PeopleIntegrationHub /></RequireAtlasIdentity>;
  }

  if (pathname === '/revenue') {
    return <RequireAtlasIdentity><RevenueIntegrationHub /></RequireAtlasIdentity>;
  }

  if (pathname === '/site-review') {
    return <RequireAtlasIdentity><SiteReviewIntegrationHub /></RequireAtlasIdentity>;
  }

  if (pathname === '/telecom') {
    return <RequireAtlasIdentity><TelecomIntegrationHub /></RequireAtlasIdentity>;
  }

  if (pathname === '/release') {
    return <RequireAtlasIdentity><ReleaseControlIntegrationHub /></RequireAtlasIdentity>;
  }

  if (pathname === '/release/gestation') {
    return <RequireAtlasIdentity><AtlasGestationPage /></RequireAtlasIdentity>;
  }

  if (pathname === '/assistant') {
    return <RequireAtlasIdentity><UnifiedAIChatPage /></RequireAtlasIdentity>;
  }

  if (pathname === '/voice' || pathname.startsWith('/voice/')) {
    return <RequireAtlasIdentity><VoiceRoutes /></RequireAtlasIdentity>;
  }

  if (pathname === '/work' || pathname.startsWith('/work/')) {
    return <RequireAtlasIdentity><WorkRoutes /></RequireAtlasIdentity>;
  }

  if (pathname === '/') return <EnterpriseExperiencePage />;

  if (pathname === '/advisory' || pathname.startsWith('/advisory/')) {
    return <RequireAtlasIdentity><AdvisoryRoutes /></RequireAtlasIdentity>;
  }

  if (pathname === '/events') {
    return <RequireAtlasIdentity><EventsHomePage /></RequireAtlasIdentity>;
  }

  if (pathname === '/frontier' || pathname.startsWith('/frontier/')) {
    return <RequireAtlasIdentity><FrontierRoutes /></RequireAtlasIdentity>;
  }

  if (pathname === '/mobility/aviation' || pathname.startsWith('/mobility/aviation/')) {
    return <RequireAtlasIdentity><AviationRoutes /></RequireAtlasIdentity>;
  }

  if (pathname === '/business') return <BusinessExperiencePage />;
  if (pathname === '/finance') return <FinanceExperiencePage />;
  if (pathname === '/finance/accounting') return <AccountingExperiencePage />;

  if (pathname === '/galaxy/portals') {
    return <RequireAtlasIdentity><AtlasPortalsPage /></RequireAtlasIdentity>;
  }

  if (pathname === '/galaxy') {
    return <RequireAtlasIdentity><AtlasGalaxyPage /></RequireAtlasIdentity>;
  }

  if (pathname === '/device-os') {
    return <RequireAtlasIdentity><DeviceOSPage /></RequireAtlasIdentity>;
  }

  if (pathname === '/crm' || pathname.startsWith('/crm/')) {
    return <RequireAtlasIdentity><CrmRoutes /></RequireAtlasIdentity>;
  }

  if (pathname === '/commerce' || pathname.startsWith('/commerce/')) {
    return <RequireAtlasIdentity><CommerceRoutes /></RequireAtlasIdentity>;
  }

  if (pathname === '/connect' || pathname.startsWith('/connect/')) {
    return <RequireAtlasIdentity><ConnectRoutes /></RequireAtlasIdentity>;
  }

  if (pathname === '/studio/content') {
    return <RequireAtlasIdentity><ContentIntelligencePage /></RequireAtlasIdentity>;
  }

  if (pathname === '/studio/social') {
    return <RequireAtlasIdentity><SocialCommandCenterPage /></RequireAtlasIdentity>;
  }

  if (pathname === '/studio/write') {
    return <RequireAtlasIdentity><ATLASWritingDeskPage /></RequireAtlasIdentity>;
  }

  if (pathname === '/studio/web-launch') {
    return <RequireAtlasIdentity><WebLaunchPage /></RequireAtlasIdentity>;
  }

  if (pathname === '/health') return <HealthExperiencePage />;
  if (pathname === JAQUE_MATE_SENTINEL_LEGACY) return <Navigate to={JAQUE_MATE_SENTINEL_V2} replace />;
  if (pathname === JAQUE_MATE_SENTINEL_V2 || pathname === JAQUE_MATE_SENTINEL_CANONICAL) return <JaqueMateSentinelPage />;
  if (pathname === '/health/wellbeing/neuroplasticity') return <NeuroplasticityProgramPage entry="health" />;
  if (pathname === '/learning/neuroplasticity') return <NeuroplasticityProgramPage entry="learning" />;
  if (pathname === '/learning') return <LearningExperiencePage />;
  return null;
}
