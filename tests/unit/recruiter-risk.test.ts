import { describe, expect, it } from 'vitest';
import { screenRecruiterMessage } from '../../apps/web/src/modules/people/recruiterRisk';

describe('ATLAS Recruiting offer safety precheck', () => {
  it('warns about upfront fees without declaring actual fraud', () => {
    const result = screenRecruiterMessage({ message: 'You must pay a $95 equipment fee before starting the job.' });
    expect(result.level).toBe('high-risk');
    expect(result.flags.map((flag) => flag.code)).toContain('upfront_payment');
    expect(result.verified).toBe(false);
  });

  it('flags early requests for sensitive personal or banking details', () => {
    const result = screenRecruiterMessage({ message: 'Please send your SSN and bank account number before the interview.' });
    expect(result.level).toBe('high-risk');
    expect(result.flags.map((flag) => flag.code)).toContain('sensitive_information');
  });

  it('flags fake check-style equipment schemes', () => {
    const result = screenRecruiterMessage({ message: 'Deposit our check and buy equipment using the money.' });
    expect(result.flags.map((flag) => flag.code)).toContain('check_scheme');
    expect(result.level).toBe('high-risk');
  });

  it('marks urgency and off-platform messaging as warnings, not proof', () => {
    const result = screenRecruiterMessage({ message: 'Contact me on WhatsApp immediately about this job.' });
    expect(result.level).toBe('review');
    expect(result.flags.map((flag) => flag.code)).toEqual(expect.arrayContaining(['off_platform','urgency']));
  });

  it('recognizes free email providers without conflating them with verified fraud', () => {
    const result = screenRecruiterMessage({ message: 'Please apply to our role.', senderEmail: 'recruiter@gmail.com' });
    expect(result.level).toBe('review');
    expect(result.flags.map((flag) => flag.code)).toContain('personal_email');
  });

  it('compares employer domains on label boundaries and permits employer subdomains', () => {
    const same = screenRecruiterMessage({message:'Apply online.',senderEmail:'jobs@hr.company.com',officialEmployerWebsite:'https://company.com/careers'});
    expect(same.flags.map((flag) => flag.code)).not.toContain('domain_mismatch');
    const different = screenRecruiterMessage({message:'Apply online.',senderEmail:'jobs@company.com.evil.org',officialEmployerWebsite:'company.com'});
    expect(different.flags.map((flag) => flag.code)).toContain('domain_mismatch');
  });

  it('does not mistake a message with no obvious risk signals for verified authenticity', () => {
    const result = screenRecruiterMessage({ message: 'We would like to invite you to apply for a Staff Accountant role. No fees required.' });
    expect(result.level).toBe('inconclusive');
    expect(result.flags).toEqual([]);
    expect(result.verified).toBe(false);
  });

  it('does not claim domain validation when no independently sourced employer domain was supplied', () => {
    const result = screenRecruiterMessage({message:'You may submit an application.',senderEmail:'recruiter@unknownagency.example'});
    expect(result.verified).toBe(false);
    expect(result.flags.map((flag)=>flag.code)).not.toContain('domain_mismatch');
  });
});
