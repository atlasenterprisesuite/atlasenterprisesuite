import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/modules/insurance/insuranceApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../apps/web/src/modules/insurance/insuranceApi')>();
  return {
    ...actual,
    issueInsuranceChallenge: vi.fn(),
    verifyInsuranceChallenge: vi.fn(),
    resendInsuranceChallenge: vi.fn()
  };
});

import { InsuranceVerificationPage } from '../../apps/web/src/modules/insurance/InsuranceVerificationPage';
import {
  isSixDigitCode,
  issueInsuranceChallenge,
  resendInsuranceChallenge,
  verifyInsuranceChallenge
} from '../../apps/web/src/modules/insurance/insuranceApi';

const issueMock = vi.mocked(issueInsuranceChallenge);
const verifyMock = vi.mocked(verifyInsuranceChallenge);
const resendMock = vi.mocked(resendInsuranceChallenge);

const challenge = {
  ok: true as const,
  challenge_id: 'challenge-123',
  scope: 'insurance_access' as const,
  resource_id: null,
  delivery_channel: 'email' as const,
  delivery_target_masked: 'w***@example.com',
  expires_at: '2026-09-15T17:10:00Z',
  resend_available_at: '2026-09-15T17:01:00Z'
};

beforeEach(() => {
  issueMock.mockResolvedValue(challenge);
  resendMock.mockResolvedValue(challenge);
  verifyMock.mockResolvedValue({
    ok: true,
    grant: {
      scope: 'insurance_access',
      resource_id: null,
      verified_at: '2026-09-15T17:00:00Z',
      expires_at: '2026-09-15T17:15:00Z'
    }
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ATLAS Insurance verification experience', () => {
  it('accepts exactly six ASCII digits', () => {
    expect(isSixDigitCode('123456')).toBe(true);
    expect(isSixDigitCode('12345')).toBe(false);
    expect(isSixDigitCode('1234567')).toBe(false);
    expect(isSixDigitCode('12a456')).toBe(false);
  });

  it('keeps Continue disabled until a six-digit code is present', async () => {
    render(
      <MemoryRouter initialEntries={['/insurance/verify?scope=insurance_access']}>
        <InsuranceVerificationPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/code sent to/i)).toHaveTextContent('w***@example.com');
    const input = screen.getByRole('textbox', { name: /^verification code$/i });
    const submit = screen.getByRole('button', { name: /continue/i });

    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: '12345' } });
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: '123456' } });
    expect(submit).toBeEnabled();
  });

  it('shows a truthful configuration state when delivery is unavailable', async () => {
    issueMock.mockRejectedValueOnce(new Error('delivery_not_configured'));

    render(
      <MemoryRouter initialEntries={['/insurance/verify?scope=insurance_access']}>
        <InsuranceVerificationPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/delivery is not configured/i);
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });
});
