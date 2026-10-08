import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AtlasAccessibility } from '../../apps/web/src/components/AtlasAccessibility';
import { defaultAccessibilityProfile } from '../../apps/web/src/services/accessibilityProfile';

describe('AtlasAccessibility', () => {
  it('exposes a global launcher, contains keyboard focus and reports truthful provider readiness', () => {
    const profile = {
      ...defaultAccessibilityProfile('user-a'),
      preferredInput: 'asl' as const,
      preferredSignLanguage: 'vsl'
    };

    render(
      <MemoryRouter>
        <AtlasAccessibility
          initialProfile={profile}
          onProfileChange={() => undefined}
          onActionTriggered={() => undefined}
        />
      </MemoryRouter>
    );

    const launcher = screen.getByRole('button', { name: /open accessibility communication center/i });
    fireEvent.click(launcher);
    const dialog = screen.getByRole('dialog', { name: /accessibility communication center/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('button', { name: /close accessibility communication center/i })).toHaveFocus();

    expect(screen.getByText(/Sign-language recognition/i)).toBeInTheDocument();
    expect(screen.getByText(/vsl/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Not configured/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /communication settings/i })).toHaveAttribute('href', '/settings/accessibility/communication');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /accessibility communication center/i })).not.toBeInTheDocument();
    expect(launcher).toHaveFocus();
  });

  it('requires confirmation for medium-confidence recognition', () => {
    const onActionTriggered = vi.fn();
    render(
      <MemoryRouter>
        <AtlasAccessibility
          initialProfile={{ ...defaultAccessibilityProfile('user-a'), preferredInput: 'asl', preferredSignLanguage: 'ase' }}
          onProfileChange={() => undefined}
          onActionTriggered={onActionTriggered}
          capabilities={{ aslRecognition: 'available' }}
          recognitionInput={{ text: 'Open Human Resources', confidence: 0.85, sensitive: false, signLanguage: 'ase' }}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /open accessibility communication center/i }));
    expect(screen.getByText('Open Human Resources')).toBeInTheDocument();
    expect(screen.getByText(/confirmation required/i)).toBeInTheDocument();
    expect(onActionTriggered).not.toHaveBeenCalledWith('EXECUTE_ACCESSIBILITY_ACTION', expect.anything());
  });

  it('blocks low-confidence recognition and exposes human escalation without claiming a connection', () => {
    const onActionTriggered = vi.fn();
    render(
      <MemoryRouter>
        <AtlasAccessibility
          initialProfile={{ ...defaultAccessibilityProfile('user-a'), preferredInput: 'asl', preferredSignLanguage: 'ase' }}
          onProfileChange={() => undefined}
          onActionTriggered={onActionTriggered}
          capabilities={{ aslRecognition: 'available' }}
          recognitionInput={{ text: 'Approve payroll', confidence: 0.5, sensitive: true, signLanguage: 'ase' }}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /open accessibility communication center/i }));
    expect(screen.getByText(/automation blocked/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request human interpreter/i })).toBeDisabled();
    expect(screen.getByText(/interpreter provider is not configured/i)).toBeInTheDocument();
    expect(onActionTriggered).not.toHaveBeenCalledWith('EXECUTE_ACCESSIBILITY_ACTION', expect.anything());
  });

  it('blocks high-confidence recognition without a configured provider', () => {
    const onActionTriggered = vi.fn();
    render(<MemoryRouter><AtlasAccessibility
      initialProfile={{ ...defaultAccessibilityProfile('user-a'), preferredInput: 'asl', preferredSignLanguage: 'ase' }}
      onProfileChange={() => undefined}
      onActionTriggered={onActionTriggered}
      recognitionInput={{ text: 'Approve payroll', confidence: 1, sensitive: false, signLanguage: 'ase' }}
    /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /open accessibility communication center/i }));
    expect(screen.getByText(/unavailable until a validated provider/i)).toBeInTheDocument();
    expect(onActionTriggered).not.toHaveBeenCalledWith('EXECUTE_ACCESSIBILITY_ACTION', expect.anything());
    expect(onActionTriggered).toHaveBeenCalledWith('ACCESSIBILITY_INTERPRETATION_BLOCKED', expect.objectContaining({ reason: 'provider_not_configured' }));
  });

  it('blocks language mismatches even when a recognition adapter is available', () => {
    const onActionTriggered = vi.fn();
    render(<MemoryRouter><AtlasAccessibility
      initialProfile={{ ...defaultAccessibilityProfile('user-a'), preferredInput: 'asl', preferredSignLanguage: 'ase' }}
      onProfileChange={() => undefined}
      onActionTriggered={onActionTriggered}
      capabilities={{ aslRecognition: 'available' }}
      recognitionInput={{ text: 'Open Human Resources', confidence: 1, sensitive: false, signLanguage: 'vsl' }}
    /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /open accessibility communication center/i }));
    expect(screen.getByText(/does not match the language/i)).toBeInTheDocument();
    expect(onActionTriggered).not.toHaveBeenCalledWith('EXECUTE_ACCESSIBILITY_ACTION', expect.anything());
  });
});
