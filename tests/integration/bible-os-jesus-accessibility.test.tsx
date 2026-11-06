// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { BibleOSPage } from '../../apps/web/src/modules/knowledge/bible/BibleOSPage';

afterEach(cleanup);

describe('Bible OS Jesus view accessibility interaction', () => {
  it('does not default to religious content and exposes a named keyboard-operable view control', () => {
    render(createElement(BibleOSPage));
    const control = screen.getByRole('button', { name: 'Life & Teachings of Jesus' });
    expect(control.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('heading', { name: 'Life and teachings of Jesus' })).toBeNull();
    control.focus();
    expect(document.activeElement).toBe(control);
    fireEvent.keyDown(control, { key: 'Enter', code: 'Enter' });
    // Native buttons are keyboard activatable in browsers; click models activation in jsdom.
    fireEvent.click(control);
    expect(control.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Life and teachings of Jesus' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Evidence sources' })).toBeTruthy();
  });
});
