import React from 'react';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { VoiceHomePage } from '../../apps/web/src/modules/voice/VoiceHomePage';

const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');

describe('ATLAS Voice first-class routing', () => {
  it('registers Voice as a visible authenticated top-level module', () => {
    const voiceBlock = registry.slice(registry.indexOf("id: 'voice'"), registry.indexOf("id: 'hospitality'"));
    expect(voiceBlock).toContain("route: '/voice'");
    expect(voiceBlock).toContain('requiresAuth: true');
    expect(voiceBlock).toContain('showInNavigation: true');
  });

  it('mounts every /voice route behind ATLAS Identity', () => {
    expect(resolver).toContain("pathname === '/voice' || pathname.startsWith('/voice/')");
    expect(resolver).toContain('<RequireAtlasIdentity><VoiceRoutes /></RequireAtlasIdentity>');
  });

  it('surfaces the governed Voice Assistant and Personal Voice entry points', () => {
    render(<MemoryRouter><VoiceHomePage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Voice Assistant/i })).toHaveAttribute('href', '/voice/assistant');
    expect(screen.getByRole('link', { name: /Personal Voice/i })).toHaveAttribute('href', '/voice/personal-voice');
    expect(screen.getByText(/Passive always-on wake-word listening is not claimed/i)).toBeInTheDocument();
  });
});
