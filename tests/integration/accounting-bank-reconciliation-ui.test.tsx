import { createHash, webcrypto } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { BankReconciliationPage } from '../../apps/web/src/modules/finance/accounting/BankReconciliationPage';

const header = 'id,date,amount,currency,reference,description\r\n';
const bank = header + 'B1,2026-11-01,-12.30,USD,INV-1,Payment\r\nB2,2026-11-03,100.00,USD,SALE-1,Receipt';
const ledger = header + 'L1,2026-11-02,-12.30,USD,INV-1,Payment\r\nL2,2026-11-03,99.00,USD,SALE-1,Receipt';
let downloaded: Blob | undefined;
const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

function renderPage() { render(<MemoryRouter><BankReconciliationPage /></MemoryRouter>); }
function select(label: string, contents: string, name: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { files: [new File([contents], name, { type: 'text/csv' })] } });
}
async function importBoth() {
  select('Archivo del banco', bank, 'bank.csv');
  select('Archivo del libro contable', ledger, 'ledger.csv');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Comparar movimientos' })).toBeEnabled());
}
async function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  downloaded = undefined;
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('React', React);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: (blob: Blob) => { downloaded = blob; return 'blob:local-report'; } });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate); else delete (URL as unknown as Record<string, unknown>).createObjectURL;
  if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke); else delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
});

describe('local bank reconciliation workspace', () => {
  it('starts empty with explicit local processing and no exportable invented report', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Conciliación de archivos' })).toBeVisible();
    expect(screen.getByText(/Los archivos permanecen en la memoria de esta página/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Comparar movimientos' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Descargar evidencia JSON' })).not.toBeInTheDocument();
  });

  it('imports real file bytes, compares and exports full review evidence without a network request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden for local comparison'));
    renderPage();
    await importBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Comparar movimientos' }));
    expect(screen.getByLabelText('Cantidad de propuestas')).toHaveTextContent('1');
    expect(screen.getByLabelText('Diferencia entre totales')).toHaveTextContent('$1.00');
    expect(within(screen.getByRole('table', { name: 'Coincidencias propuestas' })).getByText('B1')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar evidencia JSON' }));
    expect(downloaded).toBeDefined();
    const report = JSON.parse(await blobText(downloaded!));
    expect(report.sources.bank.sha256).toBe(createHash('sha256').update(bank).digest('hex'));
    expect(report.sources.bank.entries[1].id).toBe('B2');
    expect(report.reviewState).toBe('requires_human_review');
    expect(report.posted).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('invalidates the old report when a replacement file is invalid', async () => {
    renderPage();
    await importBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Comparar movimientos' }));
    select('Archivo del banco', header + 'X,2026-02-30,10,USD,R1,x', 'invalid.csv');
    expect(await screen.findByRole('alert')).toHaveTextContent('Fecha inválida');
    expect(screen.queryByRole('button', { name: 'Descargar evidencia JSON' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comparar movimientos' })).toBeDisabled();
  });

  it('displays large accepted amounts without rounding away minor units', async () => {
    renderPage();
    select('Archivo del banco', header + 'B1,2026-11-01,90071992547409.91,USD,R1,x', 'large-bank.csv');
    select('Archivo del libro contable', header + 'L1,2026-11-01,90071992547409.90,USD,R1,x', 'large-ledger.csv');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Comparar movimientos' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Comparar movimientos' }));
    expect(screen.getByText(/Total banco: \$90,071,992,547,409\.91/)).toBeVisible();
    expect(screen.getByLabelText('Diferencia entre totales')).toHaveTextContent('$0.01');
  });

  it('clears imported financial data and makes recomparison unavailable', async () => {
    renderPage();
    await importBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Comparar movimientos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar archivos y resultado' }));
    expect(screen.getByRole('button', { name: 'Comparar movimientos' })).toBeDisabled();
    expect(screen.queryByText(/bank.csv · 2 movimientos/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Descargar evidencia JSON' })).not.toBeInTheDocument();
  });

  it('invalidates a removed source and its existing report on an empty file change', async () => {
    renderPage();
    await importBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Comparar movimientos' }));
    fireEvent.change(screen.getByLabelText('Archivo del banco'), { target: { files: [] } });
    expect(screen.getByRole('button', { name: 'Comparar movimientos' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Descargar evidencia JSON' })).not.toBeInTheDocument();
    expect(screen.queryByText(/bank.csv · 2 movimientos/)).not.toBeInTheDocument();
  });

  it('does not finish a pending import after that file selection is removed', async () => {
    const read = FileReader.prototype.readAsArrayBuffer;
    let release: (() => void) | undefined;
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementationOnce(function (this: FileReader, blob: Blob) { release = () => read.call(this, blob); });
    renderPage();
    select('Archivo del banco', bank, 'removed.csv');
    fireEvent.change(screen.getByLabelText('Archivo del banco'), { target: { files: [] } });
    await act(async () => { release!(); await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(screen.queryByText(/removed.csv/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comparar movimientos' })).toBeDisabled();
  });

  it('rejects oversized files before they become a usable source', async () => {
    renderPage();
    select('Archivo del banco', 'x'.repeat(2 * 1024 * 1024 + 1), 'large.csv');
    expect(await screen.findByRole('alert')).toHaveTextContent('2 MiB');
    expect(screen.getByRole('button', { name: 'Comparar movimientos' })).toBeDisabled();
  });

  it('invalidates a report after changing its date window and rejects an invalid window', async () => {
    renderPage();
    await importBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Comparar movimientos' }));
    fireEvent.change(screen.getByLabelText('Ventana de fechas en días'), { target: { value: '31' } });
    expect(screen.getByRole('button', { name: 'Comparar movimientos' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Descargar evidencia JSON' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ventana de fechas en días'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comparar movimientos' }));
    expect(screen.getByLabelText('Cantidad de propuestas')).toHaveTextContent('0');
  });

  it('does not resurrect a pending import after Clear', async () => {
    const read = FileReader.prototype.readAsArrayBuffer;
    let release: (() => void) | undefined;
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementationOnce(function (this: FileReader, blob: Blob) { release = () => read.call(this, blob); });
    renderPage();
    select('Archivo del banco', bank, 'late.csv');
    fireEvent.click(screen.getByRole('button', { name: 'Borrar archivos y resultado' }));
    await act(async () => { release!(); await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(screen.queryByText(/late.csv/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comparar movimientos' })).toBeDisabled();
  });

  it('keeps the newest selection when an older file read finishes later', async () => {
    const read = FileReader.prototype.readAsArrayBuffer;
    let release: (() => void) | undefined;
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementationOnce(function (this: FileReader, blob: Blob) { release = () => read.call(this, blob); });
    renderPage();
    select('Archivo del banco', bank.replace('B1', 'OLD'), 'old.csv');
    select('Archivo del banco', bank, 'new.csv');
    select('Archivo del libro contable', ledger, 'ledger.csv');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Comparar movimientos' })).toBeEnabled());
    await act(async () => { release!(); await new Promise(resolve => setTimeout(resolve, 30)); });
    fireEvent.click(screen.getByRole('button', { name: 'Comparar movimientos' }));
    expect(screen.getByText(/new.csv · 2 movimientos/)).toBeVisible();
    expect(screen.queryByText('OLD')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Coincidencias propuestas' })).getByText('B1')).toBeVisible();
  });
});
