export type AviationCategory =
  | 'urban'
  | 'regional'
  | 'personal'
  | 'cargo'
  | 'medical'
  | 'security'
  | 'exploration'
  | 'group'
  | 'agriculture'
  | 'hybrid';

export type AviationConcept = {
  id: string;
  slug: string;
  modelName: string;
  category: AviationCategory;
  categoryLabel: string;
  intendedUse: string;
  summary: string;
  designStatus: 'concept';
  metrics: {
    speedKph: number | null;
    rangeKm: number | null;
    payloadKg: number | null;
    priceUsd: number | null;
    valuationUsd: number | null;
  };
  certification: {
    status: 'unverified';
    authority: string | null;
    lastVerifiedAt: string | null;
  };
  investment: {
    status: 'not_configured';
    sharePriceUsd: number | null;
    minimumInvestmentUsd: number | null;
    officialSourceUrl: string | null;
    lastVerifiedAt: string | null;
  };
};
