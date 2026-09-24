import { describe, expect, it } from 'vitest';
import { classifyAtlasLibraryAsset } from '../../packages/core/src/libraryRouting';

describe('ATLAS Library routing', () => {
  it('routes structured Library paths into owning modules', () => {
    expect(classifyAtlasLibraryAsset({ name:'01_Form_1040_2025_IRS_editable.pdf', path:'/ATLAS_LIBRARY_MASTER_2026-08-09/09_DOCUMENTS/01_FINANCE_TAX/01_Form_1040_2025_IRS_editable.pdf', mimeType:'application/pdf' }).primaryModuleId).toBe('tax');
    expect(classifyAtlasLibraryAsset({ name:'04_inventory.png', path:'/ATLAS/Inventory/04_inventory.png', mimeType:'image/png' }).moduleIds).toContain('inventory');
    expect(classifyAtlasLibraryAsset({ name:'03_gps_4t.mp3', path:'/ATLAS/Media/03_gps_4t.mp3', mimeType:'audio/mpeg' }).moduleIds).toContain('ride');
  });

  it('marks personal, legal, tax and health material restricted by default', () => {
    expect(classifyAtlasLibraryAsset({ name:'resume.pdf', path:'/Personal/resume.pdf' }).sensitivity).toBe('restricted');
    expect(classifyAtlasLibraryAsset({ name:'case.pdf', path:'/Legal/Lyft Case 2026-00117661/case.pdf' }).sensitivity).toBe('restricted');
    expect(classifyAtlasLibraryAsset({ name:'lab.pdf', path:'/ATLAS/Health/lab.pdf' }).sensitivity).toBe('restricted');
  });

  it('falls back to Knowledge Atlas without inventing a domain', () => {
    const result=classifyAtlasLibraryAsset({ name:'unknown.bin', path:'/unknown.bin', mimeType:'application/octet-stream' });
    expect(result.primaryModuleId).toBe('knowledge');
    expect(result.basis).toBe('fallback');
  });
});
