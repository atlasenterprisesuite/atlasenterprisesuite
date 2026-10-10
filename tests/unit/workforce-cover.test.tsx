import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { WorkforceCover } from '../../apps/web/src/modules/people/WorkforceCover';

const renderCover = () => renderToStaticMarkup(
  <MemoryRouter><WorkforceCover /></MemoryRouter>
);

describe('ATLAS Workforce Management blueprint cover', () => {
  it('presents the approved cover hierarchy and source-safe state', () => {
    const html = renderCover();
    expect(html).toContain('ATLAS');
    expect(html).toContain('WORKFORCE');
    expect(html).toContain('MANAGEMENT');
    expect(html).toContain('Right people. Right place. Right time.');
    expect(html).toContain('Concept visual');
    expect(html).not.toContain('Live workforce');
  });

  it('routes active capabilities to existing canonical services', () => {
    const html = renderCover();
    expect(html).toContain('href="/people/time"');
    expect(html).toContain('href="/payroll"');
    expect(html).toContain('href="/analytics"');
    expect(html).toContain('href="/people/knowledge"');
    expect(html).toContain('aria-disabled="true"');
  });

  it('labels payroll disbursement as externally gated rather than completed', () => {
    const html = renderCover();
    expect(html).toContain('Clock in/out');
    expect(html).toContain('Timecard review');
    expect(html).toContain('Payroll preparation');
    expect(html).toContain('Payment provider gated');
  });
});
