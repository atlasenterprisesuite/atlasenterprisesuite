import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ConnectMeetingsPage } from '../../apps/web/src/modules/connect/ConnectMeetingsPage';

describe('ConnectMeetingsPage', () => {
  it('blocks unverified meeting and signing claims and links to preferences', () => {
    render(<MemoryRouter><ConnectMeetingsPage /></MemoryRouter>);
    expect(screen.getByText(/live meeting or sign-language interpretation is not currently active/i)).toBeInTheDocument();
    expect(screen.getAllByText('Not configured')).toHaveLength(4);
    expect(screen.getByRole('link', { name: /configure communication accessibility/i })).toHaveAttribute('href', '/settings/accessibility/communication');
  });
  it('displays manual text with size controls, pause and clear', () => {
    render(<MemoryRouter><ConnectMeetingsPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/message to display/i), { target: { value: 'Accessible message' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show message' }));
    expect(screen.getByRole('region', { name: /manual message display/i })).toHaveTextContent('Accessible message');
    fireEvent.change(screen.getByLabelText(/text size/i), { target: { value: 'extra-large' } });
    expect(screen.getByText('Accessible message')).toHaveStyle({ fontSize: '2rem' });
    fireEvent.click(screen.getByRole('button', { name: /pause updates/i }));
    expect(screen.getByRole('button', { name: 'Show message' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /resume updates/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('region', { name: /manual message display/i })).not.toHaveTextContent('Accessible message');
  });
});
