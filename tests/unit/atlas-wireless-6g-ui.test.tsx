import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AtlasWireless6GResearchPage } from '../../apps/web/src/modules/connect/AtlasWireless6GResearchPage';

afterEach(cleanup);

describe('ATLAS Wireless 6G research-only page', () => {
  it('renders synthetic scenario and never claims commercial service', () => {
    render(<MemoryRouter><AtlasWireless6GResearchPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'ATLAS Wireless 6G Pioneer Lab' })).toBeTruthy();
    expect(screen.getByText(/No radio control, provider credentials, eSIM activation/)).toBeTruthy();
    expect(screen.getByText('100.0 Mbps')).toBeTruthy();
    expect(screen.getByText('33.3%')).toBeTruthy();
    expect(screen.getByText(/Commercial activation:/).textContent).toContain('Blocked');
  });

  it('allows bounded interactive simulation but rejects invalid capacity', () => {
    render(<MemoryRouter><AtlasWireless6GResearchPage /></MemoryRouter>);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Configured capacity (Mbps)' }), {target: { value: '200' }});
    expect(screen.getByText('150.0 Mbps')).toBeTruthy();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Configured capacity (Mbps)' }), {target: { value: '0' }});
    expect(screen.getByRole('alert').textContent).toContain('Invalid model inputs');
    fireEvent.click(screen.getByRole('button', { name: 'Reset synthetic example' }));
    expect(screen.getByText('100.0 Mbps')).toBeTruthy();
  });
});
