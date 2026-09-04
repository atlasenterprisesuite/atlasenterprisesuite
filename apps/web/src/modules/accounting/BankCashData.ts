import { useCallback, useEffect, useState } from 'react';
import type {
  BankAccountRecord,
  BankTransactionRecord,
  ReconciliationItemRecord,
  ReconciliationSessionRecord,
} from '../../../../../packages/accounting/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { useAccountingRepository } from './AccountingDataProvider';

export type BankCashDataState =
  | { status: 'waiting' }
  | { status: 'connection_unavailable' }
  | { status: 'loading' }
  | {
      status: 'ready';
      bankAccounts: BankAccountRecord[];
      transactions: BankTransactionRecord[];
      sessions: ReconciliationSessionRecord[];
      items: ReconciliationItemRecord[];
    }
  | { status: 'error' };

export function useBankCashData() {
  const identity = useAtlasContext();
  const repository = useAccountingRepository();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<BankCashDataState>({ status: 'waiting' });
  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    if (identity.status !== 'ready') {
      setState({ status: 'waiting' });
      return () => { active = false; };
    }
    if (!repository) {
      setState({ status: 'connection_unavailable' });
      return () => { active = false; };
    }

    setState({ status: 'loading' });
    void Promise.all([
      repository.listBankAccounts(identity.organizationId),
      repository.listBankTransactions(identity.organizationId),
      repository.listReconciliationSessions(identity.organizationId),
      repository.listReconciliationItems(identity.organizationId),
    ])
      .then(([bankAccounts, transactions, sessions, items]) => {
        if (active) setState({ status: 'ready', bankAccounts, transactions, sessions, items });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });

    return () => { active = false; };
  }, [identity, repository, version]);

  return { state, refresh };
}
