import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AtlasShell } from './components/AtlasShell';
import { AtlasVoicePage } from './modules/voice/AtlasVoicePage';
import './styles.css';
import './health.css';

function Root() {
  const isVoiceRoute = window.location.pathname === '/voice';
  if (isVoiceRoute) {
    return (
      <AtlasShell>
        <AtlasVoicePage />
      </AtlasShell>
    );
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
);
