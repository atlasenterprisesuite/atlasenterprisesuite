// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import { ATLAS_MODULE_CATALOG } from '../../apps/web/src/app/modules/moduleCatalog';
import { EnterpriseHome } from '../../apps/web/src/modules/home/EnterpriseHome';

afterEach(cleanup);

test('renders one canonical launcher link for every approved ATLAS product module', () => {
  render(
    <MemoryRouter>
      <EnterpriseHome />
    </MemoryRouter>,
  );

  for (const module of ATLAS_MODULE_CATALOG) {
    expect(screen.getByRole('link', { name: new RegExp(module.displayName, 'i') })).toHaveAttribute('href', module.route);
  }
  expect(screen.getAllByRole('link')).toHaveLength(18);
});
