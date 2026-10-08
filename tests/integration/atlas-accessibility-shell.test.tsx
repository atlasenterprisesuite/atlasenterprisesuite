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
    expect(screen.getByText(/sign language selected — service not yet connected/i)).toBeInTheDocument();
    expect(screen.getByText(/selecting a language does not enable/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /change communication preferences/i })).toHaveAttribute('href', '/settings/accessibility/communication');
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
          recognitionInput={{ text: 'Open Human Resources', confidence: 0.85, sensitive: false }}
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
          recognitionInput={{ text: 'Approve payroll', confidence: 0.5, sensitive: true }}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /open accessibility communication center/i }));
    expect(screen.getByText(/automation blocked/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request human interpreter/i })).toBeDisabled();
    expect(screen.getByText(/interpreter provider is not configured/i)).toBeInTheDocument();
    expect(onActionTriggered).not.toHaveBeenCalledWith('EXECUTE_ACCESSIBILITY_ACTION', expect.anything());
  });
  it('does not report haptics as verified solely from browser vibration API presence', () => {
    const before = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vi.fn(() => true) });
    try {
      render(
        <MemoryRouter>
          <AtlasAccessibility
            initialProfile={defaultAccessibilityProfile('user-haptics')}
            onProfileChange={() => undefined}
            onActionTriggered={() => undefined}
          />
        </MemoryRouter>
      );
      fireEvent.click(screen.getByRole('button', { name: /open accessibility communication center/i }));
      expect(screen.getByText('Haptics').closest('.accessibility-capability')).toHaveTextContent('Unavailable');
    } finally {
      if (before) Object.defineProperty(navigator, 'vibrate', before);
      else Reflect.deleteProperty(navigator, 'vibrate');
    }
  });

  it('blocks even high-confidence injected recognition without a verified sign provider', () => {
    const onActionTriggered = vi.fn();
    render(
      <MemoryRouter>
        <AtlasAccessibility
          initialProfile={{ ...defaultAccessibilityProfile('user-unverified'), preferredInput: 'asl', preferredSignLanguage: 'ase' }}
          onProfileChange={() => undefined}
          onActionTriggered={onActionTriggered}
          recognitionInput={{ text: 'Approve financial transfer', confidence: 1, sensitive: false }}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /open accessibility communication center/i }));
    expect(screen.getByText(/no verified sign-language recognition provider is connected/i)).toBeInTheDocument();
    expect(onActionTriggered).toHaveBeenCalledWith('ACCESSIBILITY_INTERPRETATION_BLOCKED',
      expect.objectContaining({ reason: 'sign_language_provider_not_verified', signLanguage: 'ase' }));
    expect(onActionTriggered).not.toHaveBeenCalledWith('EXECUTE_ACCESSIBILITY_ACTION', expect.anything());
  });

});
