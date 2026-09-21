import { afterEach, describe, expect, it } from 'vitest';
import { collectAssistantPageContext, serializeAssistantPageContext } from '../../apps/web/src/assistant/pageContext';

describe('ATLAS Assistant structural page context', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.title = '';
  });

  it('captures useful screen structure without form or table values', () => {
    document.title = 'ATLAS Accounts Payable';
    document.body.innerHTML = `
      <main>
        <h1>Pending Payment Approvals</h1>
        <button aria-pressed="true">Approvals</button>
        <div role="alert">Vendor balance failed to load</div>
        <input value="super-secret-input-value" />
        <table><tbody><tr><td>Private supplier $250,000</td></tr></tbody></table>
      </main>
    `;

    const context = collectAssistantPageContext('/finance/accounting/accounts-payable');
    const serialized = serializeAssistantPageContext(context);

    expect(context.pathname).toBe('/finance/accounting/accounts-payable');
    expect(context.headings).toContain('Pending Payment Approvals');
    expect(context.activeControls).toContain('Approvals');
    expect(context.alertCount).toBe(1);
    expect(serialized).not.toContain('super-secret-input-value');
    expect(serialized).not.toContain('Private supplier');
    expect(serialized).not.toContain('Vendor balance failed to load');
  });
});
