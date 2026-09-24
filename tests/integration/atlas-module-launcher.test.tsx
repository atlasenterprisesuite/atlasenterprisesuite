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
    const label = screen.getByText(module.displayName, { selector: 'strong' });
    expect(label.closest('a')).toHaveAttribute('href', module.route);
  }
  expect(screen.getAllByRole('link')).toHaveLength(ATLAS_MODULE_CATALOG.length);
});
