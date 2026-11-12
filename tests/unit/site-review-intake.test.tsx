import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SiteReviewIntake } from '../../apps/web/src/modules/integration/SiteReviewIntake';

afterEach(cleanup);

describe('Site Review offline intake UI', () => {
  it('prepares URL metadata and clears results without asserting a live scan', () => {
    render(<SiteReviewIntake />);
    const field = screen.getByLabelText('Website address');
    fireEvent.change(field, { target: { value: 'https://www.example.com/path?token=private' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prepare review' }));
    expect(screen.getByText('Prepared · Not scanned')).toBeTruthy();
    expect(screen.queryByText('private')).toBeNull();
    expect(screen.getByText('Not configured')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear target' }));
    expect(screen.queryByText('Prepared · Not scanned')).toBeNull();
    expect((field as HTMLInputElement).value).toBe('');
  });

  it('invalidates previous assessment when the URL is edited', () => {
    render(<SiteReviewIntake />);
    const field = screen.getByLabelText('Website address');
    fireEvent.change(field, { target: { value: 'https://example.com/' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prepare review' }));
    expect(screen.getByText('Prepared · Not scanned')).toBeTruthy();
    fireEvent.change(field, { target: { value: 'https://another.example.com/' } });
    expect(screen.queryByText('Prepared · Not scanned')).toBeNull();
  });
});
