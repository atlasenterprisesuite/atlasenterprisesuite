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
  createSupabaseCompensationRepository,
  createSupabasePeopleRepository,
  createSupabaseRecruitingRepository,
  PeopleCompensationWriteService,
  PeoplePayrollWriteService,
  PeopleRecruitingWriteService,
  PeopleTimeWriteService,
  SupabasePeopleCompensationWriteGateway,
  SupabasePeoplePayrollWriteGateway,
  SupabasePeopleRecruitingWriteGateway,
  SupabasePeopleTimeWriteGateway,
} from '../../../packages/people/src';
import {
  createSupabaseReleaseRepository,
  ReleaseControllerService,
} from '../../../packages/release-control/src';
import { createSupabaseRevenueOpsRepository } from '../../../packages/revenue-ops/src';
import { App } from './App';
import { AtlasProvider } from './app/AtlasContext';
import { AtlasModuleStateProvider } from './app/modules/AtlasModuleState';
import { AccountWriteProvider } from './modules/accounting/AccountWriteProvider';
import { AccountingRepositoryProvider } from './modules/accounting/AccountingDataProvider';
import { AccountingWriteProvider } from './modules/accounting/AccountingWriteProvider';
import { ArApWriteProvider } from './modules/accounting/ArApWriteProvider';
import { BankCashWriteProvider } from './modules/accounting/BankCashWriteProvider';
import { CompensationRepositoryProvider } from './modules/people/CompensationDataProvider';
import { PeopleCompensationWriteProvider } from './modules/people/PeopleCompensationWriteProvider';
import { PeopleRepositoryProvider } from './modules/people/PeopleDataProvider';
import { PeoplePayrollWriteProvider } from './modules/people/PeoplePayrollWriteProvider';
import { PeopleTimeWriteProvider } from './modules/people/PeopleTimeWriteProvider';
import { RecruitingRepositoryProvider } from './modules/people/RecruitingDataProvider';
import { RecruitingWriteProvider } from './modules/people/RecruitingWriteProvider';
import { ReleaseControlProvider } from './modules/release/ReleaseControlProvider';
import { RevenueOpsRepositoryProvider } from './modules/revenue/RevenueOpsDataProvider';
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
const compensationRepository = supabaseClient
  ? createSupabaseCompensationRepository(supabaseClient)
  : null;
const peopleCompensationWriteService = supabaseClient
  ? new PeopleCompensationWriteService(new SupabasePeopleCompensationWriteGateway(supabaseClient))
  : null;
const peopleTimeWriteService = supabaseClient
  ? new PeopleTimeWriteService(new SupabasePeopleTimeWriteGateway(supabaseClient))
  : null;
const peoplePayrollWriteService = supabaseClient
  ? new PeoplePayrollWriteService(new SupabasePeoplePayrollWriteGateway(supabaseClient))
  : null;
const recruitingRepository = supabaseClient
  ? createSupabaseRecruitingRepository(supabaseClient)
  : null;
const recruitingWriteService = supabaseClient
  ? new PeopleRecruitingWriteService(new SupabasePeopleRecruitingWriteGateway(supabaseClient))
  : null;
const revenueOpsRepository = supabaseClient
  ? createSupabaseRevenueOpsRepository(supabaseClient)
  : null;
const releaseControlService = supabaseClient
  ? new ReleaseControllerService(createSupabaseReleaseRepository(supabaseClient))
  : null;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AtlasProvider source={identitySource}>
        <AtlasModuleStateProvider client={supabaseClient}>
          <ReleaseControlProvider service={releaseControlService}>
            <RevenueOpsRepositoryProvider repository={revenueOpsRepository}>
              <PeopleRepositoryProvider repository={peopleRepository}>
                <CompensationRepositoryProvider repository={compensationRepository}>
                  <PeopleCompensationWriteProvider service={peopleCompensationWriteService}>
                    <RecruitingRepositoryProvider repository={recruitingRepository}>
                      <PeopleTimeWriteProvider service={peopleTimeWriteService}>
                        <PeoplePayrollWriteProvider service={peoplePayrollWriteService}>
                          <RecruitingWriteProvider service={recruitingWriteService}>
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
                          </RecruitingWriteProvider>
                        </PeoplePayrollWriteProvider>
                      </PeopleTimeWriteProvider>
                    </RecruitingRepositoryProvider>
                  </PeopleCompensationWriteProvider>
                </CompensationRepositoryProvider>
              </PeopleRepositoryProvider>
            </RevenueOpsRepositoryProvider>
          </ReleaseControlProvider>
        </AtlasModuleStateProvider>
      </AtlasProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
