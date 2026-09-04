import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { HealthHome } from './HealthHome';
import { ProposalLayout } from './proposal/ProposalLayout';
import { ProposalSectionPage } from './proposal/ProposalSectionPage';
import { proposalSections } from './proposal/proposalContent';
import { OperationsLayout } from './operations/OperationsLayout';
import { CommandCenterPage } from './operations/CommandCenterPage';
import { ModuleDirectoryPage } from './operations/ModuleDirectoryPage';
import { HealthModulePage } from './operations/HealthModulePage';
import { ResearchRoutes } from './research/ResearchRoutes';

function ProposalSectionRoute() { const { sectionId } = useParams(); const section = proposalSections.find(item => item.id === sectionId); if (!section) return <Navigate to="/health/proposal/adventhealth/executive-summary" replace />; return <ProposalSectionPage section={section} />; }
export function HealthRoutes() { return <Routes><Route index element={<HealthHome />} /><Route path="proposal/adventhealth" element={<ProposalLayout />}><Route index element={<Navigate to="executive-summary" replace />} /><Route path=":sectionId" element={<ProposalSectionRoute />} /></Route><Route path="operations" element={<OperationsLayout />}><Route index element={<Navigate to="command-center" replace />} /><Route path="command-center" element={<CommandCenterPage />} /><Route path="modules" element={<ModuleDirectoryPage />} /><Route path="modules/research-innovation" element={<Navigate to="/health/research" replace />} /><Route path="modules/:moduleId" element={<HealthModulePage />} /></Route><Route path="research/*" element={<ResearchRoutes />} /><Route path="*" element={<Navigate to="/health" replace />} /></Routes>; }
