import { prepareBrowserJob, sanitizeBrowserResult, type BrowserAction, type BrowserActionResult } from './browser-executor';
import type { BrowserExecutionEnvelope } from './browser-envelope';

export interface SovereignPage {
  goto(url: string): Promise<void>;
  url(): string;
  textContent(selector: string): Promise<string | null>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  close(): Promise<void>;
}
export interface SovereignBrowser { newPage(): Promise<SovereignPage> }
export interface SovereignContext {
  tenantId: string; organizationId: string; workflowId: string; stepId: string;
  signal?: AbortSignal;
  authorize?: () => Promise<boolean>;
}
const DENY = new Set(['submit', 'create_dns_txt', 'click_openai_check']);
function safeUrl(input: string, domain: string): string {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.hostname.toLowerCase() !== domain.toLowerCase() ||
      /^(localhost|.*\.localhost)$/.test(url.hostname) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) ||
      url.hostname.includes(':')) throw new Error('unsafe_navigation');
  return url.href;
}
function selector(input?: string): string {
  if (!input || input.length > 500) throw new Error('invalid_selector');
  return input;
}
export class SovereignBrowserAdapter {
  constructor(private readonly browser: SovereignBrowser) {}
  async execute(input: { executionEnvelope: BrowserExecutionEnvelope; action: BrowserAction }, context: SovereignContext): Promise<BrowserActionResult> {
    const { executionEnvelope: envelope, action } = input;
    if (!context.tenantId || !context.organizationId || !context.workflowId || !context.stepId ||
        envelope.tenantId !== context.tenantId || envelope.organizationId !== context.organizationId ||
        envelope.workflowId !== context.workflowId || envelope.stepId !== context.stepId) throw new Error('execution_scope_mismatch');
    if (!context.authorize) throw new Error('authorization_checker_required');
    const check = async () => {
      if (context.signal?.aborted) throw new Error('execution_cancelled');
      if (!(await context.authorize!())) throw new Error('authorization_revoked');
    };
    if (DENY.has(action.type)) throw new Error('human_approval_required');
    if (action.type === 'type') throw new Error('browser_sensitive_input_requires_vault');
    prepareBrowserJob(envelope, action);
    const destination = safeUrl(action.type === 'navigate' ? action.target ?? '' : 'https://' + action.domain + '/', action.domain);
    await check();
    const page = await this.browser.newPage();
    try {
      await check();
      await page.goto(destination);
      safeUrl(page.url(), action.domain);
      await check();
      let result: unknown = null;
      switch (action.type) {
        case 'navigate': result = { navigated: true }; break;
        case 'read_text': result = await page.textContent(selector(action.target)); break;
        case 'click': await check(); await page.click(selector(action.target)); result = { clicked: true }; break;
        case 'type': throw new Error('browser_sensitive_input_requires_vault');
        default: throw new Error('unsupported_action');
      }
      await check();
      safeUrl(page.url(), action.domain);
      return { state: 'completed', result: sanitizeBrowserResult(result) };
    } finally { await page.close(); }
  }
}
