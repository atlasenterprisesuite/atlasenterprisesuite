// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpotifyCompanionPanel } from '../../apps/web/src/modules/creator/music/SpotifyCompanionPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Spotify companion remains opt-in and offline', () => {
  it('recognizes short links without claiming Spotify account access or making requests', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<SpotifyCompanionPanel />);
    const input = screen.getByRole('textbox', { name: 'Spotify URL' });
    fireEvent.change(input, { target: { value: 'https://spotify.app.link/3dOvoRWr9ib?label=tracking' } });
    expect(screen.getByRole('status').textContent).toContain('unverified');
    expect(screen.getByRole('status').textContent).not.toContain('Recognized Spotify track');
    expect(screen.queryByRole('link', { name: 'Open on Spotify' })).toBeNull();
    expect(screen.getByText(/Spotify account not connected/)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders a sanitized public URL only on a supported Spotify resource', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<SpotifyCompanionPanel />);
    const input = screen.getByRole('textbox', { name: 'Spotify URL' });
    const id = '4iV5W9uYEdYUVa79Axb7Rh';
    fireEvent.change(input, { target: { value: 'https://open.spotify.com/track/' + id + '?si=secret-tracking' } });
    const link = screen.getByRole('link', { name: 'Open on Spotify' });
    expect(link.getAttribute('href')).toBe('https://open.spotify.com/track/' + id);
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    fireEvent.change(input, { target: { value: 'https://evil.invalid/track/' + id } });
    expect(screen.queryByRole('link', { name: 'Open on Spotify' })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
