import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type {
  AccountRecord,
  AccountingRepository,
  BillRecord,
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
  bills: BillRecord[];
}

export type AccountingDataState =
  | { status: 'waiting' }
  | { status: 'connection_unavailable' }
  | { status: 'loading' }
  | { status: 'ready'; data: AccountingData }
  | { status: 'error' };

const AccountingRepositoryContext = createContext<AccountingRepository | null | undefined>(undefined);
const DEFAULT_REFRESH_CONTEXT: { version: number; refresh: () => void } = {
  version: 0,
  refresh: () => {},
};
const AccountingRefreshContext = createContext(DEFAULT_REFRESH_CONTEXT);

export function AccountingRepositoryProvider({
  repository,
  children,
}: {
  repository: AccountingRepository | null;
  children: ReactNode;
}) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  return (
    <AccountingRepositoryContext.Provider value={repository}>
      <AccountingRefreshContext.Provider value={{ version, refresh }}>
        {children}
      </AccountingRefreshContext.Provider>
    </AccountingRepositoryContext.Provider>
  );
}

export function useAccountingRepository(): AccountingRepository | null {
  const repository = useContext(AccountingRepositoryContext);
  return repository ?? null;
}

export function useAccountingRefresh(): () => void {
  return useContext(AccountingRefreshContext).refresh;
}

function useAccountingRefreshVersion(): number {
  return useContext(AccountingRefreshContext).version;
}

export function useAccountingData(): AccountingDataState {
  const identity = useAtlasContext();
  const repository = useAccountingRepository();
  const refreshVersion = useAccountingRefreshVersion();
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
      repository.listBills(identity.organizationId),
    ])
      .then(([accounts, journals, customers, vendors, invoices, payments, bills]) => {
        if (!active) return;
        setState({
          status: 'ready',
          data: { accounts, journals, customers, vendors, invoices, payments, bills },
        });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });

    return () => {
      active = false;
    };
  }, [identity, repository, refreshVersion]);

  return state;
}
