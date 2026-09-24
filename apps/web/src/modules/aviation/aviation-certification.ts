import type { AviationEvidenceRecord } from './aviation-evidence';

export type AviationCertificationStage =
  | 'announced'
  | 'application'
  | 'accepted'
  | 'testing'
  | 'review'
  | 'approved'
  | 'operational'
  | 'suspended'
  | 'unknown';

const VALID_STAGES = new Set<AviationCertificationStage>([
  'announced',
  'application',
  'accepted',
  'testing',
  'review',
  'approved',
  'operational',
  'suspended'
]);

export function deriveCertificationStage(
  records: readonly AviationEvidenceRecord[]
): AviationCertificationStage {
  const authorityStages = records
    .filter((record) =>
      record.claimKey === 'certification.stage'
      && record.sourceType === 'regulator'
      && record.trustClass === 'primary_authority'
    )
    .map((record) => record.claimValue.trim().toLocaleLowerCase())
    .filter((value): value is Exclude<AviationCertificationStage, 'unknown'> =>
      VALID_STAGES.has(value as AviationCertificationStage)
    );

  if (authorityStages.length === 0) return 'unknown';

  const uniqueStages = new Set(authorityStages);
  if (uniqueStages.size !== 1) return 'unknown';

  return authorityStages[0];
}
