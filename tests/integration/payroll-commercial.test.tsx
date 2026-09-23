import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayrollSettingsPage } from '../../apps/web/src/modules/payroll/PayrollSettingsPage';

const commercial=vi.fn();
vi.mock('../../apps/web/src/lib/payrollApi',()=>({getPayrollCommercialState:(...args:unknown[])=>commercial(...args)}));

describe('payroll commercial truthfulness',()=>{
  beforeEach(()=>commercial.mockReset());

  it('shows zero ATLAS software fee only from server-authorized internal_comp',async()=>{
    commercial.mockResolvedValue({billing_mode:'internal_comp',billing_status:'internal_comp',plan_id:null,pricing_version:null,billing_provider:null});
    render(<PayrollSettingsPage />);
    expect(await screen.findByText('$0 ATLAS software fee')).toBeInTheDocument();
    expect(screen.getByText(/External provider charges remain separate/i)).toBeInTheDocument();
  });

  it('does not invent customer pricing',async()=>{
    commercial.mockResolvedValue({billing_mode:'customer',billing_status:'not_configured',plan_id:null,pricing_version:null,billing_provider:null});
    render(<PayrollSettingsPage />);
    expect(await screen.findByText('Billable customer organization')).toBeInTheDocument();
    expect(screen.getByText('Customer pricing not configured.')).toBeInTheDocument();
  });
});
