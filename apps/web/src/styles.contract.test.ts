import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'styles.css'), 'utf8');

test('styles include accessibility, responsive, shell and spatial contracts', () => {
  expect(css).toContain(':focus-visible');
  expect(css).toContain('prefers-reduced-motion');
  expect(css).toContain('@media (max-width:');
  expect(css).toContain('.spatial-entry');
  expect(css).toContain('.atlas-shell');
  expect(css).toContain('.module-grid');
  expect(css).toContain('.lab-shell');
});
