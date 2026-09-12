import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SocialCopilotPage } from '../../apps/web/src/modules/creator/social/SocialCopilotPage';

describe('ATLAS Social Copilot', () => {
  it('renders truthful empty analytics state', () => {
    render(<MemoryRouter><SocialCopilotPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Social Copilot' })).toBeInTheDocument();
    expect(screen.getByText(/No verified or imported metrics yet/i)).toBeInTheDocument();
  });

  it('analyzes valid imported rows', () => {
    render(<MemoryRouter><SocialCopilotPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Post metrics'), { target: { value: 'instagram,2026-09-10T14:00:00Z,reel,Strong hook,1000,150,20,10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze metrics' }));
    expect(screen.getByText('Strong hook')).toBeInTheDocument();
    expect(screen.getByText(/1 imported post/i)).toBeInTheDocument();
  });

  it('switches to Engage and generates drafts', () => {
    render(<MemoryRouter><SocialCopilotPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: 'Engage' }));
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'AI for payroll' } });
    fireEvent.change(screen.getByLabelText('Niche'), { target: { value: 'small business' } });
    fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'operators' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate engagement drafts' }));
    expect(screen.getByText(/Casual welcome/i)).toBeInTheDocument();
  });

  it('keeps publishing gated until a provider is configured', () => {
    render(<MemoryRouter><SocialCopilotPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: 'Publish' }));
    expect(screen.getByText(/Publishing connection required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish to Instagram/i })).toBeDisabled();
  });
});
