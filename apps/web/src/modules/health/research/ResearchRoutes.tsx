import { Navigate, Route, Routes } from 'react-router-dom';
import { DiseaseReconstructionRoutes } from './DiseaseReconstructionRoutes';
import { FrontiersHome } from './FrontiersHome';
import { ResearchHome } from './ResearchHome';

export function ResearchRoutes() {
  return (
    <Routes>
      <Route index element={<ResearchHome />} />
      <Route path="frontiers" element={<FrontiersHome />} />
      <Route path="frontiers/disease-reconstruction/*" element={<DiseaseReconstructionRoutes />} />
      <Route path="*" element={<Navigate to="/health/research" replace />} />
    </Routes>
  );
}
