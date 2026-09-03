import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type {
  AccountRecord,
  AccountingRepository,
  InvoiceRecord,
  JournalRecord,
  PartyRecord,
  PaymentRecord,
} from '../../../../../packages/accounting/src';
import { useAtlasContext } from '../../app/AtlasContext';

export interface AccountingData {
  accounts: AccountRecord[];
  journals: JournalRecord[];
  customers: PartyRecord[];
  vendors: PartyRecord[];
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
}

export type AccountingDataState =
  | { status: 'waiting' }
  | { status: 'connection_unavailable' }
  | { status: 'loading' }
  | { status: 'ready'; data: AccountingData }
  | { status: 'error' };

const AccountingRepositoryContext = createContext<AccountingRepository | null | undefined>(undefined);

export function AccountingRepositoryProvider({
  repository,
  children,
}: {
  repository: AccountingRepository | null;
  children: ReactNode;
}) {
  return (
    <AccountingRepositoryContext.Provider value={repository}>
      {children}
    </AccountingRepositoryContext.Provider>
  );
}

export function useAccountingRepository(): AccountingRepository | null {
  const repository = useContext(AccountingRepositoryContext);
  return repository ?? null;
}

export function useAccountingData(): AccountingDataState {
  const identity = useAtlasContext();
  const repository = useAccountingRepository();
  const [state, setState] = useState<AccountingDataState>({ status: 'waiting' });

  useEffect(() => {
    let active = true;

    if (identity.status !== 'ready') {
      setState({ status: 'waiting' });
      return () => {
        active = false;
      };
    }

    if (!repository) {
      setState({ status: 'connection_unavailable' });
      return () => {
        active = false;
      };
    }

    setState({ status: 'loading' });

    void Promise.all([
      repository.listAccounts(identity.organizationId),
      repository.listJournals(identity.organizationId),
      repository.listCustomers(identity.organizationId),
      repository.listVendors(identity.organizationId),
      repository.listInvoices(identity.organizationId),
      repository.listPayments(identity.organizationId),
    ])
      .then(([accounts, journals, customers, vendors, invoices, payments]) => {
        if (!active) return;
        setState({
          status: 'ready',
          data: { accounts, journals, customers, vendors, invoices, payments },
        });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });

    return () => {
      active = false;
    };
  }, [identity, repository]);

  return state;
}
