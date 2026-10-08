import React from 'react';
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasWelcomeExperience } from '../../apps/web/src/components/AtlasWelcomeExperience';

class FakeUtterance {
  lang = '';
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function showWelcome() {
  return render(<MemoryRouter><AtlasWelcomeExperience /></MemoryRouter>);
}

describe('ATLAS avatar welcome on canonical home', () => {
  it('reuses the approved avatar, keeps navigation working, and never autoplays audio', () => {
    const speak = vi.fn();
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() });

    showWelcome();

    expect(screen.getByRole('heading', { name: 'Bienvenido a ATLAS' })).toBeInTheDocument();
    expect(document.querySelector('img[src="/assets/atlas-voice-avatar-approved.webp"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Explorar módulos' })).toHaveAttribute('href', '/suite');
    expect(screen.getByRole('link', { name: 'Abrir ATLAS Voice' })).toHaveAttribute('href', '/studio/voice');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/identity');
    expect(speak).not.toHaveBeenCalled();
  });

  it('starts browser speech only on a direct click and lets the user stop it', () => {
    const speak = vi.fn((utterance: FakeUtterance) => utterance.onstart?.());
    const cancel = vi.fn();
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('speechSynthesis', { speak, cancel });

    showWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Escuchar bienvenida' }));

    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0];
    expect(utterance.lang).toBe('es-ES');
    expect(utterance.text).toContain('Soy ATLAS');
    expect(screen.getByRole('status')).toHaveTextContent('Reproduciendo bienvenida');

    fireEvent.click(screen.getByRole('button', { name: 'Detener voz' }));
    expect(cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Escuchar bienvenida' })).toBeInTheDocument();
  });

  it('changes captions and voice language without activating the microphone', () => {
    const speak = vi.fn();
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() });

    showWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('heading', { name: 'Welcome to ATLAS' })).toBeInTheDocument();
    expect(screen.getByLabelText('Welcome captions')).toHaveTextContent("I'm ATLAS");
    fireEvent.click(screen.getByRole('button', { name: 'Hear welcome' }));
    expect(speak.mock.calls[0][0].lang).toBe('en-US');
  });

  it('provides a readable fallback when device speech is unavailable', () => {
    vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    vi.stubGlobal('speechSynthesis', undefined);

    showWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Escuchar bienvenida' }));
    expect(screen.getByRole('status')).toHaveTextContent('La voz no está disponible');
    expect(screen.getByLabelText('Subtítulos del saludo')).toHaveTextContent('Soy ATLAS');
  });

  it('lets people skip and reopen the greeting without leaving the home route', () => {
    showWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Omitir bienvenida' }));
    expect(screen.queryByRole('heading', { name: 'Bienvenido a ATLAS' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar bienvenida de ATLAS' }));
    expect(screen.getByRole('heading', { name: 'Bienvenido a ATLAS' })).toBeInTheDocument();
  });

  it('mounts the greeting in the real ATLAS home route, not a disconnected preview', () => {
    const app = readFileSync('apps/web/src/App.tsx', 'utf8');
    expect(app).toContain('import { AtlasWelcomeExperience }');
    expect(app).toContain('<AtlasWelcomeExperience />');
    expect(app).toContain('<Route path="/" element={<EnterpriseHome />} />');
  });
});
