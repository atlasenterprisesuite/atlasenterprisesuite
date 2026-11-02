import { describe, it, expect, vi } from 'vitest';
import { approvedUrl, installNetworkGuard } from '../../packages/execution/src/network-policy';
import { executeOnce } from '../../packages/execution/src/idempotency';
import { PlaywrightLocalBrowser } from '../../packages/execution/src/playwright-local';
describe('Sovereign browser local transport negative gates', () => {
  const allowed=['example.com'];
  it.each(['http://example.com','https://127.0.0.1','https://[::1]','https://localhost','https://169.254.169.254','https://metadata.google.internal','https://example.com.evil.org','file:///etc/passwd','https://user:pass@example.com'])('denies destination %s', raw => {
    expect(() => approvedUrl(raw,allowed)).toThrow();
  });
  it('accepts only exact allowlisted HTTPS',()=>expect(approvedUrl('https://example.com/',allowed).hostname).toBe('example.com'));
  it('aborts a disallowed POST', async()=>{
    let handler: (route:any)=>Promise<void> = async()=>{};
    const route={request:()=>({url:()=> 'https://example.com/',method:()=> 'POST'}),abort:vi.fn(),continue:vi.fn()};
    await installNetworkGuard({route:async (_pattern,h)=>{handler=h;}},allowed);
    await handler(route);expect(route.abort).toHaveBeenCalledOnce();expect(route.continue).not.toHaveBeenCalled();
  });
  it('rejects duplicate execution before side effects',async()=>{
    const claim=vi.fn().mockResolvedValue('duplicate');
    const run=vi.fn();
    await expect(executeOnce({claim,complete:vi.fn(),fail:vi.fn()},{tenantId:'t',organizationId:'o',key:'k'},run)).rejects.toThrow('duplicate_execution');
    expect(run).not.toHaveBeenCalled();
  });
  it('requires isolated browser context',async()=>{
    const context={route:vi.fn(),newPage:vi.fn().mockResolvedValue({goto:vi.fn(),url:()=> 'https://example.com/',textContent:vi.fn(),click:vi.fn(),fill:vi.fn()}),close:vi.fn()};
    const newContext=vi.fn().mockResolvedValue(context);
    const browser=new PlaywrightLocalBrowser({newContext},allowed);
    const page=await browser.newPage();
    expect(newContext).toHaveBeenCalledWith({serviceWorkers:'block',acceptDownloads:false,javaScriptEnabled:false});
    await page.close();expect(context.close).toHaveBeenCalled();
  });
  it('denies a redirected final navigation outside the allowlist',async()=>{
    const context={route:vi.fn(),newPage:vi.fn().mockResolvedValue({
      goto:vi.fn(),url:()=> 'https://evil.example/',textContent:vi.fn(),click:vi.fn(),fill:vi.fn()
    }),close:vi.fn()};
    const browser=new PlaywrightLocalBrowser({newContext:vi.fn().mockResolvedValue(context)},allowed);
    const page=await browser.newPage();
    await expect(page.goto('https://example.com/')).rejects.toThrow('network_destination_denied');
    await page.close();
  });
  it('rejects disallowed initial navigation before touching the browser',async()=>{
    const goto=vi.fn();
    const context={route:vi.fn(),newPage:vi.fn().mockResolvedValue({
      goto,url:()=> 'https://example.com/',textContent:vi.fn(),click:vi.fn(),fill:vi.fn()
    }),close:vi.fn()};
    const browser=new PlaywrightLocalBrowser({newContext:vi.fn().mockResolvedValue(context)},allowed);
    const page=await browser.newPage();
    await expect(page.goto('https://other.example/')).rejects.toThrow('network_destination_denied');
    expect(goto).not.toHaveBeenCalled();
    await page.close();
  });

  it('fails closed without a trusted DNS-aware egress decision',async()=>{
    let handler: (route:any)=>Promise<void> = async()=>{};
    const route={request:()=>({url:()=> 'https://example.com/',method:()=> 'GET'}),abort:vi.fn(),continue:vi.fn()};
    await installNetworkGuard({route:async (_pattern,h)=>{handler=h;}},allowed);
    await handler(route);
    expect(route.abort).toHaveBeenCalledOnce();
    expect(route.continue).not.toHaveBeenCalled();
  });
  it('blocks egress denied by trusted policy despite allowlisted hostname',async()=>{
    let handler: (route:any)=>Promise<void> = async()=>{};
    const route={request:()=>({url:()=> 'https://example.com/',method:()=> 'GET'}),abort:vi.fn(),continue:vi.fn()};
    const authorize=vi.fn().mockResolvedValue(false);
    await installNetworkGuard({route:async (_pattern,h)=>{handler=h;}},allowed,{authorize});
    await handler(route);
    expect(authorize).toHaveBeenCalledOnce();
    expect(route.abort).toHaveBeenCalledOnce();
    expect(route.continue).not.toHaveBeenCalled();
  });
  it('allows GET only after explicit trusted egress authorization',async()=>{
    let handler: (route:any)=>Promise<void> = async()=>{};
    const route={request:()=>({url:()=> 'https://example.com/',method:()=> 'GET'}),abort:vi.fn(),continue:vi.fn()};
    await installNetworkGuard({route:async (_pattern,h)=>{handler=h;}},allowed,{authorize:async()=>true});
    await handler(route);
    expect(route.continue).toHaveBeenCalledOnce();
    expect(route.abort).not.toHaveBeenCalled();
  });

});
