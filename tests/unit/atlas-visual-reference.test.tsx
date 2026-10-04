import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AtlasVisualReference } from '../../apps/web/src/components/AtlasVisualReference';

describe('ATLAS visual references', () => {
  it('uses the approved dashboard reference and routes back into the functional product', () => {
    render(<MemoryRouter><AtlasVisualReference reference="dashboard" /></MemoryRouter>);
    expect(screen.getByRole('img', { name: /original atlas futuristic intelligence dashboard/i }))
      .toHaveAttribute('src', '/atlas/design/atlas-main-dashboard.webp');
    expect(screen.getByRole('link', { name: /intelligence dashboard/i }))
      .toHaveAttribute('href', '/');
  });

  it('maps Universe, module gallery and Voice references to real ATLAS routes', () => {
    const { rerender } = render(<MemoryRouter><AtlasVisualReference reference="universe" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /atlas universe/i })).toHaveAttribute('href', '/galaxy');

    rerender(<MemoryRouter><AtlasVisualReference reference="modules" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /module design gallery/i })).toHaveAttribute('href', '/suite');

    rerender(<MemoryRouter><AtlasVisualReference reference="voice" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /atlas voice/i })).toHaveAttribute('href', '/voice');
  });
});
