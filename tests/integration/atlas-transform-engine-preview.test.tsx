// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TransformSpritePreview } from '../../apps/web/src/modules/creator/director/motion/transform/TransformSpritePreview';

describe('Transform Engine isolated React preview', () => {
  it('rejects remote and encoded resource paths', () => {
    const { rerender } = render(<TransformSpritePreview src="https://example.com/frames.png" />);
    expect(screen.getByRole('alert').textContent).toMatch(/no autorizado/);
    rerender(<TransformSpritePreview src="/atlas/%2e%2e/frames.png" />);
    expect(screen.getByRole('alert').textContent).toMatch(/no autorizado/);
  });

  it('fails closed when the PNG cannot be loaded', () => {
    const { container } = render(<TransformSpritePreview src="/atlas/transform/frames.png" />);
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByRole('alert').textContent).toMatch(/spritesheet/);
    expect(screen.getByRole('button', { name: 'Siguiente' }).hasAttribute('disabled')).toBe(true);
  });

  it('enables keyboard-operable frame controls only for a valid PNG grid', () => {
    const { container } = render(<TransformSpritePreview src="/atlas/transform/frames.png" />);
    const image = container.querySelector('img')!;
    Object.defineProperties(image, { naturalWidth: { configurable: true, value: 477 }, naturalHeight: { configurable: true, value: 357 } });
    fireEvent.load(image);
    const next = screen.getByRole('button', { name: 'Siguiente' });
    expect(next.hasAttribute('disabled')).toBe(false);
    fireEvent.click(next);
    expect(screen.getByRole('img', { name: /fotograma 2 de 9/ })).toBeTruthy();
  });

  it('rejects a PNG whose dimensions are not divisible by the grid', () => {
    const { container } = render(<TransformSpritePreview src="/atlas/transform/frames.png" />);
    const image = container.querySelector('img')!;
    Object.defineProperties(image, { naturalWidth: { configurable: true, value: 478 }, naturalHeight: { configurable: true, value: 358 } });
    fireEvent.load(image);
    expect(screen.getByRole('alert').textContent).toMatch(/spritesheet/);
  });
});
