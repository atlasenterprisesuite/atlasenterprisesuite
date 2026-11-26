import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/work/api', () => ({ getEnterpriseUsage: vi.fn(), getEnterpriseCreditStatus: vi.fn() }));
vi.mock('../../apps/web/src/work/WorkSubnav', () => ({ WorkSubnav: () => null }));
vi.mock('../../apps/web/src/work/ExecutionConfiguration', () => ({ ExecutionConfiguration: () => null }));

import { getEnterpriseUsage, getEnterpriseCreditStatus } from '../../apps/web/src/work/api';
import { WorkPoliciesPage } from '../../apps/web/src/work/WorkPoliciesPage';

const usage = vi.mocked(getEnterpriseUsage);
const credits = vi.mocked(getEnterpriseCreditStatus);
const emptyReport = {
  source: 'atlas_ai_usage' as const,
  period: '2026-11',
  eventCount: 0,
  sampleIsComplete: true,
  recentEvents: [],
  creditLimitStatus: 'unconfigured' as const,
  creditsRemaining: null,
  paidExecutionEnabled: false as const
};

beforeEach(() => {
  usage.mockResolvedValue(emptyReport);
  credits.mockResolvedValue({
    source: 'atlas_enterprise_credit_accounts',
    status: 'unconfigured', period: '2026-11',
    limitCredits: null, reservedCredits: null, spentCredits: null,
    availableCredits: null, paidExecutionEnabled: false
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ATLAS Work Enterprise usage transparency UI', () => {
  it('renders verified empty usage without inventing credits or connected services', async () => {
    render(<WorkPoliciesPage />);
    expect((await screen.findAllByText('2026-11')).length).toBeGreaterThan(0);
    expect(screen.getByText(/No AI usage records were found/i)).toBeInTheDocument();
    expect(screen.getByText(/No paid AI credits are authorized/i)).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('displays only server-provided recorded rows and labels costs as estimates', async () => {
    usage.mockResolvedValueOnce({
      ...emptyReport,
      eventCount: 31,
      sampleIsComplete: false,
      recentEvents: [{
        id: 'event-a',
        createdAt: '2026-11-23T12:00:00Z',
        taskClass: 'assistant',
        status: 'completed',
        inputTokens: 5,
        outputTokens: 9,
        estimatedCostUsd: '0.003500'
      }]
    });
    render(<WorkPoliciesPage />);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('$0.003500')).toBeInTheDocument();
    expect(screen.getByText(/Showing only the 20 most recent records/i)).toBeInTheDocument();
  });

  it('fails closed on inaccessible server data and refreshes when requested', async () => {
    usage.mockRejectedValueOnce(new Error('authentication_required'))
      .mockResolvedValueOnce(emptyReport);
    render(<WorkPoliciesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('authentication_required');
    expect(screen.queryByText('Recorded requests')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /Refresh recorded activity/i }));
    expect(await screen.findByText(/No AI usage records were found/i)).toBeInTheDocument();
    expect(usage).toHaveBeenCalledTimes(2);
  });
  it('shows a real allocated ledger while keeping paid execution blocked', async () => {
    credits.mockResolvedValueOnce({
      source: 'atlas_enterprise_credit_accounts',
      status: 'allocated', period: '2026-11',
      limitCredits: 11, reservedCredits: 3, spentCredits: 5,
      availableCredits: 3, paidExecutionEnabled: false
    });
    render(<WorkPoliciesPage />);
    expect(await screen.findByText('Allocated')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('3 / 5')).toBeInTheDocument();
    expect(screen.getByText('Blocked until separately authorized')).toBeInTheDocument();
    expect(screen.queryByText(/Ledger schema is not installed/i)).not.toBeInTheDocument();
  });

  it('preserves independently authorized usage when credit lookup fails', async () => {
    credits.mockRejectedValueOnce(new Error('enterprise_credit_read_unavailable'));
    render(<WorkPoliciesPage />);
    expect(await screen.findByText(/Unable to verify credit ledger/i)).toBeInTheDocument();
    expect(await screen.findByText(/No AI usage records were found/i)).toBeInTheDocument();
    expect(screen.getByText(/Spending remains blocked/i)).toBeInTheDocument();
  });
});
