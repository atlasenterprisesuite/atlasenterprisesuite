import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

test('spatial entry exposes the real ATLAS Health route without requiring WebGL', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter>);

  expect(screen.getByRole('heading', { name: /ATLAS Enterprise Suite/i })).toBeInTheDocument();
  expect(screen.getByText(/governed enterprise intelligence/i)).toBeInTheDocument();

  await user.click(screen.getByRole('link', { name: /enter ATLAS Health/i }));
  expect(screen.getByRole('heading', { name: /^ATLAS Health$/i })).toBeInTheDocument();
});
