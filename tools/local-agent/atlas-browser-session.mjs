#!/usr/bin/env node
import { startBrowserSession } from './lib/browser-cdp.mjs';

try {
  const session = await startBrowserSession();
  process.stdout.write(
    session.alreadyRunning
      ? `ATLAS Browser Session already running on loopback port ${session.port}.\n`
      : `ATLAS Browser Session started on loopback port ${session.port}. Sign in only inside this dedicated browser profile.\n`
  );
} catch (error) {
  process.stderr.write(`ATLAS Browser Session failed: ${String(error?.message || 'browser_session_failed')}\n`);
  process.exitCode = 1;
}
