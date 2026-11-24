import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { UniversalSetupWizard } from '../../apps/web/src/modules/device-os/UniversalSetupWizard';

describe('ATLAS Universal Setup accessible navigation', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('navigates in both languages and never offers an executable migration', () => {
    render(<UniversalSetupWizard />);
    expect(screen.getByRole('heading', { name: 'Welcome to ATLAS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const languageSelect = screen.getByRole('combobox', { name: 'Language' });
    expect(languageSelect).toHaveValue('en');
    fireEvent.change(languageSelect, { target: { value: 'es' } });
    expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveValue('es');
    expect(screen.getByRole('heading', { name: 'Idioma' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('checkbox', { name: 'Activar subtítulos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { name: 'Migración autorizada' })).toBeInTheDocument();
    expect(screen.getByText(/Migración bloqueada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /migrar|transferir|autorizar/i })).not.toBeInTheDocument();
  });
});
