/** Curated published bounds, not particle observations. Exact benchmark and statistical scope matter. */
export type ExperimentalLimit = {
  id: string; experiment: 'ATLAS'|'CMS'|'PDG'; model: string; observable: string;
  sourceUrl: string; publishedAt: string; confidenceLevel: number;
  boundTeV: number; boundKind: 'excluded-threshold-up-to'|'lower-mass-exclusion';
  benchmark: string; dataset: string; sourceVersion: string; uncertaintyNote: string;
};
export const EXPERIMENTAL_LIMITS: readonly ExperimentalLimit[] = [
  {
    id:'ATLAS-QBH-RUN3-2026',experiment:'ATLAS',model:'QBH-extra-dimensions',
    observable:'lepton+jet QBH production threshold',
    sourceUrl:'https://www.atlas.cern/Updates/Briefing/Quantum-Black-Holes-Run3',
    publishedAt:'2026-09-24',confidenceLevel:0.95,boundTeV:9.4,
    boundKind:'excluded-threshold-up-to',
    benchmark:'Specific QBH extra-dimensional model scenarios; not a universal bound on extra dimensions',
    dataset:'164 fb^-1, pp 13.6 TeV, Run 3 (2022–2024)',
    sourceVersion:'ATLAS briefing 2026-09-24',
    uncertaintyNote:'95% CL exclusion depends on signal model, backgrounds and systematic treatment; inspect underlying paper for full parameter dependence.'
  }
] as const;
