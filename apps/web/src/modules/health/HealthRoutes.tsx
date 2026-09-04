import { Route, Routes } from 'react-router-dom';
import { HealthPlaceholder } from './HealthPlaceholder';

export function HealthRoutes() {
  return (
    <Routes>
      <Route index element={<HealthPlaceholder />} />
      <Route path="*" element={<HealthPlaceholder />} />
    </Routes>
  );
}
