import { describe, expect, it, vi } from 'vitest';
import { SovereignBrowserAdapter } from '../../packages/execution/src/sovereign-browser';
const envelope = { workflowId:'w', stepId:'s', tenantId:'t', organizationId:'o', allowedDomains:['example.com'], allowedActions:['navigate','read_text','click','type','submit'], deniedActions:[], autonomyLevel:'autonomous', expiresAt:'2099-01-01T00:00:00Z' } as const;
const context = { tenantId:'t', organizationId:'o', workflowId:'w', stepId:'s' };
function setup() {
  const page = { goto:vi.fn(), textContent:vi.fn().mockResolvedValue('safe'), click:vi.fn(), fill:vi.fn(), close:vi.fn() };
  const browser = { newPage:vi.fn().mockResolvedValue(page) };
  return { page, browser, adapter:new SovereignBrowserAdapter(browser) };
}
describe('ATLAS Sovereign Browser fail closed', () => {
  it('rejects cross tenant and organization before opening browser', async () => {
    const { adapter, browser } = setup();
    await expect(adapter.execute({executionEnvelope:{...envelope},action:{type:'navigate',domain:'example.com',target:'https://example.com/'}}, {...context,tenantId:'other'})).rejects.toThrow('execution_scope_mismatch');
    expect(browser.newPage).not.toHaveBeenCalled();
  });
  it('rejects non-allowlisted domain', async () => {
    const {adapter,browser}=setup();
    await expect(adapter.execute({executionEnvelope:{...envelope},action:{type:'navigate',domain:'evil.com',target:'https://evil.com/'}},context)).rejects.toThrow();
    expect(browser.newPage).not.toHaveBeenCalled();
  });
  it('rejects privileged submission even if envelope lists it', async () => {
    const {adapter,browser}=setup();
    await expect(adapter.execute({executionEnvelope:{...envelope},action:{type:'submit',domain:'example.com'}},context)).rejects.toThrow('human_approval_required');
    expect(browser.newPage).not.toHaveBeenCalled();
  });
  it('rejects cross-host redirects encoded in destination', async () => {
    const {adapter,page}=setup();
    await expect(adapter.execute({executionEnvelope:{...envelope},action:{type:'navigate',domain:'example.com',target:'https://evil.com/'}},context)).rejects.toThrow('unsafe_navigation');
    expect(page.close).toHaveBeenCalled();
  });
  it('closes browser after successful read', async () => {
    const {adapter,page}=setup();
    await expect(adapter.execute({executionEnvelope:{...envelope},action:{type:'read_text',domain:'example.com',target:'h1'}},context)).resolves.toMatchObject({state:'completed',result:'safe'});
    expect(page.close).toHaveBeenCalled();
  });
  it('rejects cancelled work before opening browser', async () => {
    const {adapter,browser}=setup();
    const controller=new AbortController();controller.abort();
    await expect(adapter.execute({executionEnvelope:{...envelope},action:{type:'navigate',domain:'example.com',target:'https://example.com/'}},{...context,signal:controller.signal})).rejects.toThrow('execution_cancelled');
    expect(browser.newPage).not.toHaveBeenCalled();
  });
});
