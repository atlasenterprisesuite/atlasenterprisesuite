import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AtlasAccessibility } from '../../apps/web/src/components/AtlasAccessibility';
import { defaultAccessibilityProfile } from '../../apps/web/src/services/accessibilityProfile';

describe('AtlasAccessibility', () => {
  it('exposes a global launcher and truthful provider readiness', () => {
    render(
      <MemoryRouter>
        <AtlasAccessibility
          initialProfile={defaultAccessibilityProfile('user-a')}
          onProfileChange={() => undefined}
          onActionTriggered={() => undefined}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /open accessibility communication center/i }));
    expect(screen.getByRole('dialog', { name: /accessibility communication center/i })).toBeInTheDocument();
    expect(screen.getByText(/ASL recognition/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Not configured/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /communication settings/i })).toHaveAttribute('href', '/settings/accessibility/communication');
  });

  it('requires confirmation for medium-confidence recognition', () => {
    const onActionTriggered = vi.fn();
    render(
      <MemoryRouter>
        <AtlasAccessibility
          initialProfile={defaultAccessibilityProfile('user-a')}
          onProfileChange={() => undefined}
          onActionTriggered={onActionTriggered}
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
          initialProfile={defaultAccessibilityProfile('user-a')}
          onProfileChange={() => undefined}
          onActionTriggered={onActionTriggered}
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
});
