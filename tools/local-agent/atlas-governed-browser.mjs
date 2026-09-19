#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNTIME_PATH = join(HERE, 'atlas-work-browser-runtime.mjs');
const PORT = Number(process.env.ATLAS_BROWSER_CDP_PORT || 9222);
const PROFILE_DIR = String(process.env.ATLAS_BROWSER_PROFILE_DIR || join(homedir(), '.atlas', 'governed-browser-profile')).trim();

function browserCandidates() {
  const explicit = String(process.env.ATLAS_CHROME_BIN || '').trim();
  const candidates = explicit ? [explicit] : [];
  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else if (process.platform === 'win32') {
    for (const root of [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']].filter(Boolean)) {
      candidates.push(
        join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        join(root, 'Google', 'Chrome for Testing', 'Application', 'chrome.exe'),
        join(root, 'Chromium', 'Application', 'chrome.exe')
      );
    }
  } else {
    candidates.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  }
  return [...new Set(candidates)];
}

function resolveBrowser() {
  const path = browserCandidates().find((candidate) => existsSync(candidate));
  if (!path) throw new Error('chrome_not_found_set_ATLAS_CHROME_BIN');
  return path;
}

async function waitForCdp(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(new URL('/json/version', url), { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('chrome_cdp_not_ready');
}

function terminate(child) {
  if (!child || child.killed) return;
  try { child.kill('SIGTERM'); } catch {}
}

async function main() {
  if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) throw new Error('invalid_browser_cdp_port');
  if (!process.env.ATLAS_WORK_RUNTIME_ID || !process.env.ATLAS_WORK_RUNTIME_TOKEN) {
    throw new Error('atlas_work_runtime_credentials_required');
  }

  mkdirSync(PROFILE_DIR, { recursive: true, mode: 0o700 });
  const chrome = resolveBrowser();
  const cdpUrl = `http://127.0.0.1:${PORT}`;
  const browser = spawn(chrome, [
    `--remote-debugging-address=127.0.0.1`,
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  browser.once('error', () => {
    process.stderr.write('ATLAS Governed Browser could not start Chrome.\n');
  });

  await waitForCdp(cdpUrl);
  const runtime = spawn(process.execPath, [RUNTIME_PATH], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ATLAS_BROWSER_CDP_URL: cdpUrl
    }
  });

  const shutdown = () => {
    terminate(runtime);
    terminate(browser);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  const exitCode = await new Promise((resolve) => {
    runtime.once('exit', (code) => resolve(Number.isInteger(code) ? code : 1));
    runtime.once('error', () => resolve(1));
  });
  terminate(browser);
  process.exitCode = exitCode;
}

main().catch((error) => {
  process.stderr.write(`ATLAS Governed Browser launcher stopped: ${String(error?.message || 'launcher_error')}\n`);
  process.exitCode = 1;
});
