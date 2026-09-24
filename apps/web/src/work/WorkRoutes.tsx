import { Navigate, Route, Routes } from 'react-router-dom';
import { WorkCommandCenter } from './WorkCommandCenter';
import { WorkComposerPage } from './WorkComposerPage';
import { WorkConnectionsPage } from './WorkConnectionsPage';
import { WorkComputerOperationsPage } from './WorkComputerOperationsPage';
import { WorkListPage } from './WorkListPage';
import { WorkPoliciesPage } from './WorkPoliciesPage';
import { WorkRuntimesPage } from './WorkRuntimesPage';
import { WorkTeamPage } from './WorkTeamPage';
import { WorkTemplatesPage } from './WorkTemplatesPage';

export function WorkRoutes() {
  return (
    <Routes>
      <Route path="/work" element={<WorkCommandCenter />} />
      <Route path="/work/new" element={<WorkComposerPage />} />
      <Route path="/work/active" element={<WorkListPage view="active" />} />
      <Route path="/work/approvals" element={<WorkListPage view="approvals" />} />
      <Route path="/work/history" element={<WorkListPage view="history" />} />
      <Route path="/work/templates" element={<WorkTemplatesPage />} />
      <Route path="/work/connections" element={<WorkConnectionsPage />} />
      <Route path="/work/computer-operations" element={<WorkComputerOperationsPage />} />
      <Route path="/work/runtimes" element={<WorkRuntimesPage />} />
      <Route path="/work/policies" element={<WorkPoliciesPage />} />
      <Route path="/work/team" element={<WorkTeamPage />} />
      <Route path="/work/*" element={<Navigate to="/work" replace />} />
    </Routes>
  );
}
