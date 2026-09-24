export type InsuranceVerificationScope = 'insurance_access' | 'member_policy';

export type InsuranceChallengeState = 'active' | 'expired' | 'consumed' | 'locked';

export type ResendDecision =
  | { allowed: true; reason: null }
  | { allowed: false; reason: 'resend_cooldown' | 'resend_limit_reached' };
