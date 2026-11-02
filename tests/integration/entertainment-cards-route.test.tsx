import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EventsRoutes } from '../../apps/web/src/modules/events/EventsRoutes';
const session = vi.hoisted(() => ({ token: '', organization: vi.fn(), clear: vi.fn() }));
vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  getAtlasAccessToken: () => session.token,
  getActiveAtlasOrganization: session.organization,
  clearAtlasSession: session.clear
}));
vi.mock('../../apps/web/src/components/AtlasShell', () => ({ AtlasShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
function open(path = '/events/cards') {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/identity" element={<h1>Identity required</h1>} />
    <Route path="*" element={<EventsRoutes />} />
  </Routes></MemoryRouter>);
}
beforeEach(() => { session.token = ''; session.organization.mockReset(); session.clear.mockReset(); });
afterEach(cleanup);
it('denies the cards route without credentials', async () => {
  open();
  expect(await screen.findByRole('heading', { name: 'Identity required' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Carta Mayor' })).not.toBeInTheDocument();
  expect(session.organization).not.toHaveBeenCalled();
});
it('denies rejected membership and clears the session', async () => {
  session.token = 'test-only';
  session.organization.mockRejectedValue(new Error('Membership revoked'));
  open();
  expect(await screen.findByRole('heading', { name: 'Identity required' })).toBeInTheDocument();
  expect(session.clear).toHaveBeenCalledOnce();
});
it('does not expose the table while membership verification is pending', async () => {
  session.token = 'test-only';
  let release!: (value: unknown) => void;
  session.organization.mockReturnValue(new Promise(resolve => { release = resolve; }));
  open();
  expect(screen.queryByRole('heading', { name: 'Carta Mayor' })).not.toBeInTheDocument();
  release({ id: 'test-org' });
  expect(await screen.findByRole('heading', { name: 'Carta Mayor' })).toBeInTheDocument();
});
it('navigates from Events to the game and back through the identity gate', async () => {
  session.token = 'test-only';
  session.organization.mockResolvedValue({ id: 'test-org' });
  open('/events');
  fireEvent.click(await screen.findByRole('link', { name: /Carta Mayor/ }));
  expect(await screen.findByRole('heading', { name: 'Carta Mayor' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Jugar / })).toHaveLength(5);
  fireEvent.click(screen.getByRole('link', { name: /Events & Entertainment/ }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Live entertainment operating system' })).toBeInTheDocument());
});
