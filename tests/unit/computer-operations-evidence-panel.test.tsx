import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComputerOperationsEvidencePanel } from '../../apps/web/src/work/ComputerOperationsEvidencePanel';
import { buildComputerOperationsEvidence } from '../../apps/web/src/work/computerOperationsEvidence';

describe('diagnostic session evidence and Siri setup', () => {
  it('shows an honest empty state and the existing operations URL for a Siri shortcut', () => {
    render(<ComputerOperationsEvidencePanel reports={[]} onClear={() => {}} />);
    expect(screen.getByText('No completed checks in this session.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Download report/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open diagnostic center' })).toHaveAttribute('href', 'https://www.atlasenterprisesuite.com/work/computer-operations');
    expect(screen.getByText(/not been verified on this device/)).toBeInTheDocument();
  });

  it('exports the observed report and clears session history only on request', () => {
    const report = buildComputerOperationsEvidence([], 'essential', '2026-11-11T22:00:00.000Z');
    const onClear = vi.fn();
    render(<ComputerOperationsEvidencePanel reports={[report]} onClear={onClear} />);
    const link = screen.getByRole('link', { name: /Download report/ });
    const payload = decodeURIComponent(link.getAttribute('href')!.split(',')[1]);
    expect(JSON.parse(payload)).toEqual(report);
    expect(onClear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear session history' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
