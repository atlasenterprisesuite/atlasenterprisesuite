import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

describe('Business Suite social publishing route', () => {
  it('opens the multi-platform publisher and keeps external publishing gated', () => {
    render(<MemoryRouter initialEntries={['/business/growth/social-publisher']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Social Publisher' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Instagram' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Publish to Instagram' })).toBeDisabled();
    expect(screen.getByText('Publishing connection required')).toBeInTheDocument();
  });
});
