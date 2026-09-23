import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupWizard } from '../../apps/web/src/modules/payroll/SetupWizard';

const save=vi.fn();
vi.mock('../../apps/web/src/lib/payrollApi',()=>({savePayrollSetupSection:(...args:unknown[])=>save(...args)}));

describe('payroll setup',()=>{
  beforeEach(()=>save.mockReset());

  it('blocks invalid EIN with an explicit accessible error',async()=>{
    render(<MemoryRouter initialEntries={['/payroll/setup/tax']}><Routes><Route path="/payroll/setup/:step" element={<SetupWizard />} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Federal EIN'),{target:{value:'123'}});
    fireEvent.click(screen.getByRole('button',{name:'Save and continue'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('12-3456789');
    expect(save).not.toHaveBeenCalled();
  });

  it('shows bank disconnected until real verification exists',()=>{
    render(<MemoryRouter initialEntries={['/payroll/setup/bank']}><Routes><Route path="/payroll/setup/:step" element={<SetupWizard />} /></Routes></MemoryRouter>);
    expect(screen.getByText('Bank connection not configured')).toBeInTheDocument();
    expect(screen.queryByText(/Direct deposit enabled/i)).not.toBeInTheDocument();
  });
});
