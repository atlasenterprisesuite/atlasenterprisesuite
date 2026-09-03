import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';

test('renders the ATLAS enterprise root', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>
  );

  expect(screen.getByRole('heading', { name: /ATLAS Enterprise Suite/i })).toBeInTheDocument();
});
