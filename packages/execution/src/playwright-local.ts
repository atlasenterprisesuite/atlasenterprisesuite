import type { SovereignBrowser, SovereignPage } from './sovereign-browser';
import { approvedUrl, installNetworkGuard } from './network-policy';

export interface PlaywrightBrowserLike {
  newContext(options: { serviceWorkers: 'block'; acceptDownloads: false; javaScriptEnabled: boolean }): Promise<{
    route(pattern: string, handler: (route: any) => Promise<void>): Promise<unknown>;
    newPage(): Promise<{ goto(url: string, options?: { waitUntil: 'domcontentloaded' }): Promise<unknown>; url(): string; textContent(selector: string): Promise<string | null>; click(selector: string): Promise<void>; fill(selector: string, value: string): Promise<void> }>;
    close(): Promise<void>;
  }>;
}
/** Adapter for a locally supplied Playwright Browser; never launches or downloads browsers. */
export class PlaywrightLocalBrowser implements SovereignBrowser {
  constructor(private readonly browser: PlaywrightBrowserLike, private readonly allowedDomains: readonly string[]) {}
  async newPage(): Promise<SovereignPage> {
    const context = await this.browser.newContext({ serviceWorkers: 'block', acceptDownloads: false, javaScriptEnabled: false });
    try {
      await installNetworkGuard(context, this.allowedDomains);
      const page = await context.newPage();
      return {
        goto: async (url: string) => { approvedUrl(url, this.allowedDomains); await page.goto(url, { waitUntil: 'domcontentloaded' }); approvedUrl(page.url(), this.allowedDomains); },
        url: () => page.url(),
        textContent: (selector: string) => page.textContent(selector),
        click: async (selector: string) => { await page.click(selector); approvedUrl(page.url(), this.allowedDomains); },
        fill: async (selector: string, value: string) => { await page.fill(selector, value); approvedUrl(page.url(), this.allowedDomains); },
        close: () => context.close()
      };
    } catch (error) { await context.close(); throw error; }
  }
}
