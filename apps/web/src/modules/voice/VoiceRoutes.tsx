import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppleVoicePage } from './AppleVoicePage';
import { PersonalVoicePage } from './PersonalVoicePage';
import { PersonalVoiceWizard } from './PersonalVoiceWizard';
import { VoiceHomePage } from './VoiceHomePage';
import { VoicePermissionsPage } from './VoicePermissionsPage';

const wizardSteps = ['setup', 'sound-check', 'record', 'review', 'generate'] as const;
type WizardStep = (typeof wizardSteps)[number];

function PersonalVoiceWizardRoute() {
  const { step } = useParams();
  if (!wizardSteps.includes(step as WizardStep)) {
    return <Navigate to="/voice/personal-voice" replace />;
  }
  return <PersonalVoiceWizard initialStep={step as WizardStep} />;
}

export function VoiceRoutes() {
  return (
    <Routes>
      <Route index element={<VoiceHomePage />} />
      <Route path="personal-voice" element={<PersonalVoicePage />} />
      <Route path="personal-voice/library" element={<PersonalVoicePage />} />
      <Route path="personal-voice/apple" element={<AppleVoicePage />} />
      <Route path="personal-voice/permissions" element={<VoicePermissionsPage />} />
      <Route path="personal-voice/:step" element={<PersonalVoiceWizardRoute />} />
      <Route path="*" element={<Navigate to="/voice" replace />} />
    </Routes>
  );
}
