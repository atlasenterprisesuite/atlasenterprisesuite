import { Navigate, Route, Routes } from 'react-router-dom';
import { HealthHome } from './HealthHome';
import { HealthModulePortfolio, HealthModuleShell } from './HealthModulePortfolio';
import { HealthPlaceholder } from './HealthPlaceholder';
import { HealthWorkspaceLanding } from './HealthWorkspaceLanding';
import { ResearchRoutes } from './research/ResearchRoutes';

export function HealthRoutes() {
  return (
    <Routes>
      <Route index element={<HealthHome />} />
      <Route
        path="proposal/adventhealth"
        element={<HealthWorkspaceLanding title="AdventHealth Business Proposal" description="A governed ATLAS Health proposal workspace for presenting the ecosystem, implementation approach, integrations, controls, and measurable operational outcomes." primaryTo="/health/proposal/adventhealth/executive-summary" primaryLabel="Executive Summary" notice="Proposal content is a business proposal state, not evidence of a live AdventHealth deployment or integration." />}
      />
      <Route
        path="proposal/adventhealth/executive-summary"
        element={<HealthWorkspaceLanding title="Proposal Executive Summary" description="Executive proposal route reserved for the approved AdventHealth proposal content implemented in the next task." primaryTo="/health/proposal/adventhealth" primaryLabel="Return to Proposal" />}
      />
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
