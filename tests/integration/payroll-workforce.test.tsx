import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PeoplePage } from '../../apps/web/src/modules/payroll/PeoplePage';
import { TimePtoPage } from '../../apps/web/src/modules/payroll/TimePtoPage';

const listWorkers=vi.fn();
const saveWorker=vi.fn();
const listTime=vi.fn();
const saveTime=vi.fn();
vi.mock('../../apps/web/src/lib/payrollApi',()=>({
  listPayrollWorkers:(...args:unknown[])=>listWorkers(...args),
  savePayrollWorker:(...args:unknown[])=>saveWorker(...args),
  listPayrollTimeEntries:(...args:unknown[])=>listTime(...args),
  savePayrollTimeEntry:(...args:unknown[])=>saveTime(...args)
}));

describe('payroll workforce',()=>{
  beforeEach(()=>{
    listWorkers.mockReset().mockResolvedValue([]);
    saveWorker.mockReset().mockResolvedValue({});
    listTime.mockReset().mockResolvedValue([]);
    saveTime.mockReset().mockResolvedValue({});
  });

  it('keeps employee and contractor classification explicit',async()=>{
    render(<PeoplePage />);
    fireEvent.click(screen.getByRole('button',{name:'Add worker'}));
    const select=screen.getByLabelText('Worker classification');
    expect(select).toHaveTextContent('Employee');
    expect(select).toHaveTextContent('Contractor');
    await waitFor(()=>expect(listWorkers).toHaveBeenCalled());
  });

  it('does not invent a PTO balance without a policy ledger',async()=>{
    render(<TimePtoPage />);
    expect(screen.getByText('No PTO policy configured')).toBeInTheDocument();
    expect(screen.queryByText(/0 hours available/i)).not.toBeInTheDocument();
    await waitFor(()=>expect(listTime).toHaveBeenCalled());
  });
});
