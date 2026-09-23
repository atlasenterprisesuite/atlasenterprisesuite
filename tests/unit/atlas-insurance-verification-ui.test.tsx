import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/lib/atlasMfa', () => ({
  listAtlasTotpFactors: vi.fn(),
  enrollAtlasTotp: vi.fn(),
  unenrollAtlasMfaFactor: vi.fn(),
  verifyAtlasTotp: vi.fn()
}));

vi.mock('../../apps/web/src/modules/insurance/insuranceApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../apps/web/src/modules/insurance/insuranceApi')>();
  return {
    ...actual,
    grantInsuranceMfa: vi.fn(),
    issueInsuranceChallenge: vi.fn(),
    verifyInsuranceChallenge: vi.fn(),
    resendInsuranceChallenge: vi.fn()
  };
});

import {
  enrollAtlasTotp,
  listAtlasTotpFactors,
  verifyAtlasTotp
} from '../../apps/web/src/lib/atlasMfa';
import { InsuranceVerificationPage } from '../../apps/web/src/modules/insurance/InsuranceVerificationPage';
import {
  grantInsuranceMfa,
  isSixDigitCode,
  issueInsuranceChallenge,
  resendInsuranceChallenge,
  verifyInsuranceChallenge
} from '../../apps/web/src/modules/insurance/insuranceApi';

const listFactorsMock = vi.mocked(listAtlasTotpFactors);
const enrollTotpMock = vi.mocked(enrollAtlasTotp);
const verifyTotpMock = vi.mocked(verifyAtlasTotp);
const grantMfaMock = vi.mocked(grantInsuranceMfa);
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
  listFactorsMock.mockResolvedValue([{
    id: 'factor-1',
    factor_type: 'totp',
    status: 'verified',
    friendly_name: 'ATLAS Insurance'
  }]);
  enrollTotpMock.mockResolvedValue({
    id: 'factor-new',
    factor_type: 'totp',
    status: 'unverified',
    friendly_name: 'ATLAS Insurance',
    qr_code: 'data:image/svg+xml;base64,PHN2Zy8+',
    secret: 'EXAMPLESECRET',
    uri: 'otpauth://totp/ATLAS'
  });
  verifyTotpMock.mockResolvedValue({});
  grantMfaMock.mockResolvedValue({
    ok: true,
    grant: {
      scope: 'insurance_access',
      resource_id: null,
      verified_at: '2026-09-15T17:00:00Z',
      expires_at: '2026-09-15T17:15:00Z',
      verification_method: 'totp'
    }
  });
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

  it('uses Authenticator app by default and keeps Continue disabled until six digits are present', async () => {
    render(
      <MemoryRouter initialEntries={['/insurance/verify?scope=insurance_access']}>
        <InsuranceVerificationPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/current six-digit code from your/i)).toHaveTextContent('Authenticator app');
    const input = screen.getByRole('textbox', { name: /^verification code$/i });
    const submit = screen.getByRole('button', { name: /continue/i });

    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: '12345' } });
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: '123456' } });
    expect(submit).toBeEnabled();
  });

  it('offers QR enrollment when the user has no verified TOTP factor', async () => {
    listFactorsMock.mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={['/insurance/verify?scope=insurance_access']}>
        <InsuranceVerificationPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/set up your authenticator app/i)).toBeInTheDocument();
    expect(screen.getByAltText(/authenticator app qr code/i)).toBeInTheDocument();
    expect(screen.getByText('EXAMPLESECRET')).toBeInTheDocument();
  });

  it('keeps email as an explicit fallback and reports missing delivery truthfully', async () => {
    issueMock.mockRejectedValueOnce(new Error('delivery_not_configured'));

    render(
      <MemoryRouter initialEntries={['/insurance/verify?scope=insurance_access']}>
        <InsuranceVerificationPage />
      </MemoryRouter>
    );

    const fallback = await screen.findByRole('button', { name: /use email code instead/i });
    fireEvent.click(fallback);

    expect(await screen.findByRole('alert')).toHaveTextContent(/email verification is not configured/i);
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /use authenticator app/i })).toBeInTheDocument();
  });
});
