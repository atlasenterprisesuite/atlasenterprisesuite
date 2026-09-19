export type WfdLegislationStatus = 'recognized' | 'not_listed_as_recognized';
export type SignLanguageProductStatus = 'research_only';

export type SignLanguageResearchEntry = {
  countryCode: string;
  countryName: string;
  languageName: string;
  acronym: string;
  iso639_3: string;
  wfdLegislationStatus: WfdLegislationStatus;
  productStatus: SignLanguageProductStatus;
  deafCommunityValidated: false;
  verifiedAt: '2026-09-11';
  sources: string[];
};

const WFD_RECOGNITION = 'https://wfdeaf.org/the-legal-recognition-of-national-sign-languages/';
const COMPENDIUM_LANGUAGE_INDEX = 'https://www.sign-lang.uni-hamburg.de/lr/compendium/language/index.html';

function entry(
  countryCode: string,
  countryName: string,
  languageName: string,
  acronym: string,
  iso639_3: string,
  wfdLegislationStatus: WfdLegislationStatus
): SignLanguageResearchEntry {
  return {
    countryCode,
    countryName,
    languageName,
    acronym,
    iso639_3,
    wfdLegislationStatus,
    productStatus: 'research_only',
    deafCommunityValidated: false,
    verifiedAt: '2026-09-11',
    sources: [COMPENDIUM_LANGUAGE_INDEX, WFD_RECOGNITION]
  };
}

/**
 * Provenance-controlled seed for ATLAS Inclusive Communication.
 *
 * This is NOT a list of languages ATLAS can translate today. Every entry stays
 * research_only until a real provider/model, language-specific linguistic review,
 * and Deaf-community validation exist for the specific language and regional varieties.
 *
 * The two seed sources are registry-level sources whose URLs were verified directly.
 * Individual language/provider evidence must be added before any productStatus can
 * advance beyond research_only; do not manufacture per-language source URLs.
 *
 * Country is only a discovery dimension. ATLAS must never infer a user's sign
 * language from country, locale, or spoken language without explicit preference.
 */
export const signLanguageRegistry: SignLanguageResearchEntry[] = [
  entry('US', 'United States', 'American Sign Language', 'ASL', 'ase', 'not_listed_as_recognized'),
  entry('CA', 'Canada', 'American Sign Language', 'ASL', 'ase', 'recognized'),
  entry('CA', 'Canada', 'Quebec Sign Language', 'LSQ', 'fcs', 'recognized'),
  entry('MX', 'Mexico', 'Mexican Sign Language', 'LSM', 'mfs', 'recognized'),
  entry('VE', 'Venezuela', 'Venezuelan Sign Language', 'LSV', 'vsl', 'recognized'),
  entry('BR', 'Brazil', 'Brazilian Sign Language', 'Libras', 'bzs', 'recognized'),
  entry('AR', 'Argentina', 'Argentine Sign Language', 'LSA', 'aed', 'recognized'),
  entry('CL', 'Chile', 'Chilean Sign Language', 'LSCh', 'csg', 'recognized'),
  entry('CO', 'Colombia', 'Colombian Sign Language', 'LSC', 'csn', 'recognized'),
  entry('PE', 'Peru', 'Peruvian Sign Language', 'LSP', 'prl', 'recognized'),
  entry('GB', 'United Kingdom', 'British Sign Language', 'BSL', 'bfi', 'recognized'),
  entry('IE', 'Ireland', 'Irish Sign Language', 'ISL', 'isg', 'recognized'),
  entry('ES', 'Spain', 'Spanish Sign Language', 'LSE', 'ssp', 'recognized'),
  entry('ES', 'Spain', 'Catalan Sign Language', 'LSC', 'csc', 'recognized'),
  entry('PT', 'Portugal', 'Portuguese Sign Language', 'LGP', 'psr', 'recognized'),
  entry('FR', 'France', 'French Sign Language', 'LSF', 'fsl', 'not_listed_as_recognized'),
  entry('DE', 'Germany', 'German Sign Language', 'DGS', 'gsg', 'recognized'),
  entry('IT', 'Italy', 'Italian Sign Language', 'LIS', 'ise', 'recognized'),
  entry('BE', 'Belgium', 'Flemish Sign Language', 'VGT', 'vgt', 'recognized'),
  entry('BE', 'Belgium', 'French Belgian Sign Language', 'LSFB', 'sfb', 'recognized'),
  entry('FI', 'Finland', 'Finnish Sign Language', 'FinSL', 'fse', 'recognized'),
  entry('FI', 'Finland', 'Finland-Swedish Sign Language', 'FinSSL', 'fss', 'recognized'),
  entry('NL', 'Netherlands', 'Sign Language of the Netherlands', 'NGT', 'dse', 'recognized'),
  entry('SE', 'Sweden', 'Swedish Sign Language', 'STS', 'swl', 'recognized'),
  entry('DK', 'Denmark', 'Danish Sign Language', 'DTS', 'dsl', 'recognized'),
  entry('NO', 'Norway', 'Norwegian Sign Language', 'NTS', 'nsl', 'recognized'),
  entry('PL', 'Poland', 'Polish Sign Language', 'PJM', 'pso', 'recognized'),
  entry('RU', 'Russian Federation', 'Russian Sign Language', 'RSL', 'rsl', 'recognized'),
  entry('UA', 'Ukraine', 'Ukrainian Sign Language', 'UkSL', 'ukl', 'recognized'),
  entry('TR', 'Turkey', 'Turkish Sign Language', 'TİD', 'tsm', 'recognized'),
  entry('JP', 'Japan', 'Japanese Sign Language', 'JSL', 'jsl', 'recognized'),
  entry('KR', 'South Korea', 'Korean Sign Language', 'KSL', 'kvk', 'recognized'),
  entry('IN', 'India', 'Indian Sign Language', 'ISL', 'ins', 'recognized'),
  entry('PH', 'Philippines', 'Filipino Sign Language', 'FSL', 'psp', 'recognized'),
  entry('PK', 'Pakistan', 'Pakistan Sign Language', 'PSL', 'pks', 'not_listed_as_recognized'),
  entry('ZA', 'South Africa', 'South African Sign Language', 'SASL', 'sfs', 'recognized'),
  entry('AU', 'Australia', 'Auslan', 'Auslan', 'asf', 'not_listed_as_recognized'),
  entry('NZ', 'New Zealand', 'New Zealand Sign Language', 'NZSL', 'nzs', 'recognized')
];

export function signLanguagesForCountry(countryCode: string): SignLanguageResearchEntry[] {
  const normalized = countryCode.trim().toUpperCase();
  return signLanguageRegistry.filter((language) => language.countryCode === normalized);
}
