import { describe, expect, it } from 'vitest';
import {
  signLanguageRegistry,
  signLanguagesForCountry
} from '../../data/accessibility/sign-languages';

describe('ATLAS sign-language rollout registry', () => {
  it('does not assume one sign language per country', () => {
    expect(signLanguagesForCountry('CA').map((entry) => entry.iso639_3).sort()).toEqual(['ase', 'fcs']);
    expect(signLanguagesForCountry('ES').map((entry) => entry.iso639_3).sort()).toEqual(['csc', 'ssp']);
    expect(signLanguagesForCountry('BE').map((entry) => entry.iso639_3).sort()).toEqual(['sfb', 'vgt']);
    expect(signLanguagesForCountry('FI').map((entry) => entry.iso639_3).sort()).toEqual(['fse', 'fss']);
  });

  it('keeps researched languages disabled for model claims until community validation exists', () => {
    expect(signLanguageRegistry.length).toBeGreaterThanOrEqual(20);
    expect(signLanguageRegistry.every((entry) => entry.productStatus === 'research_only')).toBe(true);
    expect(signLanguageRegistry.every((entry) => entry.deafCommunityValidated === false)).toBe(true);
  });

  it('requires provenance and stable language identifiers for each seed entry', () => {
    for (const entry of signLanguageRegistry) {
      expect(entry.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(entry.iso639_3).toMatch(/^[a-z]{3}$/);
      expect(entry.sources.length).toBeGreaterThan(0);
      expect(new Set(entry.sources).size).toBe(entry.sources.length);
    }
  });
});
