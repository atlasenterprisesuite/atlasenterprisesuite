import { describe, expect, it } from 'vitest';
import { parseCandidateImportCsv } from '../../apps/web/src/modules/people/candidateImport';

describe('People candidate CSV import', () => {
  it('parses the RecruitPro legacy sample without silently importing unsupported fields', () => {
    const result = parseCandidateImportCsv(
      'name,email,phone,location,experience_years,applied_job,education,certifications,availability,skills\n' +
      'Sample Candidate,sample@example.com,407-555-0100,Orlando FL,3,Accounting Specialist,B.S. Accounting,QuickBooks,2 weeks,"Bookkeeping:80;Excel:75"\n'
    );

    expect(result.candidates).toEqual([
      { fullName: 'Sample Candidate', email: 'sample@example.com', phone: '407-555-0100' }
    ]);
    expect(result.unsupportedHeaders).toEqual([
      'location','experience_years','applied_job','education','certifications','availability','skills'
    ]);
  });

  it('fails closed when required identity data is missing', () => {
    expect(() => parseCandidateImportCsv('email,phone\na@example.com,4075550100')).toThrow(
      'candidate_import_name_header_required'
    );
  });

  it('rejects duplicate rows instead of creating repeated candidates', () => {
    expect(() => parseCandidateImportCsv(
      'name,email,phone\nA,a@example.com,1\nA,a@example.com,1\n'
    )).toThrow('candidate_import_duplicate_row');
  });
});
