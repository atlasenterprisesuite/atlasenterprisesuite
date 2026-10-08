import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TaxDepreciationPractice } from '../../apps/web/src/modules/tax/TaxDepreciationPractice';

const key = 'atlas-tax-learning-2025-depreciation-v1';
const labels = [
  'Base inicial de la impresora ($)',
  'Depreciación especial de 2025 ($)',
  'Ganancia neta revisada de Schedule C ($)'
];
function answer(values: string[]) {
  values.forEach((value, index) => fireEvent.change(screen.getByLabelText(labels[index]), { target: { value } }));
}
function submit() {
  fireEvent.submit(screen.getByRole('button', { name: 'Comprobar depreciación' }).closest('form')!);
}
beforeEach(() => { cleanup(); window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Tax depreciation practice', () => {
  it('does not reveal solutions before a valid attempt', () => {
    render(<TaxDepreciationPractice />);
    expect(screen.queryByRole('status')).toBeNull();
    submit();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('scores each answer, hides feedback on edit, and persists the best score', () => {
    render(<TaxDepreciationPractice />);
    answer(['900', '960', '9740']);
    submit();
    expect(screen.getByRole('status').textContent).toContain('Aciertos: 2/3 · 67%');
    expect(screen.getByRole('status').textContent).toContain('Repasar');
    fireEvent.change(screen.getByLabelText(labels[0]), { target: { value: '960' } });
    expect(screen.queryByRole('status')).toBeNull();
    submit();
    expect(screen.getByRole('status').textContent).toContain('Aciertos: 3/3 · 100%');
    expect(JSON.parse(window.localStorage.getItem(key)!)).toEqual({ attempts: 2, best: 3 });
  });

  it('restores counters, not solutions, and tolerates malformed storage', () => {
    window.localStorage.setItem(key, JSON.stringify({ attempts: 4, best: 2 }));
    const view = render(<TaxDepreciationPractice />);
    expect(screen.getByText(/Intentos en este navegador: 4/)).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    view.unmount();
    window.localStorage.setItem(key, 'broken json');
    render(<TaxDepreciationPractice />);
    expect(screen.getByText(/Intentos en este navegador: 0/)).toBeTruthy();
  });

  it('works when local storage writes are denied and reports the limitation', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<TaxDepreciationPractice />);
    answer(['960', '960', '9740']);
    submit();
    expect(screen.getByRole('status').textContent).toContain('Aciertos: 3/3 · 100%');
    expect(screen.getByText(/El navegador no permitió guardar/)).toBeTruthy();
  });
});
