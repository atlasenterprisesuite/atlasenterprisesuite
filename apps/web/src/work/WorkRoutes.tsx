import { Navigate, Route, Routes } from 'react-router-dom';
import { WorkCommandCenter } from './WorkCommandCenter';
import { WorkComposerPage } from './WorkComposerPage';
import { WorkListPage } from './WorkListPage';

export function WorkRoutes() {
  return (
    <Routes>
      <Route path="/work" element={<WorkCommandCenter />} />
      <Route path="/work/new" element={<WorkComposerPage />} />
      <Route path="/work/active" element={<WorkListPage view="active" />} />
      <Route path="/work/approvals" element={<WorkListPage view="approvals" />} />
      <Route path="/work/history" element={<WorkListPage view="history" />} />
      <Route path="/work/*" element={<Navigate to="/work" replace />} />
    </Routes>
  );
}
