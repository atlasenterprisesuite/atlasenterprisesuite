import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';
import { loadAccessibilityProfile } from '../../apps/web/src/services/accessibilityProfile';

describe('Accessibility Communication Settings route', () => {
  beforeEach(() => window.localStorage.clear());

  it('renders labeled functional preferences and persists changes', () => {
    render(
      <MemoryRouter initialEntries={['/settings/accessibility/communication']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Accessibility Communication' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Preferred input/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Preferred output/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Always show captions/i));
    fireEvent.click(screen.getByLabelText(/High contrast/i));
    fireEvent.change(screen.getByLabelText(/Text size/i), { target: { value: '1.25' } });

    const saved = loadAccessibilityProfile('local-user');
    expect(saved.captionsEnabled).toBe(true);
    expect(saved.highContrast).toBe(true);
    expect(saved.textSizeScale).toBe(1.25);
  });

  it('does not present hardware-dependent modes as connected when no capability exists', () => {
    render(
      <MemoryRouter initialEntries={['/settings/accessibility/communication']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText(/Braille hardware support requires a compatible detected device/i)).toBeInTheDocument();
    expect(screen.getByText(/ASL recognition and avatar rendering require configured providers/i)).toBeInTheDocument();
  });
});
