import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { HealthHome } from './HealthHome';
import { HealthModulePortfolio, HealthModuleShell } from './HealthModulePortfolio';
import { HealthPlaceholder } from './HealthPlaceholder';
import { HealthWorkspaceLanding } from './HealthWorkspaceLanding';
import { ProposalLayout } from './proposal/ProposalLayout';
import { ProposalSectionPage } from './proposal/ProposalSectionPage';
import { proposalSections } from './proposal/proposalContent';
import { ResearchRoutes } from './research/ResearchRoutes';

function ProposalSectionRoute() {
  const { sectionId } = useParams();
  const section = proposalSections.find((item) => item.id === sectionId);

  if (!section) {
    return <Navigate to="/health/proposal/adventhealth/executive-summary" replace />;
  }

  return <ProposalSectionPage section={section} />;
}

export function HealthRoutes() {
  return (
    <Routes>
      <Route index element={<HealthHome />} />
      <Route path="proposal/adventhealth" element={<ProposalLayout />}>
        <Route index element={<Navigate to="executive-summary" replace />} />
        <Route path=":sectionId" element={<ProposalSectionRoute />} />
      </Route>
      <Route
        path="operations"
        element={<HealthWorkspaceLanding title="Health Operations" description="Governed operational entry point for command, modules, source status, and cross-domain Health workflows." primaryTo="/health/operations/command-center" primaryLabel="Open Command Center" />}
      />
      <Route
        path="operations/command-center"
        element={<HealthWorkspaceLanding title="Smart Health Command Center" description="Command surface for approved Health metrics, alerts, modules, and integration state." primaryTo="/health/operations/modules" primaryLabel="Open Module Portfolio" />}
      />
      <Route path="operations/modules" element={<HealthModulePortfolio />} />
      <Route
        path="operations/modules/research-innovation"
        element={<Navigate to="/health/research" replace />}
      />
      <Route path="operations/modules/:moduleId" element={<HealthModuleShell />} />
      <Route path="research/*" element={<ResearchRoutes />} />
      <Route path="*" element={<HealthPlaceholder />} />
    </Routes>
  );
}
