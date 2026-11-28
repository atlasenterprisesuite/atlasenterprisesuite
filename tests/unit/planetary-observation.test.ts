import { describe, expect, it } from 'vitest';
import { disciplines, planetarySources, buildObservationLinks, parseObservationDate } from '../../apps/web/src/modules/chronos/planetaryObservation';

describe('Planetary observation source contract', () => {
 it('preserves 24 stable Antarctic disciplines without claiming verified data', () => {
  expect(disciplines).toHaveLength(24);
  expect(new Set(disciplines.map(d=>d.id)).size).toBe(24);
  expect(disciplines.every(d=>d.sourceIds.every(id=>planetarySources.some(s=>s.id===id)))).toBe(true);
 });
 it('registers documentary sources only, with HTTPS provenance and explicit evidence type', () => {
  expect(new Set(planetarySources.map(s=>s.id)).size).toBe(planetarySources.length);
  expect(planetarySources.every(s=>new URL(s.url).protocol==='https:' && s.status==='reference-only')).toBe(true);
  expect(planetarySources.find(s=>s.id==='NSIDC-0756-v4')?.kind).toBe('reconstruction');
 });
 it('rejects malformed or impossible calendar dates and accepts leap days', () => {
  for(const value of ['','2026-02-29','2026-11-31','2026-11-26&l=other','2026-1-01']) expect(parseObservationDate(value)).toBeNull();
  expect(parseObservationDate('2024-02-29')).toBe('2024-02-29');
 });
 it('builds only fixed official endpoints and preserves the selected projection/date', () => {
  const links=buildObservationLinks('2026-11-26','antarctic');
  expect(links).not.toBeNull();
  const view=new URL(links!.worldview);
  expect(view.hostname).toBe('worldview.earthdata.nasa.gov');
  expect(view.searchParams.get('p')).toBe('antarctic');
  expect(view.searchParams.get('t')).toBe('2026-11-26');
  expect(links!.gibs).toContain('/epsg3031/');
  expect(buildObservationLinks('2026-11-31','antarctic')).toBeNull();
  expect(buildObservationLinks('2026-11-26','evil' as any)).toBeNull();
 });
 it('does not imply that the selected date applies to the BedMachine historical model', () => {
  const links=buildObservationLinks('2026-11-26','geographic')!;
  expect(links.gibs).toContain('/epsg4326/');
  expect(links.bedmachine).not.toContain('2026-11-26');
  expect(links.bedmachine).toContain('nsidc-0756/versions/4');
 });
});
