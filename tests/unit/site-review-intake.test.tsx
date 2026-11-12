import React from 'react';
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
  it('audits a local HTML file without rendering source strings or fetching a website', async () => {
    render(<SiteReviewIntake />);
    const field = screen.getByLabelText('Website address');
    fireEvent.change(field, { target: { value: 'https://example.org/' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prepare review' }));
    const input = screen.getByLabelText(/HTML snapshot/);
    const html = '<html lang="en"><head><title>SUPER_SECRET_TITLE</title></head><body><h1>Safe heading</h1><script>window.leak="SUPER_SECRET"</script></body></html>';
    const file = new File([html], 'source.html', { type: 'text/html' });
    Object.defineProperty(file, 'text', { value: async () => html });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('Static source signals · Not a live site scan')).toBeTruthy();
    expect(screen.queryByText('SUPER_SECRET_TITLE')).toBeNull();
    expect(screen.queryByText('SUPER_SECRET')).toBeNull();
    fireEvent.change(field, { target: { value: 'https://other.example.org/' } });
    expect(screen.queryByText('Static source signals · Not a live site scan')).toBeNull();
  });

  it('rejects unsupported file types without auditing their content', () => {
    render(<SiteReviewIntake />);
    fireEvent.change(screen.getByLabelText('Website address'), { target: { value: 'https://example.org/' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prepare review' }));
    const file = new File(['not html'], 'file.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText(/HTML snapshot/), { target: { files: [file] } });
    expect(screen.getByRole('alert').textContent).toContain('.html or .htm');
    expect(screen.queryByText('Static source signals · Not a live site scan')).toBeNull();
  });

});
