import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { createSupabaseAccountingRepository } from '../../../packages/accounting/src';
import { App } from './App';
import { AtlasProvider } from './app/AtlasContext';
import { AccountingRepositoryProvider } from './modules/accounting/AccountingDataProvider';
import { createAtlasSupabaseClient } from './lib/supabase/client';
import { createAtlasIdentitySource } from './lib/supabase/atlasIdentitySource';
import './styles.css';

const supabaseClient = createAtlasSupabaseClient();
const identitySource = createAtlasIdentitySource(supabaseClient);
const accountingRepository = supabaseClient
  ? createSupabaseAccountingRepository(supabaseClient)
  : null;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AtlasProvider source={identitySource}>
        <AccountingRepositoryProvider repository={accountingRepository}>
          <App />
        </AccountingRepositoryProvider>
      </AtlasProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
