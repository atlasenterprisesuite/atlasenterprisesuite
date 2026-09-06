import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import {
  AccountWriteService,
  ArApWriteService,
  BankCashWriteService,
  createSupabaseAccountingRepository,
  JournalWriteService,
  SupabaseAccountingWriteGateway,
  SupabaseAccountWriteGateway,
  SupabaseArApWriteGateway,
  SupabaseBankCashWriteGateway,
} from '../../../packages/accounting/src';
import {
  createSupabasePeopleRepository,
  PeopleTimeWriteService,
  SupabasePeopleTimeWriteGateway,
} from '../../../packages/people/src';
import { App } from './App';
import { AtlasProvider } from './app/AtlasContext';
import { AccountWriteProvider } from './modules/accounting/AccountWriteProvider';
import { AccountingRepositoryProvider } from './modules/accounting/AccountingDataProvider';
import { AccountingWriteProvider } from './modules/accounting/AccountingWriteProvider';
import { ArApWriteProvider } from './modules/accounting/ArApWriteProvider';
import { BankCashWriteProvider } from './modules/accounting/BankCashWriteProvider';
import { PeopleRepositoryProvider } from './modules/people/PeopleDataProvider';
import { PeopleTimeWriteProvider } from './modules/people/PeopleTimeWriteProvider';
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
const arApWriteService = supabaseClient
  ? new ArApWriteService(new SupabaseArApWriteGateway(supabaseClient))
  : null;
const bankCashWriteService = supabaseClient
  ? new BankCashWriteService(new SupabaseBankCashWriteGateway(supabaseClient))
  : null;
const peopleRepository = supabaseClient
  ? createSupabasePeopleRepository(supabaseClient)
  : null;
const peopleTimeWriteService = supabaseClient
  ? new PeopleTimeWriteService(new SupabasePeopleTimeWriteGateway(supabaseClient))
  : null;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AtlasProvider source={identitySource}>
        <PeopleRepositoryProvider repository={peopleRepository}>
          <PeopleTimeWriteProvider service={peopleTimeWriteService}>
            <AccountingRepositoryProvider repository={accountingRepository}>
              <AccountingWriteProvider service={accountingWriteService}>
                <AccountWriteProvider service={accountWriteService}>
                  <ArApWriteProvider service={arApWriteService}>
                    <BankCashWriteProvider service={bankCashWriteService}>
                      <App />
                    </BankCashWriteProvider>
                  </ArApWriteProvider>
                </AccountWriteProvider>
              </AccountingWriteProvider>
            </AccountingRepositoryProvider>
          </PeopleTimeWriteProvider>
        </PeopleRepositoryProvider>
      </AtlasProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
