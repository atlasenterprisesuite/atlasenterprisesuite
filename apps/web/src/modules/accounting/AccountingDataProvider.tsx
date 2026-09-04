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
const AccountingRefreshContext = createContext<{
  version: number;
  refresh: () => void;
} | null>(null);

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
  const context = useContext(AccountingRefreshContext);
  if (!context) {
    throw new Error('Accounting refresh must be used inside AccountingRepositoryProvider');
  }
  return context.refresh;
}

function useAccountingRefreshVersion(): number {
  const context = useContext(AccountingRefreshContext);
  if (!context) {
    throw new Error('Accounting data must be used inside AccountingRepositoryProvider');
  }
  return context.version;
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
