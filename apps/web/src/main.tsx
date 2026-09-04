import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import {
  AccountWriteService,
  createSupabaseAccountingRepository,
  JournalWriteService,
  SupabaseAccountingWriteGateway,
  SupabaseAccountWriteGateway,
} from '../../../packages/accounting/src';
import { App } from './App';
import { AtlasProvider } from './app/AtlasContext';
import { AccountWriteProvider } from './modules/accounting/AccountWriteProvider';
import { AccountingRepositoryProvider } from './modules/accounting/AccountingDataProvider';
import { AccountingWriteProvider } from './modules/accounting/AccountingWriteProvider';
import { createAtlasSupabaseClient } from './lib/supabase/client';
import { createAtlasIdentitySource } from './lib/supabase/atlasIdentitySource';
import './styles.css';

const supabaseClient = createAtlasSupabaseClient();
const identitySource = createAtlasIdentitySource(supabaseClient);
const accountingRepository = supabaseClient
  ? createSupabaseAccountingRepository(supabaseClient)
  : null;
const accountingWriteService = supabaseClient
  ? new JournalWriteService(new SupabaseAccountingWriteGateway(supabaseClient))
  : null;
const accountWriteService = supabaseClient
  ? new AccountWriteService(new SupabaseAccountWriteGateway(supabaseClient))
  : null;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AtlasProvider source={identitySource}>
        <AccountingRepositoryProvider repository={accountingRepository}>
          <AccountingWriteProvider service={accountingWriteService}>
            <AccountWriteProvider service={accountWriteService}>
              <App />
            </AccountWriteProvider>
          </AccountingWriteProvider>
        </AccountingRepositoryProvider>
      </AtlasProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
