import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/modules/settings/security/trustpassApi', () => ({
  passkeysSupported: vi.fn(),
  beginTrustPassStepUp: vi.fn(),
  completeTrustPassStepUp: vi.fn()
}));

import { TrustPassStepUp } from '../../apps/web/src/security/TrustPassStepUp';
import {
  beginTrustPassStepUp,
  completeTrustPassStepUp,
  passkeysSupported
} from '../../apps/web/src/modules/settings/security/trustpassApi';

const supportedMock = vi.mocked(passkeysSupported);
const beginMock = vi.mocked(beginTrustPassStepUp);
const completeMock = vi.mocked(completeTrustPassStepUp);

const action = {
  actionType: 'security.passkey.remove',
  actionClass: 'P0' as const,
  resourceId: 'credential-1',
  actionHash: 'a'.repeat(64)
};

beforeEach(() => {
  supportedMock.mockReturnValue(true);
  beginMock.mockResolvedValue({
    challengeId: 'challenge-1',
    credential: { id: 'credential-1', rawId: 'credential-1', response: {}, type: 'public-key', clientExtensionResults: {} }
  } as never);
  completeMock.mockResolvedValue({ ok: true, grant_id: 'grant-1', expires_at: '2026-10-04T12:05:00Z' } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ATLAS TrustPass passkey step-up', () => {
  it('shows an accessible unsupported state instead of a fake fallback', () => {
    supportedMock.mockReturnValue(false);
    render(<TrustPassStepUp action={action} onVerified={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent(/passkey verification is not available/i);
    expect(screen.getByRole('button', { name: /verify with passkey/i })).toBeDisabled();
    expect(screen.getByText(/no weaker fallback is permitted/i)).toBeInTheDocument();
  });

  it('runs step-up from a user click, exposes loading, and reports success', async () => {
    const onVerified = vi.fn();
    let release: ((value: any) => void) | undefined;
    beginMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));

    render(<TrustPassStepUp action={action} onVerified={onVerified} />);
    const button = screen.getByRole('button', { name: /verify with passkey/i });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/waiting for passkey verification/i);

    release?.({
      challengeId: 'challenge-1',
      credential: { id: 'credential-1', rawId: 'credential-1', response: {}, type: 'public-key', clientExtensionResults: {} }
    });

    await waitFor(() => expect(onVerified).toHaveBeenCalledWith(expect.objectContaining({ grant_id: 'grant-1' })));
    expect(screen.getByRole('status')).toHaveTextContent(/verification complete/i);
  });

  it.each([
    ['passkey_cancelled', /verification was cancelled/i],
    ['trust_challenge_expired', /verification expired/i],
    ['trust_webauthn_verification_failed', /passkey could not be verified/i]
  ])('maps %s to a safe user-visible state', async (code, expected) => {
    beginMock.mockRejectedValueOnce(new Error(code));
    render(<TrustPassStepUp action={action} onVerified={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /verify with passkey/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
  });
});
