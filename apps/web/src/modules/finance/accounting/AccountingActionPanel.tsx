import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AccountWriteService,
  AccountingGovernanceWriteService,
  ArApWriteService,
  BankCashWriteService,
  JournalWriteService,
  type AccountRecord,
  type AccountingPeriodRecord,
  type BankAccountRecord,
  type InvoiceRecord,
  type ReconciliationSessionRecord,
} from '../../../../../../packages/accounting/src';
import { createAtlasAccountingRepository } from '../../../lib/accountingRepository';
import {
  AtlasRestAccountWriteGateway,
  AtlasRestArApWriteGateway,
  AtlasRestBankCashWriteGateway,
  AtlasRestGovernanceWriteGateway,
  AtlasRestJournalWriteGateway,
} from '../../../lib/accountingWriteGateway';
import { getActiveAtlasOrganization } from '../../../lib/atlasSession';
import type { AccountingSection } from './AccountingWorkspaceReadPage';

type Options = {
  accounts: AccountRecord[];
  invoices: InvoiceRecord[];
  bankAccounts: BankAccountRecord[];
  reconciliationSessions: ReconciliationSessionRecord[];
  periods: AccountingPeriodRecord[];
};

const emptyOptions = (): Options => ({ accounts: [], invoices: [], bankAccounts: [], reconciliationSessions: [], periods: [] });

function textError(error: unknown) {
  return error instanceof Error ? error.message : 'Accounting action failed';
}

function ActionShell({ title, description, children, feedback }: { title: string; description: string; children: React.ReactNode; feedback: string }) {
  return (
    <article className="workspace-card accounting-action-card">
      <div className="accounting-action-heading"><div><p className="eyebrow">Governed action</p><h2>{title}</h2><p>{description}</p></div><span className="badge">SERVER PERMISSION ENFORCED</span></div>
      {children}
      {feedback && <div className={feedback.startsWith('Success:') ? 'notice' : 'notice strong'}>{feedback}</div>}
    </article>
  );
}

export function AccountingActionPanel({ section, onChanged }: { section: AccountingSection; onChanged: () => void }) {
  const repository = useMemo(() => createAtlasAccountingRepository(), []);
  const accountService = useMemo(() => new AccountWriteService(new AtlasRestAccountWriteGateway()), []);
  const journalService = useMemo(() => new JournalWriteService(new AtlasRestJournalWriteGateway()), []);
  const arApService = useMemo(() => new ArApWriteService(new AtlasRestArApWriteGateway()), []);
  const bankService = useMemo(() => new BankCashWriteService(new AtlasRestBankCashWriteGateway()), []);
  const governanceService = useMemo(() => new AccountingGovernanceWriteService(new AtlasRestGovernanceWriteGateway()), []);
  const [organizationId, setOrganizationId] = useState('');
  const [options, setOptions] = useState<Options>(emptyOptions);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setFeedback('');
    void getActiveAtlasOrganization().then(async (organization) => {
      const next = emptyOptions();
      if (['journal-entries', 'settings'].includes(section)) next.accounts = await repository.listAccounts(organization.id);
      if (section === 'accounts-receivable') next.invoices = await repository.listInvoices(organization.id);
      if (section === 'reconciliation') {
        [next.bankAccounts, next.reconciliationSessions] = await Promise.all([
          repository.listBankAccounts(organization.id), repository.listReconciliationSessions(organization.id),
        ]);
      }
      if (section === 'period-close') next.periods = await repository.listAccountingPeriods(organization.id);
      if (!active) return;
      setOrganizationId(organization.id);
      setOptions(next);
    }).catch(() => {
      if (!active) return;
      setOrganizationId('');
      setOptions(emptyOptions());
    });
    return () => { active = false; };
  }, [repository, section]);

  async function run(action: () => Promise<string>) {
    if (!organizationId) {
      setFeedback('Error: authenticated organization is required');
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      const id = await action();
      setFeedback(`Success: governed accounting action completed (${id.slice(0, 8)}…)`);
      onChanged();
    } catch (error) {
      setFeedback(`Error: ${textError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!organizationId) return null;

  if (section === 'chart-of-accounts') {
    return <CreateAccountForm service={accountService} organizationId={organizationId} busy={busy} feedback={feedback} run={run} />;
  }
  if (section === 'journal-entries') {
    return <CreateJournalForm service={journalService} organizationId={organizationId} accounts={options.accounts} busy={busy} feedback={feedback} run={run} />;
  }
  if (section === 'accounts-receivable') {
    return <RecordPaymentForm service={arApService} organizationId={organizationId} invoices={options.invoices} busy={busy} feedback={feedback} run={run} />;
  }
  if (section === 'reconciliation') {
    return <ReconciliationActions service={bankService} organizationId={organizationId} bankAccounts={options.bankAccounts} sessions={options.reconciliationSessions} busy={busy} feedback={feedback} run={run} />;
  }
  if (section === 'fixed-assets') {
    return <CreateAssetForm service={governanceService} organizationId={organizationId} busy={busy} feedback={feedback} run={run} />;
  }
  if (section === 'period-close') {
    return <ClosePeriodForm service={governanceService} organizationId={organizationId} periods={options.periods} busy={busy} feedback={feedback} run={run} />;
  }
  if (section === 'settings') {
    return <SettingsForm service={governanceService} organizationId={organizationId} accounts={options.accounts} busy={busy} feedback={feedback} run={run} />;
  }
  return null;
}

type Runner = (action: () => Promise<string>) => Promise<void>;

function CreateAccountForm({ service, organizationId, busy, feedback, run }: { service: AccountWriteService; organizationId: string; busy: boolean; feedback: string; run: Runner }) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'asset' | 'liability' | 'equity' | 'revenue' | 'expense'>('asset');
  const submit = (event: FormEvent) => { event.preventDefault(); void run(() => service.createAccount({ organizationId, accountNumber: number, name, accountType: type })); };
  return <ActionShell title="Create account" description="Creates an organization-scoped account through the governed Chart of Accounts RPC." feedback={feedback}><form className="accounting-action-form" onSubmit={submit}><label className="field"><span>Account number</span><input value={number} onChange={(e) => setNumber(e.target.value)} required /></label><label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label><label className="field"><span>Type</span><select value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="asset">Asset</option><option value="liability">Liability</option><option value="equity">Equity</option><option value="revenue">Revenue</option><option value="expense">Expense</option></select></label><button className="action-button" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button></form></ActionShell>;
}

function CreateJournalForm({ service, organizationId, accounts, busy, feedback, run }: { service: JournalWriteService; organizationId: string; accounts: AccountRecord[]; busy: boolean; feedback: string; run: Runner }) {
  const [entryNumber, setEntryNumber] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [journalAmount, setJournalAmount] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); void run(() => service.createPostedJournal({ organizationId, entryNumber, entryDate, memo: memo || null, debitAccountId, creditAccountId, amount: Number(journalAmount) })); };
  return <ActionShell title="Post balanced journal" description="Posts exactly balanced debit/credit lines; locked periods and permissions are enforced again in PostgreSQL." feedback={feedback}><form className="accounting-action-form" onSubmit={submit}><label className="field"><span>Entry number</span><input value={entryNumber} onChange={(e) => setEntryNumber(e.target.value)} required /></label><label className="field"><span>Date</span><input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required /></label><label className="field"><span>Amount</span><input type="number" min="0.01" step="0.01" value={journalAmount} onChange={(e) => setJournalAmount(e.target.value)} required /></label><label className="field"><span>Debit account</span><select value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)} required><option value="">Select account</option>{accounts.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.accountNumber} · {a.name}</option>)}</select></label><label className="field"><span>Credit account</span><select value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)} required><option value="">Select account</option>{accounts.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.accountNumber} · {a.name}</option>)}</select></label><label className="field"><span>Memo</span><input value={memo} onChange={(e) => setMemo(e.target.value)} /></label><button className="action-button" disabled={busy || accounts.length < 2}>{busy ? 'Posting…' : 'Post journal'}</button></form></ActionShell>;
}

function RecordPaymentForm({ service, organizationId, invoices, busy, feedback, run }: { service: ArApWriteService; organizationId: string; invoices: InvoiceRecord[]; busy: boolean; feedback: string; run: Runner }) {
  const open = invoices.filter((invoice) => Number(invoice.balanceDue ?? 0) > 0);
  const [invoiceId, setInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const submit = (event: FormEvent) => { event.preventDefault(); void run(() => service.recordInvoicePayment({ organizationId, invoiceId, amount: Number(paymentAmount), paidOn })); };
  return <ActionShell title="Record customer payment" description="Applies a confirmed payment to an open invoice and lets the database reject overpayments or unauthorized writes." feedback={feedback}><form className="accounting-action-form" onSubmit={submit}><label className="field"><span>Invoice</span><select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} required><option value="">Select invoice</option>{open.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · open {Number(invoice.balanceDue ?? 0).toFixed(2)}</option>)}</select></label><label className="field"><span>Amount</span><input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required /></label><label className="field"><span>Payment date</span><input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required /></label><button className="action-button" disabled={busy || open.length === 0}>{busy ? 'Recording…' : 'Record payment'}</button></form></ActionShell>;
}

function ReconciliationActions({ service, organizationId, bankAccounts, sessions, busy, feedback, run }: { service: BankCashWriteService; organizationId: string; bankAccounts: BankAccountRecord[]; sessions: ReconciliationSessionRecord[]; busy: boolean; feedback: string; run: Runner }) {
  const [bankAccountId, setBankAccountId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [statement, setStatement] = useState('');
  const [ledger, setLedger] = useState('');
  const [sessionId, setSessionId] = useState('');
  const start = (event: FormEvent) => { event.preventDefault(); void run(() => service.startReconciliation({ organizationId, bankAccountId, periodStart, periodEnd, statementEndingBalance: Number(statement), ledgerEndingBalance: Number(ledger) })); };
  const close = (event: FormEvent) => { event.preventDefault(); void run(() => service.closeReconciliation({ organizationId, sessionId })); };
  return <ActionShell title="Reconciliation controls" description="Starts statement-vs-ledger sessions and only closes sessions when balances match and all open items are resolved." feedback={feedback}><div className="accounting-action-split"><form className="accounting-action-form" onSubmit={start}><label className="field"><span>Bank account</span><select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required><option value="">Select account</option>{bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}</select></label><label className="field"><span>Period start</span><input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required /></label><label className="field"><span>Period end</span><input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required /></label><label className="field"><span>Statement balance</span><input type="number" step="0.01" value={statement} onChange={(e) => setStatement(e.target.value)} required /></label><label className="field"><span>Ledger balance</span><input type="number" step="0.01" value={ledger} onChange={(e) => setLedger(e.target.value)} required /></label><button className="action-button" disabled={busy || bankAccounts.length === 0}>{busy ? 'Starting…' : 'Start reconciliation'}</button></form><form className="accounting-action-form compact-action" onSubmit={close}><label className="field"><span>Session ready to close</span><select value={sessionId} onChange={(e) => setSessionId(e.target.value)} required><option value="">Select session</option>{sessions.filter((s) => !['reconciled', 'locked'].includes(s.status)).map((s) => <option key={s.id} value={s.id}>{s.periodStart} → {s.periodEnd} · {s.readinessScore}%</option>)}</select></label><button className="action-button secondary" disabled={busy || !sessionId}>Close reconciliation</button></form></div></ActionShell>;
}

function CreateAssetForm({ service, organizationId, busy, feedback, run }: { service: AccountingGovernanceWriteService; organizationId: string; busy: boolean; feedback: string; run: Runner }) {
  const [assetCode, setAssetCode] = useState(''); const [name, setName] = useState(''); const [date, setDate] = useState(''); const [cost, setCost] = useState(''); const [salvage, setSalvage] = useState('0'); const [life, setLife] = useState('60');
  const submit = (event: FormEvent) => { event.preventDefault(); void run(() => service.createFixedAsset({ organizationId, assetCode, name, acquisitionDate: date, cost: Number(cost), salvageValue: Number(salvage), usefulLifeMonths: Number(life) })); };
  return <ActionShell title="Register fixed asset" description="Validates cost, salvage value and useful life before creating the governed asset record." feedback={feedback}><form className="accounting-action-form" onSubmit={submit}><label className="field"><span>Asset code</span><input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} required /></label><label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label><label className="field"><span>Acquisition date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label><label className="field"><span>Cost</span><input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} required /></label><label className="field"><span>Salvage value</span><input type="number" min="0" step="0.01" value={salvage} onChange={(e) => setSalvage(e.target.value)} required /></label><label className="field"><span>Useful life (months)</span><input type="number" min="1" step="1" value={life} onChange={(e) => setLife(e.target.value)} required /></label><button className="action-button" disabled={busy}>{busy ? 'Creating…' : 'Register asset'}</button></form></ActionShell>;
}

function ClosePeriodForm({ service, organizationId, periods, busy, feedback, run }: { service: AccountingGovernanceWriteService; organizationId: string; periods: AccountingPeriodRecord[]; busy: boolean; feedback: string; run: Runner }) {
  const [periodId, setPeriodId] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); void run(() => service.closeAccountingPeriod({ organizationId, periodId })); };
  const open = periods.filter((p) => !['closed', 'locked'].includes(p.status));
  return <ActionShell title="Lock accounting period" description="Requires accounting.close permission. A locked period blocks governed journal posting for dates inside that period." feedback={feedback}><form className="accounting-action-form compact-action" onSubmit={submit}><label className="field"><span>Period</span><select value={periodId} onChange={(e) => setPeriodId(e.target.value)} required><option value="">Select open period</option>{open.map((p) => <option key={p.id} value={p.id}>{p.periodStart} → {p.periodEnd} · {p.closeReadiness}% ready</option>)}</select></label><button className="action-button danger" disabled={busy || !periodId}>{busy ? 'Locking…' : 'Lock period'}</button></form></ActionShell>;
}

function SettingsForm({ service, organizationId, accounts, busy, feedback, run }: { service: AccountingGovernanceWriteService; organizationId: string; accounts: AccountRecord[]; busy: boolean; feedback: string; run: Runner }) {
  const [fiscalYearStart, setFiscalYearStart] = useState('01-01'); const [baseCurrency, setBaseCurrency] = useState('USD'); const [ar, setAr] = useState(''); const [ap, setAp] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); void run(() => service.updateAccountingSettings({ organizationId, fiscalYearStart, baseCurrency, accountingBasis: 'accrual', defaultArAccountId: ar || null, defaultApAccountId: ap || null })); };
  return <ActionShell title="Update accounting settings" description="Requires accounting.admin permission and persists fiscal/base-currency/control-account configuration through the governed settings RPC." feedback={feedback}><form className="accounting-action-form" onSubmit={submit}><label className="field"><span>Fiscal year start (MM-DD)</span><input value={fiscalYearStart} onChange={(e) => setFiscalYearStart(e.target.value)} required /></label><label className="field"><span>Base currency</span><input maxLength={3} value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())} required /></label><label className="field"><span>Default AR account</span><select value={ar} onChange={(e) => setAr(e.target.value)}><option value="">Not assigned</option>{accounts.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.accountNumber} · {a.name}</option>)}</select></label><label className="field"><span>Default AP account</span><select value={ap} onChange={(e) => setAp(e.target.value)}><option value="">Not assigned</option>{accounts.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.accountNumber} · {a.name}</option>)}</select></label><button className="action-button" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></form></ActionShell>;
}
