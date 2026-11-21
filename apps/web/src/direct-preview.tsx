import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AtlasDirectCallPage } from './modules/connect/AtlasDirectCallPage';
import './modules/connect/atlas-direct-call.css';

const node = document.getElementById('root');
if (!node) throw new Error('ATLAS Direct preview root missing');
createRoot(node).render(
  <React.StrictMode>
    <MemoryRouter>
      <div style={{ maxWidth: 1240, padding: 'clamp(12px, 3vw, 32px)', margin: '0 auto' }}>
        <AtlasDirectCallPage />
      </div>
    </MemoryRouter>
  </React.StrictMode>
);
