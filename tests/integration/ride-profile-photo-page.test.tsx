import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePhotoCompliancePage } from '../../apps/web/src/modules/ride/ProfilePhotoCompliancePage';
import {
  approveRideComplianceSubmission,
  getRideCompliancePreview,
  getRideComplianceTimeline,
  getRideProfilePhotoRequirement,
  rejectRideComplianceSubmission,
  submitRideProfilePhoto
} from '../../apps/web/src/lib/rideComplianceApi';

vi.mock('../../apps/web/src/lib/rideComplianceApi', () => ({
  getRideProfilePhotoRequirement: vi.fn(),
  getRideComplianceTimeline: vi.fn(),
  submitRideProfilePhoto: vi.fn(),
  getRideCompliancePreview: vi.fn(),
  approveRideComplianceSubmission: vi.fn(),
  rejectRideComplianceSubmission: vi.fn()
}));

const baseRequirement: any = {
  id: 'req-1', tenantId: 'org-1', organizationId: 'org-1', subjectUserId: 'user-1',
  module: 'ride', subjectType: 'driver', requirementType: 'profile_photo', status: 'action_required',
  requestedAt: '2026-09-12T12:00:00Z', dueAt: null, expiresAt: null,
  eligibilityEffect: null, reasonCode: 'periodic_reverification', reasonText: null, createdBy: null,
  createdAt: '2026-09-12T12:00:00Z', updatedAt: '2026-09-12T12:00:00Z'
};

const submitted: any = {
  id: 'sub-1', requirementId: 'req-1', tenantId: 'org-1', organizationId: 'org-1',
  subjectUserId: 'user-1', submittedBy: 'user-1', status: 'submitted', storageBucket: 'atlas-compliance-evidence',
  storagePath: 'private/path', mimeType: 'image/jpeg', fileSizeBytes: 1000, sha256: null,
  submittedAt: '2026-09-12T12:05:00Z', reviewedAt: null, reviewedBy: null, decisionReason: null,
  providerReference: null, createdAt: '2026-09-12T12:05:00Z', updatedAt: '2026-09-12T12:05:00Z'
};

function response(overrides: Record<string, unknown> = {}) {
  return { ok: true, requirement: baseRequirement, submission: null, permissions: ['ride.compliance.read', 'ride.compliance.submit'], ...overrides } as any;
}

describe('ATLAS Ride profile-photo compliance page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getRideComplianceTimeline).mockResolvedValue({ ok: true, events: [] });
  });

  it('renders a truthful no-action state', async () => {
    vi.mocked(getRideProfilePhotoRequirement).mockResolvedValue(response({ requirement: null }));
    render(<ProfilePhotoCompliancePage />);
    expect(await screen.findByText(/no profile-photo action is currently required/i)).toBeInTheDocument();
    expect(screen.queryByText(/verified by ai|face matched/i)).not.toBeInTheDocument();
  });

  it('shows action required with an accessible governed image input', async () => {
    vi.mocked(getRideProfilePhotoRequirement).mockResolvedValue(response());
    render(<ProfilePhotoCompliancePage />);
    expect(await screen.findByRole('heading', { name: /profile photo update required/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /take or choose photo/i })).toBeEnabled();
    expect(screen.getByLabelText(/profile photo/i)).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(screen.getByText(/private compliance evidence/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders persisted eligibility impact and rejection reason', async () => {
    const requirement = { ...baseRequirement, status: 'rejected', eligibilityEffect: 'block_new_activity', reasonText: 'Photo was not clear' };
    const rejection = { ...submitted, status: 'rejected', decisionReason: 'Photo was not clear', reviewedAt: '2026-09-12T12:10:00Z' };
    vi.mocked(getRideProfilePhotoRequirement).mockResolvedValue(response({ requirement, submission: rejection }));
    render(<ProfilePhotoCompliancePage />);
    expect(await screen.findByText(/new ride activity is blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/photo was not clear/i)).toBeInTheDocument();
    expect(screen.getByText(/rejected/i)).toBeInTheDocument();
  });

  it('does not expose reviewer controls without review permission', async () => {
    vi.mocked(getRideProfilePhotoRequirement).mockResolvedValue(response({ requirement: { ...baseRequirement, status: 'submitted' }, submission: submitted }));
    render(<ProfilePhotoCompliancePage />);
    expect(await screen.findByText(/^submitted$/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open review/i })).not.toBeInTheDocument();
  });

  it('loads short-lived preview only after a reviewer opens the panel and requires a rejection reason', async () => {
    vi.mocked(getRideProfilePhotoRequirement).mockResolvedValue(response({
      requirement: { ...baseRequirement, status: 'submitted' }, submission: submitted,
      permissions: ['ride.compliance.read', 'ride.compliance.review']
    }));
    vi.mocked(getRideCompliancePreview).mockResolvedValue({ ok: true, signed_url: 'https://signed.example/photo', expires_in: 300 });
    render(<ProfilePhotoCompliancePage />);

    const open = await screen.findByRole('button', { name: /open review/i });
    expect(getRideCompliancePreview).not.toHaveBeenCalled();
    fireEvent.click(open);
    expect(await screen.findByAltText(/submitted profile photo/i)).toHaveAttribute('src', 'https://signed.example/photo');
    const reject = screen.getByRole('button', { name: /^reject$/i });
    expect(reject).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/rejection reason/i), { target: { value: 'Image is too dark' } });
    expect(reject).toBeEnabled();
  });

  it('submits only after a valid selection and uses the server response as truth', async () => {
    vi.mocked(getRideProfilePhotoRequirement).mockResolvedValue(response());
    vi.mocked(submitRideProfilePhoto).mockResolvedValue({
      ok: true,
      requirement: { ...baseRequirement, status: 'submitted' },
      submission: submitted
    });
    render(<ProfilePhotoCompliancePage />);
    await screen.findByRole('button', { name: /take or choose photo/i });

    const file = new File(['jpeg'], 'profile.jpg', { type: 'image/jpeg' });
    Object.defineProperty(globalThis.URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test') });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    class TestImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal('Image', TestImage as any);

    fireEvent.change(screen.getByLabelText(/profile photo/i), { target: { files: [file] } });
    const submit = await screen.findByRole('button', { name: /submit profile photo/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    expect(await screen.findByText(/photo submitted for review/i)).toBeInTheDocument();
    expect(submitRideProfilePhoto).toHaveBeenCalledWith(file);
    expect(screen.queryByText(/^approved$/i)).not.toBeInTheDocument();
  });

  it('renders server failures as alerts', async () => {
    vi.mocked(getRideProfilePhotoRequirement).mockRejectedValue(new Error('backend_unavailable'));
    render(<ProfilePhotoCompliancePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to load/i);
  });

  it('uses server state after review decisions', async () => {
    vi.mocked(getRideProfilePhotoRequirement).mockResolvedValue(response({
      requirement: { ...baseRequirement, status: 'under_review' }, submission: { ...submitted, status: 'under_review' },
      permissions: ['ride.compliance.read', 'ride.compliance.review']
    }));
    vi.mocked(getRideCompliancePreview).mockResolvedValue({ ok: true, signed_url: 'https://signed.example/photo', expires_in: 300 });
    vi.mocked(approveRideComplianceSubmission).mockResolvedValue({
      ok: true,
      requirement: { ...baseRequirement, status: 'approved' },
      submission: { ...submitted, status: 'approved', reviewedAt: '2026-09-12T12:20:00Z' }
    });
    vi.mocked(rejectRideComplianceSubmission).mockResolvedValue({
      ok: true,
      requirement: { ...baseRequirement, status: 'rejected' },
      submission: { ...submitted, status: 'rejected', decisionReason: 'Too dark' }
    });
    render(<ProfilePhotoCompliancePage />);
    fireEvent.click(await screen.findByRole('button', { name: /open review/i }));
    await screen.findByAltText(/submitted profile photo/i);
    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    expect(await screen.findByText(/^approved$/i)).toBeInTheDocument();
  });
});
