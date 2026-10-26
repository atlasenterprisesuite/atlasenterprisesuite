// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HumanFlourishingPage } from '../../apps/web/src/modules/wellbeing/HumanFlourishingPage';

afterEach(cleanup);
function mount() {
  return render(<MemoryRouter><HumanFlourishingPage /></MemoryRouter>);
}
describe('Human Flourishing 777 interface', () => {
  it('starts secular and does not display Christian content without explicit selection', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Secular' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText(/Santiago 1:5/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Reflexión personal' })).toBeTruthy();
  });
  it('requires an explicit click to reveal faith content and permits revocation', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Cristiana (opcional)' }));
    expect(screen.getByText(/Santiago 1:5/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Secular' }));
    expect(screen.queryByText(/Santiago 1:5/)).toBeNull();
  });
  it('renders seven navigable dimensions with accessible toggle controls', () => {
    mount();
    const cards = screen.getAllByRole('button', { name: 'Ver una sugerencia' });
    expect(cards).toHaveLength(7);
    expect(screen.getAllByRole('link', { name: 'Explorar módulo relacionado' })).toHaveLength(7);
    const button = cards[0];
    const id = button.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.hidden).toBe(true);
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(id!)?.hidden).toBe(false);
    fireEvent.click(button);
    expect(document.getElementById(id!)?.hidden).toBe(true);
  });
  it('does not write to browser storage when changing modes and dimensions', () => {
    const localSpy = vi.spyOn(Storage.prototype, 'setItem');
    try {
      mount();
      fireEvent.click(screen.getByRole('button', { name: 'Cristiana (opcional)' }));
      fireEvent.click(screen.getAllByRole('button', { name: 'Ver una sugerencia' })[0]);
      expect(localSpy).not.toHaveBeenCalled();
    } finally { localSpy.mockRestore(); }
  });
});
