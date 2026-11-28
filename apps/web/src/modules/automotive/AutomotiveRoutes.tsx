import { Navigate, Route, Routes } from 'react-router-dom';
import { AutomotiveIntelligencePage } from './AutomotiveIntelligencePage';

export function AutomotiveRoutes() {
  return (
    <Routes>
      <Route path="/mobility/automotive" element={<AutomotiveIntelligencePage />} />
      <Route path="/mobility/automotive/*" element={<Navigate to="/mobility/automotive" replace />} />
    </Routes>
  );
}
