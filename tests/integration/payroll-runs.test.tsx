import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayrollRunsPage } from '../../apps/web/src/modules/payroll/PayrollRunsPage';

const listRuns=vi.fn();
const createRun=vi.fn();
const transition=vi.fn();
vi.mock('../../apps/web/src/lib/payrollApi',()=>({
  listPayrollRuns:(...args:unknown[])=>listRuns(...args),
  createPayrollRun:(...args:unknown[])=>createRun(...args),
  transitionPayrollRun:(...args:unknown[])=>transition(...args)
}));

describe('payroll run UI',()=>{
  beforeEach(()=>{
    createRun.mockReset();
    transition.mockReset().mockResolvedValue({});
  });

  it('shows a tax-rule block without claiming taxes were filed or paid',async()=>{
    listRuns.mockReset().mockResolvedValue([{
      id:'run-1',period_start:'2026-09-01',period_end:'2026-09-15',pay_date:'2026-09-20',
      status:'blocked',blocked_reason:'tax_rule_unavailable',gross_pay_cents:null,
      employee_taxes_cents:null,employer_taxes_cents:null,net_pay_cents:null
    }]);
    render(<PayrollRunsPage />);
    expect(await screen.findByText('Validated tax rule unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/taxes filed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/taxes paid/i)).not.toBeInTheDocument();
  });

  it('requires explicit approval before process is exposed',async()=>{
    listRuns.mockReset().mockResolvedValue([{
      id:'run-2',period_start:'2026-09-01',period_end:'2026-09-15',pay_date:'2026-09-20',
      status:'awaiting_approval',blocked_reason:null,gross_pay_cents:null,
      employee_taxes_cents:null,employer_taxes_cents:null,net_pay_cents:null
    }]);
    render(<PayrollRunsPage />);
    const approve=await screen.findByRole('button',{name:'Approve payroll'});
    expect(screen.queryByRole('button',{name:'Process payroll'})).not.toBeInTheDocument();
    fireEvent.click(approve);
    await waitFor(()=>expect(transition).toHaveBeenCalledWith('run-2','approve'));
  });
});
