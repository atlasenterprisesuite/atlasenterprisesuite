import { describe, expect, it } from 'vitest';
import { classifyAtlasLibraryAsset } from '../../packages/core/src/libraryRouting';

describe('ATLAS Library routing', () => {
  it('routes structured Library paths into owning modules', () => {
    expect(classifyAtlasLibraryAsset({ name:'ATLAS Care Plan - Family A.pdf', path:'/ATLAS/Care/ATLAS Care Plan - Family A.pdf', mimeType:'application/pdf' }).primaryModuleId).toBe('care');
    expect(classifyAtlasLibraryAsset({ name:'01_Form_1040_2025_IRS_editable.pdf', path:'/ATLAS_LIBRARY_MASTER_2026-08-09/09_DOCUMENTS/01_FINANCE_TAX/01_Form_1040_2025_IRS_editable.pdf', mimeType:'application/pdf' }).primaryModuleId).toBe('tax');
    expect(classifyAtlasLibraryAsset({ name:'04_inventory.png', path:'/ATLAS/Inventory/04_inventory.png', mimeType:'image/png' }).moduleIds).toContain('inventory');
    expect(classifyAtlasLibraryAsset({ name:'03_gps_4t.mp3', path:'/ATLAS/Media/03_gps_4t.mp3', mimeType:'audio/mpeg' }).moduleIds).toContain('ride');
  });

  it('marks personal, legal, tax and health material restricted by default', () => {
    expect(classifyAtlasLibraryAsset({ name:'resume.pdf', path:'/Personal/resume.pdf' }).sensitivity).toBe('restricted');
    expect(classifyAtlasLibraryAsset({ name:'case.pdf', path:'/Legal/Lyft Case 2026-00117661/case.pdf' }).sensitivity).toBe('restricted');
    expect(classifyAtlasLibraryAsset({ name:'lab.pdf', path:'/ATLAS/Health/lab.pdf' }).sensitivity).toBe('restricted');
  });


  it('routes restaurant and fast-food material into Hospitality and Commerce without creating a parallel food app', () => {
    const result=classifyAtlasLibraryAsset({
      name:'USA Fast Food Restaurant Chain Menu POS.pdf',
      path:'/Library/USA Fast Food Restaurant Chain Menu POS.pdf',
      mimeType:'application/pdf'
    });
    expect(result.primaryModuleId).toBe('hospitality');
    expect(result.moduleIds).toContain('hospitality');
    expect(result.moduleIds).toContain('commerce');
    expect(result.tags).toContain('food-service');
  });

  it('routes weight, nutrition and wellness material into ATLAS Health', () => {
    const result=classifyAtlasLibraryAsset({
      name:'Weight Nutrition BMI Wellness Research.pdf',
      path:'/Research/Weight Nutrition BMI Wellness Research.pdf',
      mimeType:'application/pdf'
    });
    expect(result.primaryModuleId).toBe('health');
    expect(result.tags).toContain('weight');
    expect(result.tags).toContain('nutrition');
  });

  it('routes biblical and scripture material into Bible OS with Knowledge provenance', () => {
    const result=classifyAtlasLibraryAsset({
      name:'Bible Psalms Scripture Study.pdf',
      path:'/Research/Bible Psalms Scripture Study.pdf',
      mimeType:'application/pdf'
    });
    expect(result.primaryModuleId).toBe('bible-os');
    expect(result.moduleIds).toContain('knowledge');
    expect(result.tags).toContain('scripture');
  });

  it('routes USA geography references into Knowledge Atlas', () => {
    const result=classifyAtlasLibraryAsset({
      name:'USA United States Geography and States.pdf',
      path:'/Reference/USA United States Geography and States.pdf',
      mimeType:'application/pdf'
    });
    expect(result.primaryModuleId).toBe('knowledge');
    expect(result.tags).toContain('usa');
    expect(result.tags).toContain('geography');
  });

  it('can route opaque filenames from analyzed content', () => {
    const bible=classifyAtlasLibraryAsset({
      name:'scan-001.pdf',
      path:'/Inbox/scan-001.pdf',
      mimeType:'application/pdf',
      contentText:'Psalm 37 biblical scripture study about Jehovah and Jesus'
    });
    expect(bible.primaryModuleId).toBe('bible-os');
    expect(bible.basis).toBe('content');

    const restaurant=classifyAtlasLibraryAsset({
      name:'scan-002.pdf',
      path:'/Inbox/scan-002.pdf',
      mimeType:'application/pdf',
      contentText:'restaurant fast food chain menu kitchen POS ordering operations'
    });
    expect(restaurant.primaryModuleId).toBe('hospitality');
    expect(restaurant.basis).toBe('content');
  });

  it('keeps obvious personal health summaries restricted', () => {
    expect(classifyAtlasLibraryAsset({
      name:'My_Health_Summary.pdf',
      path:'/Inbox/My_Health_Summary.pdf',
      mimeType:'application/pdf'
    }).sensitivity).toBe('restricted');
  });

  it('falls back to Knowledge Atlas without inventing a domain', () => {
    const result=classifyAtlasLibraryAsset({ name:'unknown.bin', path:'/unknown.bin', mimeType:'application/octet-stream' });
    expect(result.primaryModuleId).toBe('knowledge');
    expect(result.basis).toBe('fallback');
  });
});
