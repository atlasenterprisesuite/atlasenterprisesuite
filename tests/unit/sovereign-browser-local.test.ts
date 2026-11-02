import { describe, it, expect, vi } from 'vitest';
import { approvedUrl, installNetworkGuard, resolvePublicDns } from '../../packages/execution/src/network-policy';
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
  it('does not invoke egress authorization for a forbidden POST',async()=>{
    let handler: (route:any)=>Promise<void> = async()=>{};
    const authorize=vi.fn().mockResolvedValue(true);
    const route={request:()=>({url:()=> 'https://example.com/',method:()=> 'POST'}),abort:vi.fn(),continue:vi.fn()};
    await installNetworkGuard({route:async (_pattern,h)=>{handler=h;}},allowed,{authorize});
    await handler(route);
    expect(authorize).not.toHaveBeenCalled();
    expect(route.abort).toHaveBeenCalledOnce();
    expect(route.continue).not.toHaveBeenCalled();
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
  it('does not continue GET on a URL-level allow decision without socket pinning',async()=>{
    let handler: (route:any)=>Promise<void> = async()=>{};
    const route={request:()=>({url:()=> 'https://example.com/',method:()=> 'GET'}),abort:vi.fn(),continue:vi.fn()};
    await installNetworkGuard({route:async (_pattern,h)=>{handler=h;}},allowed,{authorize:async()=>true});
    await handler(route);
    expect(route.abort).toHaveBeenCalledOnce();
    expect(route.continue).not.toHaveBeenCalled();
  });

  it('fails closed even when an unbound boolean egress approval returns true',async()=>{
    let handler: (route:any)=>Promise<void> = async()=>{};
    const route={request:()=>({url:()=> 'https://example.com/',method:()=> 'GET'}),abort:vi.fn(),continue:vi.fn()};
    const authorize=vi.fn().mockResolvedValue(true);
    await installNetworkGuard({route:async (_pattern,h)=>{handler=h;}},allowed,{authorize});
    await handler(route);
    // A URL-level boolean does not pin the browser socket to a validated IP.
    expect(route.abort).toHaveBeenCalledOnce();
    expect(route.continue).not.toHaveBeenCalled();
  });


  // DNS answers are untrusted even when the HTTPS hostname is allowlisted.
  // The resolver is injected so these negative cases perform no network I/O.
  it.each([
    '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '192.0.0.8', '192.0.0.170', '192.0.0.171',
    '192.0.2.1', '198.18.0.1', '198.51.100.2', '203.0.113.2',
    '224.0.0.1', '255.255.255.255', 'not-an-ip'
  ])('denies unsafe DNS A record %s', async address => {
    await expect(resolvePublicDns('https://example.com/', allowed, {
      resolve4: async () => [address], resolve6: async () => []
    })).rejects.toThrow('network_dns_address_denied');
  });
  it.each(['::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1', '2001:db8::1', '2002::1'])(
    'denies unsafe DNS AAAA record %s', async address => {
      await expect(resolvePublicDns('https://example.com/', allowed, {
        resolve4: async () => ['8.8.8.8'], resolve6: async () => [address]
      })).rejects.toThrow('network_dns_address_denied');
    }
  );
  it('rejects mixed public and private answers instead of selecting a safe subset', async () => {
    await expect(resolvePublicDns('https://example.com/', allowed, {
      resolve4: async () => ['8.8.8.8', '10.1.2.3'], resolve6: async () => []
    })).rejects.toThrow('network_dns_address_denied');
  });
  it('fails closed on DNS resolver failure or empty answer sets', async () => {
    await expect(resolvePublicDns('https://example.com/', allowed, {
      resolve4: async () => { throw new Error('SERVFAIL'); }, resolve6: async () => []
    })).rejects.toThrow('network_dns_lookup_failed');
    await expect(resolvePublicDns('https://example.com/', allowed, {
      resolve4: async () => [], resolve6: async () => []
    })).rejects.toThrow('network_dns_empty');
  });
  it('accepts only bounded public A/AAAA answers as preflight evidence, not socket authorization', async () => {
    const verified = await resolvePublicDns('https://example.com/', allowed, {
      resolve4: async () => ['8.8.8.8'], resolve6: async () => ['2606:4700:4700::1111']
    });
    expect(verified).toEqual({ hostname: 'example.com', addresses: ['8.8.8.8', '2606:4700:4700::1111'] });
  });
  it('normalizes an allowed absolute DNS name before resolving its addresses', async () => {
    const resolve4 = vi.fn().mockResolvedValue(['8.8.8.8']);
    const resolve6 = vi.fn().mockResolvedValue([]);
    const result = await resolvePublicDns('https://example.com./', allowed, { resolve4, resolve6 });
    expect(resolve4).toHaveBeenCalledWith('example.com');
    expect(result.hostname).toBe('example.com');
  });
});
