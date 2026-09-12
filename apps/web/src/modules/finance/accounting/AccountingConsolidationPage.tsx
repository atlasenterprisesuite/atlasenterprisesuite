import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AccountRecord, IntercompanyCandidateRecord } from '../../../../../../packages/accounting/src';
import { createAtlasAccountingRepository } from '../../../lib/accountingRepository';
import {
  addConsolidationMember,
  createConsolidationGroup,
  createIntercompanyElimination,
  createManualConsolidationAdjustment,
  getAccountingConsolidationWorkspace,
  getConsolidatedTrialBalance,
  getIntercompanyCandidates,
  matchIntercompanyLines,
  setConsolidationGroupStatus,
  type AccountingConsolidationWorkspace,
} from '../../../lib/accountingConsolidationSession';

const accountingLinks = [
  ['dashboard', 'Command Center'],
  ['chart-of-accounts', 'Chart of Accounts'],
  ['general-ledger', 'General Ledger'],
  ['journal-entries', 'Journal Entries'],
  ['accounts-receivable', 'Receivables'],
  ['bank-cash', 'Bank & Cash'],
  ['reconciliation', 'Reconciliation'],
  ['fixed-assets', 'Fixed Assets'],
  ['budgeting', 'Budgeting'],
  ['forecast', 'Forecast'],
  ['consolidation', 'Consolidation'],
  ['period-close', 'Period Close'],
  ['reports', 'Reports'],
  ['audit-trail', 'Audit Trail'],
  ['settings', 'Settings'],
] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`;
  }
}

function candidateLabel(row: IntercompanyCandidateRecord) {
  const side = row.debit > 0 ? `Dr ${row.debit.toFixed(2)}` : `Cr ${row.credit.toFixed(2)}`;
  return `${row.entityCode} · ${row.entryNumber} · ${row.accountNumber} ${row.accountName} · ${side} · ${row.reportingAmount.toFixed(2)} ${row.reportingCurrency}`;
}

export function AccountingConsolidationPage() {
  const repository = useMemo(() => createAtlasAccountingRepository(), []);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [workspace, setWorkspace] = useState<AccountingConsolidationWorkspace | null>(null);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [candidates, setCandidates] = useState<IntercompanyCandidateRecord[]>([]);
  const [trialBalance, setTrialBalance] = useState<Array<{ accountId: string; accountNumber: string; accountName: string; debit: number; credit: number; balance: number; reportingCurrency: string }>>([]);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [asOfDate, setAsOfDate] = useState(today());
  const [candidateStart, setCandidateStart] = useState('');
  const [candidateEnd, setCandidateEnd] = useState('');

  const [groupName, setGroupName] = useState('');
  const [groupCurrency, setGroupCurrency] = useState('USD');
  const [parentEntityId, setParentEntityId] = useState('');

  const [memberEntityId, setMemberEntityId] = useState('');
  const [memberMethod, setMemberMethod] = useState<'full' | 'proportional'>('full');
  const [ownershipPct, setOwnershipPct] = useState('100');
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [effectiveTo, setEffectiveTo] = useState('');

  const [matchReference, setMatchReference] = useState('');
  const [sourceLineId, setSourceLineId] = useState('');
  const [counterpartyLineId, setCounterpartyLineId] = useState('');
  const [matchTolerance, setMatchTolerance] = useState('0.01');

  const [eliminationMatchId, setEliminationMatchId] = useState('');
  const [eliminationDate, setEliminationDate] = useState(today());
  const [eliminationReference, setEliminationReference] = useState('');
  const [eliminationReason, setEliminationReason] = useState('Intercompany elimination');
  const [roundingAccountId, setRoundingAccountId] = useState('');

  const [adjustmentDate, setAdjustmentDate] = useState(today());
  const [adjustmentReference, setAdjustmentReference] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentDebitAccountId, setAdjustmentDebitAccountId] = useState('');
  const [adjustmentCreditAccountId, setAdjustmentCreditAccountId] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');

  const loadWorkspace = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const nextWorkspace = await getAccountingConsolidationWorkspace();
      const nextAccounts = await repository.listAccounts(nextWorkspace.organization.id);
      setWorkspace(nextWorkspace);
      setAccounts(nextAccounts);
      setSelectedGroupId((current) => current && nextWorkspace.groups.some((group) => group.id === current)
        ? current
        : nextWorkspace.groups[0]?.id || '');
      setMemberEntityId((current) => current || nextWorkspace.entities.find((entity) => entity.active)?.id || '');
      const firstAccount = nextAccounts.find((account) => account.active)?.id || '';
      setRoundingAccountId((current) => current || firstAccount);
      setAdjustmentDebitAccountId((current) => current || firstAccount);
      setAdjustmentCreditAccountId((current) => current || nextAccounts.find((account) => account.active && account.id !== firstAccount)?.id || '');
      setStatus('ready');
    } catch (loadError) {
      setWorkspace(null);
      setAccounts([]);
      setStatus('error');
      setError(loadError instanceof Error ? loadError.message : 'Consolidation workspace could not be loaded');
    }
  }, [repository]);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const selectedGroup = workspace?.groups.find((group) => group.id === selectedGroupId) || null;
  const groupMembers = workspace?.members.filter((member) => member.groupId === selectedGroupId) || [];
  const groupMatches = workspace?.matches.filter((match) => match.groupId === selectedGroupId) || [];
  const groupAdjustments = workspace?.adjustments.filter((adjustment) => adjustment.groupId === selectedGroupId) || [];
  const entityMap = useMemo(() => new Map((workspace?.entities || []).map((entity) => [entity.id, entity])), [workspace]);
  const matchedCandidates = useMemo(() => candidates.filter((candidate) => candidate.latestMatchId), [candidates]);
  const openCandidates = useMemo(() => candidates.filter((candidate) => !candidate.latestMatchId), [candidates]);
  const exceptionCount = groupMatches.filter((match) => match.status === 'exception').length;
  const matchedForElimination = groupMatches.filter((match) => match.status === 'matched');

  const refreshGroupData = useCallback(async (groupId: string) => {
    if (!groupId) {
      setCandidates([]);
      setTrialBalance([]);
      return;
    }
    const [candidateRows, trialRows] = await Promise.all([
      getIntercompanyCandidates(groupId, candidateStart || null, candidateEnd || null),
      getConsolidatedTrialBalance(groupId, asOfDate),
    ]);
    setCandidates(candidateRows);
    setTrialBalance(trialRows);
    setSourceLineId((current) => current && candidateRows.some((row) => row.lineId === current) ? current : candidateRows.find((row) => !row.latestMatchId)?.lineId || '');
    setCounterpartyLineId((current) => current && candidateRows.some((row) => row.lineId === current) ? current : '');
    setEliminationMatchId((current) => current && matchedForElimination.some((match) => match.id === current) ? current : matchedForElimination[0]?.id || '');
  }, [asOfDate, candidateEnd, candidateStart, matchedForElimination]);

  useEffect(() => {
    if (status !== 'ready' || !selectedGroupId) return;
    void refreshGroupData(selectedGroupId).catch((loadError) => setFeedback(loadError instanceof Error ? loadError.message : 'Group data could not be loaded'));
  }, [refreshGroupData, selectedGroupId, status]);

  async function runWrite(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setFeedback('');
    try {
      await action();
      setFeedback(success);
      await loadWorkspace();
    } catch (writeError) {
      setFeedback(writeError instanceof Error ? writeError.message : 'Accounting action failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitGroup(event: FormEvent) {
    event.preventDefault();
    if (!workspace) return;
    await runWrite(() => createConsolidationGroup({
      organizationId: workspace.organization.id,
      name: groupName,
      reportingCurrency: groupCurrency,
      parentEntityId: parentEntityId || null,
    }), 'Consolidation group created.');
    setGroupName('');
  }

  async function submitMember(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !selectedGroup) return;
    await runWrite(() => addConsolidationMember({
      organizationId: workspace.organization.id,
      groupId: selectedGroup.id,
      entityId: memberEntityId,
      consolidationMethod: memberMethod,
      ownershipPct: Number(ownershipPct),
      effectiveFrom,
      effectiveTo: effectiveTo || null,
    }), 'Consolidation member added.');
  }

  async function submitMatch(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !selectedGroup) return;
    await runWrite(() => matchIntercompanyLines({
      organizationId: workspace.organization.id,
      groupId: selectedGroup.id,
      reference: matchReference,
      sourceLineId,
      counterpartyLineId,
      tolerance: Number(matchTolerance),
    }), 'Intercompany match evaluated against reporting currency.');
    setMatchReference('');
  }

  async function submitElimination(event: FormEvent) {
    event.preventDefault();
    if (!workspace) return;
    await runWrite(() => createIntercompanyElimination({
      organizationId: workspace.organization.id,
      matchId: eliminationMatchId,
      adjustmentDate: eliminationDate,
      reference: eliminationReference,
      reason: eliminationReason,
      roundingAccountId: roundingAccountId || null,
    }), 'Intercompany elimination posted to the consolidation ledger.');
    setEliminationReference('');
  }

  async function submitManualAdjustment(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !selectedGroup) return;
    await runWrite(() => createManualConsolidationAdjustment({
      organizationId: workspace.organization.id,
      groupId: selectedGroup.id,
      adjustmentDate,
      reference: adjustmentReference,
      reason: adjustmentReason,
      debitAccountId: adjustmentDebitAccountId,
      creditAccountId: adjustmentCreditAccountId,
      amount: Number(adjustmentAmount),
    }), 'Consolidation-only adjustment posted.');
    setAdjustmentReference('');
    setAdjustmentReason('');
    setAdjustmentAmount('');
  }

  async function changeGroupStatus(nextStatus: 'locked' | 'archived') {
    if (!workspace || !selectedGroup) return;
    await runWrite(
      () => setConsolidationGroupStatus(workspace.organization.id, selectedGroup.id, nextStatus),
      `Consolidation group changed to ${nextStatus}.`,
    );
  }

  const reportingCurrency = selectedGroup?.reportingCurrency || 'USD';

  return (
    <section className="page-stack">
      <header className="page-header split-header">
        <div><p className="eyebrow">ATLAS Finance · Accounting</p><h1>Intercompany & Consolidation</h1><p>Entity-scoped legal ledgers remain untouched; matching and eliminations are recorded in a governed consolidation layer.</p></div>
        <div className="asof-card"><span>Boundary</span><strong>RLS · FX evidence · audit</strong></div>
      </header>

      <nav className="accounting-nav" aria-label="Accounting navigation">
        {accountingLinks.map(([slug, label]) => <Link key={slug} className={slug === 'consolidation' ? 'accounting-nav-link active' : 'accounting-nav-link'} to={`/finance/accounting/${slug}`}>{label}</Link>)}
        <Link className="accounting-nav-link" to="/finance/accounting/accounts-payable">Payables + AI</Link>
      </nav>

      {status === 'loading' && <div className="notice">Loading authenticated consolidation scope…</div>}
      {status === 'error' && <div className="connection-gate"><strong>Consolidation unavailable</strong><span>{error === 'authentication_required' ? 'Sign in through ATLAS Identity.' : error}</span><Link className="text-link" to={`/identity?app=${encodeURIComponent('/finance/accounting/consolidation')}`}>Open ATLAS Identity</Link></div>}

      {status === 'ready' && workspace && (
        <>
          <div className="workspace-card toolbar">
            <label className="field wide-field"><span>Consolidation group</span><select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}><option value="">No group selected</option>{workspace.groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.reportingCurrency} · {group.status}</option>)}</select></label>
            <label className="field"><span>As of</span><input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} /></label>
            <button className="link-button" type="button" disabled={!selectedGroupId || busy} onClick={() => void refreshGroupData(selectedGroupId)}>Refresh report</button>
          </div>

          {selectedGroup ? (
            <>
              <div className="metric-grid">
                <article><span>Members</span><strong>{groupMembers.length}</strong><small>{selectedGroup.reportingCurrency} reporting</small></article>
                <article><span>Intercompany matches</span><strong>{groupMatches.length}</strong><small>{exceptionCount} exception(s)</small></article>
                <article><span>Adjustments</span><strong>{groupAdjustments.length}</strong><small>Consolidation-only ledger</small></article>
                <article><span>Status</span><strong>{selectedGroup.status}</strong><small>{selectedGroup.parentEntityId ? entityMap.get(selectedGroup.parentEntityId)?.legalName || 'Parent entity' : 'No parent designated'}</small></article>
              </div>

              <div className="workspace-card table-wrap"><table><thead><tr><th>Entity</th><th>Method</th><th>Ownership</th><th>Effective</th></tr></thead><tbody>{groupMembers.map((member) => <tr key={member.id}><td>{entityMap.get(member.entityId)?.legalName || member.entityId}</td><td>{member.consolidationMethod}</td><td>{member.ownershipPct}%</td><td>{member.effectiveFrom} → {member.effectiveTo || 'open'}</td></tr>)}</tbody></table>{groupMembers.length === 0 && <div className="empty-state"><strong>No members</strong><span>Add legal entities before matching intercompany lines.</span></div>}</div>

              <div className="workspace-card toolbar">
                <label className="field"><span>Candidate start</span><input type="date" value={candidateStart} onChange={(event) => setCandidateStart(event.target.value)} /></label>
                <label className="field"><span>Candidate end</span><input type="date" value={candidateEnd} onChange={(event) => setCandidateEnd(event.target.value)} /></label>
                <button className="link-button" type="button" disabled={busy} onClick={() => void refreshGroupData(selectedGroup.id)}>Reload candidates</button>
                <span className="accounting-workspace-note">{openCandidates.length} unmatched · {matchedCandidates.length} previously matched</span>
              </div>

              <div className="workspace-card table-wrap"><table><thead><tr><th>Date</th><th>Entity</th><th>Journal</th><th>Account</th><th>Side</th><th>Reporting amount</th><th>Match</th></tr></thead><tbody>{candidates.map((row) => <tr key={row.lineId}><td>{row.entryDate}</td><td>{row.entityCode}</td><td>{row.entryNumber}</td><td>{row.accountNumber} · {row.accountName}</td><td>{row.debit > 0 ? `Dr ${row.debit}` : `Cr ${row.credit}`}</td><td className="money">{money(row.reportingAmount,row.reportingCurrency)}</td><td>{row.latestMatchStatus || 'unmatched'}</td></tr>)}</tbody></table>{candidates.length === 0 && <div className="empty-state"><strong>No posted candidates</strong><span>Only posted journal lines from active group members appear here. Missing FX evidence will block retrieval rather than guess a rate.</span></div>}</div>

              <form className="workspace-card toolbar" onSubmit={submitMatch}>
                <label className="field wide-field"><span>Match reference</span><input value={matchReference} onChange={(event) => setMatchReference(event.target.value)} required /></label>
                <label className="field wide-field"><span>Source line</span><select value={sourceLineId} onChange={(event) => setSourceLineId(event.target.value)} required><option value="">Select source</option>{openCandidates.map((row) => <option key={row.lineId} value={row.lineId}>{candidateLabel(row)}</option>)}</select></label>
                <label className="field wide-field"><span>Counterparty line</span><select value={counterpartyLineId} onChange={(event) => setCounterpartyLineId(event.target.value)} required><option value="">Select counterparty</option>{openCandidates.filter((row) => row.lineId !== sourceLineId).map((row) => <option key={row.lineId} value={row.lineId}>{candidateLabel(row)}</option>)}</select></label>
                <label className="field"><span>Tolerance</span><input type="number" min="0" step="0.01" value={matchTolerance} onChange={(event) => setMatchTolerance(event.target.value)} required /></label>
                <button className="link-button" type="submit" disabled={busy || selectedGroup.status !== 'active'}>Evaluate match</button>
              </form>

              <div className="workspace-card table-wrap"><table><thead><tr><th>Reference</th><th>Entities</th><th>Source</th><th>Counterparty</th><th>Difference</th><th>Status</th></tr></thead><tbody>{groupMatches.map((match) => <tr key={match.id}><td>{match.matchReference}</td><td>{entityMap.get(match.sourceEntityId)?.code || '—'} ↔ {entityMap.get(match.counterpartyEntityId)?.code || '—'}</td><td>{money(match.sourceReportingAmount,match.reportingCurrency)}</td><td>{money(match.counterpartyReportingAmount,match.reportingCurrency)}</td><td>{money(match.difference,match.reportingCurrency)}</td><td><span className="status-pill">{match.status}</span></td></tr>)}</tbody></table>{groupMatches.length === 0 && <div className="empty-state"><strong>No intercompany matches</strong><span>Match opposite posted lines from different legal entities.</span></div>}</div>

              <form className="workspace-card toolbar" onSubmit={submitElimination}>
                <label className="field wide-field"><span>Matched pair</span><select value={eliminationMatchId} onChange={(event) => setEliminationMatchId(event.target.value)} required><option value="">Select matched pair</option>{matchedForElimination.map((match) => <option key={match.id} value={match.id}>{match.matchReference} · difference {match.difference} {match.reportingCurrency}</option>)}</select></label>
                <label className="field"><span>Date</span><input type="date" value={eliminationDate} onChange={(event) => setEliminationDate(event.target.value)} required /></label>
                <label className="field"><span>Reference</span><input value={eliminationReference} onChange={(event) => setEliminationReference(event.target.value)} required /></label>
                <label className="field wide-field"><span>Reason</span><input value={eliminationReason} onChange={(event) => setEliminationReason(event.target.value)} required /></label>
                <label className="field wide-field"><span>Rounding / FX account</span><select value={roundingAccountId} onChange={(event) => setRoundingAccountId(event.target.value)}><option value="">None — difference must be zero</option>{accounts.filter((account) => account.active).map((account) => <option key={account.id} value={account.id}>{account.accountNumber} · {account.name}</option>)}</select></label>
                <button className="link-button" type="submit" disabled={busy || !eliminationMatchId || selectedGroup.status !== 'active'}>Post elimination</button>
              </form>

              <div className="workspace-card table-wrap"><table><thead><tr><th>Account</th><th>Name</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{trialBalance.map((row) => <tr key={row.accountId}><td>{row.accountNumber}</td><td>{row.accountName}</td><td className="money">{money(row.debit,row.reportingCurrency)}</td><td className="money">{money(row.credit,row.reportingCurrency)}</td><td className="money">{money(row.balance,row.reportingCurrency)}</td></tr>)}</tbody></table>{trialBalance.length === 0 && <div className="empty-state"><strong>No consolidated balances</strong><span>The report uses posted legal ledgers plus posted consolidation-only adjustments.</span></div>}</div>

              <form className="workspace-card toolbar" onSubmit={submitManualAdjustment}>
                <label className="field"><span>Adjustment date</span><input type="date" value={adjustmentDate} onChange={(event) => setAdjustmentDate(event.target.value)} required /></label>
                <label className="field"><span>Reference</span><input value={adjustmentReference} onChange={(event) => setAdjustmentReference(event.target.value)} required /></label>
                <label className="field wide-field"><span>Reason</span><input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} required /></label>
                <label className="field wide-field"><span>Debit account</span><select value={adjustmentDebitAccountId} onChange={(event) => setAdjustmentDebitAccountId(event.target.value)} required>{accounts.filter((account) => account.active).map((account) => <option key={account.id} value={account.id}>{account.accountNumber} · {account.name}</option>)}</select></label>
                <label className="field wide-field"><span>Credit account</span><select value={adjustmentCreditAccountId} onChange={(event) => setAdjustmentCreditAccountId(event.target.value)} required>{accounts.filter((account) => account.active).map((account) => <option key={account.id} value={account.id}>{account.accountNumber} · {account.name}</option>)}</select></label>
                <label className="field"><span>Amount ({reportingCurrency})</span><input type="number" min="0.01" step="0.01" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} required /></label>
                <button className="link-button" type="submit" disabled={busy || selectedGroup.status !== 'active'}>Post top-side adjustment</button>
              </form>

              <div className="workspace-card toolbar">
                <button className="link-button" type="button" disabled={busy || selectedGroup.status !== 'active'} onClick={() => void changeGroupStatus('locked')}>Lock consolidation group</button>
                <button className="link-button" type="button" disabled={busy || selectedGroup.status !== 'locked'} onClick={() => void changeGroupStatus('archived')}>Archive group</button>
                <span className="accounting-workspace-note">Locking is rejected server-side while exceptions or draft adjustments remain.</span>
              </div>
            </>
          ) : <div className="empty-state"><strong>No consolidation group selected</strong><span>Create a governed group below.</span></div>}

          {selectedGroup?.status === 'active' && (
            <form className="workspace-card toolbar" onSubmit={submitMember}>
              <label className="field wide-field"><span>Legal entity</span><select value={memberEntityId} onChange={(event) => setMemberEntityId(event.target.value)} required>{workspace.entities.filter((entity) => entity.active).map((entity) => <option key={entity.id} value={entity.id}>{entity.code} · {entity.legalName} · {entity.functionalCurrency}</option>)}</select></label>
              <label className="field"><span>Method</span><select value={memberMethod} onChange={(event) => setMemberMethod(event.target.value as 'full' | 'proportional')}><option value="full">Full</option><option value="proportional">Proportional</option></select></label>
              <label className="field"><span>Ownership %</span><input type="number" min="0.0001" max="100" step="0.0001" value={ownershipPct} onChange={(event) => setOwnershipPct(event.target.value)} required /></label>
              <label className="field"><span>Effective from</span><input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} required /></label>
              <label className="field"><span>Effective to</span><input type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} /></label>
              <button className="link-button" type="submit" disabled={busy || !memberEntityId}>Add member</button>
            </form>
          )}

          <form className="workspace-card toolbar" onSubmit={submitGroup}>
            <label className="field wide-field"><span>New consolidation group</span><input value={groupName} onChange={(event) => setGroupName(event.target.value)} required /></label>
            <label className="field"><span>Reporting currency</span><input maxLength={3} value={groupCurrency} onChange={(event) => setGroupCurrency(event.target.value.toUpperCase())} required /></label>
            <label className="field wide-field"><span>Parent entity</span><select value={parentEntityId} onChange={(event) => setParentEntityId(event.target.value)}><option value="">No designated parent</option>{workspace.entities.filter((entity) => entity.active).map((entity) => <option key={entity.id} value={entity.id}>{entity.code} · {entity.legalName}</option>)}</select></label>
            <button className="link-button" type="submit" disabled={busy}>Create group</button>
          </form>

          {feedback && <div className="notice">{feedback}</div>}
        </>
      )}
    </section>
  );
}
