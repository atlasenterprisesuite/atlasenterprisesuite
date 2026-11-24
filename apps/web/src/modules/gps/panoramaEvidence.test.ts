import { describe, expect, it } from 'vitest';
import { canDisplayPanorama, canNavigatePanorama, type PanoramaScene, type PanoramaConnection } from './panoramaEvidence';

const scene: PanoramaScene = {
  id: 'concierge', organizationId: 'org-a', buildingId: 'millenia',
  levelId: 'L1', imageUri: 'https://example.org/authorized-panorama.jpg',
  imageSha256: 'a'.repeat(64), rightsEvidenceRef: 'license-record-1',
  verification: 'verified'
};
const destination: PanoramaScene = { ...scene, id: 'apple', imageSha256: 'b'.repeat(64) };
const link: PanoramaConnection = {
  fromSceneId: 'concierge', toSceneId: 'apple', organizationId: 'org-a',
  buildingId: 'millenia', evidenceRef: 'survey-record-1',
  verification: 'verified', accessible: true
};

describe('ATLAS panorama evidence gate', () => {
  it('rejects cross-tenant, unverified, unlicensed, and non-HTTPS imagery', () => {
    expect(canDisplayPanorama(scene, 'org-b')).toBe(false);
    expect(canDisplayPanorama({ ...scene, verification: 'unverified' }, 'org-a')).toBe(false);
    expect(canDisplayPanorama({ ...scene, rightsEvidenceRef: '' }, 'org-a')).toBe(false);
    expect(canDisplayPanorama({ ...scene, imageUri: 'http://example.org/a.jpg' }, 'org-a')).toBe(false);
    expect(canDisplayPanorama({ ...scene, imageSha256: 'not-a-sha' }, 'org-a')).toBe(false);
  });

  it('blocks navigation without verified evidence and matching identities', () => {
    expect(canNavigatePanorama(scene, destination, { ...link, verification: 'simulation' }, 'org-a')).toBe(false);
    expect(canNavigatePanorama(scene, destination, { ...link, evidenceRef: '' }, 'org-a')).toBe(false);
    expect(canNavigatePanorama(scene, destination, { ...link, toSceneId: 'other' }, 'org-a')).toBe(false);
    expect(canNavigatePanorama(scene, { ...destination, buildingId: 'other' }, link, 'org-a')).toBe(false);
    expect(canNavigatePanorama(scene, destination, { ...link, accessible: false }, 'org-a', true)).toBe(false);
    expect(canNavigatePanorama(scene, destination, link, 'org-b')).toBe(false);
  });

  it('accepts a structurally verified same-tenant link', () => {
    expect(canNavigatePanorama(scene, destination, link, 'org-a', true)).toBe(true);
  });
});
