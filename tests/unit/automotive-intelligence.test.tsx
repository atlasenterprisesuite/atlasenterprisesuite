import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AutomotiveIntelligencePage } from '../../apps/web/src/modules/automotive/AutomotiveIntelligencePage';
import { buildVehicleDossier, vehicleCatalog, getVehicleSpecification } from '../../apps/web/src/modules/automotive/automotiveCatalog';

const renderApp=()=>render(<MemoryRouter><AutomotiveIntelligencePage /></MemoryRouter>);
let originalCreate:typeof URL.createObjectURL;
let originalRevoke:typeof URL.revokeObjectURL;
beforeEach(()=>{
 originalCreate=URL.createObjectURL;
 originalRevoke=URL.revokeObjectURL;
 URL.createObjectURL=vi.fn(()=>'blob:atlas-test-image');
 URL.revokeObjectURL=vi.fn();
});
afterEach(()=>{
 cleanup();
 URL.createObjectURL=originalCreate;
 URL.revokeObjectURL=originalRevoke;
 vi.restoreAllMocks();
});

describe('ATLAS Automotive Intelligence — manufacturer references and fail closed',()=>{
 it('does not invent photos, VINs, automated visual confidence or current prices',()=>{
  expect(vehicleCatalog).toHaveLength(2);
  expect(vehicleCatalog.map(v=>v.id)).toEqual(['mclaren-720s-spider','mclaren-750s-spider']);
  for(const vehicle of vehicleCatalog){
   expect(vehicle.manufacturer).toBe('McLaren');
   expect(vehicle.specSourceUrl).toMatch(/^https:\/\/(cars\.|www\.)?mclaren\.com\//);
   expect(vehicle.marketPriceUsd).toBeNull();
   expect(vehicle.individualVin).toBeNull();
   expect(vehicle.specReviewDate).toBe('2026-11-26');
  }
  expect(getVehicleSpecification('other')).toBeUndefined();
  expect(buildVehicleDossier('other','test.jpg')).toBeNull();
 });
 it('preserves the 720S Spider correction separately from the 750S Spider',()=>{
  const first=getVehicleSpecification('mclaren-720s-spider');
  const next=getVehicleSpecification('mclaren-750s-spider');
  expect(first?.powerPs).toBe(720);
  expect(first?.powerBhp).toBe(710);
  expect(first?.accelerationZeroToHundredSeconds).toBe(2.8);
  expect(first?.topSpeedKmh).toBe(341);
  expect(next?.powerPs).toBe(750);
  expect(next?.powerBhp).toBe(740);
  expect(next?.topSpeedKmh).toBe(332);
  expect(first?.specSourceUrl).not.toEqual(next?.specSourceUrl);
 });
 it('produces explicit manual candidate status and no machine confidence',()=>{
  const dossier=buildVehicleDossier('mclaren-720s-spider','photo.webp');
  expect(dossier?.identification.method).toBe('human-selected-candidate');
  expect(dossier?.identification.visualRecognitionPerformed).toBe(false);
  expect(dossier?.identification.confidencePercent).toBeNull();
  expect(dossier?.identification.vinVerified).toBe(false);
  expect(dossier?.source.type).toBe('official-manufacturer');
  expect(dossier?.photo.name).toBe('photo.webp');
  expect(dossier?.market.priceUsd).toBeNull();
 });
});

describe('ATLAS Automotive Intelligence — local photo flow',()=>{
 it('shows the source-backed comparison with no price claimed',()=>{
  renderApp();
  expect(screen.getByRole('heading',{name:'ATLAS Automotive Intelligence'})).toBeTruthy();
  expect(screen.getByText('720S Spider')).toBeTruthy();
  expect(screen.getByText('750S Spider')).toBeTruthy();
  expect(screen.getByText('Precio actual: sin verificación')).toBeTruthy();
  expect(screen.getAllByRole('link',{name:/Ficha oficial de McLaren/})).toHaveLength(2);
 });
 it('accepts a local photo and builds a manual candidate dossier',()=>{
  renderApp();
  const input=screen.getByLabelText('Fotografía del vehículo') as HTMLInputElement;
  const file=new File(['image-bytes'],'example.webp',{type:'image/webp'});
  fireEvent.change(input,{target:{files:[file]}});
  expect(screen.getByAltText('Vista previa de la fotografía seleccionada')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox',{name:'Modelo para comparar'}),{target:{value:'mclaren-720s-spider'}});
  fireEvent.click(screen.getByRole('button',{name:'Generar ficha técnica'}));
  expect(screen.getByRole('heading',{name:'Ficha técnica con procedencia'})).toBeTruthy();
  expect(screen.getByText('Identificación visual automática: no ejecutada')).toBeTruthy();
  expect(screen.getByText('Identidad individual: VIN sin verificar')).toBeTruthy();
  expect(screen.getByText('Modelo seleccionado manualmente')).toBeTruthy();
 });
 it('rejects unsupported photo input, never sending it to a remote provider',()=>{
  const fetchMock=vi.spyOn(globalThis,'fetch');
  renderApp();
  fireEvent.change(screen.getByLabelText('Fotografía del vehículo'),{target:{files:[new File(['fake'],'example.svg',{type:'image/svg+xml'})]}});
  expect(screen.getByRole('alert').textContent).toContain('JPG, PNG o WebP');
  expect(fetchMock).not.toHaveBeenCalled();
 });
 it('requires an explicit candidate before issuing a dossier',()=>{
  renderApp();
  fireEvent.click(screen.getByRole('button',{name:'Generar ficha técnica'}));
  expect(screen.getByRole('alert').textContent).toContain('Selecciona un modelo');
  expect(screen.queryByRole('heading',{name:'Ficha técnica con procedencia'})).toBeNull();
 });
});
