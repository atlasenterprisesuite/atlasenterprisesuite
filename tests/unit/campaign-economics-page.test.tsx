import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CampaignEconomicsPage } from '../../apps/web/src/modules/advisory/CampaignEconomicsPage';

describe('campaign economics planning page', () => {
  it('starts empty and calculates editable simulations without provider execution', () => {
    render(<MemoryRouter><CampaignEconomicsPage /></MemoryRouter>);
    expect(screen.getByText(/No advertising account is connected/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Advertising spend (USD)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Leads'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Customers'), { target: { value: '2' } });
    expect(screen.getByTestId('costPerLeadCents')).toHaveTextContent('$10.00');
    expect(screen.getByTestId('adCostPerCustomerCents')).toHaveTextContent('$50.00');
    expect(screen.queryByRole('button', { name: /publish|activate|spend/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear scenario' }));
    expect(screen.getByLabelText('Advertising spend (USD)')).toHaveValue(null);
    expect(screen.getByTestId('costPerLeadCents')).toHaveTextContent('—');
  });
  it('reports invalid input and suppresses stale metrics', () => {
    render(<MemoryRouter><CampaignEconomicsPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Leads'), { target: { value: '1.5' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/whole numbers/i);
    expect(screen.queryByTestId('costPerLeadCents')).not.toBeInTheDocument();
  });
});
