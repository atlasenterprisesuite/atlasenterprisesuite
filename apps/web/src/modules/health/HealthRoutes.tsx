import { Navigate, Route, Routes } from 'react-router-dom';
import { HealthPlaceholder } from './HealthPlaceholder';
import { ResearchRoutes } from './research/ResearchRoutes';

export function HealthRoutes() {
  return (
    <Routes>
      <Route index element={<HealthPlaceholder />} />
      <Route path="research/*" element={<ResearchRoutes />} />
      <Route
        path="operations/modules/research-innovation"
        element={<Navigate to="/health/research" replace />}
      />
      <Route path="*" element={<HealthPlaceholder />} />
    </Routes>
  );
}
