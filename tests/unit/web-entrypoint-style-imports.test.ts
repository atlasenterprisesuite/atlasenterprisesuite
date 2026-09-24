import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const entrypointPath = resolve(process.cwd(), 'apps/web/src/main.tsx');
const payablesStylesheetPath = resolve(process.cwd(), 'apps/web/src/modules/finance/accounting/payables-ai.css');

describe('web entrypoint stylesheet imports', () => {
  it('imports the existing Accounts Payable stylesheet with the canonical path', () => {
    const entrypoint = readFileSync(entrypointPath, 'utf8');

    expect(existsSync(payablesStylesheetPath)).toBe(true);
    expect(entrypoint).toContain("import './modules/finance/accounting/payables-ai.css';");
    expect(entrypoint).not.toContain('paayables-ai.css');
  });
});
