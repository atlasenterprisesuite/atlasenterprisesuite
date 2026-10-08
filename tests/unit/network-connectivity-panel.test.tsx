import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NetworkConnectivityPanel } from '../../apps/web/src/work/NetworkConnectivityPanel';
afterEach(cleanup);
describe('network troubleshooting interaction', () => {
  it('changes guidance when users select a failing action', () => {
    render(<NetworkConnectivityPanel />);
    expect(screen.getByText(/Permit secure WebSocket/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Observed symptom'), { target: { value: 'uploads' } });
    expect(screen.getByText(/Allow \*\.oaiusercontent.com/)).toBeTruthy();
    expect(screen.queryByText(/Permit secure WebSocket/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Observed symptom'), { target: { value: 'voice' } });
    expect(screen.getByText(/Permit UDP 3478/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Official network guide' }).getAttribute('href')).toContain('9247338');
  });
});
