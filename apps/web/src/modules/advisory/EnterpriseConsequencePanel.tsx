import { useState } from 'react';
import {
  type FifthDimensionFutureId,
  evaluateFifthDimensionFutures
} from './enterpriseFifthDimensionModel';
import { type SixDimensionPathId } from './enterpriseSixDimensionModel';
import {
  buildConsequenceTrace,
  CONSEQUENCE_FUTURES,
  CONSEQUENCE_PATHS
} from './enterpriseConsequenceTrace';
import './enterpriseConsequence.css';

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(value);
const number = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);

/** Visualizes the existing hypothetical models; never writes data or executes jobs. */
export function EnterpriseConsequencePanel({
  futures
}: {
  futures: ReturnType<typeof evaluateFifthDimensionFutures>;
}) {
  const [futureId, setFutureId] = useState<FifthDimensionFutureId>('baseline');
  const [pathId, setPathId] = useState<SixDimensionPathId>('governed-rpa');
  const trace = buildConsequenceTrace(futures, futureId, pathId);
  return <section id="automation-consequence" aria-labelledby="automation-consequence-title" className="consequence-explorer">
    <div>
      <p className="eyebrow">ATLAS 777 · Decision & Consequence Explorer</p>
      <h3 id="automation-consequence-title">From choice to modeled consequence</h3>
      <p>Inspired by the visual language of cause and effect: inputs → operating choice → modeled result. This is a business-planning metaphor, not a spiritual judgment, a law of physics, or a prediction.</p>
    </div>
    <div className="consequence-filters">
      <label htmlFor="consequence-future">Select a hypothetical future
        <select id="consequence-future" value={futureId} onChange={(event) => setFutureId(event.target.value as FifthDimensionFutureId)}>
          {CONSEQUENCE_FUTURES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <label htmlFor="consequence-path">Select an operating path
        <select id="consequence-path" value={pathId} onChange={(event) => setPathId(event.target.value as SixDimensionPathId)}>
          {CONSEQUENCE_PATHS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
    </div>
    {trace ? <>
      <figure className="consequence-figure">
        <svg className="consequence-diagram" viewBox="0 0 640 218" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="consequence-flow" x1="0" x2="1">
              <stop offset="0%" stopColor="#6bb6ef" />
              <stop offset="50%" stopColor="#efca72" />
              <stop offset="100%" stopColor="#76dbc7" />
            </linearGradient>
          </defs>
          <path d="M112 105 C177 24 236 185 320 105 S462 24 530 105" fill="none" stroke="url(#consequence-flow)" strokeWidth="3" />
          <path d="M102 105H538" fill="none" stroke="#ffffff" strokeOpacity=".12" strokeDasharray="4 9" />
          {[112, 320, 530].map((x, index) => <g key={x}>
            <circle cx={x} cy="105" r="65" fill="none" stroke={index === 2 ? '#76dbc7' : '#a6c9ff'} strokeOpacity=".22" strokeDasharray="3 10" />
            <circle cx={x} cy="105" r="46" fill="#0a2033" stroke={index === 1 ? '#efca72' : '#7ac9df'} strokeWidth="1.8" />
            <circle cx={x} cy="105" r="31" fill="none" stroke={index === 1 ? '#efca72' : '#7ac9df'} strokeOpacity=".35" />
            <circle cx={x} cy="105" r="5" fill={index === 1 ? '#efca72' : '#76dbc7'} />
          </g>)}
          <g fill="#eaf7ff" fontSize="15" textAnchor="middle">
            <text x="112" y="188">INPUT</text><text x="320" y="188">CHOICE</text><text x="530" y="188">MODEL</text>
          </g>
        </svg>
        <figcaption>
          <strong>{trace.futureLabel}</strong> → <strong>{trace.path.label}</strong> → <strong>{money(trace.path.operatingCost)}/month</strong>, based on the current editable assumptions.
        </figcaption>
      </figure>
      <div className="consequence-metrics" aria-live="polite" aria-atomic="true">
        <article><span>Modeled monthly operating cost</span><strong>{money(trace.path.operatingCost)}</strong></article>
        <article><span>Human hours per month</span><strong>{number(trace.path.humanHours)} h</strong></article>
        <article><span>Difference vs manual baseline</span><strong>{trace.differenceFromManual >= 0 ? 'Lower by ' : 'Higher by '}{money(Math.abs(trace.differenceFromManual))}</strong></article>
        <article><span>Modeled exception cases</span><strong>{trace.path.projectedExceptions === null ? 'Not modeled' : number(trace.path.projectedExceptions)}</strong></article>
      </div>
      <p className="consequence-safety"><strong>SIMULATION · NOT LIVE.</strong> Calculated from editable assumptions, not verified actuals. {trace.restrictedProcesses.length} restricted process categories retain their existing human approval and authorization gates. No financial transaction, payroll, accounting posting or RPA execution is triggered.</p>
    </> : <p role="alert" className="consequence-safety">The selected scenario lacks valid simulation evidence. Results are blocked.</p>}
  </section>;
}
