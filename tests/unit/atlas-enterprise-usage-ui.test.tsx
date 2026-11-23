import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/work/api', () => ({ getEnterpriseUsage: vi.fn() }));
vi.mock('../../apps/web/src/work/WorkSubnav', () => ({ WorkSubnav: () => null }));
vi.mock('../../apps/web/src/work/ExecutionConfiguration', () => ({ ExecutionConfiguration: () => null }));

import { getEnterpriseUsage } from '../../apps/web/src/work/api';
import { WorkPoliciesPage } from '../../apps/web/src/work/WorkPoliciesPage';

const usage = vi.mocked(getEnterpriseUsage);
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

beforeEach(() => usage.mockResolvedValue(emptyReport));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ATLAS Work Enterprise usage transparency UI', () => {
  it('renders verified empty usage without inventing credits or connected services', async () => {
    render(<WorkPoliciesPage />);
    expect(await screen.findByText('2026-11')).toBeInTheDocument();
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
    expect(screen.queryByText('2026-11')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Refresh recorded activity/i }));
    expect(await screen.findByText('2026-11')).toBeInTheDocument();
    expect(usage).toHaveBeenCalledTimes(2);
  });
});
