import { describe, expect, it, vi } from 'vitest';
import { SovereignBrowserAdapter } from '../../packages/execution/src/sovereign-browser';
const envelope = { workflowId:'w', stepId:'s', tenantId:'t', organizationId:'o', allowedDomains:['example.com'], allowedActions:['navigate','read_text','click','type','submit'], deniedActions:[], autonomyLevel:'autonomous', expiresAt:'2099-01-01T00:00:00Z' } as const;
const context = { tenantId:'t', organizationId:'o', workflowId:'w', stepId:'s', authorize:async()=>true };
function setup() {
  const page = { goto:vi.fn(), url:vi.fn().mockReturnValue('https://example.com/'), textContent:vi.fn().mockResolvedValue('safe'), click:vi.fn(), fill:vi.fn(), close:vi.fn() };
  const browser = { newPage:vi.fn().mockResolvedValue(page) };
  return { page, browser, adapter:new SovereignBrowserAdapter(browser) };
}
const job = (action: any) => ({ executionEnvelope:{...envelope,allowedDomains:[...envelope.allowedDomains],allowedActions:[...envelope.allowedActions],deniedActions:[]},action });
describe('ATLAS Sovereign Browser fail closed', () => {
  it('rejects cross-tenant and cross-org before opening browser', async () => {
    const {adapter,browser}=setup();
    for(const changed of [{tenantId:'other'},{organizationId:'other'}]) await expect(adapter.execute(job({type:'navigate',domain:'example.com',target:'https://example.com/'}),{...context,...changed})).rejects.toThrow('execution_scope_mismatch');
    expect(browser.newPage).not.toHaveBeenCalled();
  });
  it('rejects non-allowlisted domain', async () => {
    const {adapter,browser}=setup();
    await expect(adapter.execute(job({type:'navigate',domain:'evil.com',target:'https://evil.com/'}),context)).rejects.toThrow();
    expect(browser.newPage).not.toHaveBeenCalled();
  });
  it('denies click before opening browser until transport and approval are certified', async () => {
    const {adapter,browser}=setup();
    await expect(adapter.execute(job({type:'click',domain:'example.com',target:'#confirm'}),context)).rejects.toThrow('human_approval_required');
    expect(browser.newPage).not.toHaveBeenCalled();
  });
  it('rejects reserved and internal DNS suffixes before opening a page', async () => {
    const {adapter,browser}=setup();
    for (const domain of ['service.internal','host.local','metadata.google.internal','host.test','host.invalid']) {
      const scoped = job({type:'navigate',domain,target:'https://'+domain+'/'});
      scoped.executionEnvelope.allowedDomains.push(domain);
      await expect(adapter.execute(scoped,context)).rejects.toThrow('unsafe_navigation');
    }
    expect(browser.newPage).not.toHaveBeenCalled();
  });
  it('rejects privileged submission', async () => {
    const {adapter,browser}=setup();
    await expect(adapter.execute(job({type:'submit',domain:'example.com'}),context)).rejects.toThrow('human_approval_required');
    expect(browser.newPage).not.toHaveBeenCalled();
  });
  it('rejects mismatched initial URL before opening browser', async () => {
    const {adapter,browser}=setup();
    await expect(adapter.execute(job({type:'navigate',domain:'example.com',target:'https://evil.com/'}),context)).rejects.toThrow('unsafe_navigation');
    expect(browser.newPage).not.toHaveBeenCalled();
  });
  it('closes page after read', async () => {
    const {adapter,page}=setup();
    await expect(adapter.execute(job({type:'read_text',domain:'example.com',target:'h1'}),context)).resolves.toMatchObject({state:'completed',result:'safe'});
    expect(page.close).toHaveBeenCalled();
  });
  it('rejects cancelled work before browser creation', async () => {
    const {adapter,browser}=setup();const c=new AbortController();c.abort();
    await expect(adapter.execute(job({type:'navigate',domain:'example.com',target:'https://example.com/'}),{...context,signal:c.signal})).rejects.toThrow('execution_cancelled');
    expect(browser.newPage).not.toHaveBeenCalled();
  });
  it('requires a live authorization checker', async () => {
    const {adapter,browser}=setup();
    await expect(adapter.execute(job({type:'navigate',domain:'example.com',target:'https://example.com/'}),{...context,authorize:undefined})).rejects.toThrow('authorization_checker_required');
    expect(browser.newPage).not.toHaveBeenCalled();
  });
  it('blocks revoked authorization before reading page content', async () => {
    const {adapter,page}=setup();let count=0;
    await expect(adapter.execute(job({type:'read_text',domain:'example.com',target:'h1'}),{...context,authorize:async()=>++count<3})).rejects.toThrow('authorization_revoked');
    expect(page.textContent).not.toHaveBeenCalled();
    expect(page.click).not.toHaveBeenCalled();
    expect(page.close).toHaveBeenCalled();
  });
  it('detects redirect to a different host before reading page content', async () => {
    const {adapter,page}=setup();page.url.mockReturnValue('https://evil.com/');
    await expect(adapter.execute(job({type:'read_text',domain:'example.com',target:'h1'}),context)).rejects.toThrow('unsafe_navigation');
    expect(page.textContent).not.toHaveBeenCalled();
    expect(page.click).not.toHaveBeenCalled();
  });
});
