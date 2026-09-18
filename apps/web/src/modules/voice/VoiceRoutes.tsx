import { Route, Routes } from 'react-router-dom';
import { AtlasVoicePage } from './AtlasVoicePage';
import { VoiceHomePage } from './VoiceHomePage';
import { VoiceStudioPage } from './VoiceStudioPage';
import './voice.css';
import './voiceStudio.css';

export function VoiceRoutes() {
  return (
    <Routes>
      <Route path="/voice" element={<VoiceHomePage />} />
      <Route path="/voice/assistant" element={<AtlasVoicePage />} />
      <Route path="/voice/personal-voice" element={<VoiceStudioPage />} />
    </Routes>
  );
}
