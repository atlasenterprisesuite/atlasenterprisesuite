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
  },
  {
    id:'PDG-KK-GLUON-CMS-2025',experiment:'PDG',model:'warped-KK-gluon',
    observable:'KK gluon mass in CMS ttbar analysis',
    sourceUrl:'https://pdg.lbl.gov/2025/reviews/rpp2025-rev-extra-dimensions.pdf',
    publishedAt:'2025-01-01',confidenceLevel:0.95,boundTeV:4.55,
    boundKind:'lower-mass-exclusion',
    benchmark:'CMS KK gluon implementation in ttbar channels; cannot be compared directly with ATLAS implementation',
    dataset:'36 fb^-1, pp 13 TeV, as reviewed by PDG',
    sourceVersion:'PDG 2025 extra dimensions review',
    uncertaintyNote:'Review reports exclusion for specified model; original confidence convention and assumptions require cross-check before quantitative reinterpretation.'
  }
] as const;
