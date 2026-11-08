import { describe, expect, it } from 'vitest';
import {
  classifyRuntimeIncident,
  sanitizeRuntimeText
} from '../../apps/web/src/runtime/runtimeIntegrity';

describe('ATLAS Runtime Integrity classification', () => {
  it('keeps browser-extension transport noise non-blocking', () => {
    expect(classifyRuntimeIncident({
      eventType: 'window-error',
      message: 'Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.',
      source: 'chrome-extension://example/content.js'
    })).toMatchObject({
      category: 'browser_extension',
      severity: 'P3',
      code: 'browser_extension_transport'
    });
  });

  it('classifies permissions-policy unload warnings without promoting them to P0', () => {
    expect(classifyRuntimeIncident({
      eventType: 'security-policy',
      message: 'Permissions policy violation: unload is not allowed in this document'
    })).toMatchObject({
      category: 'security_policy',
      severity: 'P2',
      code: 'permissions_policy_violation'
    });
  });

  it('treats React render-boundary failures as P0 application incidents', () => {
    expect(classifyRuntimeIncident({
      eventType: 'react-boundary',
      message: 'Minified React error #418'
    })).toMatchObject({
      category: 'application',
      severity: 'P0',
      code: 'react_render_failure'
    });
  });

  it('redacts bearer and query-token material before persistence', () => {
    const sanitized = sanitizeRuntimeText(
      'Authorization: Bearer example-sensitive-value https://example.test/path?token=example-sensitive-value'
    );

    expect(sanitized).not.toContain('example-sensitive-value');
    expect(sanitized).toContain('[REDACTED]');
  });
});
