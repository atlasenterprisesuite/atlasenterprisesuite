import React from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AutomotiveRoutes } from '../../apps/web/src/modules/automotive/AutomotiveRoutes';

const source = readFileSync('apps/web/src/modules/automotive/AutomotiveIntelligencePage.tsx', 'utf8');
const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const createObjectURL = vi.fn(() => 'blob:atlas-automotive-local-preview');
const revokeObjectURL = vi.fn();
const fetchSpy = vi.fn();

function photoFile(name: string, mime: string, bytes: readonly number[], read?: () => Promise<ArrayBuffer>) {
  const buffer = Uint8Array.from(bytes);
  const file = new File([buffer], name, { type: mime });
  Object.defineProperty(file, 'slice', {
    configurable: true,
    value: () => ({ arrayBuffer: read ?? (async () => buffer.slice().buffer) })
  });
  return file;
}
const jpegBytes = [255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1];

function mount() {
  return render(<MemoryRouter initialEntries={['/mobility/automotive']}><AutomotiveRoutes /></MemoryRouter>);
}
function choose(file: File) {
  fireEvent.change(screen.getByLabelText(/Select JPEG, PNG or WebP/), {
    target: { files: [file] }
  });
}

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  fetchSpy.mockClear();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
  else Reflect.deleteProperty(URL, 'createObjectURL');
  if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
  else Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('ATLAS Automotive — browser-local photo lifecycle (not live SSO E2E)', () => {
  it('previews a valid photo locally and revokes its object URL when cleared, without network upload', async () => {
    mount();
    choose(photoFile('mclaren.jpg', 'image/jpeg', jpegBytes));
    const img = await screen.findByAltText(/Locally selected vehicle photograph/);
    expect(img.getAttribute('src')).toBe('blob:atlas-automotive-local-preview');
    expect(screen.getByText(/mclaren.jpg · Local preview only/)).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear image' }));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:atlas-automotive-local-preview'));
    expect(screen.getByText(/No local image selected/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a spoofed image before creating a preview or uploading anything', async () => {
    mount();
    choose(photoFile('spoofed.jpg', 'image/jpeg', [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]));
    expect(await screen.findByRole('alert')).toHaveTextContent(/signature does not match/i);
    expect(screen.getByText(/No local image selected/)).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('drops an earlier file read that resolves after a newer valid selection', async () => {
    let completeSlowRead: ((data: ArrayBuffer) => void) | undefined;
    const slowRead = new Promise<ArrayBuffer>((resolve) => { completeSlowRead = resolve; });
    mount();
    choose(photoFile('slow.jpg', 'image/jpeg', jpegBytes, () => slowRead));
    choose(photoFile('new.jpg', 'image/jpeg', jpegBytes));
    expect(await screen.findByText(/new.jpg · Local preview only/)).toBeInTheDocument();
    await act(async () => {
      completeSlowRead?.(Uint8Array.from(jpegBytes).buffer);
      await slowRead;
    });
    expect(screen.getByText(/new.jpg · Local preview only/)).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never creates a blob URL for a file that finishes reading after unmount', async () => {
    let completeRead: ((data: ArrayBuffer) => void) | undefined;
    const slowRead = new Promise<ArrayBuffer>((resolve) => { completeRead = resolve; });
    const view = mount();
    choose(photoFile('pending.jpg', 'image/jpeg', jpegBytes, () => slowRead));
    view.unmount();
    await act(async () => {
      completeRead?.(Uint8Array.from(jpegBytes).buffer);
      await slowRead;
    });
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never calls upload/network/storage APIs in the local intake implementation', () => {
    expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB)\b/);
    expect(source).toContain('URL.createObjectURL(file)');
    expect(source).toContain('URL.revokeObjectURL(photoUrl)');
  });
});
