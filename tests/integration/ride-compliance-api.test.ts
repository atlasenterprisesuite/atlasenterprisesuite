import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveRideComplianceSubmission,
  getRideCompliancePreview,
  getRideComplianceTimeline,
  getRideProfilePhotoRequirement,
  rejectRideComplianceSubmission,
  submitRideProfilePhoto
} from '../../apps/web/src/lib/rideComplianceApi';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('ATLAS Ride compliance browser API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem('atlas_access_token', 'test-token');
    localStorage.setItem('atlas_org_id', '11111111-1111-4111-8111-111111111111');
  });

  it('sends the active ATLAS token and selected organization to the profile-photo endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      ok: true,
      requirement: null,
      submission: null,
      permissions: ['ride.compliance.read']
    }));

    await getRideProfilePhotoRequirement();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/atlas-ride-compliance?api=profile-photo'),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer test-token',
          'x-atlas-org-id': '11111111-1111-4111-8111-111111111111'
        })
      })
    );
  });

  it('uploads FormData without manually setting multipart content type', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      ok: true,
      requirement: { id: 'req-1', status: 'submitted' },
      submission: { id: 'sub-1', status: 'submitted' }
    }, 201));
    const photo = new File(['jpeg'], 'profile.jpg', { type: 'image/jpeg' });

    await submitRideProfilePhoto(photo);

    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.headers as Record<string, string>)['content-type']).toBeUndefined();
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer test-token');
    expect((init?.headers as Record<string, string>)['x-atlas-org-id']).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('encodes identifiers and sends review mutations as JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true, events: [] }));
    await getRideComplianceTimeline('req /1');
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('requirement_id=req+%2F1');

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, signed_url: 'https://signed.example/x', expires_in: 300 }));
    await getRideCompliancePreview('sub-1');
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('api=preview');

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, requirement: {}, submission: {} }));
    await approveRideComplianceSubmission('sub-1');
    let [, init] = fetchMock.mock.calls.at(-1)!;
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ submission_id: 'sub-1' });

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, requirement: {}, submission: {} }));
    await rejectRideComplianceSubmission('sub-1', 'Too dark');
    [, init] = fetchMock.mock.calls.at(-1)!;
    expect(JSON.parse(String(init?.body))).toEqual({ submission_id: 'sub-1', reason: 'Too dark' });
  });

  it.each([
    [403, 'authorization_denied'],
    [403, 'organization_membership_required'],
    [409, 'state_conflict'],
    [500, 'internal_error']
  ])('preserves HTTP %s as an error', async (status, code) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: false, error: code }, status));
    await expect(approveRideComplianceSubmission('sub-1')).rejects.toMatchObject({
      message: code,
      status,
      code
    });
  });

  it('does not convert a failed 401 refresh into success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: false, error: 'invalid_session' }, 401));
    await expect(getRideProfilePhotoRequirement()).rejects.toThrow(/session_expired|invalid_session/);
  });
});
