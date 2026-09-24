export type OracleReadingType = 'daily' | 'love' | 'money' | 'work' | 'emotional' | 'spiritual' | 'full';

export type OracleCardCategory = 'trust' | 'intuition' | 'acceptance' | 'inner-light' | 'guidance' | 'peace';

export type OracleCard = {
  id: string;
  slug: string;
  title: string;
  shortMessage: string;
  longMessage: string;
  category: OracleCardCategory;
};

export type OracleSpreadPosition = {
  key: string;
  label: string;
};

export type OracleInterpretationItem = {
  position: OracleSpreadPosition;
  card: OracleCard;
  reflection: string;
};
