import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AtlasProvider } from './app/AtlasContext';
import { createAtlasSupabaseClient } from './lib/supabase/client';
import { createAtlasIdentitySource } from './lib/supabase/atlasIdentitySource';
import './styles.css';

const identitySource = createAtlasIdentitySource(createAtlasSupabaseClient());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AtlasProvider source={identitySource}>
        <App />
      </AtlasProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
