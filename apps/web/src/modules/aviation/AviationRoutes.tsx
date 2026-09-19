import { Navigate, Route, Routes } from 'react-router-dom';
import { ModuleExperiencePage, type ModuleExperienceSection } from '../../components/ModuleExperiencePage';
import { AviationAircraftDetailPage } from './AviationAircraftDetailPage';
import { AviationCatalogPage } from './AviationCatalogPage';
import './aviation.css';

const aviationSections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Aircraft intelligence',
    title: 'Evidence before claims',
    description: 'ATLAS Aviation starts with governed research surfaces. Aircraft performance, certification and investment terms remain unverified until evidence-backed records exist.',
    cards: [
      {
        label: 'Aircraft',
        title: 'Concept catalog foundation',
        description: 'The approved ten-model ATLAS design family will be exposed as internal concepts without invented engineering specifications.',
        to: '/mobility/aviation/aircraft'
      },
      {
        label: 'Certification',
        title: 'Authority-backed status',
        description: 'Certification milestones require regulator or other traceable evidence before ATLAS can promote a status.',
        status: 'Evidence integration not configured'
      },
      {
        label: 'Investment intelligence',
        title: 'Research-only boundary',
        description: 'Offering information remains read-only research with source provenance and no securities transaction execution.',
        status: 'No transaction capability'
      }
    ]
  },
  {
    eyebrow: 'Mobility governance',
    title: 'Connected to the existing ATLAS control plane',
    description: 'Aviation reuses the canonical ATLAS Identity, organization context, navigation and production verification boundaries.',
    cards: [
      {
        label: 'Identity',
        title: 'Protected workspace',
        description: 'Every Aviation route stays behind the existing ATLAS Identity boundary.'
      },
      {
        label: 'Truthfulness',
        title: 'No fabricated readiness',
        description: 'Unknown range, speed, payload, price, certification and provider state remain explicitly unvalidated.'
      },
      {
        label: 'Operations',
        title: 'Flight execution is not active',
        description: 'Dispatch, autonomous control, vertiport booking and live fleet operations are not represented as active in this slice.',
        status: 'Operational providers not configured'
      }
    ]
  }
];

function AviationHomePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Mobility"
      title="ATLAS Aviation"
      description="Aircraft, certification and advanced-air-mobility intelligence under one governed ATLAS workspace."
      narrative="Explore the future of flight without turning concepts or marketing claims into production facts."
      sections={aviationSections}
      statusNote="Aviation is currently a partial capability. Engineering performance, certification, offering terms and operational provider connectivity require evidence before ATLAS presents them as verified."
    />
  );
}

export function AviationRoutes() {
  return (
    <Routes>
      <Route path="/mobility/aviation" element={<AviationHomePage />} />
      <Route path="/mobility/aviation/aircraft" element={<AviationCatalogPage />} />
      <Route path="/mobility/aviation/aircraft/:aircraftId" element={<AviationAircraftDetailPage />} />
      <Route path="/mobility/aviation/*" element={<Navigate to="/mobility/aviation" replace />} />
    </Routes>
  );
}
