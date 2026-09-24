import { afterEach, describe, expect, it } from 'vitest';
import {
  assistantElementLabel,
  describeAssistantElement,
  serializeAssistantElementContext,
  startAssistantElementPicker
} from '../../apps/web/src/assistant/elementContext';

describe('ATLAS Assistant element context', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
  });

  it('captures structural metadata without values or visible business data', () => {
    document.body.innerHTML = `
      <main>
        <input id="vendor-email" name="vendorEmail" aria-label="Vendor email" placeholder="name@example.com" value="secret@vendor.com" />
        <table id="payments"><tbody><tr><td>Private Vendor</td><td>$250,000</td></tr></tbody></table>
      </main>
    `;

    const input = document.getElementById('vendor-email') as HTMLElement;
    const context = describeAssistantElement(input);
    const serialized = serializeAssistantElementContext(context);

    expect(context).toMatchObject({
      tag: 'input',
      id: 'vendor-email',
      name: 'vendorEmail',
      label: null,
      placeholder: null
    });
    expect(serialized).not.toContain('secret@vendor.com');
    expect(serialized).not.toContain('Vendor email');
    expect(serialized).not.toContain('name@example.com');
    expect(serialized).not.toContain('Private Vendor');
    expect(serialized).not.toContain('$250,000');
    expect(assistantElementLabel(context)).toBe('vendor-email');
  });

  it('selects an element without activating its normal click action', () => {
    document.body.innerHTML = `
      <main>
        <button id="approve-payment" data-atlas-component="approvalAction" aria-label="Approve payment">Approve</button>
      </main>
    `;
    const button = document.getElementById('approve-payment') as HTMLButtonElement;
    let normalClicks = 0;
    let selected = '';
    button.addEventListener('click', () => { normalClicks += 1; });

    startAssistantElementPicker({
      onSelect: (context) => { selected = assistantElementLabel(context); }
    });

    button.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(button).toHaveClass('atlas-assistant-element-hover');

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(selected).toBe('approvalAction');
    expect(normalClicks).toBe(0);
    expect(button).not.toHaveClass('atlas-assistant-element-hover');
    expect(document.body).not.toHaveClass('atlas-assistant-picking');
  });

  it('never allows the assistant surface or explicitly private regions to become targets', () => {
    document.body.innerHTML = `
      <div class="atlas-assistant-root"><button id="assistant-button">Assistant</button></div>
      <section data-private="true"><button id="private-button">Private action</button></section>
      <button id="public-button" data-atlas-component="publicAction">Public action</button>
    `;

    let selected = '';
    const cleanup = startAssistantElementPicker({
      onSelect: (context) => { selected = assistantElementLabel(context); }
    });

    document.getElementById('assistant-button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.getElementById('private-button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(selected).toBe('');

    document.getElementById('public-button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(selected).toBe('publicAction');
    cleanup();
  });
});
