export type ContactType = 'employer' | 'agency' | 'website' | 'career_source';
export type ContactMethod = 'online' | 'email' | 'telephone' | 'in_person' | 'fax' | 'other';
export type VerificationStatus = 'verified' | 'partial' | 'outside_week' | 'duplicate' | 'unsupported';

export interface EvidenceReference {
  sourceType: 'gmail' | 'manual' | 'file' | 'other';
  sourceId?: string;
  capturedAt: string;
  factPaths: string[];
  conflicts?: string[];
}

export interface WorkSearchRecord {
  id: string;
  claimWeekStart: string;
  claimWeekEnd: string;
  contactDate: string;
  contactType: ContactType;
  contactMethod: ContactMethod;
  employerName: string;
  referralSource?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  websiteUrl?: string;
  emailAddress?: string;
  telephone?: string;
  fax?: string;
  personContacted?: string;
  workType: string;
  jobTitle?: string;
  referenceNumber?: string;
  result: string;
  notes?: string;
  evidence: EvidenceReference[];
  verificationStatus: VerificationStatus;
}

export interface WorkSearchValidationResult {
  record: WorkSearchRecord;
  status: VerificationStatus;
  ready: boolean;
  issues: string[];
}

export interface WorkSearchBatchValidationResult {
  records: WorkSearchValidationResult[];
  readyCount: number;
}
