import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendAssistantWorkspaceMessage } from '../../apps/web/src/assistant/client';
import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../apps/web/src/lib/atlasSession';

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  authorizedAtlasFetch: vi.fn(),
  getActiveAtlasOrganization: vi.fn()
}));

const fetchMock = vi.mocked(authorizedAtlasFetch);
const orgMock = vi.mocked(getActiveAtlasOrganization);
const input = { message: 'synthetic request', mode: 'auto', profile: 'deep', executionMode: 'interactive' } as const;

beforeEach(() => {
  vi.resetAllMocks();
  orgMock.mockResolvedValue({ id: 'synthetic-org', role: 'member' });
});

describe('Assistant workspace HTTP cancellation contract', () => {
  it('forwards the exact signal and organization scope', async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, text: 'synthetic result' })));
    await expect(sendAssistantWorkspaceMessage({ ...input, signal: controller.signal })).resolves.toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/functions/v1/atlas-copilot?api=chat');
    expect(init?.signal).toBe(controller.signal);
    expect(init?.headers).toMatchObject({ 'x-atlas-org-id': 'synthetic-org' });
    expect(JSON.parse(String(init?.body))).toMatchObject({ organization_id: 'synthetic-org', execution_mode: 'interactive' });
  });
  it('rejects pre-aborted requests without resolving identity or sending HTTP', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sendAssistantWorkspaceMessage({ ...input, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(orgMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not send HTTP if cancelled during organization lookup', async () => {
    const controller = new AbortController();
    orgMock.mockImplementationOnce(async () => {
      controller.abort();
      return { id: 'synthetic-org', role: 'member' };
    });
    await expect(sendAssistantWorkspaceMessage({ ...input, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('propagates transport cancellation', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(async (_path, init) => {
      controller.abort();
      init?.signal?.throwIfAborted();
      throw new Error('expected cancellation');
    });
    await expect(sendAssistantWorkspaceMessage({ ...input, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
