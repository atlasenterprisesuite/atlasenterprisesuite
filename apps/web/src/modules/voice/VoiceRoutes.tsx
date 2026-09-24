import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppleVoicePage } from './AppleVoicePage';
import { AtlasVoicePage } from './AtlasVoicePage';
import { PersonalVoicePage } from './PersonalVoicePage';
import { PersonalVoiceWizard, type PersonalVoiceWizardStep } from './PersonalVoiceWizard';
import { VoiceHomePage } from './VoiceHomePage';
import { VoiceStudioPage } from './VoiceStudioPage';
import './voice.css';
import './voiceStudio.css';

const personalVoiceSteps: readonly PersonalVoiceWizardStep[] = [
  'setup',
  'sound-check',
  'record',
  'review',
  'generate'
];

function PersonalVoiceWizardRoute() {
  const { step } = useParams();
  if (!personalVoiceSteps.includes(step as PersonalVoiceWizardStep)) {
    return <Navigate to="/voice/personal-voice" replace />;
  }
  return <PersonalVoiceWizard initialStep={step as PersonalVoiceWizardStep} />;
}

export function VoiceRoutes() {
  return (
    <Routes>
      <Route path="/voice" element={<VoiceHomePage />} />
      <Route path="/voice/assistant" element={<AtlasVoicePage />} />
      <Route path="/voice/studio" element={<VoiceStudioPage />} />
      <Route path="/voice/personal-voice" element={<PersonalVoicePage />} />
      <Route path="/voice/personal-voice/apple" element={<AppleVoicePage />} />
      <Route path="/voice/personal-voice/setup" element={<PersonalVoiceWizard initialStep="setup" />} />
      <Route path="/voice/personal-voice/sound-check" element={<PersonalVoiceWizard initialStep="sound-check" />} />
      <Route path="/voice/personal-voice/record" element={<PersonalVoiceWizard initialStep="record" />} />
      <Route path="/voice/personal-voice/review" element={<PersonalVoiceWizard initialStep="review" />} />
      <Route path="/voice/personal-voice/generate" element={<PersonalVoiceWizard initialStep="generate" />} />
      <Route path="/voice/personal-voice/:step" element={<PersonalVoiceWizardRoute />} />
      <Route path="*" element={<Navigate to="/voice" replace />} />
    </Routes>
  );
}
