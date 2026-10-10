import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CreatorExperiencePage } from '../../apps/web/src/modules/experience/CreatorExperiencePage';

describe('ATLAS approved Music & Video Studio visual', () => {
  it('shows the approved 16:9 music, video and teleprompter visual with real destinations', () => {
    render(<MemoryRouter><CreatorExperiencePage /></MemoryRouter>);
    const preview = screen.getByRole('region', { name: 'Music & Video Studio preview' });
    expect(within(preview).getByRole('img', { name: /music, video and teleprompter/i }))
      .toHaveAttribute('src', '/atlas/design/atlas-music-video-studio.svg');
    expect(within(preview).getByRole('link', { name: 'Open Music Lab' }))
      .toHaveAttribute('href', '/studio/create?type=music');
    expect(within(preview).getByRole('link', { name: 'Open Video Studio' }))
      .toHaveAttribute('href', '/studio/create?type=video');
    expect(within(preview).getByRole('link', { name: 'Open Smart Teleprompter' }))
      .toHaveAttribute('href', '/studio/teleprompter');
  });

  it('keeps a responsive 16:9 visual asset and descriptive alternative text', () => {
    const asset = readFileSync(resolve(process.cwd(), 'apps/web/public/atlas/design/atlas-music-video-studio.svg'), 'utf8');
    const styles = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/experience/music-video-showcase.css'), 'utf8');
    expect(asset).toContain('viewBox="0 0 1600 900"');
    expect(styles).toContain('aspect-ratio:16/9');
    expect(styles).toContain('@media(max-width:700px)');
  });
});
