import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AccountRecord,
  AccountType,
  UpdateAccountCommand,
} from '../../../../../packages/accounting/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { useAccountWriteService } from './AccountWriteProvider';
import { useAccountingRepository } from './AccountingDataProvider';

const accountTypes: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

type LoadStatus = 'waiting' | 'connection_unavailable' | 'loading' | 'ready' | 'error';

type EditState = {
  id: string;
  accountNumber: string;
  name: string;
  accountType: AccountType;
  active: boolean;
};

function isAccountType(value: string): value is AccountType {
  return accountTypes.includes(value as AccountType);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown account write error';
}

export function ChartOfAccountsPage() {
  const identity = useAtlasContext();
  const repository = useAccountingRepository();
  const writeService = useAccountWriteService();
  const [status, setStatus] = useState<LoadStatus>('waiting');
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [query, setQuery] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('asset');
  const [editing, setEditing] = useState<EditState | null>(null);

  useEffect(() => {
    let active = true;

    if (identity.status !== 'ready') {
      setStatus('waiting');
      setAccounts([]);
      return () => {
        active = false;
      };
    }

    if (!repository) {
      setStatus('connection_unavailable');
      setAccounts([]);
      return () => {
        active = false;
      };
    }

    setStatus('loading');
    void repository.listAccounts(identity.organizationId)
      .then((rows) => {
        if (!active) return;
        setAccounts(rows);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setAccounts([]);
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [identity, repository, refreshVersion]);

  const filteredAccounts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const rows = normalized
      ? accounts.filter((account) =>
          [account.accountNumber, account.name, account.accountType]
            .some((value) => value.toLowerCase().includes(normalized)),
        )
      : accounts;

    return [...rows].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  }, [accounts, query]);

  const hasWritePermission = identity.status === 'ready' && (
    identity.permissions.includes('accounting.write') || identity.permissions.includes('accounting.admin')
  );
  const canManage = hasWritePermission && writeService !== null;

  const reload = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  const createAccount = async () => {
    if (!canManage || identity.status !== 'ready' || !writeService) return;
    setBusy(true);
    setFeedback(null);
    try {
      await writeService.createAccount({
        organizationId: identity.organizationId,
        accountNumber: newNumber,
        name: newName,
        accountType: newType,
      });
      setNewNumber('');
      setNewName('');
      setNewType('asset');
      setFeedback('Account created');
      reload();
    } catch (error) {
      setFeedback(`Account creation failed: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (account: AccountRecord) => {
    if (!isAccountType(account.accountType)) {
      setFeedback('Account update failed: Unsupported account type');
      return;
    }
    setEditing({
      id: account.id,
      accountNumber: account.accountNumber,
      name: account.name,
      accountType: account.accountType,
      active: account.active,
    });
    setFeedback(null);
  };

  const saveEdit = async () => {
    if (!editing || !canManage || identity.status !== 'ready' || !writeService) return;
    setBusy(true);
    setFeedback(null);
    try {
      await writeService.updateAccount({
        organizationId: identity.organizationId,
        accountId: editing.id,
        accountNumber: editing.accountNumber,
        name: editing.name,
        accountType: editing.accountType,
        active: editing.active,
      });
      setEditing(null);
      setFeedback('Account updated');
      reload();
    } catch (error) {
      setFeedback(`Account update failed: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleAccount = async (account: AccountRecord) => {
    if (!canManage || identity.status !== 'ready' || !writeService) return;
    if (!isAccountType(account.accountType)) {
      setFeedback('Account update failed: Unsupported account type');
      return;
    }

    const command: UpdateAccountCommand = {
      organizationId: identity.organizationId,
      accountId: account.id,
      accountNumber: account.accountNumber,
      name: account.name,
      accountType: account.accountType,
      active: !account.active,
    };

    setBusy(true);
    setFeedback(null);
    try {
      await writeService.updateAccount(command);
      setFeedback(command.active ? 'Account activated' : 'Account deactivated');
      reload();
    } catch (error) {
      setFeedback(`Account update failed: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Finance / Accounting</p>
      <h1>Chart of Accounts</h1>
      <p className="atlas-page__lede">
        Organization-scoped account definitions are read directly from the configured Accounting repository. Account history is preserved through activation state rather than destructive deletion.
      </p>

      {(status === 'waiting' || status === 'loading') && (
        <section className="atlas-status-panel" role="status">
          <strong>Loading Chart of Accounts</strong>
          <span>Reading the authorized organization account definitions.</span>
        </section>
      )}

      {status === 'connection_unavailable' && (
        <section className="atlas-status-panel" role="status">
          <strong>Chart of Accounts connection unavailable</strong>
          <span>No configured real Accounting repository is available.</span>
        </section>
      )}

      {status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
          <strong>Chart of Accounts unavailable</strong>
          <span>The authorized account query did not complete successfully.</span>
        </section>
      )}

      {feedback && (
        <section className="atlas-status-panel" role="status">
          <strong>{feedback}</strong>
        </section>
      )}

      {hasWritePermission && !writeService && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
          <strong>Account management unavailable</strong>
          <span>The runtime has no configured real account write service.</span>
        </section>
      )}

      {status === 'ready' && (
        <>
          {canManage && (
            <section className="atlas-status-panel" aria-label="Create account">
              <strong>Create account</strong>
              <div className="atlas-form-grid">
                <label className="atlas-form-field">
                  New account number
                  <input value={newNumber} onChange={(event) => setNewNumber(event.target.value)} />
                </label>
                <label className="atlas-form-field">
                  New account name
                  <input value={newName} onChange={(event) => setNewName(event.target.value)} />
                </label>
                <label className="atlas-form-field">
                  New account type
                  <select value={newType} onChange={(event) => setNewType(event.target.value as AccountType)}>
                    {accountTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" disabled={busy} onClick={() => void createAccount()}>
                Create account
              </button>
            </section>
          )}

          {editing && canManage && (
            <section className="atlas-status-panel" aria-label={`Edit ${editing.accountNumber}`}>
              <strong>Edit {editing.accountNumber}</strong>
              <div className="atlas-form-grid">
                <label className="atlas-form-field">
                  Edit account number
                  <input
                    value={editing.accountNumber}
                    onChange={(event) => setEditing({ ...editing, accountNumber: event.target.value })}
                  />
                </label>
                <label className="atlas-form-field">
                  Edit account name
                  <input
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  />
                </label>
                <label className="atlas-form-field">
                  Edit account type
                  <select
                    value={editing.accountType}
                    onChange={(event) => setEditing({ ...editing, accountType: event.target.value as AccountType })}
                  >
                    {accountTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" disabled={busy} onClick={() => void saveEdit()}>Save account</button>
              <button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel edit</button>
            </section>
          )}

          <label className="atlas-form-field">
            Search accounts
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Number, name, or type"
            />
          </label>

          {accounts.length === 0 ? (
            <section className="atlas-status-panel" aria-label="Chart of Accounts empty state">
              <strong>No accounts configured</strong>
              <span>This organization currently has no Chart of Accounts records.</span>
            </section>
          ) : filteredAccounts.length === 0 ? (
            <section className="atlas-status-panel" aria-label="Chart of Accounts no matches">
              <strong>No matching accounts</strong>
              <span>No real account records match the current search.</span>
            </section>
          ) : (
            <section className="atlas-status-panel" aria-label="Chart of Accounts records">
              <strong>{filteredAccounts.length} account{filteredAccounts.length === 1 ? '' : 's'}</strong>
              <div className="atlas-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Status</th>
                      {canManage && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((account) => (
                      <tr key={account.id}>
                        <td>{account.accountNumber}</td>
                        <td>{account.name}</td>
                        <td>{account.accountType}</td>
                        <td>{account.active ? 'Active' : 'Inactive'}</td>
                        {canManage && (
                          <td>
                            <button type="button" disabled={busy} onClick={() => openEdit(account)}>
                              Edit {account.accountNumber}
                            </button>
                            <button type="button" disabled={busy} onClick={() => void toggleAccount(account)}>
                              {account.active ? 'Deactivate' : 'Activate'} {account.accountNumber}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
