import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LabResultsGuidancePage } from '../../apps/web/src/modules/health/LabResultsGuidancePage';

describe('ATLAS Health urinalysis guidance', () => {
  it('keeps protein 1+ educational and non-diagnostic', () => {
    render(<LabResultsGuidancePage />);

    expect(screen.getByRole('heading', { name: 'Urinalysis guidance' })).toBeInTheDocument();
    expect(screen.getByText(/does not diagnose a condition/i)).toBeInTheDocument();
    expect(screen.getByText(/Protein 1\+/i)).toBeInTheDocument();
    expect(screen.getByText(/does not diagnose kidney disease/i)).toBeInTheDocument();
    expect(screen.getByText(/urine albumin-to-creatinine ratio \(UACR\)/i)).toBeInTheDocument();
    expect(screen.getByText(/older adult \(75\)/i)).toBeInTheDocument();
  });

  it('updates guidance when the dipstick level changes', () => {
    render(<LabResultsGuidancePage />);

    fireEvent.change(screen.getByLabelText('Urine protein'), { target: { value: '3+' } });

    expect(screen.getByRole('heading', { name: /Protein 3\+/i })).toBeInTheDocument();
    expect(screen.getByText(/prompt clinical assessment/i)).toBeInTheDocument();
  });

  it('surfaces escalation boundaries without claiming emergency triage', () => {
    render(<LabResultsGuidancePage />);

    expect(screen.getByRole('heading', { name: 'Escalation' })).toBeInTheDocument();
    expect(screen.getByText(/visible blood/i)).toBeInTheDocument();
    expect(screen.getByText(/substantially reduced urine output/i)).toBeInTheDocument();
    expect(screen.getByText(/shortness of breath/i)).toBeInTheDocument();
  });
});
