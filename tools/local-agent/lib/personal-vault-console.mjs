import { open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';

export function terminalText(value) {
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '');
}

export async function readImportFile(path) {
  let handle;
  try {
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink()) throw new Error();
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 1048576 || stat.ino !== before.ino || stat.dev !== before.dev) throw new Error();
    // Bounded read even if another process grows the file after stat.
    const buffer = Buffer.alloc(1048577);
    try {
      let count = 0;
      while (count < buffer.length) {
        const { bytesRead } = await handle.read(buffer, count, buffer.length - count, null);
        if (!bytesRead) break;
        count += bytesRead;
      }
      if (count > 1048576) throw new Error();
      return buffer.subarray(0, count).toString('utf8');
    } finally { buffer.fill(0); }
  } catch { throw new Error('personal_vault_import_file'); }
  finally { await handle?.close(); }
}

/** Local trusted terminal only. Deliberately offers no secret output command. */
export async function runVaultConsole({ vault, prompt, write }) {
  write('ATLAS Personal Vault · local development console');
  while (true) {
    const action = (await prompt('Action [import/search/lookup/exit]: ', false)).trim().toLowerCase();
    if (action === 'exit') return;
    if (!['import', 'search', 'lookup'].includes(action)) { write('Choose import, search, lookup or exit.'); continue; }
    let passphrase = '', csv = '';
    try {
      if (action === 'import') {
        const source = (await prompt('Source [google/apple]: ', false)).trim();
        if (!['google', 'apple'].includes(source)) { write('Unsupported source.'); continue; }
        csv = await readImportFile(await prompt('Local CSV path: ', false));
        passphrase = await prompt('Unlock passphrase: ', true);
        const result = await vault.importCsv({ source, csv, passphrase });
        write(`Imported: ${result.imported}; skipped: ${result.skipped}.`);
      } else {
        const input = await prompt(action === 'lookup' ? 'Account reference: ' : 'Search accounts: ', false);
        passphrase = await prompt('Unlock passphrase: ', true);
        let records;
        if (action === 'lookup') {
          const account = await vault.lookupReference({ reference: input, passphrase });
          records = account ? [account] : [];
        } else records = await vault.search({ query: input, passphrase });
        write(`Accounts: ${records.length}`);
        for (const a of records) write(`${terminalText(a.id)} | ${terminalText(a.title)} | ${terminalText(a.url)} | ${terminalText(a.username)} | ${terminalText(a.reference)}`);
      }
    } catch { write('Operation failed. Check unlock, file format, permissions and conflicts.'); }
    finally { passphrase = ''; csv = ''; }
  }
}
