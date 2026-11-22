import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChronosPage } from '../../apps/web/src/modules/chronos/ChronosPage';
import { resolveChronosRoute, searchTopics } from '../../apps/web/src/modules/chronos/catalog';
import { afterEach } from 'vitest';
import { defaultAccessibilityProfile, resolveAccessibilityUserId, saveAccessibilityProfile } from '../../apps/web/src/services/accessibilityProfile';
afterEach(() => { cleanup(); window.localStorage.removeItem(`atlas_accessibility_profile:v1:${resolveAccessibilityUserId()}`); });
const open = (path:string) => render(<MemoryRouter initialEntries={[path]}><ChronosPage /></MemoryRouter>);
describe('CHRONOS navigation',()=>{
 it('resolves canonical routes and rejects unrelated and unknown paths',()=>{
  expect(resolveChronosRoute('/chronos/')).toBe('');
  expect(resolveChronosRoute('/chronos/research/01.001')).toBe('research/01.001');
  for(const path of ['/chronos/research/99.999','/chronos/researching','/chronos/research/01.001/extra','/chronos-other','/chronos//review']) expect(resolveChronosRoute(path)).toBeNull();
 });
 it('finds nonadjacent normalized search terms',()=>{
  expect(searchTopics('radiacion universo').map(t=>t.id)).toContain('01.001');
 });
 it('renders an active research deep link and source navigation',()=>{
  open('/chronos/research/01.001');
  expect(screen.getByRole('heading',{name:/01.001 · Big Bang/})).toBeTruthy();
  expect(screen.getByRole('link',{name:'Consultar fuentes'}).getAttribute('href')).toBe('/chronos/evidence');
  expect(screen.getByRole('link',{name:'Investigación'}).getAttribute('aria-current')).toBe('page');
 });
 it('navigates to a search result and clears the query',()=>{
  open('/chronos');
  const input=screen.getByRole('searchbox',{name:'Buscar expedientes'});
  fireEvent.change(input,{target:{value:'radiacion'}});
  fireEvent.click(screen.getByRole('link',{name:/01.001 · Big Bang/}));
  expect(screen.getByRole('heading',{name:/01.001 · Big Bang/})).toBeTruthy();
  expect((input as HTMLInputElement).value).toBe('');
 });
 it('reports no results and exposes accessible landmarks',()=>{
  open('/chronos');
  expect(screen.getByRole('main').id).toBe('chronos-content');
  expect(screen.getByRole('link',{name:'Saltar al contenido'}).getAttribute('href')).toBe('#chronos-content');
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'xyz-no-topic'}});
  expect(screen.getByRole('status').textContent).toContain('No se encontraron');
 });
 it('renders separate research progress and timeline on the home screen',()=>{
  open('/chronos');
  expect(screen.getByRole('heading',{name:'Progreso de investigación'})).toBeTruthy();
  expect(screen.getByRole('heading',{name:'Cronología universal'})).toBeTruthy();
  expect(screen.getByText('0/8 tareas preliminares; 0 certificaciones.')).toBeTruthy();
  expect(screen.getByRole('link',{name:'Abrir cronología completa'}).getAttribute('href')).toBe('/chronos/timeline');
 });
 it('preserves the shared ATLAS accessibility profile and Spanish language declaration', () => {
  const userId=resolveAccessibilityUserId();
  saveAccessibilityProfile({...defaultAccessibilityProfile(userId), highContrast:true, motionReduced:true, textSizeScale:1.5, screenReaderOptimized:true});
  const {container}=open('/chronos');
  const root=container.querySelector('.chronos-os') as HTMLElement;
  expect(root.getAttribute('lang')).toBe('es');
  expect(root.classList.contains('accessibility-high-contrast')).toBe(true);
  expect(root.classList.contains('accessibility-reduced-motion')).toBe(true);
  expect(root.style.fontSize).toBe('150%');
  expect(root.dataset.screenReaderOptimized).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:'Alto contraste'}));
  expect(root.classList.contains('accessibility-high-contrast')).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Aumentar tamaño del texto'}));
  expect(root.style.fontSize).toBe('175%');
 });
 it('reacts to accessibility preferences changed in another ATLAS view',()=>{
  const {container}=open('/chronos');
  const root=container.querySelector('.chronos-os') as HTMLElement;
  saveAccessibilityProfile({...defaultAccessibilityProfile(resolveAccessibilityUserId()),highContrast:true});
  expect(root.classList.contains('accessibility-high-contrast')).toBe(true);
 });
 it('unknown research ID fails closed',()=>{
  open('/chronos/research/99.999');
  expect(screen.getByRole('heading',{name:'Ruta no encontrada'})).toBeTruthy();
 });
 it('shows the exact evidence registry and safe external links',()=>{
  open('/chronos/evidence');
  expect(screen.getByRole('heading',{name:'Registro de fuentes'})).toBeTruthy();
  expect(screen.getByRole('link',{name:/COBE/}).getAttribute('rel')).toContain('noopener');
 });
});
